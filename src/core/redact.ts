/**
 * Secret redaction for anything that leaves the process: exported HTML,
 * audit details pasted into a report, and screenshots of the UI.
 *
 * This is deliberately conservative and pattern-based. It is a safety net,
 * not a guarantee: the export dialog still warns that session logs can contain
 * arbitrary user data.
 */
import type { ParsedSession, SessionEvent } from './types.js'

export interface RedactionResult {
  text: string
  count: number
  kinds: string[]
}

interface Rule {
  kind: string
  re: RegExp
  // String.replace callbacks receive the match plus arbitrary capture/offset args.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacement: string | ((substring: string, ...args: any[]) => string)
}

const RULES: Rule[] = [
  { kind: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: '[REDACTED:openai-key]' },
  {
    kind: 'github-token',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replacement: '[REDACTED:github-token]',
  },
  { kind: 'aws-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: '[REDACTED:aws-key]' },
  { kind: 'google-key', re: /\bAIza[0-9A-Za-z_-]{20,}\b/g, replacement: '[REDACTED:google-key]' },
  { kind: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replacement: '[REDACTED:slack-token]' },
  {
    kind: 'private-key',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED:private-key]',
  },
  {
    kind: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[REDACTED:jwt]',
  },
  {
    kind: 'env-assignment',
    re: /(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE|CREDENTIAL)[A-Z0-9_]*\s*=\s*)(["']?)([^\s"'\\]{4,})\2/g,
    replacement: (_m, prefix: string, quote: string) => `${prefix}${quote}[REDACTED]${quote}`,
  },
  {
    kind: 'key-value',
    re: /(["']?(?:api[_-]?key|secret|token|password|passwd|authorization|jwt[_-]?secret)["']?\s*[:=]\s*["']?)([^"'\s,}]{4,})/gi,
    replacement: (_m, prefix: string) => `${prefix}[REDACTED]`,
  },
  { kind: 'bearer', re: /(\bBearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, replacement: '$1[REDACTED]' },
  {
    kind: 'basic-auth-url',
    re: /(https?:\/\/[^/\s:@]+:)([^@\s/]+)(@)/g,
    replacement: '$1[REDACTED]$3',
  },
  { kind: 'windows-user', re: /([A-Za-z]:\\Users\\)([^\\\s"']+)/g, replacement: '$1[user]' },
  { kind: 'unix-home', re: /(\/(?:home|Users)\/)([^/\s"']+)/g, replacement: '$1[user]' },
  { kind: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[email]' },
  { kind: 'session-id', re: /\bsession-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, replacement: 'session-[id]' },
]

const CREDENTIAL_KINDS = new Set([
  'openai-key',
  'github-token',
  'aws-key',
  'google-key',
  'slack-token',
  'private-key',
  'jwt',
  'env-assignment',
  'key-value',
  'bearer',
  'basic-auth-url',
])

/** Mask secrets in one string. */
export function redactText(input: string): RedactionResult {
  let text = input
  let count = 0
  const kinds = new Set<string>()
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    const matches = text.match(rule.re)
    if (matches === null) continue
    count += matches.length
    kinds.add(rule.kind)
    rule.re.lastIndex = 0
    text = text.replace(rule.re, rule.replacement as string)
  }
  return { text, count, kinds: [...kinds] }
}

/**
 * True when the text looks like it contains a credential. Deliberately
 * narrower than `redactText`: an email address or a home path is privacy
 * sensitive, but not a reason to raise a critical audit finding.
 */
export function containsSecret(input: string): boolean {
  for (const rule of RULES) {
    if (!CREDENTIAL_KINDS.has(rule.kind)) continue
    rule.re.lastIndex = 0
    const hit = rule.re.test(input)
    rule.re.lastIndex = 0
    if (hit) return true
  }
  return false
}

/**
 * Deep-redact a JSON-like value. Keys are preserved; string values are
 * redacted. Depth is bounded so a hostile log cannot exhaust the stack.
 */
export function redactValue<T>(value: T, depth = 0): { value: T; count: number } {
  if (depth > 20) return { value, count: 0 }
  if (typeof value === 'string') {
    const result = redactText(value)
    return { value: result.text as unknown as T, count: result.count }
  }
  if (Array.isArray(value)) {
    let count = 0
    const next = value.map(item => {
      const result = redactValue(item, depth + 1)
      count += result.count
      return result.value
    })
    return { value: next as unknown as T, count }
  }
  if (typeof value === 'object' && value !== null) {
    let count = 0
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const result = redactValue(item, depth + 1)
      count += result.count
      next[key] = result.value
    }
    return { value: next as unknown as T, count }
  }
  return { value, count: 0 }
}

export interface RedactSessionResult {
  session: ParsedSession
  count: number
  kinds: string[]
}

/**
 * Clone and redact a parsed session. Event envelopes (seq/time/type) are
 * preserved so the viewer still works; only payload strings are masked.
 */
export function redactSession(session: ParsedSession): RedactSessionResult {
  let count = 0
  const kinds = new Set<string>()
  const header = { ...session.header }
  for (const key of ['cwd', 'title'] as const) {
    const value = (header as Record<string, unknown>)[key]
    if (typeof value === 'string') {
      const result = redactText(value)
      ;(header as Record<string, unknown>)[key] = result.text
      count += result.count
      for (const kind of result.kinds) kinds.add(kind)
    }
  }
  const events: SessionEvent[] = session.events.map(event => {
    const data = redactValue(event.data)
    count += data.count
    if (data.count > 0) {
      for (const rule of RULES) {
        rule.re.lastIndex = 0
        if (rule.re.test(JSON.stringify(event.data))) kinds.add(rule.kind)
        rule.re.lastIndex = 0
      }
    }
    return { ...event, data: data.value }
  })
  return { session: { ...session, header, events }, count, kinds: [...kinds] }
}
