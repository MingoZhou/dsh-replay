import { describe, expect, it } from 'vitest'
import { alignToolCalls, compareSessions } from '../src/core/compare.js'
import { buildDashboard, baselineFor } from '../src/core/dashboard.js'
import { DEFAULT_PRICING } from '../src/core/cost.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { buildForkForest, lineageOf } from '../src/core/forktree.js'
import { redactSession, redactText } from '../src/core/redact.js'
import { summarizeSession } from '../src/core/summary.js'
import {
  SAMPLE_LOGS, sessionA, sessionB, sessionC, sessionE, SESSION_A_ID, SESSION_B_ID, SESSION_C_ID,
} from '../demo/samples.js'

describe('redaction', () => {
  it('masks keys, env assignments and home paths without touching the original', () => {
    const session = parseSessionJsonl(sessionE())
    const before = JSON.stringify(session)
    const result = redactSession(session)
    const after = JSON.stringify(result.session)
    expect(JSON.stringify(session)).toBe(before)
    expect(after).not.toContain('sk-live-9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c')
    expect(after).not.toContain('mingo')
    expect(result.session.header.cwd).toBe('C:\\Users\\user\\projects\\glass-ark')
    expect(result.hits.some(h => h.category === 'secret')).toBe(true)
    expect(result.hits.some(h => h.category === 'path')).toBe(true)
    expect(result.hits.every(h => !h.sample.includes('9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c'))).toBe(true)
  })
  it('masks the value of a sensitive assignment but keeps its name', () => {
    expect(redactText('JWT_SECRET=dev-secret-do-not-ship').text).toBe('JWT_SECRET=‹redacted›')
    expect(redactText('{"content":"API_KEY=abcd1234efgh"}').text).toContain('API_KEY=‹redacted›')
    expect(redactText('Authorization: Bearer abcdefghijklmnopqrstuvwx').text).toContain('Bearer ‹redacted›')
    expect(redactText('git clone https://bob:hunter2pass@example.com/r.git').text).toContain('bob:‹redacted›@')
    expect(redactText('/Users/alice/code and /home/bob/x').text).toBe('/Users/user/code and /home/user/x')
  })
  it('leaves ordinary text alone and respects the switches', () => {
    expect(redactText('the token count was 42 and password policy is strict').total).toBe(0)
    expect(redactText('mail me: a.b@example.com').total).toBe(0)
    expect(redactText('mail me: a.b@example.com', { secrets: true, paths: true, emails: true }).total).toBe(1)
    expect(redactText('/home/bob/x', { secrets: true, paths: false, emails: false }).text).toBe('/home/bob/x')
  })
  it('can export a seq range only', () => {
    const result = redactSession(parseSessionJsonl(sessionA()), undefined, { fromSeq: 5, toSeq: 9 })
    expect(result.session.events.map(e => e.seq)).toEqual([5, 6, 7, 8, 9])
  })
})

describe('lineage', () => {
  const entries = [sessionA(), sessionB(), sessionC()].map(text => {
    const session = parseSessionJsonl(text)
    const summary = summarizeSession(session)
    return { header: session.header, rootKey: summary.rootKey }
  })
  it('infers a v4 fork (no parentSession) from the shared first prompt', () => {
    const forest = buildForkForest(entries)
    expect(forest.roots.map(r => r.id)).toEqual([SESSION_A_ID])
    expect(forest.roots[0].children.map(c => c.id).sort()).toEqual([SESSION_B_ID, SESSION_C_ID].sort())
    expect(forest.nodes.get(SESSION_B_ID)!.inferred).toBe(true)
    expect(forest.nodes.get(SESSION_C_ID)!.inferred).toBeUndefined()
    expect(lineageOf(forest, SESSION_B_ID).map(n => n.id)).toEqual([SESSION_A_ID, SESSION_B_ID])
  })
  it('treats a child with a missing parent as an orphan root and survives cycles', () => {
    expect(buildForkForest([{ header: { id: 'x', createdAt: 1, parentSession: 'missing' } }]).roots[0].orphan).toBe(true)
    const cyc = buildForkForest([
      { header: { id: 'p', createdAt: 1, parentSession: 'q' } },
      { header: { id: 'q', createdAt: 2, parentSession: 'p' } },
    ])
    expect(cyc.rowCount).toBe(2)
  })
})

