/**
 * Per-browser preferences: the pricing table, ignored audit rules and share
 * defaults. Kept in localStorage behind a tiny external store so every open
 * view re-renders when one of them changes.
 */
import { useSyncExternalStore } from 'react'
import { DEFAULT_PRICING, sanitizePricing, type PricingConfig } from '../core/cost.js'
import { DEFAULT_REDACT, type RedactOptions } from '../core/redact.js'

export interface Settings {
  pricing: PricingConfig
  ignoredRules: string[]
  redact: RedactOptions
  /** Timeline token strip + overview chart unit. */
  chartUnit: 'cost' | 'tokens'
}

const KEY = 'dshr-settings-v1'

function load(): Settings {
  const fallback: Settings = {
    pricing: structuredClone(DEFAULT_PRICING),
    ignoredRules: [],
    redact: { ...DEFAULT_REDACT },
    chartUnit: 'cost',
  }
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw === null || raw === undefined) return fallback
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      pricing: parsed.pricing === undefined ? fallback.pricing : sanitizePricing(parsed.pricing),
      ignoredRules: Array.isArray(parsed.ignoredRules) ? parsed.ignoredRules.filter(r => typeof r === 'string') : [],
      redact: {
        secrets: parsed.redact?.secrets !== false,
        paths: parsed.redact?.paths !== false,
        emails: parsed.redact?.emails === true,
      },
      chartUnit: parsed.chartUnit === 'tokens' ? 'tokens' : 'cost',
    }
  } catch {
    return fallback // storage unavailable or corrupt — run on defaults
  }
}

let current: Settings | undefined
const listeners = new Set<() => void>()

function snapshot(): Settings {
  current ??= load()
  return current
}

/**
 * Provide defaults for a context that has no stored preferences yet (an
 * exported file carries its author's pricing table). Never overrides a stored choice.
 */
export function seedSettings(patch: Partial<Settings>): void {
  let stored = false
  try {
    stored = globalThis.localStorage?.getItem(KEY) != null
  } catch {
    stored = false
  }
  if (!stored) current = { ...snapshot(), ...patch }
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...snapshot(), ...patch }
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current))
  } catch {
    /* best effort — the in-memory copy still applies for this page */
  }
  for (const listener of listeners) listener()
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot,
    snapshot,
  )
}
