import { describe, expect, it } from 'vitest'
import { parseSessionJsonl } from '../src/core/decode.js'
import { buildTimeline } from '../src/core/timeline.js'
import { sessionA, sessionB } from '../demo/samples.js'

describe('buildTimeline', () => {
  const model = buildTimeline(parseSessionJsonl(sessionA()))

  it('groups turns and steps', () => {
    expect(model.turns.map(t => t.turn)).toEqual([1, 2, 3])
    expect(model.turns[2].steps.map(s => s.step)).toEqual([1, 2])
    expect(model.turns.every(t => t.endReason === 'completed')).toBe(true)
  })

  it('pairs tool calls with results and computes durations', () => {
    expect(model.toolCalls).toHaveLength(6)
    const install = model.toolCalls.find(c => c.callId === 'call_1')!
    expect(install.name).toBe('bash')
    expect(install.durationMs).toBe(16_650)
    const failing = model.toolCalls.find(c => c.callId === 'call_4')!
    expect(failing.error?.code).toBe('EXIT_1')
  })

  it('folds token usage last-wins per step, with disjoint billed input', () => {
    expect(model.usageSamples).toHaveLength(5)
    const input = 1_240 + 460 + 620 + 780 + 840
    const cacheRead = 0 + 1_180 + 2_310 + 3_050 + 3_420
    const cacheWrite = 900 + 300 + 240 + 260 + 180
    expect(model.totals.input).toBe(input)
    expect(model.totals.billedInput).toBe(input + cacheRead + cacheWrite)
    expect(model.totals.output).toBe(184 + 342 + 358 + 412 + 268)
    expect(model.totals.reasoning).toBe(96)
  })

  it('extracts models and meta items', () => {
    expect(model.models).toContain('deepseek-v4')
    const approvals = model.items.filter(i => i.type.startsWith('approval/'))
    expect(approvals).toHaveLength(2)
  })

  it('marks the seed boundary in a forked session', () => {
    const fork = buildTimeline(parseSessionJsonl(sessionB()))
    expect(fork.seedBoundarySeq).toBe(16)
    expect(fork.items.some(i => i.type === 'session/end-seed')).toBe(true)
  })

  it('keeps reasoning text and shows the system prompt', () => {
    const text = [
      { type: 'session', version: 0, id: 'reasoning', createdAt: 1 },
      { type: 'system/message', seq: 0, time: 1, data: { turn: 1, step: 1, message: { role: 'system', content: [{ type: 'text', text: 'be nice' }] } } },
      { type: 'turn/start', seq: 1, time: 2, data: { turn: 1 } },
      { type: 'step/start', seq: 2, time: 3, data: { turn: 1, step: 1 } },
      {
        type: 'assistant/message', seq: 3, time: 4,
        data: {
          turn: 1, step: 1,
          message: {
            role: 'assistant',
            source: { kind: 'model', model: 'deepseek-flash' },
            content: [{ type: 'reasoning', text: 'think first' }, { type: 'text', text: 'answer' }],
          },
          usage: { inputTokens: 10, outputTokens: 5 },
        },
      },
    ].map(line => JSON.stringify(line)).join('\n') + '\n'
    const model = buildTimeline(parseSessionJsonl(text))
    const assistant = model.items.find(item => item.kind === 'assistant')!
    expect(assistant.text).toBe('answer')
    expect(assistant.reasoningText).toBe('think first')
    expect(model.items.some(item => item.type === 'system/message' && item.text === 'be nice')).toBe(true)
    expect(Object.keys(model.modelTotals)).toContain('deepseek-flash')
  })
})
