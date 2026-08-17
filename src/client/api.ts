/** Data access for the UI — one HTTP implementation, one in-memory demo implementation. */
import { fromInspection, parseSessionJsonl } from '../core/decode.js'
import type { ParsedSession, SessionHeader, StorageRecord } from '../core/types.js'

export interface SessionEntry {
  header: SessionHeader
  title?: string
}

export interface ReplayApi {
  listSessions: () => Promise<SessionEntry[]>
  getSession: (id: string) => Promise<ParsedSession>
  /** Source of the standalone viewer bundle, for HTML export (optional). */
  getViewerSource?: () => Promise<string>
}

export class HttpReplayApi implements ReplayApi {
  constructor(private readonly base = '/replay/api') {}

  private async fetchJson(path: string): Promise<unknown> {
    const response = await fetch(`${this.base}${path}`)
    if (!response.ok) throw new Error(`replay api ${path}: HTTP ${response.status}`)
    return response.json()
  }

  async listSessions(): Promise<SessionEntry[]> {
    const body = (await this.fetchJson('/sessions')) as { sessions: SessionEntry[] }
    return body.sessions
  }

  async getSession(id: string): Promise<ParsedSession> {
    const body = (await this.fetchJson(`/session/${encodeURIComponent(id)}`)) as {
      header: SessionHeader
      events: StorageRecord[]
    }
    return fromInspection(body.header, body.events)
  }

  async getViewerSource(): Promise<string> {
    const response = await fetch(`${this.base}/viewer.js`)
    if (!response.ok) throw new Error(`viewer bundle: HTTP ${response.status}`)
    return response.text()
  }
}

/** Demo/testing implementation over raw JSONL texts keyed by session id. */
export class StaticReplayApi implements ReplayApi {
  private readonly sessions = new Map<string, ParsedSession>()
  private readonly titles = new Map<string, string>()
  /** Optional URL of the viewer bundle for HTML export (demo mode). */
  viewerUrl?: string

  constructor(logs: { jsonl: string; title?: string }[]) {
    for (const { jsonl, title } of logs) {
      const parsed = parseSessionJsonl(jsonl)
      this.sessions.set(parsed.header.id, parsed)
      if (title !== undefined) this.titles.set(parsed.header.id, title)
    }
  }

  /** Build directly from already-decoded sessions (exported HTML, tooling). */
  static fromParsed(list: { header: ParsedSession['header']; events: ParsedSession['events']; title?: string }[]): StaticReplayApi {
    const api = new StaticReplayApi([])
    for (const { header, events, title } of list) {
      api.sessions.set(header.id, { header, events, malformed: [] })
      if (title !== undefined) api.titles.set(header.id, title)
    }
    return api
  }

  async getViewerSource(): Promise<string> {
    if (this.viewerUrl === undefined) throw new Error('viewer bundle unavailable in this mode')
    const response = await fetch(this.viewerUrl)
    if (!response.ok) throw new Error(`viewer bundle: HTTP ${response.status}`)
    return response.text()
  }

  async listSessions(): Promise<SessionEntry[]> {
    return [...this.sessions.values()].map(s => ({
      header: s.header,
      title: this.titles.get(s.header.id),
    }))
  }

  async getSession(id: string): Promise<ParsedSession> {
    const session = this.sessions.get(id)
    if (session === undefined) throw new Error(`unknown session ${id}`)
    return session
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function formatClock(time: number, startTime: number): string {
  const ms = time - startTime
  const s = Math.floor(ms / 1000)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
