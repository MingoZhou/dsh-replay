/**
 * Redaction for sharing: walk every string in a session and mask secrets,
 * home-directory user names and (optionally) e-mail addresses. Pattern-based
 * and therefore best-effort — the share dialog shows the hit list so the
 * sender can check before a file leaves their machine.
 */
import type { JsonValue, ParsedSession, SessionEvent } from './types.js'

export type RedactCategory = 'secret' | 'path' | 'email'

export interface RedactOptions {
  secrets: boolean
  paths: boolean
  emails: boolean
}

export const DEFAULT_REDACT: RedactOptions = { secrets: true, paths: true, emails: false }

export interface RedactHit {
  category: RedactCategory
  /** Which pattern matched (`api-key`, `env-assignment`, `home-path`, …). */
  kind: string
  count: number
  /** A masked preview of the first match, safe to display. */
  sample: string
}

export interface RedactResult {
  session: ParsedSession
  hits: RedactHit[]
  total: number
}

const MASK = '‹redacted›'

function preview(value: string): string {
  const flat = value.replaceAll(/\s+/gu, ' ')
  if (flat.length <= 8) return '•'.repeat(flat.length)
  return `${flat.slice(0, 4)}${'•'.repeat(Math.min(12, flat.length - 6))}${flat.slice(-2)}`
}

interface Pattern {
  category: RedactCategory
  kind: string
  re: RegExp
  /** Replacement; receives the match and its groups. */
  replace: (match: string, ...groups: string[]) => string
  /** What to show as the sample. */
  sample?: (match: string, ...groups: string[]) => string
}

const SENSITIVE_NAME = String.raw`[A-Za-z0-9_.-]*(?:API[_-]?KEY|ACCESS[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIALS?|PRIVATE[_-]?KEY)[A-Za-z0-9_]*`

const PATTERNS: Pattern[] = [
  {
    category: 'secret', kind: 'private-key',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu,
    replace: () => `-----BEGIN PRIVATE KEY----- ${MASK}`,
    sample: () => '-----BEGIN … PRIVATE KEY-----',
  },
  {
    category: 'secret', kind: 'api-key',
    re: /\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|hf_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,})\b/gu,
    replace: match => `${match.slice(0, match.indexOf('-') >= 0 && match.indexOf('-') < 8 ? match.indexOf('-') + 1 : 4)}${MASK}`,
  },
  {
    category: 'secret', kind: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
    replace: () => `eyJ${MASK}`,
  },
  {
    category: 'secret', kind: 'bearer',
    re: /\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{16,})/gu,
    replace: (_m, scheme) => `${scheme} ${MASK}`,
    sample: (_m, scheme, token) => `${scheme} ${preview(token)}`,
  },
  {
    // NAME=value / NAME: value / "NAME": "value" (also inside JSON-escaped strings).
    category: 'secret', kind: 'env-assignment',
    re: new RegExp(String.raw`(\\?["']?\b${SENSITIVE_NAME}\\?["']?\s*[=:]\s*\\?["']?)([^\s"'\\,;}&|<>]{4,})`, 'giu'),
    replace: (match, head, value) => (value.includes(MASK) || /^(true|false|null|undefined)$/iu.test(value) ? match : `${head}${MASK}`),
    sample: (_m, head, value) => `${head.replaceAll(/[\\"']/gu, '')}${preview(value)}`,
  },
  {
    category: 'secret', kind: 'url-credentials',
    re: /\b([a-z][a-z0-9+.-]*:\/\/[^\s/:@]+):([^\s/@]{3,})@/giu,
    replace: (_m, head) => `${head}:${MASK}@`,
    sample: (_m, head, pass) => `${head}:${preview(pass)}@`,
  },
  {
    category: 'path', kind: 'home-path',
    re: /(\/(?:home|Users)\/)([^/\s"'\\:]+)/gu,
    replace: (_m, head) => `${head}user`,
    sample: (_m, head, user) => `${head}${preview(user)}`,
  },
  {
    // C:\Users\name — single or JSON-escaped double backslashes, or forward slashes.
    category: 'path', kind: 'home-path',
    re: /([A-Za-z]:(?:\\\\|\\|\/)Users(?:\\\\|\\|\/))([^\\/\s"':]+)/gu,
    replace: (_m, head) => `${head}user`,
    sample: (_m, head, user) => `${head}${preview(user)}`,
  },
  {
    category: 'email', kind: 'email',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gu,
    replace: () => `user@${MASK}`,
  },
]

class Redactor {
  private readonly hits = new Map<string, RedactHit>()
  total = 0

  constructor(private readonly options: RedactOptions) {}

  private enabled(category: RedactCategory): boolean {
    return category === 'secret' ? this.options.secrets : category === 'path' ? this.options.paths : this.options.emails
  }

  text(input: string): string {
    let out = input
    for (const pattern of PATTERNS) {
      if (!this.enabled(pattern.category)) continue
      pattern.re.lastIndex = 0
      out = out.replace(pattern.re, (match: string, ...rest: unknown[]) => {
        const groups = rest.filter((g): g is string => typeof g === 'string').slice(0, 3)
        const replaced = pattern.replace(match, ...groups)
        if (replaced === match) return match
        this.total++
        const key = `${pattern.category}/${pattern.kind}`
        const hit = this.hits.get(key)
        if (hit === undefined) {
          this.hits.set(key, {
            category: pattern.category, kind: pattern.kind, count: 1,
            sample: (pattern.sample ? pattern.sample(match, ...groups) : preview(match)).slice(0, 80),
          })
        } else {
          hit.count++
        }
        return replaced
      })
    }
    return out
  }

  value(input: JsonValue): JsonValue {
    if (typeof input === 'string') return this.text(input)
    if (Array.isArray(input)) return input.map(v => this.value(v))
    if (typeof input === 'object' && input !== null) {
      const out: { [key: string]: JsonValue } = {}
      for (const [key, v] of Object.entries(input)) out[key] = this.value(v)
      return out
    }
    return input
  }

  report(): RedactHit[] {
    return [...this.hits.values()].sort((a, b) => b.count - a.count)
  }
}

/** Mask one string; returns the text and how many replacements were made. */
export function redactText(input: string, options: RedactOptions = DEFAULT_REDACT): { text: string; total: number } {
  const redactor = new Redactor(options)
  const text = redactor.text(input)
  return { text, total: redactor.total }
}

export interface RedactRange {
  /** Inclusive seq bounds; events outside are dropped from the copy. */
  fromSeq?: number
  toSeq?: number
}

/** Produce a redacted deep copy; the input session is never mutated. */
export function redactSession(
  session: ParsedSession,
  options: RedactOptions = DEFAULT_REDACT,
  range: RedactRange = {},
): RedactResult {
  const redactor = new Redactor(options)
  const from = range.fromSeq ?? Number.NEGATIVE_INFINITY
  const to = range.toSeq ?? Number.POSITIVE_INFINITY
  const events: SessionEvent[] = session.events
    .filter(e => e.seq >= from && e.seq <= to)
    .map(event => ({ ...event, data: redactor.value(event.data) }))
  const header = { ...session.header }
  if (typeof header.cwd === 'string') header.cwd = redactor.text(header.cwd)
  return {
    session: { header, events, malformed: [], inheritedEventCount: session.inheritedEventCount },
    hits: redactor.report(),
    total: redactor.total,
  }
}
