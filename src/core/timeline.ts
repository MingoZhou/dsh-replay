/**
 * Fold a decoded session into the timeline model the UI renders:
 * turns → steps → items (user / assistant / tool / meta), with durations,
 * per-step token usage (last sample wins per turn/step), per-step model and
 * timing, and cumulative totals.
 *
 * Reads harness format v4 (assistant messages embed their stream, failed
 * attempts are `assistant/attempt`, surface replacement addresses seqs) and
 * stays tolerant of the v0 shapes the first releases were written against.
 */
import type {
  ContentBlock,
  JsonValue,
  MessageLike,
  ParsedSession,
  SessionEvent,
  StreamRecord,
  TokenUsage,
} from './types.js'

export type ItemKind = 'user' | 'assistant' | 'tool' | 'meta'

export interface ToolCallInfo {
  callId: string
  name: string
  turn?: number
  step?: number
  /** Raw argument JSON string exactly as the model produced it. */
  argumentsRaw: string
  argumentsPretty?: string
  /** Parsed arguments when the raw string is a JSON object. */
  args?: Record<string, JsonValue>
  resultText?: string
  error?: { name: string; code: string; reason?: string }
  /** True when the result was flagged as an error (with or without identity). */
  failed?: boolean
  /** Tool-private presentation payload from `tool/result.data.meta`. */
  meta?: JsonValue
  callSeq: number
  resultSeq?: number
  callTime: number
  resultTime?: number
  durationMs?: number
}

export interface TimelineItem {
  kind: ItemKind
  seq: number
  time: number
  turn?: number
  step?: number
  type: string
  /** Short one-line label for the timeline rail. */
  label: string
  /** Full text body when the item carries prose (user/assistant messages). */
  text?: string
  reasoningText?: string
  model?: string
  toolCall?: ToolCallInfo
  usage?: TokenUsage
  event: SessionEvent
  /** True when this surface node was later shadowed by compaction. */
  shadowed?: boolean
}

export interface StepModel {
  turn: number
  step: number
  startSeq: number
  endSeq?: number
  startTime: number
  endTime?: number
  usage?: TokenUsage
  /** Model that answered this step, when the log names it. */
  model?: string
  /** Step start → assistant message committed. */
  llmMs?: number
  /** Step start → first streamed token (v4 logs only). */
  ttftMs?: number
  /** Summed matched tool call → result wall time inside the step. */
  toolMs: number
  items: TimelineItem[]
}

export interface TurnModel {
  turn: number
  startSeq: number
  endSeq?: number
  startTime: number
  endTime?: number
  endReason?: string
  steps: StepModel[]
  items: TimelineItem[]
}

export interface TokenTotals {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  /** billed input = input + cacheRead + cacheWrite (disjoint counts). */
  billedInput: number
}

export interface UsageSample {
  seq: number
  time: number
  turn: number
  step: number
  usage: TokenUsage
  model?: string
}

export interface TimelineModel {
  turns: TurnModel[]
  /** Flat, seq-ordered list of everything renderable. */
  items: TimelineItem[]
  totals: TokenTotals
  /** Per assistant-step usage samples in order. */
  usageSamples: UsageSample[]
  toolCalls: ToolCallInfo[]
  /** First event → last event, idle gaps included. */
  durationMs: number
  /** Summed turn wall time (excludes the gaps where the agent waited for the user). */
  activeMs: number
  startTime: number
  endTime: number
  eventCount: number
  lastSeq: number
  /** seq of the last `session/end-seed` marker (fork/resume boundary), if any. */
  seedBoundarySeq?: number
  models: string[]
  /** Latest `session/title` event payload, when the log carries one. */
  title?: string
  /** Model attempts that had to be retried (`assistant/attempt` / `llm/retry`). */
  retries: number
  /** Context compactions (summary or prune). */
  compactions: number
  /** Largest advertised context window seen in `request/context`. */
  contextWindow?: number
}

