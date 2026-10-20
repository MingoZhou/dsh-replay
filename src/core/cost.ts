/**
 * Cost estimation from token totals. Prices are USD per 1M tokens and are
 * ESTIMATES — provider list prices change; the UI lets you override them.
 * Cache-write falls back to the input rate when a provider doesn't price it
 * separately.
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
  /** ISO date the default rates were last checked. */
  updatedAt?: string
  source?: string
}

/** Editable defaults — first match wins, most specific first. */
export const DEFAULT_PRICING: PricingEntry[] = [
  {
    match: /deepseek.*pro/iu,
    rate: { input: 1.1, cacheRead: 0.27, output: 4.4 },
    label: 'DeepSeek Pro',
    updatedAt: '2026-08-18',
    source: 'provider list price (estimate)',
  },
  {
    match: /deepseek/iu,
    rate: { input: 0.27, cacheRead: 0.07, output: 1.1 },
    label: 'DeepSeek',
    updatedAt: '2026-08-18',
    source: 'provider list price (estimate)',
  },
  {
    match: /claude|anthropic/iu,
    rate: { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
    label: 'Claude',
    updatedAt: '2026-08-18',
    source: 'provider list price (estimate)',
  },
  {
    match: /gpt|^o\d|openai|codex/iu,
    rate: { input: 2.5, cacheRead: 1.25, output: 10 },
    label: 'OpenAI',
    updatedAt: '2026-08-18',
    source: 'provider list price (estimate)',
  },
  {
    match: /gemini/iu,
    rate: { input: 1.25, cacheRead: 0.31, output: 10 },
    label: 'Gemini',
    updatedAt: '2026-08-18',
    source: 'provider list price (estimate)',
  },
]

export interface CostEstimate {
  usd: number
  label: string
}

export interface CostPart extends CostEstimate {
  model: string
  totals: TokenTotals
}

export interface CostEstimateDetailed extends CostEstimate {
  parts: CostPart[]
}

function costOf(totals: TokenTotals, rate: PricingRate): number {
  return (
    (totals.input * rate.input +
      totals.cacheRead * rate.cacheRead +
      totals.cacheWrite * (rate.cacheWrite ?? rate.input) +
      totals.output * rate.output) /
    1_000_000
  )
}

export function estimateCost(
  totals: TokenTotals,
  models: string[],
  pricing: PricingEntry[] = DEFAULT_PRICING,
): CostEstimate | undefined {
  const entry = pricing.find(p => models.some(m => p.match.test(m)))
  if (entry === undefined) return undefined
  return { usd: costOf(totals, entry.rate), label: entry.label }
}

/**
 * Per-model cost. A session can switch models mid-run; charging every token at
 * the first matching rate over- or under-estimates the bill.
 */
export function estimateCostDetailed(
  modelTotals: Record<string, TokenTotals>,
  pricing: PricingEntry[] = DEFAULT_PRICING,
): CostEstimateDetailed | undefined {
  if (modelTotals === undefined || modelTotals === null) return undefined
  const parts: CostPart[] = []
  for (const [model, totals] of Object.entries(modelTotals)) {
    const entry = pricing.find(p => p.match.test(model))
    if (entry === undefined) continue
    parts.push({ model, label: entry.label, usd: costOf(totals, entry.rate), totals })
  }
  if (parts.length === 0) return undefined
  const usd = parts.reduce((sum, part) => sum + part.usd, 0)
  const labels = [...new Set(parts.map(part => part.label))]
  return { usd, label: labels.length === 1 ? labels[0] : `Mixed (${labels.length} models)`, parts }
}

export function formatUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

/** Approximate CNY amount at a caller-supplied exchange rate. */
export function formatCny(usd: number, rate = 7.2): string {
  const cny = usd * rate
  if (cny >= 1) return `¥${cny.toFixed(2)}`
  if (cny >= 0.01) return `¥${cny.toFixed(3)}`
  return `¥${cny.toFixed(4)}`
}

export function formatMoney(usd: number, currency: 'USD' | 'CNY', rate = 7.2): string {
  return currency === 'CNY' ? formatCny(usd, rate) : formatUsd(usd)
}
