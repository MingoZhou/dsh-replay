import { describe, expect, it } from 'vitest'
import { expandChunkRow, parseSessionJsonl } from '../src/core/decode.js'
import { sessionA, SESSION_A_ID } from '../demo/samples.js'

describe('parseSessionJsonl', () => {
  it('parses header and events with contiguous seqs', () => {
    const parsed = parseSessionJsonl(sessionA())
    expect(parsed.header.id).toBe(SESSION_A_ID)
    expect(parsed.malformed).toHaveLength(0)
    expect(parsed.events[0].seq).toBe(0)
    for (let i = 1; i < parsed.events.length; i++) {
      expect(parsed.events[i].seq).toBe(parsed.events[i - 1].seq + 1)
    }
  })

  it('expands packed chunk rows into assistant/chunk events', () => {
    const parsed = parseSessionJsonl(sessionA())
    const chunks = parsed.events.filter(e => e.type === 'assistant/chunk')
    expect(chunks.map(c => c.seq)).toEqual([5, 6, 7])
    // time0 + cumulative dt
    expect(chunks[1].time - chunks[0].time).toBe(140)
    expect(chunks[2].time - chunks[1].time).toBe(220)
  })

  it('tolerates a torn tail without dropping committed events', () => {
    const text = sessionA()
    const torn = text + '{"type":"turn/start","seq":43,"ti'
    const parsed = parseSessionJsonl(torn)
    expect(parsed.events.at(-1)?.seq).toBe(42)
    expect(parsed.malformed).toHaveLength(1)
    expect(parsed.malformed[0].error).toContain('torn tail')
  })

  it('throws on a log with no header', () => {
    expect(() => parseSessionJsonl('{"type":"turn/start","seq":0,"time":1,"data":{"turn":1}}\n')).toThrow(
      /header/u,
    )
  })

  it('expandChunkRow reconstructs tool-call deltas with name only on the first', () => {
    const events = expandChunkRow({
      type: 'tool-call-chunks', seq0: 10, time0: 100,
      data: { turn: 1, step: 1, index: 0, dt: [50], id: 'call_x', name: 'bash', args: ['{"comm', 'and":"ls"}'] },
    })
    expect(events).toHaveLength(2)
    const first = events[0].data as { chunk: { name?: string } }
    const second = events[1].data as { chunk: { name?: string } }
    expect(first.chunk.name).toBe('bash')
    expect(second.chunk.name).toBeUndefined()
  })
})
