import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICING, cacheHitRate, estimateCost, formatMoney, isPeak, matchRule, priceBuckets, sanitizePricing,
} from '../src/core/cost.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { buildTimeline } from '../src/core/timeline.js'
import { sessionA, sessionE } from '../demo/samples.js'

const M = 1_000_000
const bucket = (model: string, peak: boolean) => ({ model, peak, input: M, cacheRead: M, cacheWrite: 0, output: M })

describe('pricing', () => {
  it('prices DeepSeek in CNY with separate peak rates', () => {
    expect(priceBuckets([bucket('deepseek-flash', false)], DEFAULT_PRICING).cny).toBeCloseTo(1 + 0.02 + 4, 6)
    expect(priceBuckets([bucket('deepseek-flash', true)], DEFAULT_PRICING).cny).toBeCloseTo(2 + 0.04 + 8, 6)
    expect(priceBuckets([bucket('deepseek-v4-pro', false)], DEFAULT_PRICING).cny).toBeCloseTo(4.5 + 0.15 + 13.5, 6)
  })
  it('prefers the more specific rule and reports unpriced models', () => {
    expect(matchRule('deepseek-v4-pro-0813', DEFAULT_PRICING)?.id).toBe('deepseek-pro')
    expect(matchRule('deepseek-v4-flash', DEFAULT_PRICING)?.id).toBe('deepseek-flash')
    const estimate = priceBuckets([bucket('mystery-lm', false)], DEFAULT_PRICING)
    expect(estimate.cny).toBe(0)
    expect(estimate.unpriced).toEqual(['mystery-lm'])
  })
  it('converts USD-quoted rules with the configured rate', () => {
    const estimate = priceBuckets([{ model: 'claude-x', peak: false, input: M, cacheRead: 0, cacheWrite: 0, output: 0 }], DEFAULT_PRICING)
    expect(estimate.cny).toBeCloseTo(3 * DEFAULT_PRICING.usdToCny, 6)
  })
  it('detects the Beijing-time peak windows', () => {
    expect(isPeak(Date.UTC(2026, 10, 11, 1, 40), DEFAULT_PRICING)).toBe(true) // 09:40 +08
    expect(isPeak(Date.UTC(2026, 10, 11, 4, 30), DEFAULT_PRICING)).toBe(false) // 12:30 +08
    expect(isPeak(Date.UTC(2026, 10, 10, 12, 30), DEFAULT_PRICING)).toBe(false) // 20:30 +08
  })
  it('prices a session step by step, with a monotone cumulative series', () => {
    const model = buildTimeline(parseSessionJsonl(sessionA()))
    const cost = estimateCost(model)
    expect(cost.cny).toBeGreaterThan(0)
    expect(cost.peakShare).toBe(0)
    expect(cost.cumulative).toHaveLength(model.usageSamples.length)
    expect(cost.cumulative.at(-1)).toBeCloseTo(cost.cny, 9)
    expect(cost.savedByCache).toBeGreaterThan(0)
  })
  it('splits a mixed-model peak session by model', () => {
    const cost = estimateCost(buildTimeline(parseSessionJsonl(sessionE())))
    expect(cost.byModel.map(m => m.model).sort()).toEqual(['deepseek-flash', 'deepseek-v4-pro'])
    expect(cost.peakShare).toBeGreaterThan(0.5)
  })
  it('formats in the display currency', () => {
    expect(formatMoney(4.2)).toBe('¥4.20')
    expect(formatMoney(0.042)).toBe('¥0.042')
    expect(formatMoney(0.0042)).toBe('¥0.0042')
    expect(formatMoney(7.1, { displayCurrency: 'USD', usdToCny: 7.1 })).toBe('$1.00')
  })
  it('sanitizes a persisted config', () => {
    expect(sanitizePricing(null).rules.length).toBe(DEFAULT_PRICING.rules.length)
    const custom = sanitizePricing({ displayCurrency: 'USD', usdToCny: -3, rules: [{ pattern: 'x', rate: { input: 1, cacheRead: 0, output: 2 } }, { nope: 1 }] })
    expect(custom.displayCurrency).toBe('USD')
    expect(custom.usdToCny).toBe(DEFAULT_PRICING.usdToCny)
    expect(custom.rules).toHaveLength(1)
  })
  it('computes cache hit rate over billed input', () => {
    expect(cacheHitRate({ cacheRead: 75, billedInput: 100 })).toBe(0.75)
    expect(cacheHitRate({ cacheRead: 0, billedInput: 0 })).toBe(0)
  })
})
