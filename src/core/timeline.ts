/**
 * Fold a decoded session into the timeline model the UI renders:
 * turns → steps → items (user / assistant / tool / meta), with durations,
 * per-step token usage (last sample wins per turn/step, per the harness's
 * `usageOf` replace-not-accumulate rule), and cumulative token totals.
 */
import type {
  ContentBlock,
  MessageLike,
  ParsedSession,
  SessionEvent,
  TokenUsage,
} from './types.js'

export type ItemKind = 'user' | 'assistant' | 'tool' | 'meta'

export interface ToolCallInfo {
  callId: string
  name: string
  /** Raw argument JSON string exactly as the model produced it. */
  argumentsRaw: string
  argumentsPretty?: string
<<<<<<< HEAD
  /** Short, human-readable summary (command/path/url/query) for the rail. */
  summary?: string
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  resultText?: string
  error?: { name: string; code: string }
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

export interface TimelineModel {
  turns: TurnModel[]
  /** Flat, seq-ordered list of everything renderable. */
  items: TimelineItem[]
  totals: TokenTotals
<<<<<<< HEAD
  /** Token totals split by model, for cache-aware multi-model cost. */
  modelTotals: Record<string, TokenTotals>
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  /** Per assistant-step usage samples in order, for the token strip. */
  usageSamples: { seq: number; turn: number; step: number; usage: TokenUsage }[]
  toolCalls: ToolCallInfo[]
  durationMs: number
  startTime: number
  endTime: number
  eventCount: number
  /** seq of the last `session/end-seed` marker (fork/resume boundary), if any. */
  seedBoundarySeq?: number
  models: string[]
  /** Latest `session/title` event payload, when the log carries one. */
  title?: string
}

function contentText(message: MessageLike | undefined): string {
  if (!message?.content) return ''
  return message.content
<<<<<<< HEAD
    .filter((b: ContentBlock) => typeof b.text === 'string' && b.type !== 'reasoning')
=======
    .filter((b: ContentBlock) => typeof b.text === 'string')
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    .map((b: ContentBlock) => b.text)
    .join('')
}

<<<<<<< HEAD
function contentReasoning(message: MessageLike | undefined): string {
  if (!message?.content) return ''
  return message.content
    .filter((b: ContentBlock) => b.type === 'reasoning' && typeof b.text === 'string')
    .map((b: ContentBlock) => b.text)
    .join('')
}

function oneLine(text: string, max: number): string {
  return truncate(text.replaceAll(/\s+/gu, ' ').trim(), max)
}

/**
 * Turn tool arguments into a label a human can scan. The raw JSON stays
 * available in the detail panel; the rail should not be a wall of escapes.
 */
export function summarizeToolArguments(name: string, raw: string): string {
  let args: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null) args = parsed as Record<string, unknown>
  } catch {
    args = undefined
  }
  if (args === undefined) return oneLine(raw, 64)
  const keys = ['command', 'cmd', 'script', 'path', 'file_path', 'filePath', 'url', 'query', 'pattern', 'description']
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string' && value.trim() !== '') return oneLine(value, 64)
  }
  return name
}

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
function truncate(text: string, max = 96): string {
  const oneLine = text.replaceAll(/\s+/gu, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

function tryPretty(raw: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return undefined
  }
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

const HIDDEN_TYPES = new Set(['assistant/chunk', 'step/start', 'step/end', 'turn/start'])

/** Meta events worth a rail entry (log-only vocabulary). */
function metaLabel(event: SessionEvent): string | undefined {
  const d = event.data
  switch (event.type) {
    case 'turn/end': {
      const reason = get(get(d, 'reason'), 'kind')
      return reason === 'completed' ? undefined : `turn ended: ${String(reason)}`
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
      return `plan mode change`
    case 'subagent/descriptor':
      return `subagent spawned (${String(get(d, 'mode') ?? '')})`
    case 'session/end-seed':
      return 'seed boundary (fork/resume point)'
    case 'llm/retry':
    case 'llm/retry-started':
      return 'model request retried'
    case 'command/run':
      return `command: ${truncate(JSON.stringify(d), 60)}`
    case 'goal/change':
      return 'goal changed'
    case 'session/title':
      return undefined
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
    } else if (typeof op === 'object' && op.op === 'replace') {
      const removed = surfaceOrder.splice(op.start, op.end - op.start + 1, event.seq)
      for (const seq of removed) shadowed.add(seq)
    }
  }
  return shadowed
}

export function buildTimeline(session: ParsedSession): TimelineModel {
  const { events } = session
  const turns = new Map<number, TurnModel>()
  const items: TimelineItem[] = []
  const usageSamples: TimelineModel['usageSamples'] = []
  const toolCallsBySeq = new Map<string, ToolCallInfo>()
  const toolCalls: ToolCallInfo[] = []
  const usageByStep = new Map<string, TokenUsage>()
<<<<<<< HEAD
  const usageModelByStep = new Map<string, string>()
  const modelTotals: Record<string, TokenTotals> = {}
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  const models = new Set<string>()
  const shadowed = shadowedSeqs(events)
  let seedBoundarySeq: number | undefined
  let activeTurn: number | undefined
<<<<<<< HEAD
  let activeModel: string | undefined
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  let sessionTitle: string | undefined

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
      model = { turn: turnModel.turn, step, startSeq: event.seq, startTime: event.time, items: [] }
      turnModel.steps.push(model)
    }
    return model
  }
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
        break
      }
      case 'step/start':
        ensureStep(ensureTurn(turn as number, event), step as number, event)
        break
      case 'step/end': {
        const stepModel = ensureStep(ensureTurn(turn as number, event), step as number, event)
        stepModel.endSeq = event.seq
        stepModel.endTime = event.time
        break
      }
      case 'user/message': {
        const message = d as MessageLike
        const text = contentText(message)
        push({
          kind: 'user', seq: event.seq, time: event.time, type: event.type,
          turn: activeTurn, label: truncate(text) || '(user message)', text, event,
        })
        break
      }
      case 'assistant/message': {
        const message = get(d, 'message') as MessageLike
        const usage = get(d, 'usage') as TokenUsage | undefined
        const text = contentText(message)
<<<<<<< HEAD
        const reasoningText = contentReasoning(message)
        const source = message?.source as Record<string, unknown> | undefined
        if (typeof source?.['model'] === 'string') {
          activeModel = source['model']
          models.add(activeModel)
        }
        if (usage) {
          const key = `${String(turn)}/${String(step)}`
          usageByStep.set(key, usage)
          if (activeModel !== undefined) usageModelByStep.set(key, activeModel)
=======
        const source = message?.source as Record<string, unknown> | undefined
        if (typeof source?.['model'] === 'string') models.add(source['model'])
        if (usage) {
          usageByStep.set(`${String(turn)}/${String(step)}`, usage)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        }
        push({
          kind: 'assistant', seq: event.seq, time: event.time,
          turn: turn as number, step: step as number, type: event.type,
<<<<<<< HEAD
          label: truncate(text) || '(assistant message)', text, reasoningText, usage, event,
=======
          label: truncate(text) || '(assistant message)', text, usage, event,
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        })
        break
      }
      case 'assistant/chunk': {
        const chunk = get(d, 'chunk')
        if (get(chunk, 'type') === 'usage') {
          const usage = get(chunk, 'usage') as TokenUsage
<<<<<<< HEAD
          const key = `${String(turn)}/${String(step)}`
          usageByStep.set(key, usage)
          if (activeModel !== undefined && !usageModelByStep.has(key)) {
            usageModelByStep.set(key, activeModel)
          }
=======
          usageByStep.set(`${String(turn)}/${String(step)}`, usage)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        }
        break
      }
      case 'tool/call': {
<<<<<<< HEAD
        const raw = String(get(d, 'arguments') ?? '')
        const name = String(get(d, 'name') ?? '')
        const info: ToolCallInfo = {
          callId: String(get(d, 'callId') ?? ''),
          name,
          argumentsRaw: raw,
          argumentsPretty: tryPretty(raw),
          summary: summarizeToolArguments(name, raw),
=======
        const info: ToolCallInfo = {
          callId: String(get(d, 'callId') ?? ''),
          name: String(get(d, 'name') ?? ''),
          argumentsRaw: String(get(d, 'arguments') ?? ''),
          argumentsPretty: tryPretty(String(get(d, 'arguments') ?? '')),
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          callSeq: event.seq,
          callTime: event.time,
        }
        toolCallsBySeq.set(info.callId, info)
        toolCalls.push(info)
        push({
          kind: 'tool', seq: event.seq, time: event.time,
          turn: turn as number, step: step as number, type: event.type,
<<<<<<< HEAD
          label: info.summary === name ? name : `${name} · ${info.summary}`,
          toolCall: info, event,
=======
          label: `${info.name}(${truncate(info.argumentsRaw, 48)})`, toolCall: info, event,
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        })
        break
      }
      case 'tool/result': {
        const message = get(d, 'message') as MessageLike
        const source = message?.source as Record<string, unknown> | undefined
        const callId = String(source?.['callId'] ?? '')
        const info = toolCallsBySeq.get(callId)
        const block = message?.content?.[0]
        const resultText =
<<<<<<< HEAD
          contentText(message) ||
          (typeof get(block, 'text') === 'string'
            ? (get(block, 'text') as string)
            : contentText({ content: get(block, 'content') as ContentBlock[] | undefined }))
=======
          typeof get(block, 'text') === 'string'
            ? (get(block, 'text') as string)
            : contentText({ content: get(block, 'content') as ContentBlock[] | undefined })
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        const error = get(d, 'error') as { name: string; code: string } | undefined
        if (info) {
          info.resultSeq = event.seq
          info.resultTime = event.time
          info.durationMs = event.time - info.callTime
          info.resultText = resultText
          info.error = error
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
<<<<<<< HEAD
      case 'system/message': {
        const message = get(d, 'message') as MessageLike
        const text = contentText(message)
        push({
          kind: 'meta', seq: event.seq, time: event.time,
          turn: typeof turn === 'number' ? turn : undefined,
          step: typeof step === 'number' ? step : undefined,
          type: event.type, label: 'system prompt', text, event,
        })
        break
      }
      case 'model/selection': {
        const model = get(d, 'model')
        if (typeof model === 'string' && model !== '') {
          activeModel = model
          models.add(model)
          push({
            kind: 'meta', seq: event.seq, time: event.time, type: event.type,
            label: `model selected: ${model}`, event,
          })
        }
        break
      }
      case 'request/context': {
        const model = get(d, 'model')
        if (typeof model === 'string') {
          activeModel = model
          models.add(model)
        }
=======
      case 'request/context': {
        const model = get(d, 'model')
        if (typeof model === 'string') models.add(model)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        break
      }
      case 'session/title': {
        const title = get(d, 'title')
        if (typeof title === 'string' && title !== '') sessionTitle = title
        break
      }
      default: {
        if (HIDDEN_TYPES.has(event.type)) break
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
<<<<<<< HEAD
  const emptyTotals = (): TokenTotals => ({
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 0,
  })
  for (const [key, usage] of usageByStep) {
    const [turnStr, stepStr] = key.split('/')
    const billed = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
=======
  for (const [key, usage] of usageByStep) {
    const [turnStr, stepStr] = key.split('/')
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    totals.input += usage.inputTokens
    totals.output += usage.outputTokens
    totals.cacheRead += usage.cacheReadTokens ?? 0
    totals.cacheWrite += usage.cacheWriteTokens ?? 0
    totals.reasoning += usage.reasoningTokens ?? 0
<<<<<<< HEAD
    const modelName = usageModelByStep.get(key) ?? activeModel ?? 'unknown'
    const modelTotal = modelTotals[modelName] ?? emptyTotals()
    modelTotal.input += usage.inputTokens
    modelTotal.output += usage.outputTokens
    modelTotal.cacheRead += usage.cacheReadTokens ?? 0
    modelTotal.cacheWrite += usage.cacheWriteTokens ?? 0
    modelTotal.reasoning += usage.reasoningTokens ?? 0
    modelTotal.billedInput += billed
    modelTotals[modelName] = modelTotal
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    const turnModel = turns.get(Number(turnStr))
    const stepModel = turnModel?.steps.find(s => s.step === Number(stepStr))
    if (stepModel) stepModel.usage = usage
    const anchor = stepModel?.items.find(i => i.kind === 'assistant')
    usageSamples.push({
      seq: anchor?.seq ?? stepModel?.startSeq ?? 0,
      turn: Number(turnStr), step: Number(stepStr), usage,
    })
  }
  usageSamples.sort((a, b) => a.seq - b.seq)
  totals.billedInput = totals.input + totals.cacheRead + totals.cacheWrite

  const orderedTurns = [...turns.values()].sort((a, b) => a.turn - b.turn)
  for (const t of orderedTurns) t.steps.sort((a, b) => a.step - b.step)
  const startTime = events[0]?.time ?? session.header.createdAt
  const endTime = events.at(-1)?.time ?? startTime
  return {
    turns: orderedTurns,
    items,
    totals,
<<<<<<< HEAD
    modelTotals,
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    usageSamples,
    toolCalls,
    durationMs: endTime - startTime,
    startTime,
    endTime,
    eventCount: events.length,
    seedBoundarySeq,
    models: [...models],
    title: sessionTitle,
  }
}
