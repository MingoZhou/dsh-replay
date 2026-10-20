/**
 * dsh-replay — host half.
 *
 * Registers a small read-only HTTP API on the harness web server that the
 * browser half (and nothing else) consumes:
 *
<<<<<<< HEAD
 *   GET /replay/api/sessions            → { sessions: [{ header, title, live }] }
 *   GET /replay/api/session/<id>        → { header, events }
 *   GET /replay/api/summary?limit=30    → aggregate stats for the dashboard
 *   GET /replay/api/viewer.js           → standalone viewer bundle
 *
 * Reads go through `ctx.sessionQuery` (live-preferred corpus), so an open
 * session replays with its in-memory state, not a stale disk artifact.
 *
 * The API is intentionally loopback-only by default: session logs can contain
 * secrets, and this route is registered directly on the web server rather than
 * through the authenticated Connection fetch bridge.
=======
 *   GET /replay/api/sessions            → { sessions: [{ header, title }] }
 *   GET /replay/api/session/<id>        → { header, events }
 *
 * Reads go through `ctx.sessionQuery` (live-preferred corpus), so an open
 * session replays with its in-memory state, not a stale disk artifact.
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
 */
import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
<<<<<<< HEAD
import { auditSession, buildTimeline, fromInspection } from './core/index.js'
import type { ParsedSession, SessionEvent, SessionHeader, StorageRecord } from './core/types.js'
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

export const name = 'dsh-replay'

export const inject = ['webServer', 'sessionQuery']

export interface Config {
  /** URL prefix for the replay API (exact-prefix route). */
  routePrefix?: string
<<<<<<< HEAD
  /** Allow non-loopback clients. Off by default because the route is unauthenticated. */
  allowRemote?: boolean
  /** Maximum sessions included in one dashboard summary request. */
  summaryLimit?: number
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

interface SessionQueryLike {
  listSessions: (signal?: AbortSignal) => Promise<unknown[]>
  readSession: (sessionId: string) => Promise<unknown>
  readTitleSnapshots?: (ids: string[], signal?: AbortSignal) => Promise<unknown[]>
<<<<<<< HEAD
  readTitle?: (id: string, signal?: AbortSignal) => Promise<unknown>
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

interface WebServerLike {
  register: (route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }) => () => void
}

<<<<<<< HEAD
export interface SessionEntry {
  header: Record<string, unknown>
  title?: string
  live?: boolean
}

export interface SessionSummary {
  header: Record<string, unknown>
  title?: string
  live?: boolean
  summary?: {
    events: number
    turns: number
    steps: number
    toolCalls: number
    toolErrors: number
    durationMs: number
    models: string[]
    tokens: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      reasoning: number
      billedInput: number
    }
    modelTotals: Record<string, {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      reasoning: number
      billedInput: number
    }>
    findings: number
    critical: number
    serious: number
    warning: number
    info: number
  }
  error?: string
}

function json(res: ServerResponse, status: number, body: unknown, head = false): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(head ? undefined : JSON.stringify(body))
=======
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

/** Pull a SessionHeader-shaped object out of whatever record shape the engine returns. */
function headerOf(record: unknown): Record<string, unknown> | undefined {
  for (const candidate of [get(record, 'header'), get(record, 'meta'), record]) {
    if (typeof get(candidate, 'id') === 'string' && typeof get(candidate, 'createdAt') === 'number') {
      return candidate as Record<string, unknown>
    }
  }
  return undefined
}

<<<<<<< HEAD
/** Titles may arrive as a string, `{ title }`, or a settled snapshot wrapper. */
function titleOf(record: unknown, depth = 4): string | undefined {
  if (typeof record === 'string') return record === '' ? undefined : record
  if (typeof record !== 'object' || record === null || depth < 0) return undefined
  const direct = (record as Record<string, unknown>)['title']
  if (typeof direct === 'string' && direct.length > 0) return direct
  for (const key of ['value', 'session', 'meta']) {
    const found = titleOf((record as Record<string, unknown>)[key], depth - 1)
    if (found !== undefined) return found
=======
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
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  }
  return undefined
}

<<<<<<< HEAD
function eventsOf(record: unknown): StorageRecord[] {
  const events = get(record, 'events') ?? get(get(record, 'session'), 'events')
  return Array.isArray(events) ? (events as StorageRecord[]) : []
}

function isLoopback(address: string | undefined): boolean {
  if (address === undefined) return false
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1' ||
    address.startsWith('127.')
  )
}

function hostIsLoopback(host: string | undefined): boolean {
  if (host === undefined || host === '') return true
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name.startsWith('127.')
}

