/**
 * Session health report: the handful of facts worth reading before the
 * timeline — where the time went, what failed, what repeated, how well the
 * cache worked — plus a transparent 0–100 run score built only from the
 * deductions it lists.
 */
import type { AuditReport } from './audit.js'
import { cacheHitRate } from './cost.js'
import type { TimelineModel, ToolCallInfo } from './timeline.js'

export interface LoopFinding {
  name: string
  /** Normalised arguments shared by every call in the loop. */
  signature: string
  count: number
  /** Longest run of back-to-back identical calls. */
  consecutive: number
  firstSeq: number
  lastSeq: number
  /** Total wall time spent across the repeats. */
  totalMs: number
}

export interface ToolStat {
  name: string
  count: number
  errors: number
  ms: number
}

export interface ContextSample {
  seq: number
  time: number
  turn: number
  step: number
  /** Prompt size sent for this step: input + cacheRead + cacheWrite. */
  tokens: number
}

export interface Deduction {
  key: 'critical' | 'serious' | 'failures' | 'loops' | 'retries' | 'abnormal'
  points: number
  count: number
}

export interface Insights {
  wallMs: number
  activeMs: number
  modelMs: number
  toolMs: number
  /** Wall time outside any turn — the agent waiting for the user. */
  idleMs: number
  cacheHitRate: number
  slowestCalls: ToolCallInfo[]
  failedCalls: ToolCallInfo[]
  retries: number
  loops: LoopFinding[]
  compactions: number
  context: ContextSample[]
  peakContext: number
  contextWindow?: number
  abnormalTurns: { turn: number; reason: string; seq: number }[]
  toolStats: ToolStat[]
  /** Mean time-to-first-token over the steps that recorded one. */
  avgTtftMs?: number
  /** Output tokens per second of model time. */
  outputSpeed?: number
  score: number
  deductions: Deduction[]
}

const LOOP_MIN = 3

function signatureOf(call: ToolCallInfo): string {
  if (call.args !== undefined) {
    // Stable key order so `{a,b}` and `{b,a}` are the same call.
    return JSON.stringify(Object.keys(call.args).sort().map(k => [k, call.args![k]]))
  }
  return call.argumentsRaw.trim()
}

export function findLoops(calls: ToolCallInfo[]): LoopFinding[] {
  const map = new Map<string, LoopFinding & { run: number; lastIndex: number }>()
  calls.forEach((call, index) => {
    const signature = signatureOf(call)
    const key = `${call.name}\u0000${signature}`
    const entry = map.get(key)
    if (entry === undefined) {
      map.set(key, {
        name: call.name, signature, count: 1, consecutive: 1, run: 1, lastIndex: index,
        firstSeq: call.callSeq, lastSeq: call.callSeq, totalMs: call.durationMs ?? 0,
      })
      return
    }
    entry.count++
    entry.run = entry.lastIndex === index - 1 ? entry.run + 1 : 1
    entry.consecutive = Math.max(entry.consecutive, entry.run)
    entry.lastIndex = index
    entry.lastSeq = call.callSeq
    entry.totalMs += call.durationMs ?? 0
  })
  return [...map.values()]
    .filter(e => e.count >= LOOP_MIN)
    .map(({ run: _run, lastIndex: _last, ...rest }) => rest)
    .sort((a, b) => b.consecutive - a.consecutive || b.count - a.count)
}

export function toolStats(calls: ToolCallInfo[]): ToolStat[] {
  const map = new Map<string, ToolStat>()
  for (const call of calls) {
    const stat = map.get(call.name) ?? { name: call.name, count: 0, errors: 0, ms: 0 }
    stat.count++
    stat.ms += call.durationMs ?? 0
    if (call.failed) stat.errors++
    map.set(call.name, stat)
  }
  return [...map.values()].sort((a, b) => b.ms - a.ms || b.count - a.count)
}

export function buildInsights(model: TimelineModel, report?: AuditReport): Insights {
  const steps = model.turns.flatMap(t => t.steps)
  const modelMs = steps.reduce((n, s) => n + (s.llmMs ?? 0), 0)
  const toolMs = model.toolCalls.reduce((n, c) => n + (c.durationMs ?? 0), 0)
  const failedCalls = model.toolCalls.filter(c => c.failed)
  const loops = findLoops(model.toolCalls)
  const abnormalTurns = model.turns
    .filter(t => t.endReason !== undefined && !['completed', 'forked'].includes(t.endReason))
    .map(t => ({ turn: t.turn, reason: t.endReason!, seq: t.endSeq ?? t.startSeq }))
  const context: ContextSample[] = model.usageSamples.map(s => ({
    seq: s.seq, time: s.time, turn: s.turn, step: s.step,
    tokens: (s.usage.inputTokens ?? 0) + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0),
  }))
  const ttft = steps.filter(s => s.ttftMs !== undefined)

  const deductions: Deduction[] = []
  const deduct = (key: Deduction['key'], count: number, each: number, cap: number): void => {
    if (count <= 0) return
    deductions.push({ key, count, points: Math.min(cap, Math.round(count * each)) })
  }
  deduct('critical', report?.counts.critical ?? 0, 10, 30)
  deduct('serious', report?.counts.serious ?? 0, 4, 16)
  if (model.toolCalls.length > 0 && failedCalls.length > 0) {
    const rate = failedCalls.length / model.toolCalls.length
    deductions.push({ key: 'failures', count: failedCalls.length, points: Math.min(20, Math.max(2, Math.round(rate * 40))) })
  }
  deduct('loops', loops.filter(l => l.consecutive >= LOOP_MIN).length, 6, 18)
  deduct('retries', model.retries, 2, 10)
  deduct('abnormal', abnormalTurns.length, 6, 18)
  const score = Math.max(0, 100 - deductions.reduce((n, d) => n + d.points, 0))

  return {
    wallMs: model.durationMs,
    activeMs: model.activeMs,
    modelMs,
    toolMs,
    idleMs: Math.max(0, model.durationMs - model.activeMs),
    cacheHitRate: cacheHitRate(model.totals),
    slowestCalls: [...model.toolCalls]
      .filter(c => c.durationMs !== undefined)
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, 3),
    failedCalls,
    retries: model.retries,
    loops,
    compactions: model.compactions,
    context,
    peakContext: context.reduce((n, c) => Math.max(n, c.tokens), 0),
    contextWindow: model.contextWindow,
    abnormalTurns,
    toolStats: toolStats(model.toolCalls),
    avgTtftMs: ttft.length > 0 ? ttft.reduce((n, s) => n + (s.ttftMs ?? 0), 0) / ttft.length : undefined,
    outputSpeed: modelMs > 0 ? model.totals.output / (modelMs / 1000) : undefined,
    score,
    deductions,
  }
}
