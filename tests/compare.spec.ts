import { describe, expect, it } from 'vitest'
import { compareSessions } from '../src/core/compare.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { sessionA, sessionB, sessionC } from '../demo/samples.js'

describe('compareSessions', () => {
  it('detects lineage and the divergence seq of a fork', () => {
    const result = compareSessions(parseSessionJsonl(sessionA()), parseSessionJsonl(sessionB()))
    expect(result.related).toBe(true)
    // A's seq 16 is turn/start; B's seq 16 is the end-seed marker → divergence at 16.
    expect(result.divergenceSeq).toBe(16)
  })

  it('produces symmetric headline stats', () => {
    const a = parseSessionJsonl(sessionA())
    const c = parseSessionJsonl(sessionC())
    const result = compareSessions(a, c, { a: 'A', b: 'C' })
    expect(result.a.turns).toBe(3)
    expect(result.b.turns).toBe(1)
    expect(result.a.toolCallCount).toBe(6)
    expect(result.b.toolCallCount).toBe(1)
    expect(result.a.toolErrors).toBe(1)
    expect(result.toolNames).toContain('bash')
    expect(result.toolNames).toContain('web_fetch')
  })

  it('marks unrelated-but-shared-parent sessions as related', () => {
    const b = parseSessionJsonl(sessionB())
    const c = parseSessionJsonl(sessionC())
    expect(compareSessions(b, c).related).toBe(true)
  })
})
