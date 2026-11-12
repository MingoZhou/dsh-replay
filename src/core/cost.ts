/**
 * Cost estimation. Every step is priced with the model that actually answered
 * it and — for providers with peak/off-peak tariffs — the tariff in force at
 * the step's timestamp. Amounts are kept in CNY internally (DeepSeek bills in
 * CNY) and converted for display.
 *
 * The table is plain JSON so the UI can edit and persist it. Prices are
 * ESTIMATES: list prices change, so check them against your provider's page.
 */
import type { TimelineModel, TokenTotals, UsageSample } from './timeline.js'
import type { TokenUsage } from './types.js'

export type Currency = 'CNY' | 'USD'

export interface PricingRate {
  /** Per 1M uncached input tokens. */
  input: number
  /** Per 1M cache-read tokens. */
  cacheRead: number
  /** Per 1M cache-write tokens (defaults to `input`). */
  cacheWrite?: number
  /** Per 1M output tokens. */
  output: number
}

export interface PricingRule {
  id: string
  label: string
  /** Case-insensitive regular expression source matched against the model id. */
  pattern: string
  /** Currency the rates are quoted in. */
  currency: Currency
  /** Off-peak (or only) tariff. */
  rate: PricingRate
  /** Peak tariff, applied inside `PricingConfig.peakHours` when present. */
  peak?: PricingRate
  /** False for reference prices that were not checked against a price page. */
  verified?: boolean
}

export interface PricingConfig {
  /** First match wins — keep the most specific rule first. */
  rules: PricingRule[]
  displayCurrency: Currency
  /** CNY per 1 USD. */
  usdToCny: number
  /** Peak windows as [startHour, endHour) in `peakUtcOffset` local time. */
  peakHours: [number, number][]
  peakUtcOffset: number
}

/**
 * DeepSeek rows follow the official CNY price page as of 2026-10
 * (off-peak / peak). The other rows are rough USD reference prices kept so a
 * mixed-provider session is not silently free — edit them before relying on them.
 */
export const DEFAULT_PRICING: PricingConfig = {
  displayCurrency: 'CNY',
  usdToCny: 7.1,
  peakHours: [[9, 12], [14, 18]],
  peakUtcOffset: 8,
  rules: [
    {
      id: 'deepseek-pro', label: 'DeepSeek V4 Pro', pattern: 'deepseek.*pro', currency: 'CNY', verified: true,
      rate: { input: 4.5, cacheRead: 0.15, output: 13.5 },
      peak: { input: 9, cacheRead: 0.3, output: 27 },
    },
    {
      id: 'deepseek-flash', label: 'DeepSeek Flash', pattern: 'deepseek', currency: 'CNY', verified: true,
      rate: { input: 1, cacheRead: 0.02, output: 4 },
      peak: { input: 2, cacheRead: 0.04, output: 8 },
    },
    {
      id: 'claude', label: 'Claude', pattern: 'claude|anthropic', currency: 'USD', verified: false,
      rate: { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
    },
    {
      id: 'openai', label: 'OpenAI', pattern: 'gpt|^o\\d|openai|codex', currency: 'USD', verified: false,
      rate: { input: 2.5, cacheRead: 1.25, output: 10 },
    },
    {
      id: 'gemini', label: 'Gemini', pattern: 'gemini', currency: 'USD', verified: false,
      rate: { input: 1.25, cacheRead: 0.31, output: 10 },
    },
  ],
}

export function isPeak(time: number, config: PricingConfig): boolean {
  if (config.peakHours.length === 0) return false
  const local = new Date(time + config.peakUtcOffset * 3_600_000)
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60
  return config.peakHours.some(([from, to]) => hour >= from && hour < to)
}

export function matchRule(model: string | undefined, config: PricingConfig): PricingRule | undefined {
  if (model === undefined) return undefined
  return config.rules.find(rule => {
    try {
      return new RegExp(rule.pattern, 'iu').test(model)
    } catch {
      return false
    }
  })
}

export interface CostParts {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

const ZERO_PARTS = (): CostParts => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 })