export function contentText(message: MessageLike | undefined, type = 'text'): string {
  if (!message?.content) return ''
  return message.content
    .filter((b: ContentBlock) => (b.type === type || (type === 'text' && b.type === 'tool_result')) && typeof b.text === 'string')
    .map((b: ContentBlock) => b.text)
    .join(type === 'text' ? '' : '\n\n')
}

function truncate(text: string, max = 96): string {
  const oneLine = text.replaceAll(/\s+/gu, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

function tryParse(raw: string): JsonValue | undefined {
  try {
    return JSON.parse(raw) as JsonValue
  } catch {
    return undefined
  }
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

const HIDDEN_TYPES = new Set([
  'assistant/chunk', 'step/start', 'step/end', 'turn/start', 'request/header', 'system/message',
])

/** The one argument worth showing on a single line for well-known tools. */
export function primaryArgument(call: Pick<ToolCallInfo, 'args' | 'argumentsRaw'>): string {
  const args = call.args
  if (args !== undefined) {
    for (const key of ['command', 'file_path', 'path', 'query', 'url', 'pattern', 'input', 'description', 'prompt']) {
      const value = args[key]
      if (typeof value === 'string' && value !== '') return value
    }
  }
  return call.argumentsRaw
}

/** Meta events worth a rail entry (log-only vocabulary). */
function metaLabel(event: SessionEvent): string | undefined {
  const d = event.data
  switch (event.type) {
    case 'turn/end': {
      const reason = get(get(d, 'reason'), 'kind')
      return reason === 'completed' || reason === undefined ? undefined : `turn ended: ${String(reason)}`
    }
    case 'compaction/summary':
      return 'context compacted (summary)'
    case 'compaction/prune':
      return 'context pruned'
    case 'approval/asked':
      return `approval requested: ${String(get(d, 'toolName') ?? '')}`
    case 'approval/decided': {
      const outcome = get(d, 'outcome') ?? get(d, 'decision')
      return `approval decided: ${typeof outcome === 'string' ? outcome : JSON.stringify(outcome)}`
    }
    case 'sandbox/mode':
      return `sandbox mode → ${JSON.stringify(d)}`
    case 'permission/preset':
      return `permission preset → ${JSON.stringify(d)}`
    case 'plan/mode':
      return 'plan mode change'
    case 'subagent/descriptor':
      return `subagent spawned (${String(get(d, 'mode') ?? '')})`
    case 'llm/retry':
    case 'llm/retry-started':
      return 'model request retried'
    case 'assistant/attempt':
      return 'model attempt failed (no message committed)'
    case 'model/selection':
      return `model → ${String(get(d, 'model') ?? get(get(d, 'selection'), 'model') ?? JSON.stringify(d))}`
    case 'working-directory/change':
      return `cwd → ${String(get(d, 'cwd') ?? get(d, 'path') ?? JSON.stringify(d))}`
    case 'command/run':
      return `command: ${truncate(JSON.stringify(d), 60)}`
    case 'goal/change':
      return 'goal changed'
    default:
      return undefined
  }
}

/** Compute which surface seqs are shadowed by later replace ops. */
function shadowedSeqs(events: SessionEvent[]): Set<number> {
  const surfaceOrder: number[] = [] // seqs of surface nodes in order
  const shadowed = new Set<number>()
  for (const event of events) {
    const op = event.surfaceOp
    if (op === undefined) continue
    if (op === 'append') {
      surfaceOrder.push(event.seq)
      continue
    }
    if (typeof op !== 'object' || op.op !== 'replace') continue
    let from = -1
    let to = -1
    if (typeof op.startSeq === 'number' && typeof op.endSeq === 'number') {
      from = surfaceOrder.indexOf(op.startSeq)
      to = surfaceOrder.indexOf(op.endSeq)
    } else if (typeof op.start === 'number' && typeof op.end === 'number') {
      from = op.start
      to = op.end
    }
    if (from < 0 || to < from) {
      surfaceOrder.push(event.seq)
      continue
    }
    const removed = surfaceOrder.splice(from, to - from + 1, event.seq)
    for (const seq of removed) shadowed.add(seq)
  }
  return shadowed
}

/** Earliest timestamp carried by an embedded v4 stream. */
function firstStreamTime(stream: unknown): number | undefined {
  if (!Array.isArray(stream)) return undefined
  let best: number | undefined
  for (const record of stream as StreamRecord[]) {
    const type = record?.type
    if (type === 'chunk') {
      const chunkType = record.chunk?.type
      if (chunkType !== 'text-delta' && chunkType !== 'reasoning-delta' && chunkType !== 'tool-call-delta') continue
    }
    const time = typeof record?.time0 === 'number' ? record.time0 : record?.time
    if (typeof time === 'number' && (best === undefined || time < best)) best = time
  }
  return best
}

export function buildTimeline(session: ParsedSession): TimelineModel {
  const { events } = session
  const turns = new Map<number, TurnModel>()
  const items: TimelineItem[] = []
  const toolCallsById = new Map<string, ToolCallInfo>()
  const toolCalls: ToolCallInfo[] = []
  const usageByStep = new Map<string, { usage: TokenUsage; time: number; model?: string }>()
  const models = new Set<string>()
  const shadowed = shadowedSeqs(events)
  let seedBoundarySeq: number | undefined
  let activeTurn: number | undefined
  let sessionTitle: string | undefined
  let currentModel: string | undefined
  let failedAttempts = 0
  let retryEvents = 0
  let compactions = 0
  let contextWindow: number | undefined
  let inCompaction = false

  const ensureTurn = (turn: number, event: SessionEvent): TurnModel => {
    let model = turns.get(turn)
    if (model === undefined) {
      model = { turn, startSeq: event.seq, startTime: event.time, steps: [], items: [] }
      turns.set(turn, model)
    }
    return model
  }
  const ensureStep = (turnModel: TurnModel, step: number, event: SessionEvent): StepModel => {
    let model = turnModel.steps.find(s => s.step === step)
    if (model === undefined) {
      model = { turn: turnModel.turn, step, startSeq: event.seq, startTime: event.time, toolMs: 0, items: [] }
      turnModel.steps.push(model)
    }
    return model
  }
  const stepOf = (turn: unknown, step: unknown, event: SessionEvent): StepModel | undefined =>
    typeof turn === 'number' && typeof step === 'number'
      ? ensureStep(ensureTurn(turn, event), step, event)
      : undefined
  const push = (item: TimelineItem): void => {
    if (shadowed.has(item.seq)) item.shadowed = true
    items.push(item)
    if (item.turn !== undefined) {
      const turnModel = ensureTurn(item.turn, item.event)
      turnModel.items.push(item)
      if (item.step !== undefined) ensureStep(turnModel, item.step, item.event).items.push(item)
    }
  }

  for (const event of events) {
    const d = event.data
    const turn = get(d, 'turn')
    const step = get(d, 'step')
    switch (event.type) {
      case 'turn/start':
        activeTurn = turn as number
        ensureTurn(activeTurn, event)
        break
      case 'turn/end': {
        const model = ensureTurn(turn as number, event)
        model.endSeq = event.seq
        model.endTime = event.time
        model.endReason = String(get(get(d, 'reason'), 'kind') ?? 'completed')
        activeTurn = undefined
        const label = metaLabel(event)
        if (label !== undefined) {
          push({ kind: 'meta', seq: event.seq, time: event.time, turn: turn as number, type: event.type, label, event })
        }
        break
      }
      case 'step/start':
        stepOf(turn, step, event)
        break
      case 'step/end': {
        const stepModel = stepOf(turn, step, event)
        if (stepModel) {
          stepModel.endSeq = event.seq
          stepModel.endTime = event.time
        }
        break
      }
      case 'user/message': {
        const message = d as MessageLike
        const text = contentText(message)
        const sourceKind = message?.source?.kind
        const injected = sourceKind !== undefined && sourceKind !== 'user'
        push({
          kind: injected ? 'meta' : 'user',
          seq: event.seq, time: event.time, type: injected ? 'context' : event.type,
          turn: activeTurn,
          label: truncate(text) || (injected ? '(context)' : '(user message)'),
          text, event,
        })
        break
      }
      case 'developer/message': {
        const text = contentText(get(d, 'message') as MessageLike)
        push({
          kind: 'meta', seq: event.seq, time: event.time, type: 'context',
          turn: typeof turn === 'number' ? turn : activeTurn,
          step: typeof step === 'number' ? step : undefined,
          label: truncate(text) || '(developer message)', text, event,
        })
        break
      }
      case 'assistant/message': {
        const message = get(d, 'message') as MessageLike
        const usage = get(d, 'usage') as TokenUsage | undefined
        const text = contentText(message)
        const reasoningText = contentText(message, 'reasoning')
        const source = message?.source as Record<string, unknown> | undefined
        const model = typeof source?.['model'] === 'string' ? source['model'] : currentModel
        if (model !== undefined) models.add(model)
        const stepModel = stepOf(turn, step, event)
        if (stepModel) {
          stepModel.model = model
          stepModel.llmMs = Math.max(0, event.time - stepModel.startTime)
          const first = firstStreamTime(get(d, 'stream'))
          if (first !== undefined) stepModel.ttftMs = Math.max(0, first - stepModel.startTime)
        }
        if (usage) usageByStep.set(`${String(turn)}/${String(step)}`, { usage, time: event.time, model })
        const toolNames = (message?.content ?? [])
          .filter(b => b.type === 'tool-call' && typeof b['name'] === 'string')
          .map(b => String(b['name']))
        push({
          kind: 'assistant', seq: event.seq, time: event.time,
          turn: turn as number, step: step as number, type: event.type,
          label:
            truncate(text) ||
            (toolNames.length > 0 ? `→ ${toolNames.join(', ')}` : truncate(reasoningText) || '(assistant message)'),
          text, reasoningText: reasoningText === '' ? undefined : reasoningText,
          model, usage, event,
        })
        break
      }
      case 'assistant/chunk': {
        // v0 logs: usage could arrive early as a chunk.
        const chunk = get(d, 'chunk')
        if (get(chunk, 'type') === 'usage') {
          const usage = get(chunk, 'usage') as TokenUsage
          const key = `${String(turn)}/${String(step)}`
          usageByStep.set(key, { usage, time: event.time, model: usageByStep.get(key)?.model ?? currentModel })
        }
        break
      }
      case 'tool/call': {
        const raw = String(get(d, 'arguments') ?? '')
        const parsed = tryParse(raw)
        const info: ToolCallInfo = {
          callId: String(get(d, 'callId') ?? ''),
          name: String(get(d, 'name') ?? ''),
          turn: typeof turn === 'number' ? turn : undefined,
          step: typeof step === 'number' ? step : undefined,
          argumentsRaw: raw,
          argumentsPretty: parsed === undefined ? undefined : JSON.stringify(parsed, null, 2),
          args:
            typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
              ? (parsed as Record<string, JsonValue>)
              : undefined,
          callSeq: event.seq,
          callTime: event.time,
        }
        toolCallsById.set(info.callId, info)
        toolCalls.push(info)
        push({
          kind: 'tool', seq: event.seq, time: event.time,
          turn: info.turn, step: info.step, type: event.type,
          label: truncate(primaryArgument(info), 72), toolCall: info, event,
        })
        break
      }
      case 'tool/result': {
        const message = get(d, 'message') as MessageLike
        const source = message?.source as Record<string, unknown> | undefined
        const callId = String(source?.['callId'] ?? message?.toolCallId ?? '')
        const info = toolCallsById.get(callId)
        const block = message?.content?.[0]
        const direct = contentText(message)
        const resultText =
          direct !== ''
            ? direct
            : contentText({ content: get(block, 'content') as ContentBlock[] | undefined })
        const error = get(d, 'error') as ToolCallInfo['error']
        if (info) {
          info.resultSeq = event.seq
          info.resultTime = event.time
          info.durationMs = Math.max(0, event.time - info.callTime)
          info.resultText = resultText
          info.error = error
          info.failed = error !== undefined || message?.isError === true
          const meta = get(d, 'meta')
          if (meta !== undefined) info.meta = meta as JsonValue
          const stepModel = stepOf(info.turn, info.step, event)
          if (stepModel) stepModel.toolMs += info.durationMs
        }
        break
      }
      case 'session/end-seed':
        seedBoundarySeq = event.seq
        push({
          kind: 'meta', seq: event.seq, time: event.time, type: event.type,
          label: 'seed boundary (fork/resume point)', event,
        })
        break
      case 'request/context': {
        const model = get(d, 'model')
        if (typeof model === 'string') {
          models.add(model)
          currentModel = model
        }
        const window = get(d, 'contextWindow')
        if (typeof window === 'number') contextWindow = Math.max(contextWindow ?? 0, window)
        break
      }
      case 'session/title': {
        const title = get(d, 'title')
        if (typeof title === 'string' && title !== '') sessionTitle = title
        break
      }
      default: {
        if (HIDDEN_TYPES.has(event.type)) break
        if (event.type === 'assistant/attempt') failedAttempts++
        if (event.type === 'llm/retry') retryEvents++
        if (event.type === 'compaction/start') {
          inCompaction = true
          compactions++
        } else if (event.type === 'compaction/end') {
          inCompaction = false
        } else if ((event.type === 'compaction/summary' || event.type === 'compaction/prune') && !inCompaction) {
          compactions++
        }
        const label = metaLabel(event)
        if (label !== undefined) {
          push({
            kind: 'meta', seq: event.seq, time: event.time,
            turn: typeof turn === 'number' ? turn : undefined,
            step: typeof step === 'number' ? step : undefined,
            type: event.type, label, event,
          })
        }
      }
    }
  }

  // Fold usage samples (already last-wins per turn/step via the map).
  const totals: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 0 }
  const usageSamples: UsageSample[] = []
  for (const [key, sample] of usageByStep) {
    const [turnStr, stepStr] = key.split('/')
    const { usage } = sample
    totals.input += usage.inputTokens ?? 0
    totals.output += usage.outputTokens ?? 0
    totals.cacheRead += usage.cacheReadTokens ?? 0
    totals.cacheWrite += usage.cacheWriteTokens ?? 0
    totals.reasoning += usage.reasoningTokens ?? 0
    const turnModel = turns.get(Number(turnStr))
    const stepModel = turnModel?.steps.find(s => s.step === Number(stepStr))
    if (stepModel) stepModel.usage = usage
    const anchor = stepModel?.items.find(i => i.kind === 'assistant')
    usageSamples.push({
      seq: anchor?.seq ?? stepModel?.startSeq ?? 0,
      time: anchor?.time ?? sample.time,
      turn: Number(turnStr), step: Number(stepStr), usage,
      model: sample.model ?? stepModel?.model,
    })
  }
  usageSamples.sort((a, b) => a.seq - b.seq)
  totals.billedInput = totals.input + totals.cacheRead + totals.cacheWrite

  const orderedTurns = [...turns.values()].sort((a, b) => a.turn - b.turn)
  for (const t of orderedTurns) t.steps.sort((a, b) => a.step - b.step)
  const startTime = events[0]?.time ?? session.header.createdAt
  const endTime = events.at(-1)?.time ?? startTime
  const activeMs = orderedTurns.reduce(
    (sum, t) => sum + Math.max(0, (t.endTime ?? t.items.at(-1)?.time ?? t.startTime) - t.startTime),
    0,
  )
  return {
    turns: orderedTurns,
    items,
    totals,
    usageSamples,
    toolCalls,
    durationMs: endTime - startTime,
    activeMs,
    startTime,
    endTime,
    eventCount: events.length,
    lastSeq: events.at(-1)?.seq ?? -1,
    seedBoundarySeq,
    models: [...models],
    title: sessionTitle,
    // One failed attempt usually logs both records; count it once.
    retries: Math.max(failedAttempts, retryEvents),
    compactions,
    contextWindow,
  }
}
