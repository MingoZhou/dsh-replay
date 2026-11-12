/**
 * Compact per-session aggregate for the cross-session dashboard. Small enough
 * to compute on the host and cache, so the browser never has to download
 * every session's events to draw a spend chart. Token usage is kept as
 * priceable buckets (model × peak) so the client can re-price it with the
 * user's own table without another round trip.
 */
import { auditSession, type Severity } from './audit.js'
import { bucketize, DEFAULT_PRICING, type PricingConfig, type UsageBucket } from './cost.js'
import { toolStats, type ToolStat } from './insights.js'
import { buildTimeline, type TimelineModel } from './timeline.js'
import type { ParsedSession } from './types.js'

export interface SessionSummary {
  id: string
  title?: string
  createdAt: number
  startTime: number
  endTime: number
  cwd?: string
  origin?: 'subagent'
  parentSession?: string
  isSeeded?: boolean
  /** Inherited prefix length when known (fork). */
  inheritedEventCount?: number
  /** Identity of the first user message — equal across a fork family. */
  rootKey?: string
  durationMs: number
  activeMs: number
  turns: number
  steps: number
  events: number
  lastSeq: number
  toolCalls: number
  toolErrors: number
  retries: number
  compactions: number
  models: string[]
  tokens: { input: number; cacheRead: number; cacheWrite: number; output: number }
  buckets: UsageBucket[]
  tools: ToolStat[]
  audit: Record<Severity, number>
  live?: boolean
}

function firstUserKey(session: ParsedSession): string | undefined {
  for (const event of session.events) {
    if (event.type !== 'user/message') continue
    const data = event.data as { id?: unknown; source?: { kind?: unknown } } | null
    if (data?.source?.kind !== undefined && data.source.kind !== 'user') continue
    return `${event.time}:${typeof data?.id === 'string' ? data.id : event.seq}`
  }
  return undefined
}

export function summarizeSession(
  session: ParsedSession,
  options: { title?: string; model?: TimelineModel; pricing?: PricingConfig; live?: boolean } = {},
): SessionSummary {
  const model = options.model ?? buildTimeline(session)
  const audit = auditSession(session)
  const { header } = session
  return {
    id: header.id,
    title: options.title ?? model.title,
    createdAt: header.createdAt,
    startTime: model.startTime,
    endTime: model.endTime,
    cwd: header.cwd,
    origin: header.origin,
    parentSession: header.parentSession,
    isSeeded: header.isSeeded ?? (header.seedLength !== undefined ? true : undefined),
    inheritedEventCount: session.inheritedEventCount ?? header.seedLength,
    rootKey: firstUserKey(session),
    durationMs: model.durationMs,
    activeMs: model.activeMs,
    turns: model.turns.length,
    steps: model.turns.reduce((n, t) => n + t.steps.length, 0),
    events: model.eventCount,
    lastSeq: model.lastSeq,
    toolCalls: model.toolCalls.length,
    toolErrors: model.toolCalls.filter(c => c.failed).length,
    retries: model.retries,
    compactions: model.compactions,
    models: model.models,
    tokens: {
      input: model.totals.input,
      cacheRead: model.totals.cacheRead,
      cacheWrite: model.totals.cacheWrite,
      output: model.totals.output,
    },
    buckets: bucketize(model.usageSamples, options.pricing ?? DEFAULT_PRICING, model.models[0]),
    tools: toolStats(model.toolCalls),
    audit: audit.counts,
    live: options.live,
  }
}
