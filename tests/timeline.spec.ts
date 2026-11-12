import { describe, expect, it } from 'vitest'
import { expandChunkRow, parseSessionJsonl } from '../src/core/decode.js'
import { buildTimeline } from '../src/core/timeline.js'
import { sessionA, sessionB, sessionE, SESSION_A_ID } from '../demo/samples.js'
import { LEGACY_JSONL } from './legacy-fixture.js'

describe('parseSessionJsonl', () => {
  it('parses header and events with contiguous seqs', () => {
    const parsed = parseSessionJsonl(sessionA())
    expect(parsed.header.id).toBe(SESSION_A_ID)
    expect(parsed.malformed).toHaveLength(0)
    parsed.events.forEach((event, i) => expect(event.seq).toBe(i))
  })
  it('tolerates a torn tail without dropping committed events', () => {
    const whole = parseSessionJsonl(sessionA())
    const parsed = parseSessionJsonl(sessionA() + '{"type":"turn/start","seq":999,"ti')
    expect(parsed.events).toHaveLength(whole.events.length)
    expect(parsed.malformed[0].error).toContain('torn tail')
  })
  it('throws on a log with no header', () => {
    expect(() => parseSessionJsonl('{"type":"turn/start","seq":0,"time":1,"data":{"turn":1}}\n')).toThrow(/header/u)
  })
  it('expands legacy packed chunk rows', () => {
    const chunks = parseSessionJsonl(LEGACY_JSONL).events.filter(e => e.type === 'assistant/chunk')
    expect(chunks.map(c => c.seq)).toEqual([4, 5, 6])
    expect(chunks[2].time - chunks[1].time).toBe(220)
    const calls = expandChunkRow({
      type: 'tool-call-chunks', seq0: 10, time0: 100,
      data: { turn: 1, step: 1, index: 0, dt: [50], id: 'call_x', name: 'bash', args: ['{"comm', 'and":"ls"}'] },
    })
    expect((calls[0].data as { chunk: { name?: string } }).chunk.name).toBe('bash')
    expect((calls[1].data as { chunk: { name?: string } }).chunk.name).toBeUndefined()
  })
})

describe('buildTimeline (format v4)', () => {
  const model = buildTimeline(parseSessionJsonl(sessionA()))
  it('groups turns and steps', () => {
    expect(model.turns.map(t => t.turn)).toEqual([1, 2, 3])
    expect(model.turns[2].steps.map(s => s.step)).toEqual([1, 2, 3])
    expect(model.turns.every(t => t.endReason === 'completed')).toBe(true)
  })
  it('pairs tool calls with results, parses arguments, flags failures', () => {
    expect(model.toolCalls).toHaveLength(7)
    const install = model.toolCalls[0]
    expect(install.name).toBe('bash')
    expect(install.args?.['command']).toContain('npm init')
    expect(install.durationMs).toBe(16_400)
    const failing = model.toolCalls.filter(c => c.failed)
    expect(failing).toHaveLength(1)
    expect(failing[0].error?.code).toBe('EXIT_1')
    expect(failing[0].resultText).toContain('2 failed')
  })
  it('folds usage with disjoint billed input and names the model per step', () => {
    expect(model.usageSamples).toHaveLength(7)
    expect(model.totals.billedInput).toBe(model.totals.input + model.totals.cacheRead + model.totals.cacheWrite)
    expect(model.totals.reasoning).toBe(96)
    expect(model.usageSamples.every(s => s.model === 'deepseek-flash')).toBe(true)
    expect(model.models).toEqual(['deepseek-flash'])
  })
  it('captures reasoning text and first-token latency from the embedded stream', () => {
    const reasoning = model.items.find(i => i.reasoningText !== undefined)!
    expect(reasoning.reasoningText).toContain('process.env.JWT_SECRET')
    const step = model.turns[0].steps[0]
    expect(step.ttftMs).toBeGreaterThan(0)
    expect(step.ttftMs!).toBeLessThan(step.llmMs!)
  })
  it('separates active time from idle gaps', () => {
    expect(model.activeMs).toBeLessThan(model.durationMs)
    expect(model.activeMs).toBeGreaterThan(0)
  })
  it('marks the seed boundary in a forked session', () => {
    const fork = buildTimeline(parseSessionJsonl(sessionB()))
    expect(fork.seedBoundarySeq).toBeGreaterThan(0)
    expect(fork.items.some(i => i.type === 'session/end-seed')).toBe(true)
  })
  it('counts retries, compactions and abnormal turn ends', () => {
    const long = buildTimeline(parseSessionJsonl(sessionE()))
    expect(long.retries).toBe(1)
    expect(long.compactions).toBe(1)
    expect(long.turns.at(-1)?.endReason).toBe('aborted')
    expect(new Set(long.models)).toEqual(new Set(['deepseek-v4-pro', 'deepseek-flash']))
  })
})

describe('buildTimeline (legacy v0)', () => {
  const model = buildTimeline(parseSessionJsonl(LEGACY_JSONL))
  it('still reads results, errors and usage', () => {
    expect(model.toolCalls[0].resultText).toBe('file.txt')
    expect(model.toolCalls[0].failed).toBe(true)
    expect(model.totals.billedInput).toBe(150)
  })
  it('applies index-based surface replacement', () => {
    expect(model.items.filter(i => i.shadowed).map(i => i.seq)).toEqual([2])
  })
})
