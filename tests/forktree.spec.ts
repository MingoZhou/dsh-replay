import { describe, expect, it } from 'vitest'
import { parseSessionJsonl } from '../src/core/decode.js'
import { buildForkForest, lineageOf } from '../src/core/forktree.js'
import { sessionA, sessionB, sessionC, SESSION_A_ID, SESSION_B_ID, SESSION_C_ID } from '../demo/samples.js'

const entries = [sessionA(), sessionB(), sessionC()].map(text => ({
  header: parseSessionJsonl(text).header,
}))

describe('buildForkForest', () => {
  it('builds one root with two children', () => {
    const forest = buildForkForest(entries)
    expect(forest.roots.map(r => r.id)).toEqual([SESSION_A_ID])
    expect(forest.roots[0].children.map(c => c.id).sort()).toEqual([SESSION_B_ID, SESSION_C_ID].sort())
    expect(forest.maxDepth).toBe(1)
    expect(forest.rowCount).toBe(3)
  })

  it('records seedLength on fork edges', () => {
    const forest = buildForkForest(entries)
    const fork = forest.nodes.get(SESSION_B_ID)!
    expect(fork.seedLength).toBe(16)
  })

  it('treats a child with a missing parent as an orphan root', () => {
    const forest = buildForkForest([
      { header: { id: 'x', createdAt: 1, parentSession: 'missing' } },
    ])
    expect(forest.roots[0].orphan).toBe(true)
  })

  it('survives lineage cycles without hanging', () => {
    const forest = buildForkForest([
      { header: { id: 'p', createdAt: 1, parentSession: 'q' } },
      { header: { id: 'q', createdAt: 2, parentSession: 'p' } },
    ])
    expect(forest.rowCount).toBeGreaterThan(0)
  })

  it('lineageOf returns root→leaf path', () => {
    const forest = buildForkForest(entries)
    expect(lineageOf(forest, SESSION_B_ID).map(n => n.id)).toEqual([SESSION_A_ID, SESSION_B_ID])
  })
})