/** Reject cross-site and (by default) non-loopback requests before reading data. */
function allowed(req: IncomingMessage, allowRemote: boolean): boolean {
  if (!allowRemote && !isLoopback(req.socket.remoteAddress)) return false
  if (!allowRemote && !hostIsLoopback(req.headers.host)) return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    // A static Desktop shell may issue same-process requests with a file://
    // or null origin. The loopback checks above already constrain those.
    if (origin === 'null' || origin.startsWith('file://')) return true
    try {
      const originUrl = new URL(origin)
      if (req.headers.host !== undefined && originUrl.host !== req.headers.host) return false
    } catch {
      return false
    }
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  return true
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await task(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

export function apply(ctx: Context, config: Config = {}): void {
  const prefix = config.routePrefix ?? '/replay/api'
  const allowRemote = config.allowRemote === true
  const summaryLimit = Math.min(Math.max(config.summaryLimit ?? 30, 1), 100)
  const webServer = (ctx as unknown as { webServer: WebServerLike }).webServer
  const sessionQuery = (ctx as unknown as { sessionQuery: SessionQueryLike }).sessionQuery

  const viewerCache = new Map<string, string>()
  const summaryCache = new Map<string, { key: string; at: number; value: SessionSummary }>()
  const SUMMARY_TTL_MS = 30_000

  const loadEntries = async (
    options: { withTitles?: boolean } = {},
  ): Promise<{ entries: SessionEntry[]; titles: Map<string, string> }> => {
    const withTitles = options.withTitles !== false
    const records = await sessionQuery.listSessions()
    const entries: SessionEntry[] = []
    for (const record of records) {
      const header = headerOf(record)
      if (header === undefined) continue
      const id = String(header['id'])
      const title = titleOf(record)
      const live = get(record, 'live')
      entries.push({ header, ...(title !== undefined ? { title } : {}), ...(typeof live === 'boolean' ? { live } : {}) })
    }

    const titles = new Map<string, string>()
    for (const entry of entries) {
      if (entry.title !== undefined) titles.set(String(entry.header['id']), entry.title)
    }

    if (withTitles && sessionQuery.readTitleSnapshots !== undefined) {
      try {
        const snapshots = await sessionQuery.readTitleSnapshots(
          entries.map(entry => String(entry.header['id'])),
        )
        for (const snapshot of snapshots) {
          // Current engines return { status, value: { session, title } }.
          const value = get(snapshot, 'value') ?? snapshot
          const header = get(value, 'session') ?? get(value, 'header')
          const id = get(header, 'id')
          const title = titleOf(value)
          if (typeof id === 'string' && title !== undefined) titles.set(id, title)
        }
      } catch {
        /* titles are decoration — never fail the listing over them */
      }
    }

    // Per-id fallback for engines where the batch call misses. `readTitle`
    // returns a string on current engines; older ones returned an object.
    const readTitle = sessionQuery.readTitle
    if (withTitles && readTitle !== undefined) {
      await Promise.all(
        entries
          .filter(entry => !titles.has(String(entry.header['id'])))
          .map(async entry => {
            try {
              const id = String(entry.header['id'])
              const result = await readTitle.call(sessionQuery, id)
              const title = titleOf(result)
              if (title !== undefined) titles.set(id, title)
            } catch {
              /* decoration only */
            }
          }),
      )
    }

    for (const entry of entries) {
      const id = String(entry.header['id'])
      const title = titles.get(id)
      if (title !== undefined) entry.title = title
    }
    return { entries, titles }
  }

  const summarize = async (entry: SessionEntry): Promise<SessionSummary> => {
    const id = String(entry.header['id'])
    try {
      const snapshot = await sessionQuery.readSession(id)
      const header = headerOf(snapshot) ?? headerOf(get(snapshot, 'session')) ?? entry.header
      const records = eventsOf(snapshot)
      const lastSeq = records.length > 0 ? Number(get(records.at(-1), 'seq') ?? -1) : -1
      const key = `${id}:${lastSeq}`
      const cached = summaryCache.get(id)
      if (cached !== undefined && cached.key === key && Date.now() - cached.at < SUMMARY_TTL_MS) {
        return cached.value
      }
      const parsed: ParsedSession = fromInspection(
        header as unknown as SessionHeader,
        records,
      )
      const model = buildTimeline(parsed)
      const report = auditSession(parsed)
      const value: SessionSummary = {
        header,
        ...(entry.title !== undefined ? { title: entry.title } : model.title !== undefined ? { title: model.title } : {}),
        ...(entry.live !== undefined ? { live: entry.live } : {}),
        summary: {
          events: model.eventCount,
          turns: model.turns.length,
          steps: model.turns.reduce((sum, turn) => sum + turn.steps.length, 0),
          toolCalls: model.toolCalls.length,
          toolErrors: model.toolCalls.filter(call => call.error !== undefined).length,
          durationMs: model.durationMs,
          models: model.models,
          tokens: model.totals,
          modelTotals: model.modelTotals,
          findings: report.findings.length,
          critical: report.counts.critical,
          serious: report.counts.serious,
          warning: report.counts.warning,
          info: report.counts.info,
        },
      }
      summaryCache.set(id, { key, at: Date.now(), value })
      // Bound the cache; dashboard reads only a page of recent sessions.
      while (summaryCache.size > 100) {
        const oldest = summaryCache.keys().next().value
        if (oldest === undefined) break
        summaryCache.delete(oldest)
      }
      return value
    } catch (error) {
      return {
        header: entry.header,
        ...(entry.title !== undefined ? { title: entry.title } : {}),
        ...(entry.live !== undefined ? { live: entry.live } : {}),
        error: String(error),
      }
    }
  }

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!allowed(req, allowRemote)) {
      json(res, 403, { error: 'forbidden' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rest = url.pathname.slice(prefix.length).replace(/^\//u, '')
    const head = req.method === 'HEAD'
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'method not allowed' }, head)
        return
      }
      if (rest === 'sessions') {
        const { entries } = await loadEntries()
        json(res, 200, { sessions: entries }, head)
        return
      }
      if (rest === 'summary') {
        const limitParam = Number(url.searchParams.get('limit'))
        const limit = Number.isFinite(limitParam) && limitParam > 0
          ? Math.min(Math.floor(limitParam), summaryLimit)
          : summaryLimit
        const { entries } = await loadEntries({ withTitles: false })
        const selected = entries.slice(0, limit)
        const summaries = await mapLimit(selected, 4, summarize)
        json(res, 200, { sessions: summaries, total: entries.length }, head)
=======
export function apply(ctx: Context, config: Config = {}): void {
  const prefix = config.routePrefix ?? '/replay/api'
  const webServer = (ctx as unknown as { webServer: WebServerLike }).webServer
  const sessionQuery = (ctx as unknown as { sessionQuery: SessionQueryLike }).sessionQuery

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rest = url.pathname.slice(prefix.length).replace(/^\//u, '')
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      if (rest === 'sessions') {
        const records = await sessionQuery.listSessions()
        const headers = records.map(headerOf).filter((h): h is Record<string, unknown> => h !== undefined)
        const titles = new Map<string, string>()
        if (sessionQuery.readTitleSnapshots !== undefined) {
          try {
            const snapshots = await sessionQuery.readTitleSnapshots(headers.map(h => String(h['id'])))
            snapshots.forEach((snapshot, i) => {
              const title = titleOf(snapshot)
              const id = headers[i]?.['id']
              if (title !== undefined && typeof id === 'string') titles.set(id, title)
            })
          } catch {
            /* titles are decoration — never fail the listing over them */
          }
        }
        // Per-id fallback for engines where the batch call misses.
        const readTitle = (sessionQuery as { readTitle?: (id: string) => Promise<unknown> }).readTitle
        if (readTitle !== undefined) {
          await Promise.all(
            headers
              .filter(h => !titles.has(String(h['id'])))
              .map(async h => {
                try {
                  const title = titleOf(await readTitle.call(sessionQuery, String(h['id'])))
                  if (title !== undefined) titles.set(String(h['id']), title)
                } catch {
                  /* decoration only */
                }
              }),
          )
        }
        json(res, 200, {
          sessions: headers.map(h => ({ header: h, title: titles.get(String(h['id'])) })),
        })
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        return
      }
      if (rest === 'viewer.js') {
        // The standalone viewer bundle (sibling artifact of this module),
        // inlined into exported HTML files by the browser half.
<<<<<<< HEAD
        let source = viewerCache.get('viewer')
        if (source === undefined) {
          source = await readFile(new URL('./viewer.js', import.meta.url), 'utf8')
          viewerCache.set('viewer', source)
        }
        res.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
        })
        res.end(head ? undefined : source)
=======
        const source = await readFile(new URL('./viewer.js', import.meta.url), 'utf8')
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
        res.end(source)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        return
      }
      if (rest.startsWith('session/')) {
        const id = decodeURIComponent(rest.slice('session/'.length))
        const snapshot = await sessionQuery.readSession(id)
        const header = headerOf(snapshot) ?? headerOf(get(snapshot, 'session'))
<<<<<<< HEAD
        if (header === undefined) {
          json(res, 404, { error: 'session not found' }, head)
          return
        }
        json(res, 200, { header, events: eventsOf(snapshot) }, head)
        return
      }
      json(res, 404, { error: 'unknown replay endpoint' }, head)
    } catch (error) {
      // Do not leak filesystem paths or provider details to the browser.
      console.error('[dsh-replay] request failed', error)
      json(res, 500, { error: 'internal error' }, head)
=======
        const events =
          get(snapshot, 'events') ?? get(get(snapshot, 'session'), 'events') ?? []
        if (header === undefined) {
          json(res, 404, { error: 'session not found' })
          return
        }
        json(res, 200, { header, events })
        return
      }
      json(res, 404, { error: 'unknown replay endpoint' })
    } catch (error) {
      json(res, 500, { error: String(error) })
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    }
  }

  ctx.effect(
    () => webServer.register({ kind: 'prefix', path: prefix, handler }),
    'dsh-replay: http api',
  )
}
