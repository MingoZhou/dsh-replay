/**
 * Cost estimation from token totals. Prices are USD per 1M tokens and are
 * ESTIMATES — provider list prices change; override the table if you need
 * exact numbers. Cache-write falls back to the input rate when a provider
 * doesn't price it separately.
 */
import type { TokenTotals } from './timeline.js'

export interface PricingRate {
  /** USD per 1M uncached input tokens. */
  input: number
  /** USD per 1M cache-read tokens. */
  cacheRead: number
  /** USD per 1M cache-write tokens (defaults to `input`). */
  cacheWrite?: number
  /** USD per 1M output tokens. */
  output: number
}

export interface PricingEntry {
  match: RegExp
  rate: PricingRate
  label: string
}

/** Editable defaults — first match wins, most specific first. */
export const DEFAULT_PRICING: PricingEntry[] = [
  { match: /deepseek.*pro/iu, rate: { input: 1.1, cacheRead: 0.27, output: 4.4 }, label: 'DeepSeek Pro' },
  { match: /deepseek/iu, rate: { input: 0.27, cacheRead: 0.07, output: 1.1 }, label: 'DeepSeek' },
  { match: /claude|anthropic/iu, rate: { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 }, label: 'Claude' },
  { match: /gpt|^o\d|openai|codex/iu, rate: { input: 2.5, cacheRead: 1.25, output: 10 }, label: 'OpenAI' },
  { match: /gemini/iu, rate: { input: 1.25, cacheRead: 0.31, output: 10 }, label: 'Gemini' },
]

export interface CostEstimate {
  usd: number
  label: string
}

export function estimateCost(
  totals: TokenTotals,
  models: string[],
  pricing: PricingEntry[] = DEFAULT_PRICING,
): CostEstimate | undefined {
  const entry = pricing.find(p => models.some(m => p.match.test(m)))
  if (entry === undefined) return undefined
  const { rate } = entry
  const usd =
    (totals.input * rate.input +
      totals.cacheRead * rate.cacheRead +
      totals.cacheWrite * (rate.cacheWrite ?? rate.input) +
      totals.output * rate.output) /
    1_000_000
  return { usd, label: entry.label }
}

export function formatUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}
