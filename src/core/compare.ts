/**
 * Compare two decoded sessions: headline stats side by side, tool-call mix,
 * and — when the two share lineage — the exact divergence seq (first event
 * where the logs stop being identical over the shared prefix).
 */
import { buildTimeline, type TimelineModel } from './timeline.js'
import type { ParsedSession, SessionEvent } from './types.js'

export interface CompareStats {
  id: string
  title?: string
  turns: number
  steps: number
  events: number
  toolCallCount: number
  toolErrors: number
  inputTokens: number
  billedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  durationMs: number
  models: string[]
  toolMix: Record<string, number>
}

export type CompareRelation = 'same' | 'a-parent-of-b' | 'b-parent-of-a' | 'siblings' | 'none'

export interface CompareResult {
  a: CompareStats
  b: CompareStats
  /** All tool names across both, for a stable table order. */
  toolNames: string[]
  /** First seq at which the two logs differ (comparing type+data), if computable. */
  divergenceSeq?: number
  /** The first differing event on each side, for a side-by-side context view. */
  divergenceA?: SessionEvent
  divergenceB?: SessionEvent
  /** True when one session is an ancestor/relative of the other (any depth). */
  related: boolean
  relation: CompareRelation
}

function stats(session: ParsedSession, timeline: TimelineModel, title?: string): CompareStats {
  const toolMix: Record<string, number> = {}
  let toolErrors = 0
  for (const call of timeline.toolCalls) {
    toolMix[call.name] = (toolMix[call.name] ?? 0) + 1
    if (call.error !== undefined) toolErrors++
  }
  const steps = timeline.turns.reduce((n, t) => n + t.steps.length, 0)
  return {
    id: session.header.id,
    title,
    turns: timeline.turns.length,
    steps,
    events: timeline.eventCount,
    toolCallCount: timeline.toolCalls.length,
    toolErrors,
    inputTokens: timeline.totals.input,
    billedInputTokens: timeline.totals.billedInput,
    outputTokens: timeline.totals.output,
    cacheReadTokens: timeline.totals.cacheRead,
    durationMs: timeline.durationMs,
    models: timeline.models,
    toolMix,
  }
}

function eventFingerprint(event: { type: string; data: unknown }): string {
  return `${event.type}\u0000${JSON.stringify(event.data)}`
}

function relatedBy(
  a: ParsedSession,
  b: ParsedSession,
  parentOf: (id: string) => string | undefined,
): CompareRelation {
  if (a.header.id === b.header.id) return 'same'
  if (b.header.parentSession === a.header.id) return 'a-parent-of-b'
  if (a.header.parentSession === b.header.id) return 'b-parent-of-a'

  // Walk the full lineage so grandparent/grandchild comparisons work.
  const ancestorsOfB = new Set<string>()
  let cursor = b.header.parentSession
  while (cursor !== undefined && !ancestorsOfB.has(cursor)) {
    ancestorsOfB.add(cursor)
    cursor = parentOf(cursor)
  }
  if (ancestorsOfB.has(a.header.id)) return 'a-parent-of-b'

  const ancestorsOfA = new Set<string>()
  cursor = a.header.parentSession
  while (cursor !== undefined && !ancestorsOfA.has(cursor)) {
    ancestorsOfA.add(cursor)
    cursor = parentOf(cursor)
  }
  if (ancestorsOfA.has(b.header.id)) return 'b-parent-of-a'

  if (
    a.header.parentSession !== undefined &&
    a.header.parentSession === b.header.parentSession
  ) {
    return 'siblings'
  }
  return 'none'
}

export function compareSessions(
  a: ParsedSession,
  b: ParsedSession,
  titles?: { a?: string; b?: string },
  parentOf: (id: string) => string | undefined = () => undefined,
): CompareResult {
  const timelineA = buildTimeline(a)
  const timelineB = buildTimeline(b)
  const statsA = stats(a, timelineA, titles?.a)
  const statsB = stats(b, timelineB, titles?.b)
  const toolNames = [...new Set([...Object.keys(statsA.toolMix), ...Object.keys(statsB.toolMix)])].sort()

  const relation = relatedBy(a, b, parentOf)
  const related = relation !== 'none'

  let divergenceSeq: number | undefined
  let divergenceA: SessionEvent | undefined
  let divergenceB: SessionEvent | undefined
  const shared = Math.min(a.events.length, b.events.length)
  for (let i = 0; i < shared; i++) {
    // session/end-seed markers are pickup artifacts, not divergence.
    if (a.events[i].type === 'session/end-seed' || b.events[i].type === 'session/end-seed') {
      if (a.events[i].type !== b.events[i].type) {
        divergenceSeq = Math.min(a.events[i].seq, b.events[i].seq)
        divergenceA = a.events[i]
        divergenceB = b.events[i]
        break
      }
      continue
    }
    if (eventFingerprint(a.events[i]) !== eventFingerprint(b.events[i])) {
      divergenceSeq = a.events[i].seq
      divergenceA = a.events[i]
      divergenceB = b.events[i]
      break
    }
  }
  if (divergenceSeq === undefined && a.events.length !== b.events.length) {
    divergenceSeq = shared > 0 ? (a.events[shared - 1]?.seq ?? 0) + 1 : 0
    divergenceA = a.events[shared]
    divergenceB = b.events[shared]
  }

  return { a: statsA, b: statsB, toolNames, divergenceSeq, divergenceA, divergenceB, related, relation }
}
