/** Data access for the UI — one HTTP implementation, one in-memory implementation (demo, exported HTML). */
import { fromInspection, parseSessionJsonl } from '../core/decode.js'
import { summarizeSession, type SessionSummary } from '../core/summary.js'
import type { ParsedSession, SessionHeader, StorageRecord } from '../core/types.js'

export interface SessionEntry {
  header: SessionHeader
  title?: string
  /** The session is attached in the running harness (may still grow). */
  live?: boolean
  /** First-prompt identity, for inferring fork families (filled from summaries). */
  rootKey?: string
  inheritedEventCount?: number
}

export interface SessionDelta {
  events: ParsedSession['events']
  live?: boolean
}

export interface ReplayApi {
  listSessions: () => Promise<SessionEntry[]>
  getSession: (id: string) => Promise<ParsedSession>
  /** Events appended after `sinceSeq` — drives live follow. Absent in static modes. */
  getSessionSince?: (id: string, sinceSeq: number) => Promise<SessionDelta>
  /** Compact per-session aggregates for the cross-session dashboard. */
  getSummaries: () => Promise<{ summaries: SessionSummary[]; truncated?: boolean; total?: number }>
  /** Source of the standalone viewer bundle, for HTML export (optional). */
  getViewerSource?: () => Promise<string>
}

/** Actions only the running harness can perform; absent in the demo and in exported files. */
export interface HostBridge {
  /** Fork `sessionId` at `atSeq` (inclusive) into a new session; resolves to the child id. */
  fork?: (sessionId: string, atSeq: number) => Promise<string>
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
      inheritedEventCount?: number
    }
    return fromInspection(body.header, body.events, body.inheritedEventCount)
  }

  async getSessionSince(id: string, sinceSeq: number): Promise<SessionDelta> {
    const body = (await this.fetchJson(`/session/${encodeURIComponent(id)}?since=${sinceSeq}`)) as {
      header: SessionHeader
      events: StorageRecord[]
      live?: boolean
    }
    return { events: fromInspection(body.header, body.events).events, live: body.live }
  }

  async getSummaries(): Promise<{ summaries: SessionSummary[]; truncated?: boolean; total?: number }> {
    return (await this.fetchJson('/summaries')) as { summaries: SessionSummary[]; truncated?: boolean; total?: number }
  }

  async getViewerSource(): Promise<string> {
    const response = await fetch(`${this.base}/viewer.js`)
    if (!response.ok) throw new Error(`viewer bundle: HTTP ${response.status}`)
    return response.text()
  }
}

/** Demo/testing/export implementation over already-available sessions. */
export class StaticReplayApi implements ReplayApi {
  private readonly sessions = new Map<string, ParsedSession>()
  private readonly titles = new Map<string, string>()
  private summaries?: SessionSummary[]
  /** Optional URL of the viewer bundle for HTML export (demo mode). */
  viewerUrl?: string
  getViewerSource?: () => Promise<string>

  constructor(logs: { jsonl: string; title?: string }[]) {
    for (const { jsonl, title } of logs) {
      const parsed = parseSessionJsonl(jsonl)
      this.sessions.set(parsed.header.id, parsed)
      if (title !== undefined) this.titles.set(parsed.header.id, title)
    }
  }

  /** Enable HTML export by pointing at a served copy of the viewer bundle. */
  withViewer(url: string): this {
    this.viewerUrl = url
    this.getViewerSource = async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`viewer bundle: HTTP ${response.status}`)
      return response.text()
    }
    return this
  }

  /** Build directly from already-decoded sessions (exported HTML, tooling). */
  static fromParsed(
    list: { header: ParsedSession['header']; events: ParsedSession['events']; title?: string; inheritedEventCount?: number }[],
  ): StaticReplayApi {
    const api = new StaticReplayApi([])
    for (const { header, events, title, inheritedEventCount } of list) {
      api.sessions.set(header.id, { header, events, malformed: [], inheritedEventCount })
      if (title !== undefined) api.titles.set(header.id, title)
    }
    return api
  }

  async listSessions(): Promise<SessionEntry[]> {
    return [...this.sessions.values()].map(s => ({ header: s.header, title: this.titles.get(s.header.id) }))
  }

  async getSession(id: string): Promise<ParsedSession> {
    const session = this.sessions.get(id)
    if (session === undefined) throw new Error(`unknown session ${id}`)
    return session
  }

  async getSummaries(): Promise<{ summaries: SessionSummary[] }> {
    this.summaries ??= [...this.sessions.values()].map(s => summarizeSession(s, { title: this.titles.get(s.header.id) }))
    return { summaries: this.summaries }
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function formatPercent(ratio: number, digits = 0): string {
  return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : '—'
}

export function formatClock(time: number, startTime: number): string {
  const s = Math.max(0, Math.floor((time - startTime) / 1000))
  const hh = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatDateTime(time: number): string {
  if (!Number.isFinite(time) || time <= 0) return ''
  const d = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
