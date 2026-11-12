import { describe, expect, it } from 'vitest'
import { auditSession } from '../src/core/audit.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { compactDiff, diffLines, diffStat } from '../src/core/diff.js'
import { collectFileChanges, parsePatch } from '../src/core/files.js'
import { buildInsights, findLoops } from '../src/core/insights.js'
import { buildTimeline } from '../src/core/timeline.js'
import { sessionA, sessionD, sessionE } from '../demo/samples.js'

const load = (text: string) => {
  const session = parseSessionJsonl(text)
  const model = buildTimeline(session)
  return { session, model, insights: buildInsights(model, auditSession(session)) }
}

describe('buildInsights', () => {
  it('scores a clean session 100 with no deductions', () => {
    const { insights } = load(sessionD())
    expect(insights.score).toBe(100)
    expect(insights.deductions).toEqual([])
  })
  it('finds the retry loop and deducts for it', () => {
    const { insights, model } = load(sessionE())
    const loop = insights.loops[0]
    expect(loop.name).toBe('pwsh')
    expect(loop.consecutive).toBe(4)
    expect(loop.count).toBe(5)
    expect(insights.deductions.map(d => d.key).sort()).toEqual(['abnormal', 'critical', 'failures', 'loops', 'retries', 'serious'])
    expect(insights.score).toBeLessThan(70)
    expect(insights.failedCalls).toHaveLength(5)
    expect(insights.slowestCalls[0].durationMs).toBe(Math.max(...model.toolCalls.map(c => c.durationMs ?? 0)))
  })
  it('reports time split, cache hit rate and context growth', () => {
    const { insights } = load(sessionE())
    expect(insights.idleMs).toBeGreaterThan(0)
    expect(insights.modelMs + insights.toolMs).toBeLessThanOrEqual(insights.activeMs)
    expect(insights.cacheHitRate).toBeGreaterThan(0.6)
    expect(insights.compactions).toBe(1)
    // The compaction shows up as a drop in prompt size.
    const sizes = insights.context.map(c => c.tokens)
    expect(sizes.some((s, i) => i > 0 && s < sizes[i - 1] * 0.6)).toBe(true)
    expect(insights.avgTtftMs).toBeGreaterThan(0)
  })
  it('ignores key order when matching repeated calls', () => {
    const call = (args: string, seq: number) => ({ callId: String(seq), name: 't', argumentsRaw: args, args: JSON.parse(args), callSeq: seq, callTime: seq })
    expect(findLoops([call('{"a":1,"b":2}', 1), call('{"b":2,"a":1}', 2), call('{"a":1,"b":2}', 3)])[0].count).toBe(3)
  })
})

describe('file changes', () => {
  it('rebuilds writes and edits per file', () => {
    const { model } = load(sessionA())
    const report = collectFileChanges(model)
    expect(report.files.map(f => f.path).sort()).toEqual(['api/.env', 'api/middleware/auth.js', 'api/server.js'])
    const auth = report.files.find(f => f.path.endsWith('auth.js'))!
    expect(auth.added).toBe(1)
    expect(auth.removed).toBe(1)
    expect(report.files.find(f => f.path === 'api/server.js')!.status).toBe('created')
  })
  it('parses apply_patch envelopes', () => {
    const { model } = load(sessionE())
    const report = collectFileChanges(model)
    expect(report.files.find(f => f.path === 'src/render/units.ts')!.status).toBe('created')
    expect(report.files.find(f => f.path === 'src/render/lights.ts')!.ops[0].lines.map(l => l.op).join('')).toBe('-+ ')
    expect(parsePatch('*** Begin Patch\n*** Delete File: a.txt\n*** End Patch')[0].kind).toBe('delete')
  })
  it('diffs lines and compacts context', () => {
    const lines = diffLines('a\nb\nc\nd\ne\nf\ng\nh', 'a\nb\nc\nd\nE\nf\ng\nh')
    expect(diffStat(lines)).toEqual({ added: 1, removed: 1 })
    const compact = compactDiff(lines, 1)
    expect(compact[0]).toEqual({ op: '…', text: '3' })
    expect(compact.filter(l => l.op === '+' || l.op === '-')).toHaveLength(2)
  })
})
