/** Data access for the UI — one HTTP implementation, one in-memory demo implementation. */
<<<<<<< HEAD
import { auditSession } from '../core/audit.js'
import { fromInspection, parseSessionJsonl } from '../core/decode.js'
import { buildTimeline } from '../core/timeline.js'
=======
import { fromInspection, parseSessionJsonl } from '../core/decode.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
import type { ParsedSession, SessionHeader, StorageRecord } from '../core/types.js'

export interface SessionEntry {
  header: SessionHeader
  title?: string
<<<<<<< HEAD
  live?: boolean
}

export interface SessionSummaryData {
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

export interface SessionSummaryEntry {
  header: SessionHeader
  title?: string
  live?: boolean
  summary?: SessionSummaryData
  error?: string
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

export interface ReplayApi {
  listSessions: () => Promise<SessionEntry[]>
  getSession: (id: string) => Promise<ParsedSession>
<<<<<<< HEAD
  getSummaries?: (limit?: number) => Promise<SessionSummaryEntry[]>
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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

<<<<<<< HEAD
  async getSummaries(limit = 30): Promise<SessionSummaryEntry[]> {
    const body = (await this.fetchJson(`/summary?limit=${limit}`)) as {
      sessions: SessionSummaryEntry[]
    }
    return body.sessions
  }

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
  static fromParsed(
    list: { header: ParsedSession['header']; events: ParsedSession['events']; title?: string }[],
  ): StaticReplayApi {
=======
  static fromParsed(list: { header: ParsedSession['header']; events: ParsedSession['events']; title?: string }[]): StaticReplayApi {
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
    return [...this.sessions.values()].map(session => ({
      header: session.header,
      title: this.titles.get(session.header.id),
=======
    return [...this.sessions.values()].map(s => ({
      header: s.header,
      title: this.titles.get(s.header.id),
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    }))
  }

  async getSession(id: string): Promise<ParsedSession> {
    const session = this.sessions.get(id)
    if (session === undefined) throw new Error(`unknown session ${id}`)
    return session
  }
<<<<<<< HEAD

  async getSummaries(limit = 30): Promise<SessionSummaryEntry[]> {
    const entries = await this.listSessions()
    return entries.slice(0, limit).map(entry => {
      const session = this.sessions.get(entry.header.id)
      if (session === undefined) return { header: entry.header, title: entry.title }
      const model = buildTimeline(session)
      const report = auditSession(session)
      return {
        header: entry.header,
        ...(entry.title !== undefined ? { title: entry.title } : {}),
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
    })
  }
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`
<<<<<<< HEAD
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
=======
  return `${Math.floor(m / 60)}h ${m % 60}m`
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

<<<<<<< HEAD
/** Clock offset from the session start: mm:ss, or h:mm:ss for long sessions. */
export function formatClock(time: number, startTime: number): string {
  const ms = Math.max(0, time - startTime)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Human relative time for the session picker ("3 days ago", "2 months ago"). */
export function formatRelativeTime(time: number, now = Date.now(), lang: 'en' | 'zh' = 'en'): string {
  if (!Number.isFinite(time) || time <= 0) return ''
  const diff = time - now
  const abs = Math.abs(diff)
  const locale = lang === 'zh' ? 'zh-CN' : 'en'
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < minute) return lang === 'zh' ? '刚刚' : 'just now'
  if (abs < hour) return formatter.format(Math.round(diff / minute), 'minute')
  if (abs < day) return formatter.format(Math.round(diff / hour), 'hour')
  if (abs < 30 * day) return formatter.format(Math.round(diff / day), 'day')
  if (abs < 365 * day) return formatter.format(Math.round(diff / (30 * day)), 'month')
  return formatter.format(Math.round(diff / (365 * day)), 'year')
=======
export function formatClock(time: number, startTime: number): string {
  const ms = time - startTime
  const s = Math.floor(ms / 1000)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
