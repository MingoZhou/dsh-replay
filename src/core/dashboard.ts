/** Cross-session aggregation over `SessionSummary[]` for the dashboard view. */
import { priceBuckets, type PricingConfig } from './cost.js'
import type { ToolStat } from './insights.js'
import type { SessionSummary } from './summary.js'

export interface PricedSummary extends SessionSummary {
  /** Estimated cost in CNY under the supplied pricing. */
  cny: number
  totalTokens: number
}

export interface DayBucket {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string
  time: number
  sessions: number
  tokens: number
  cny: number
  /** CNY per model label, for the stacked bars. */
  byModel: Record<string, number>
}

export interface GroupRow {
  key: string
  sessions: number
  tokens: number
  cny: number
  durationMs: number
}

export interface Dashboard {
  sessions: PricedSummary[]
  totals: { sessions: number; tokens: number; cny: number; activeMs: number; toolCalls: number; toolErrors: number; cacheHitRate: number }
  days: DayBucket[]
  /** Model labels in stable (entity) order — drives series colors. */
  models: string[]
  byProject: GroupRow[]
  byModel: GroupRow[]
  top: PricedSummary[]
  tools: (ToolStat & { errorRate: number })[]
  /** activity[weekday 0=Mon..6][hour 0..23] = tokens. */
  activity: number[][]
}

export function priceSummary(summary: SessionSummary, pricing: PricingConfig): PricedSummary {
  const estimate = priceBuckets(summary.buckets, pricing)
  const t = summary.tokens
  return { ...summary, cny: estimate.cny, totalTokens: t.input + t.cacheRead + t.cacheWrite + t.output }
}

function dayKey(time: number): string {
  const d = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function projectName(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return '—'
  const parts = cwd.split(/[\\/]/u).filter(Boolean)
  return parts.at(-1) ?? cwd
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface Baseline {
  /** How many other sessions the medians come from. */
  n: number
  cny?: number
  tokens?: number
  activeMs?: number
  toolCalls?: number
}

/** Medians of the most recent `n` other root sessions — the "is this one unusual?" yardstick. */
export function baselineFor(sessions: PricedSummary[], currentId: string, n = 10): Baseline {
  const others = sessions
    .filter(s => s.id !== currentId && s.origin !== 'subagent' && s.totalTokens > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, n)
  return {
    n: others.length,
    cny: median(others.map(s => s.cny)),
    tokens: median(others.map(s => s.totalTokens)),
    activeMs: median(others.map(s => s.activeMs)),
    toolCalls: median(others.map(s => s.toolCalls)),
  }
}

export function buildDashboard(
  summaries: SessionSummary[],
  pricing: PricingConfig,
  range: { from?: number; to?: number } = {},
): Dashboard {
  const sessions = summaries
    .filter(s => (range.from === undefined || s.startTime >= range.from) && (range.to === undefined || s.startTime <= range.to))
    .map(s => priceSummary(s, pricing))
    .sort((a, b) => b.createdAt - a.createdAt)

  const days = new Map<string, DayBucket>()
  const projects = new Map<string, GroupRow>()
  const modelRows = new Map<string, GroupRow>()
  const tools = new Map<string, ToolStat>()
  const activity = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const bump = (map: Map<string, GroupRow>, key: string, s: PricedSummary, cny: number, tokens: number): void => {
    const row = map.get(key) ?? { key, sessions: 0, tokens: 0, cny: 0, durationMs: 0 }
    row.sessions++
    row.tokens += tokens
    row.cny += cny
    row.durationMs += s.activeMs
    map.set(key, row)
  }
  let cacheRead = 0
  let billedInput = 0

  for (const s of sessions) {
    const key = dayKey(s.startTime)
    const start = new Date(s.startTime)
    const day = days.get(key) ?? {
      day: key, time: new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime(),
      sessions: 0, tokens: 0, cny: 0, byModel: {},
    }
    day.sessions++
    day.tokens += s.totalTokens
    day.cny += s.cny
    bump(projects, projectName(s.cwd), s, s.cny, s.totalTokens)
    // Split cost per model through the buckets so mixed-model sessions land in the right series.
    const perModel = new Map<string, { cny: number; tokens: number }>()
    for (const bucket of s.buckets) {
      const priced = priceBuckets([bucket], pricing)
      const label = priced.byModel[0]?.label ?? bucket.model
      const entry = perModel.get(label) ?? { cny: 0, tokens: 0 }
      entry.cny += priced.cny
      entry.tokens += bucket.input + bucket.cacheRead + bucket.cacheWrite + bucket.output
      perModel.set(label, entry)
    }
    for (const [label, entry] of perModel) {
      day.byModel[label] = (day.byModel[label] ?? 0) + entry.cny
      bump(modelRows, label, s, entry.cny, entry.tokens)
    }
    days.set(key, day)
    for (const tool of s.tools) {
      const stat = tools.get(tool.name) ?? { name: tool.name, count: 0, errors: 0, ms: 0 }
      stat.count += tool.count
      stat.errors += tool.errors
      stat.ms += tool.ms
      tools.set(tool.name, stat)
    }
    activity[(start.getDay() + 6) % 7][start.getHours()] += s.totalTokens
    cacheRead += s.tokens.cacheRead
    billedInput += s.tokens.input + s.tokens.cacheRead + s.tokens.cacheWrite
  }

  const byModel = [...modelRows.values()].sort((a, b) => b.cny - a.cny || b.tokens - a.tokens)
  return {
    sessions,
    totals: {
      sessions: sessions.length,
      tokens: sessions.reduce((n, s) => n + s.totalTokens, 0),
      cny: sessions.reduce((n, s) => n + s.cny, 0),
      activeMs: sessions.reduce((n, s) => n + s.activeMs, 0),
      toolCalls: sessions.reduce((n, s) => n + s.toolCalls, 0),
      toolErrors: sessions.reduce((n, s) => n + s.toolErrors, 0),
      cacheHitRate: billedInput > 0 ? cacheRead / billedInput : 0,
    },
    days: [...days.values()].sort((a, b) => a.time - b.time),
    // Entity order: alphabetical, so a filter never repaints the survivors.
    models: byModel.map(r => r.key).sort((a, b) => a.localeCompare(b)),
    byProject: [...projects.values()].sort((a, b) => b.cny - a.cny || b.tokens - a.tokens),
    byModel,
    top: [...sessions].sort((a, b) => b.cny - a.cny || b.totalTokens - a.totalTokens).slice(0, 6),
    tools: [...tools.values()]
      .map(t => ({ ...t, errorRate: t.count > 0 ? t.errors / t.count : 0 }))
      .sort((a, b) => b.count - a.count),
    activity,
  }
}