/** One priceable slice of usage: a model, whether it ran at peak, and disjoint token counts. */
export interface UsageBucket {
  model: string
  peak: boolean
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

/** Price one bucket; amounts in CNY. Undefined when no rule matches the model. */
export function priceBucket(bucket: UsageBucket, config: PricingConfig): { parts: CostParts; rule: PricingRule } | undefined {
  const rule = matchRule(bucket.model, config)
  if (rule === undefined) return undefined
  const rate = bucket.peak && rule.peak !== undefined ? rule.peak : rule.rate
  const fx = rule.currency === 'USD' ? config.usdToCny : 1
  const per = (tokens: number, price: number): number => (tokens * price * fx) / 1_000_000
  return {
    rule,
    parts: {
      input: per(bucket.input, rate.input),
      cacheRead: per(bucket.cacheRead, rate.cacheRead),
      cacheWrite: per(bucket.cacheWrite, rate.cacheWrite ?? rate.input),
      output: per(bucket.output, rate.output),
    },
  }
}

export function bucketOf(usage: TokenUsage, model: string | undefined, time: number, config: PricingConfig): UsageBucket {
  return {
    model: model ?? 'unknown',
    peak: isPeak(time, config),
    input: usage.inputTokens ?? 0,
    cacheRead: usage.cacheReadTokens ?? 0,
    cacheWrite: usage.cacheWriteTokens ?? 0,
    output: usage.outputTokens ?? 0,
  }
}

/** Collapse usage samples into one bucket per (model, peak). */
export function bucketize(samples: UsageSample[], config: PricingConfig, fallbackModel?: string): UsageBucket[] {
  const map = new Map<string, UsageBucket>()
  for (const sample of samples) {
    const bucket = bucketOf(sample.usage, sample.model ?? fallbackModel, sample.time, config)
    const key = `${bucket.model}|${bucket.peak ? 1 : 0}`
    const existing = map.get(key)
    if (existing === undefined) {
      map.set(key, bucket)
    } else {
      existing.input += bucket.input
      existing.cacheRead += bucket.cacheRead
      existing.cacheWrite += bucket.cacheWrite
      existing.output += bucket.output
    }
  }
  return [...map.values()]
}

export interface ModelCost {
  model: string
  label: string
  cny: number
  tokens: number
  peakShare: number
  verified: boolean
}

export interface CostEstimate {
  /** Total in CNY. */
  cny: number
  parts: CostParts
  byModel: ModelCost[]
  /** Models with usage but no pricing rule. */
  unpriced: string[]
  /** What the same cache-read tokens would have cost at the uncached input rate, minus what they did cost. */
  savedByCache: number
  /** Share of the total billed at the peak tariff (0..1). */
  peakShare: number
  /** Cumulative CNY after each priced sample, aligned with the input order (when priced from samples). */
  cumulative: number[]
}

export function priceBuckets(buckets: UsageBucket[], config: PricingConfig): CostEstimate {
  const parts = ZERO_PARTS()
  const byModel = new Map<string, ModelCost & { peakCny: number }>()
  const unpriced = new Set<string>()
  let savedByCache = 0
  let peakCny = 0
  for (const bucket of buckets) {
    const priced = priceBucket(bucket, config)
    const tokens = bucket.input + bucket.cacheRead + bucket.cacheWrite + bucket.output
    if (priced === undefined) {
      if (tokens > 0) unpriced.add(bucket.model)
      continue
    }
    const sum = priced.parts.input + priced.parts.cacheRead + priced.parts.cacheWrite + priced.parts.output
    parts.input += priced.parts.input
    parts.cacheRead += priced.parts.cacheRead
    parts.cacheWrite += priced.parts.cacheWrite
    parts.output += priced.parts.output
    const rate = bucket.peak && priced.rule.peak !== undefined ? priced.rule.peak : priced.rule.rate
    const fx = priced.rule.currency === 'USD' ? config.usdToCny : 1
    savedByCache += (bucket.cacheRead * (rate.input - rate.cacheRead) * fx) / 1_000_000
    if (bucket.peak && priced.rule.peak !== undefined) peakCny += sum
    const entry = byModel.get(bucket.model) ?? {
      model: bucket.model, label: priced.rule.label, cny: 0, tokens: 0, peakShare: 0,
      verified: priced.rule.verified !== false, peakCny: 0,
    }
    entry.cny += sum
    entry.tokens += tokens
    if (bucket.peak && priced.rule.peak !== undefined) entry.peakCny += sum
    byModel.set(bucket.model, entry)
  }
  const cny = parts.input + parts.cacheRead + parts.cacheWrite + parts.output
  return {
    cny,
    parts,
    byModel: [...byModel.values()]
      .map(({ peakCny: modelPeak, ...rest }) => ({ ...rest, peakShare: rest.cny > 0 ? modelPeak / rest.cny : 0 }))
      .sort((a, b) => b.cny - a.cny),
    unpriced: [...unpriced],
    savedByCache: Math.max(0, savedByCache),
    peakShare: cny > 0 ? peakCny / cny : 0,
    cumulative: [],
  }
}

/** Price a whole timeline step by step. */
export function estimateCost(model: TimelineModel, config: PricingConfig = DEFAULT_PRICING): CostEstimate {
  const fallback = model.models[0]
  const estimate = priceBuckets(bucketize(model.usageSamples, config, fallback), config)
  let running = 0
  estimate.cumulative = model.usageSamples.map(sample => {
    const priced = priceBucket(bucketOf(sample.usage, sample.model ?? fallback, sample.time, config), config)
    if (priced !== undefined) {
      running += priced.parts.input + priced.parts.cacheRead + priced.parts.cacheWrite + priced.parts.output
    }
    return running
  })
  return estimate
}

/** Cache-hit rate over billed input: cacheRead / (input + cacheRead + cacheWrite). */
export function cacheHitRate(totals: Pick<TokenTotals, 'cacheRead' | 'billedInput'>): number {
  return totals.billedInput > 0 ? totals.cacheRead / totals.billedInput : 0
}

export function currencySymbol(currency: Currency): string {
  return currency === 'CNY' ? '¥' : '$'
}

/** Format a CNY amount in the configured display currency. */
export function formatMoney(cny: number, config: Pick<PricingConfig, 'displayCurrency' | 'usdToCny'> = DEFAULT_PRICING): string {
  const value = config.displayCurrency === 'USD' ? cny / (config.usdToCny || 1) : cny
  const symbol = currencySymbol(config.displayCurrency)
  if (!Number.isFinite(value)) return `${symbol}—`
  const abs = Math.abs(value)
  if (abs >= 100) return `${symbol}${value.toFixed(0)}`
  if (abs >= 1) return `${symbol}${value.toFixed(2)}`
  if (abs >= 0.01) return `${symbol}${value.toFixed(3)}`
  if (abs === 0) return `${symbol}0`
  return `${symbol}${value.toFixed(4)}`
}

/** Validate an untrusted (persisted / user-edited) config, falling back to defaults field by field. */
export function sanitizePricing(input: unknown): PricingConfig {
  const base = DEFAULT_PRICING
  if (typeof input !== 'object' || input === null) return structuredClone(base)
  const raw = input as Partial<PricingConfig>
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
  const rate = (value: unknown, fallback?: PricingRate): PricingRate | undefined => {
    if (typeof value !== 'object' || value === null) return fallback
    const r = value as Partial<PricingRate>
    return {
      input: num(r.input, fallback?.input ?? 0),
      cacheRead: num(r.cacheRead, fallback?.cacheRead ?? 0),
      ...(r.cacheWrite === undefined ? {} : { cacheWrite: num(r.cacheWrite, 0) }),
      output: num(r.output, fallback?.output ?? 0),
    }
  }
  const rules: PricingRule[] = Array.isArray(raw.rules)
    ? raw.rules.flatMap((rule, i): PricingRule[] => {
        if (typeof rule !== 'object' || rule === null || typeof rule.pattern !== 'string') return []
        const main = rate(rule.rate)
        if (main === undefined) return []
        const peak = rate(rule.peak)
        return [{
          id: typeof rule.id === 'string' ? rule.id : `rule-${i}`,
          label: typeof rule.label === 'string' ? rule.label : rule.pattern,
          pattern: rule.pattern,
          currency: rule.currency === 'USD' ? 'USD' : 'CNY',
          rate: main,
          ...(peak === undefined ? {} : { peak }),
          ...(rule.verified === false ? { verified: false } : {}),
        }]
      })
    : structuredClone(base.rules)
  const peakHours = Array.isArray(raw.peakHours)
    ? raw.peakHours.filter(
        (w): w is [number, number] =>
          Array.isArray(w) && w.length === 2 && w.every(h => typeof h === 'number' && h >= 0 && h <= 24) && w[0] < w[1],
      )
    : base.peakHours
  return {
    rules,
    displayCurrency: raw.displayCurrency === 'USD' ? 'USD' : 'CNY',
    usdToCny: num(raw.usdToCny, base.usdToCny) || base.usdToCny,
    peakHours,
    peakUtcOffset: typeof raw.peakUtcOffset === 'number' && Number.isFinite(raw.peakUtcOffset) ? raw.peakUtcOffset : base.peakUtcOffset,
  }
}