describe('compareSessions', () => {
  it('relates a fork to its source and finds the divergence', () => {
    const result = compareSessions(parseSessionJsonl(sessionA()), parseSessionJsonl(sessionB()))
    expect(result.related).toBe(true)
    expect(result.divergenceSeq).toBeGreaterThan(0)
    // Turn 1's two calls are shared; the runs differ from the third row on.
    expect(result.alignment.slice(0, 2).every(r => r.kind === 'same')).toBe(true)
    expect(result.firstDifference).toBe(2)
  })
  it('produces headline stats and no divergence for unrelated runs', () => {
    expect(compareSessions(parseSessionJsonl(sessionA()), parseSessionJsonl(sessionC())).related).toBe(true)
    const result = compareSessions(parseSessionJsonl(sessionA()), parseSessionJsonl(sessionE()), { a: 'A', b: 'E' })
    expect(result.a.turns).toBe(3)
    expect(result.a.toolErrors).toBe(1)
    expect(result.toolNames).toContain('pwsh')
    expect(result.related).toBe(false)
    expect(result.divergenceSeq).toBeUndefined()
  })
  it('aligns sequences with insertions', () => {
    const call = (name: string, args = '{}') => ({ callId: name, name, argumentsRaw: args, callSeq: 0, callTime: 0 })
    const rows = alignToolCalls([call('a'), call('b'), call('c')], [call('a'), call('x'), call('b', '{"n":1}'), call('c')])
    expect(rows.map(r => r.kind)).toEqual(['same', 'only-b', 'args', 'same'])
  })
})

describe('dashboard', () => {
  const summaries = SAMPLE_LOGS.map(({ jsonl, title }) => summarizeSession(parseSessionJsonl(jsonl), { title }))
  const dash = buildDashboard(summaries, DEFAULT_PRICING)
  it('totals equal the sum of its parts', () => {
    expect(dash.totals.sessions).toBe(SAMPLE_LOGS.length)
    expect(dash.days.reduce((n, d) => n + d.cny, 0)).toBeCloseTo(dash.totals.cny, 6)
    expect(dash.byProject.reduce((n, p) => n + p.cny, 0)).toBeCloseTo(dash.totals.cny, 6)
    expect(dash.byModel.reduce((n, m) => n + m.cny, 0)).toBeCloseTo(dash.totals.cny, 6)
    expect(dash.activity.flat().reduce((a, b) => a + b, 0)).toBe(dash.totals.tokens)
  })
  it('ranks the most expensive sessions and aggregates tools', () => {
    expect(dash.top[0].cny).toBeGreaterThanOrEqual(dash.top[1].cny)
    const pwsh = dash.tools.find(t => t.name === 'pwsh')!
    expect(pwsh.errors).toBe(5)
    expect(pwsh.errorRate).toBeCloseTo(5 / pwsh.count, 6)
  })
  it('re-prices from buckets when the table changes', () => {
    const doubled = structuredClone(DEFAULT_PRICING)
    for (const rule of doubled.rules) {
      for (const rate of [rule.rate, rule.peak]) {
        if (!rate) continue
        rate.input *= 2; rate.cacheRead *= 2; rate.output *= 2
        if (rate.cacheWrite !== undefined) rate.cacheWrite *= 2
      }
    }
    expect(buildDashboard(summaries, doubled).totals.cny).toBeCloseTo(dash.totals.cny * 2, 6)
  })
  it('builds a median baseline from other root sessions', () => {
    const base = baselineFor(dash.sessions, SESSION_A_ID)
    expect(base.n).toBe(10)
    expect(base.cny).toBeGreaterThan(0)
  })
})
