/**
 * dsh-replay — host half.
 *
 * Registers a small read-only HTTP API on the harness web server that the
 * browser half (and nothing else) consumes:
 *
 *   GET /replay/api/sessions            → { sessions: [{ header, title }] }
 *   GET /replay/api/session/<id>        → { header, events }
 *
 * Reads go through `ctx.sessionQuery` (live-preferred corpus), so an open
 * session replays with its in-memory state, not a stale disk artifact.
 */
import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'

export const name = 'dsh-replay'

export const inject = ['webServer', 'sessionQuery']

export interface Config {
  /** URL prefix for the replay API (exact-prefix route). */
  routePrefix?: string
}

interface SessionQueryLike {
  listSessions: (signal?: AbortSignal) => Promise<unknown[]>
  readSession: (sessionId: string) => Promise<unknown>
  readTitleSnapshots?: (ids: string[], signal?: AbortSignal) => Promise<unknown[]>
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
  for (const candidate of [get(record, 'header'), get(record, 'meta'), record]) {
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
        const snapshot = await sessionQuery.readSession(id)
        const header = headerOf(snapshot) ?? headerOf(get(snapshot, 'session'))
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
    }
  }

  ctx.effect(
    () => webServer.register({ kind: 'prefix', path: prefix, handler }),
    'dsh-replay: http api',
  )
}
