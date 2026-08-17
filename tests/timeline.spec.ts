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
})
