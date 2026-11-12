/**
 * dsh-replay — host half.
 *
 * Registers a small read-only HTTP API on the harness web server that the
 * browser half (and nothing else) consumes:
 *
 *   GET /replay/api/sessions                 → { sessions: [{ header, title, live, persisted }] }
 *   GET /replay/api/session/<id>             → { header, events, inheritedEventCount, live }
 *   GET /replay/api/session/<id>?since=<seq> → same, only events with seq > since (live follow)
 *   GET /replay/api/summaries[?limit=n]      → { summaries: SessionSummary[], truncated }
 *   GET /replay/api/viewer.js                → standalone viewer bundle (HTML export)
 *
 * Reads go through `ctx.sessionQuery` (live-preferred corpus), so an open
 * session replays with its in-memory state, not a stale disk artifact.
 * Summaries are folded here and cached, so the cross-session dashboard never
 * ships whole event logs to the browser.
 */
import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromInspection } from './core/decode.js'
import { summarizeSession, type SessionSummary } from './core/summary.js'
import type { SessionHeader, StorageRecord } from './core/types.js'

export const name = 'dsh-replay'

export const inject = ['webServer', 'sessionQuery']

export interface Config {
  /** URL prefix for the replay API (exact-prefix route). */
  routePrefix?: string
  /** Most recent sessions summarised for the dashboard (default 300). */
  summaryLimit?: number
}

interface SessionQueryLike {
  listSessions: (signal?: AbortSignal) => Promise<unknown[]>
  readSession: (sessionId: string) => Promise<unknown>
  readTitleSnapshots?: (ids: string[], signal?: AbortSignal) => Promise<unknown[]>
  readTitle?: (id: string) => Promise<unknown>
}

interface WebServerLike {
  register: (route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }) => () => void
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

/** Pull a SessionHeader-shaped object out of whatever record shape the engine returns. */
function headerOf(record: unknown): Record<string, unknown> | undefined {
  for (const candidate of [get(record, 'header'), get(record, 'session'), get(record, 'meta'), record]) {
    if (typeof get(candidate, 'id') === 'string' && typeof get(candidate, 'createdAt') === 'number') {
      return candidate as Record<string, unknown>
    }
  }
  return undefined
}

