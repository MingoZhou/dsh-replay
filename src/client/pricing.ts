/**
 * User-editable pricing overrides. Persisted in localStorage; the default
 * table still lives in core/cost.ts so the demo and CLI tools work without UI.
 */
import React from 'react'
import { DEFAULT_PRICING, type PricingEntry, type PricingRate } from '../core/cost.js'

const KEY = 'dshr-pricing-overrides'

type Overrides = Record<string, PricingRate>

function read(): Overrides {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw === null || raw === undefined) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Overrides = {}
    for (const [label, value] of Object.entries(parsed)) {
      if (typeof value !== 'object' || value === null) continue
      const rate = value as Record<string, unknown>
      if (
        typeof rate['input'] === 'number' &&
        typeof rate['cacheRead'] === 'number' &&
        typeof rate['output'] === 'number'
      ) {
        out[label] = {
          input: rate['input'],
          cacheRead: rate['cacheRead'],
          output: rate['output'],
          ...(typeof rate['cacheWrite'] === 'number' ? { cacheWrite: rate['cacheWrite'] } : {}),
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

let overrides: Overrides = read()
let cached: PricingEntry[] = build(overrides)
const listeners = new Set<() => void>()

function build(source: Overrides): PricingEntry[] {
  return DEFAULT_PRICING.map(entry =>
    source[entry.label] === undefined
      ? entry
      : { ...entry, rate: source[entry.label], source: 'user override' },
  )
}

function snapshot(): PricingEntry[] {
  return cached
}

export function getPricing(): PricingEntry[] {
  return cached
}

export function setRate(label: string, rate: PricingRate): void {
  overrides = { ...overrides, [label]: rate }
  cached = build(overrides)
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(overrides))
  } catch {
    /* best effort */
  }
  for (const listener of listeners) listener()
}

export function resetPricing(): void {
  overrides = {}
  cached = build(overrides)
  try {
    globalThis.localStorage?.removeItem(KEY)
  } catch {
    /* best effort */
  }
  for (const listener of listeners) listener()
}

export function subscribePricing(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePricing(): PricingEntry[] {
  return React.useSyncExternalStore(subscribePricing, snapshot, snapshot)
}
