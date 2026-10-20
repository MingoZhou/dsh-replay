import { describe, expect, it } from 'vitest'
<<<<<<< HEAD
import { estimateCost, estimateCostDetailed, formatUsd } from '../src/core/cost.js'
=======
import { estimateCost, formatUsd } from '../src/core/cost.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
import { buildTimeline } from '../src/core/timeline.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { sessionA } from '../demo/samples.js'

describe('estimateCost', () => {
  it('matches the deepseek rate and computes disjoint-count cost', () => {
    const totals = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0, reasoning: 0, billedInput: 2_000_000 }
    const cost = estimateCost(totals, ['deepseek-v4'])!
    expect(cost.label).toBe('DeepSeek')
    expect(cost.usd).toBeCloseTo(0.27 + 0.07 + 1.1, 6)
  })

  it('prefers the more specific pro rate', () => {
    const totals = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 1_000_000 }
    expect(estimateCost(totals, ['deepseek-v4-pro-0813'])!.label).toBe('DeepSeek Pro')
  })

  it('returns undefined for unknown models and works end-to-end on a session', () => {
    expect(estimateCost({ input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 1 }, ['mystery-lm'])).toBeUndefined()
    const model = buildTimeline(parseSessionJsonl(sessionA()))
    const cost = estimateCost(model.totals, model.models)!
    expect(cost.usd).toBeGreaterThan(0)
  })

<<<<<<< HEAD
  it('prices a mixed-model session per model instead of applying one rate to all tokens', () => {
    const flash = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 1_000_000 }
    const pro = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, billedInput: 1_000_000 }
    const result = estimateCostDetailed({ 'deepseek-flash': flash, 'deepseek-v4-pro': pro })!
    expect(result.parts).toHaveLength(2)
    expect(result.usd).toBeCloseTo(0.27 + 1.1, 6)
  })

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  it('formats sub-cent amounts with enough precision', () => {
    expect(formatUsd(0.0042)).toBe('$0.0042')
    expect(formatUsd(0.042)).toBe('$0.042')
    expect(formatUsd(4.2)).toBe('$4.20')
  })
})