/** Depth-limited recursive search for a non-empty string `title` field. */
function titleOf(record: unknown, depth = 3): string | undefined {
  if (typeof record !== 'object' || record === null || depth < 0) return undefined
  const direct = (record as Record<string, unknown>)['title']
  if (typeof direct === 'string' && direct.length > 0) return direct
  for (const value of Object.values(record)) {
    if (typeof value === 'object' && value !== null) {
      const found = titleOf(value, depth - 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

interface ListedSession {
  header: Record<string, unknown>
  title?: string
  live: boolean
  persisted: boolean
}

export function apply(ctx: Context, config: Config = {}): void {
  const prefix = config.routePrefix ?? '/replay/api'
  const summaryLimit = config.summaryLimit ?? 300
  const webServer = (ctx as unknown as { webServer: WebServerLike }).webServer
  const sessionQuery = (ctx as unknown as { sessionQuery: SessionQueryLike }).sessionQuery

  const listSessions = async (): Promise<ListedSession[]> => {
    const records = await sessionQuery.listSessions()
    const listed: ListedSession[] = []
    for (const record of records) {
      const header = headerOf(record)
      if (header === undefined) continue
      listed.push({ header, live: get(record, 'live') === true, persisted: get(record, 'persisted') !== false })
    }
    const titles = new Map<string, string>()
    if (sessionQuery.readTitleSnapshots !== undefined) {
      try {
        const snapshots = await sessionQuery.readTitleSnapshots(listed.map(s => String(s.header['id'])))
        snapshots.forEach((snapshot, i) => {
          const title = titleOf(snapshot)
          const id = get(snapshot, 'sessionId') ?? listed[i]?.header['id']
          if (title !== undefined && typeof id === 'string') titles.set(id, title)
        })
      } catch {
        /* titles are decoration — never fail the listing over them */
      }
    }
    // Per-id fallback for engines where the batch call misses.
    if (sessionQuery.readTitle !== undefined) {
      await Promise.all(
        listed
          .filter(s => !titles.has(String(s.header['id'])))
          .map(async s => {
            try {
              const title = titleOf(await sessionQuery.readTitle!(String(s.header['id'])))
              if (title !== undefined) titles.set(String(s.header['id']), title)
            } catch {
              /* decoration only */
            }
          }),
      )
    }
    for (const s of listed) s.title = titles.get(String(s.header['id']))
    return listed
  }

  const readSession = async (
    id: string,
  ): Promise<{ header: Record<string, unknown>; events: unknown[]; inheritedEventCount?: number } | undefined> => {
    const snapshot = await sessionQuery.readSession(id)
    const header = headerOf(snapshot)
    if (header === undefined) return undefined
    const events = get(snapshot, 'events') ?? get(get(snapshot, 'session'), 'events') ?? []
    const inherited = get(snapshot, 'inheritedEventCount')
    return {
      header,
      events: Array.isArray(events) ? events : [],
      ...(typeof inherited === 'number' ? { inheritedEventCount: inherited } : {}),
    }
  }

  /** id → summary folded while the session was cold (`live: false`) or live. */
  const summaryCache = new Map<string, { live: boolean; at: number; summary: SessionSummary }>()
  const LIVE_TTL = 20_000

  const summaryFor = async (listed: ListedSession): Promise<SessionSummary | undefined> => {
    const id = String(listed.header['id'])
    const cached = summaryCache.get(id)
    if (cached !== undefined) {
      // A cold log is immutable; a live one is re-folded at most every LIVE_TTL.
      const fresh = listed.live ? Date.now() - cached.at < LIVE_TTL : !cached.live
      if (fresh) return { ...cached.summary, title: listed.title ?? cached.summary.title, live: listed.live }
    }
    const read = await readSession(id)
    if (read === undefined) return undefined
    const session = fromInspection(read.header as unknown as SessionHeader, read.events as StorageRecord[], read.inheritedEventCount)
    const summary = summarizeSession(session, { title: listed.title, live: listed.live })
    summaryCache.set(id, { live: listed.live, at: Date.now(), summary })
    return summary
  }

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rest = url.pathname.slice(prefix.length).replace(/^\//u, '')
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      if (rest === 'sessions') {
        json(res, 200, { sessions: await listSessions() })
        return
      }
      if (rest === 'summaries') {
        const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get('limit')) || summaryLimit))
        const all = (await listSessions()).sort(
          (a, b) => Number(b.header['createdAt']) - Number(a.header['createdAt']),
        )
        const picked = all.slice(0, limit)
        const summaries: SessionSummary[] = []
        // Small batches: a cold read decompresses a whole log.
        for (let i = 0; i < picked.length; i += 4) {
          const batch = await Promise.all(
            picked.slice(i, i + 4).map(async listed => {
              try {
                return await summaryFor(listed)
              } catch {
                return undefined // one unreadable log must not blank the dashboard
              }
            }),
          )
          for (const summary of batch) if (summary !== undefined) summaries.push(summary)
        }
        for (const id of summaryCache.keys()) {
          if (!all.some(s => s.header['id'] === id)) summaryCache.delete(id)
        }
        json(res, 200, { summaries, truncated: all.length > picked.length, total: all.length })
        return
      }
      if (rest === 'viewer.js') {
        // The standalone viewer bundle (sibling artifact of this module),
        // inlined into exported HTML files by the browser half.
        const source = await readFile(new URL('./viewer.js', import.meta.url), 'utf8')
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
        res.end(source)
        return
      }
      if (rest.startsWith('session/')) {
        const id = decodeURIComponent(rest.slice('session/'.length))
        const read = await readSession(id)
        if (read === undefined) {
          json(res, 404, { error: 'session not found' })
          return
        }
        const sinceRaw = url.searchParams.get('since')
        const since = sinceRaw === null ? undefined : Number(sinceRaw)
        const events =
          since === undefined || !Number.isFinite(since)
            ? read.events
            : read.events.filter(e => {
                // Packed legacy chunk rows carry `seq0`; ordinary events carry `seq`.
                const seq = get(e, 'seq') ?? get(e, 'seq0')
                return typeof seq === 'number' && seq > since
              })
        let live: boolean | undefined
        if (since !== undefined) {
          try {
            const records = await sessionQuery.listSessions()
            const record = records.find(r => headerOf(r)?.['id'] === id)
            live = get(record, 'live') === true
          } catch {
            live = undefined
          }
        }
        json(res, 200, {
          header: read.header,
          events,
          ...(read.inheritedEventCount === undefined ? {} : { inheritedEventCount: read.inheritedEventCount }),
          ...(live === undefined ? {} : { live }),
        })
        return
      }
      json(res, 404, { error: 'unknown replay endpoint' })
    } catch (error) {
      json(res, 500, { error: String(error) })
    }
  }

  ctx.effect(
    () => webServer.register({ kind: 'prefix', path: prefix, handler }),
    'dsh-replay: http api',
  )
}
