/**
 * Security-audit pass over a decoded session: classify events into findings
 * with a severity, grouped for the audit view. Rules are data, not code —
 * extend `DEFAULT_RULES` or pass your own list.
 *
 * Design goals, in order:
 *  1. Signal, not activity. A clean session should produce zero findings;
 *     routine file writes and ordinary network reads are not "risks".
 *  2. Windows is a first-class platform. `pwsh`, PowerShell aliases and
 *     Windows paths are scanned just like bash on Unix.
 *  3. Baseline is not a finding. Every session starts with a permission
 *     preset and sandbox mode; only a later *change* is interesting.
 *
 * Severity vocabulary mirrors a standard status palette:
 * 'critical' | 'serious' | 'warning' | 'info'.
 */
import type { ParsedSession, SessionEvent } from './types.js'
import { containsSecret, redactText } from './redact.js'

export type Severity = 'critical' | 'serious' | 'warning' | 'info'

export type AuditCategory =
  | 'shell'
  | 'file'
  | 'network'
  | 'approval'
  | 'config'
  | 'error'
  | 'secret'

export interface AuditFinding {
  ruleId: string
  severity: Severity
  category?: AuditCategory
  seq: number
  time: number
  /** English title (stable fallback). */
  title: string
  detail?: string
  /** Structured message id + params, so UIs can localize findings. */
  messageKey?: string
  params?: Record<string, string>
}

export interface AuditRule {
  id: string
  category?: AuditCategory
  severity: Severity | ((event: SessionEvent) => Severity)
  /** Return a finding title when the event matches, undefined otherwise. */
  match: (event: SessionEvent) => {
    title: string
    detail?: string
    messageKey?: string
    params?: Record<string, string>
    category?: AuditCategory
  } | undefined
}

export interface AuditReport {
  findings: AuditFinding[]
  counts: Record<Severity, number>
  /** Number of raw events scanned. */
  scanned: number
  /** Number of rules evaluated. */
  rules: number
  /** Baseline/duplicate config events deliberately ignored. */
  suppressed: number
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

function str(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

function clipped(value: string, max = 500): string {
  return redactText(value).text.slice(0, max)
}

function toolName(event: SessionEvent): string {
  return str(get(event.data, 'name'))
}

function argsOf(event: SessionEvent): string {
  return str(get(event.data, 'arguments'))
}

function parseArgs(raw: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(raw) as unknown
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

const PATH_KEYS = [
  'path',
  'file_path',
  'filePath',
  'target',
  'destination',
  'dest',
  'filename',
  'file',
  'name',
] as const

function pathOf(raw: string): string | undefined {
  const args = parseArgs(raw)
  if (args === undefined) return undefined
  for (const key of PATH_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value !== '' && /[\\/.]/u.test(value)) return value
  }
  return undefined
}

const SHELL_TOOLS = /^(bash|shell|exec|run_command|terminal|subprocess|pwsh|powershell|cmd|run_code|code_execution)/iu
const WRITE_TOOLS = /^(write|write_file|edit|edit_file|create_file|str_replace|multi_edit|apply_patch|notebook_edit|fs_write|mv|move|rename|copy|rm|remove|delete|del|remove_item|rmdir|rd)/iu
const DESTRUCTIVE_TOOLS = /^(rm|remove|delete|del|remove_item|rmdir|rd|mv|move|rename)/iu
const READ_TOOLS = /^(read|read_file|view|open|cat|type|get-content|grep|search|glob|list|find|head|tail|less|more|strings|xxd)/iu
const NETWORK_TOOLS = /^(fetch|web_fetch|http|curl|download|web_search|browser|invoke-webrequest|iwr|invoke-restmethod|start-bitstransfer)/iu

interface ShellPattern {
  re: RegExp
  why: string
  key: string
  severity: Severity
}

/**
 * Shell patterns are deliberately small and readable. Each one maps to a
 * stable `why` key so the UI can localize the reason.
 */
const DANGEROUS_SHELL: ShellPattern[] = [
  // --- destructive deletes -------------------------------------------------
  { re: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+/iu, why: 'recursive/forced delete', key: 'rm-rf', severity: 'critical' },
  { re: /\bremove-item\b[^\n]*(?:-recurse|-force)/iu, why: 'recursive/forced delete', key: 'rm-rf', severity: 'critical' },
  { re: /\b(?:del|erase)\b[^\n]*\/[sq]/iu, why: 'forced delete', key: 'rm-rf', severity: 'critical' },
  { re: /\b(?:rd|rmdir)\b[^\n]*\/s/iu, why: 'recursive directory delete', key: 'rm-rf', severity: 'critical' },
  // --- privilege / system --------------------------------------------------
  { re: /\bsudo\b/iu, why: 'privilege escalation', key: 'sudo', severity: 'critical' },
  { re: /\b(?:takeown|icacls)\b[^\n]*(?:grant|\/grant|\/f|\/reset)/iu, why: 'ownership/permission change', key: 'chmod', severity: 'serious' },
  { re: /\bchmod\s+([0-7]{3,4}|\+x)/u, why: 'permission change', key: 'chmod', severity: 'serious' },
  { re: /\bset-executionpolicy\b/iu, why: 'script execution policy change', key: 'exec-policy', severity: 'serious' },
  { re: /\b(?:bcdedit|vssadmin\s+delete|wevtutil\s+cl)\b/iu, why: 'boot/shadow/log tampering', key: 'system-tamper', severity: 'critical' },
  { re: /\b(?:reg\s+delete|schtasks\b[^\n]*\/create|sc\s+create|net\s+user|net\s+localgroup)\b/iu, why: 'persistence or account change', key: 'persistence', severity: 'serious' },
  // --- disk / remote code --------------------------------------------------
  { re: /\b(?:dd|mkfs|fdisk|diskpart|format)\b/iu, why: 'raw disk operation', key: 'disk', severity: 'critical' },
  { re: /\b(?:iwr|invoke-webrequest|curl|wget|start-bitstransfer)\b[^\n|;]*(?:\||;)\s*(?:iex|invoke-expression)\b/iu, why: 'pipe remote script to shell', key: 'curl-pipe', severity: 'critical' },
  { re: /\b(?:downloadstring|downloadfile)\b/iu, why: 'download and execute', key: 'curl-pipe', severity: 'critical' },
  { re: /\b(?:powershell|pwsh)\b[^\n]*-e(?:nc|ncodedcommand)?\s+[A-Za-z0-9+/=]{40,}/iu, why: 'encoded PowerShell command', key: 'encoded-shell', severity: 'critical' },
  // --- credentials / exfiltration -----------------------------------------
  { re: /\b(?:export|\$env:|\bset\b|\becho\b)[^\n]*(?:api[_-]?key|token|secret|password|passwd)/iu, why: 'credential material in command', key: 'creds', severity: 'serious' },
  { re: /\b(?:get-content|type|cat)\b[^\n]*(?:\.env\b|id_rsa|\.ssh[\\/]|credentials)/iu, why: 'credential file read', key: 'creds', severity: 'serious' },
  { re: /\b(?:curl|wget|iwr|invoke-webrequest|invoke-restmethod)\b[^\n]*(?:-d\b|--data|--upload-file|-f\b|\.env\b|secret|token|password)/iu, why: 'possible credential exfiltration', key: 'exfil', severity: 'critical' },
  { re: /\b(?:ssh|scp|rsync)\b[^\n]*(?:@|\bremote\b)/iu, why: 'remote host access', key: 'remote', severity: 'warning' },
  { re: /\b(?:invoke-command|enter-pssession|winrs)\b/iu, why: 'remote execution', key: 'remote', severity: 'serious' },
  // --- supply chain / repo ------------------------------------------------
  { re: /\bgit\s+push\s+[^\n]*--force/iu, why: 'force push', key: 'force-push', severity: 'serious' },
  { re: /\b(?:npm|pnpm|yarn)\s+publish\b/iu, why: 'package publish', key: 'publish', severity: 'warning' },
  { re: /\bgh\s+release\s+create\b/iu, why: 'release publish', key: 'publish', severity: 'warning' },
]

/** File paths that deserve a second look when read or written. */
const SENSITIVE_PATH = /(?:^|[\\/])(?:\.env(?:\.[\w-]+)?(?:[\\/]|$)|\.ssh(?:[\\/]|$)|id_rsa|id_ed25519|\.aws(?:[\\/]|$)|\.kube(?:[\\/]|$)|\.docker(?:[\\/]config\.json|$)|credentials|\.npmrc|\.netrc|secrets?\.|\.pem|\.pfx|\.p12|ntuser\.dat|\.git[\\/]config|\.config[\\/]gh[\\/]hosts\.yml)/iu

const NETWORK_RISK = /(?:--data|-d\s|--upload-file|-f\s|body\s*[:=]|\.env\b|secret|token|password|passwd|private[_-]?key|authorization|api[_-]?key)/iu

function messageText(message: unknown): string {
  const content = get(message, 'content')
  if (!Array.isArray(content)) return ''
  return content
    .map(block => (typeof get(block, 'text') === 'string' ? (get(block, 'text') as string) : ''))
    .join('')
}

function findDanger(event: SessionEvent): ShellPattern | undefined {
  if (event.type !== 'tool/call') return undefined
  const name = toolName(event)
  if (!SHELL_TOOLS.test(name)) return undefined
  const args = argsOf(event)
  return DANGEROUS_SHELL.find(pattern => pattern.re.test(args))
}

export const DEFAULT_RULES: AuditRule[] = [
  {
    id: 'shell-exec',
    category: 'shell',
    severity: event => findDanger(event)?.severity ?? 'warning',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = toolName(event)
      if (!SHELL_TOOLS.test(name)) return undefined
      const args = argsOf(event)
      const hit = DANGEROUS_SHELL.find(pattern => pattern.re.test(args))
      if (hit === undefined) return undefined // ordinary shell is activity, not a finding
      return {
        title: `shell: ${hit.why}`,
        detail: clipped(args),
        messageKey: 'f.shell.dangerous',
        params: { whyKey: hit.key, why: hit.why, name },
      }
    },
  },
  {
    id: 'file-write',
    category: 'file',
    severity: event => {
      const args = argsOf(event)
      const path = pathOf(args) ?? args
      return SENSITIVE_PATH.test(path) || containsSecret(args) ? 'critical' : 'warning'
    },
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = toolName(event)
      if (!WRITE_TOOLS.test(name)) return undefined
      const args = argsOf(event)
      const path = pathOf(args) ?? args
      const sensitive = SENSITIVE_PATH.test(path)
      const secret = containsSecret(args)
      if (!sensitive && !secret && !DESTRUCTIVE_TOOLS.test(name)) return undefined
      const reason = sensitive
        ? 'file write touches a sensitive path'
        : secret
          ? 'credential material written to a file'
          : `destructive file operation via ${name}`
      return {
        title: reason,
        detail: clipped(args),
        messageKey: sensitive ? 'f.file.sensitive' : secret ? 'f.file.secret' : 'f.file.destructive',
        params: { name, ...(path !== args ? { path } : {}) },
      }
    },
  },
  {
    id: 'sensitive-read',
    category: 'file',
    severity: 'serious',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = toolName(event)
      if (WRITE_TOOLS.test(name) || SHELL_TOOLS.test(name) || NETWORK_TOOLS.test(name)) return undefined
      if (!READ_TOOLS.test(name)) return undefined
      const args = argsOf(event)
      const path = pathOf(args) ?? args
      if (!SENSITIVE_PATH.test(path)) return undefined
      return {
        title: `access to sensitive path via ${name}`,
        detail: clipped(args),
        messageKey: 'f.read.sensitive',
        params: { name, ...(path !== args ? { path } : {}) },
      }
    },
  },
  {
    id: 'network',
    category: 'network',
    severity: event => {
      const args = argsOf(event)
      return containsSecret(args) || SENSITIVE_PATH.test(args) ? 'critical' : 'warning'
    },
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = toolName(event)
      if (!NETWORK_TOOLS.test(name)) return undefined
      const args = argsOf(event)
      if (!NETWORK_RISK.test(args)) return undefined // ordinary fetches are activity
      return {
        title: `network request may carry sensitive data via ${name}`,
        detail: clipped(args),
        messageKey: 'f.network',
        params: { name },
      }
    },
  },
  {
    id: 'secret-output',
    category: 'secret',
    severity: 'critical',
    match: event => {
      if (event.type !== 'tool/result') return undefined
      const message = get(event.data, 'message')
      const text = messageText(message) || str(message) || str(get(event.data, 'error'))
      if (text === '' || !containsSecret(text)) return undefined
      return {
        title: 'tool output contains credential material',
        detail: clipped(text, 300),
        messageKey: 'f.output.secret',
      }
    },
  },
  {
    id: 'approval-denied',
    category: 'approval',
    severity: 'warning',
    match: event => {
      if (event.type !== 'approval/decided') return undefined
      const outcome = str(get(event.data, 'outcome') ?? get(event.data, 'decision'))
      if (!/deny|denied|reject|refus/iu.test(outcome)) return undefined
      return { title: 'user denied an approval', detail: clipped(outcome), messageKey: 'f.approval.denied' }
    },
  },
  {
    id: 'sandbox-change',
    category: 'config',
    severity: event => {
      const mode = str(get(event.data, 'mode'))
      return /danger|full/iu.test(mode) ? 'critical' : 'serious'
    },
    match: event =>
      event.type === 'sandbox/mode'
        ? {
            title: `sandbox mode changed to ${str(get(event.data, 'mode')) || 'unknown'}`,
            detail: clipped(JSON.stringify(event.data)),
            messageKey: 'f.sandbox.change',
            params: { mode: str(get(event.data, 'mode')) },
          }
        : undefined,
  },
  {
    id: 'permission-change',
    category: 'config',
    severity: event => {
      const preset = str(get(event.data, 'preset'))
      return /danger|full/iu.test(preset) ? 'critical' : 'serious'
    },
    match: event =>
      event.type === 'permission/preset'
        ? {
            title: `permission preset changed to ${str(get(event.data, 'preset')) || 'unknown'}`,
            detail: clipped(JSON.stringify(event.data)),
            messageKey: 'f.permission.change',
            params: { preset: str(get(event.data, 'preset')) },
          }
        : undefined,
  },
  {
    id: 'tool-error',
    category: 'error',
    severity: 'warning',
    match: event => {
      if (event.type !== 'tool/result') return undefined
      const error = get(event.data, 'error')
      if (error === undefined) return undefined
      return {
        title: `tool failed: ${str(get(error, 'name'))}`,
        detail: clipped(str(get(error, 'code'))),
        messageKey: 'f.tool.error',
        params: { name: str(get(error, 'name')), code: str(get(error, 'code')) },
      }
    },
  },
  {
    id: 'turn-error',
    category: 'error',
    severity: 'warning',
    match: event => {
      if (event.type !== 'turn/end') return undefined
      const kind = str(get(get(event.data, 'reason'), 'kind'))
      if (kind === '' || kind === 'completed' || kind === 'aborted') return undefined
      return { title: `turn ended abnormally: ${kind}`, messageKey: 'f.turn.error', params: { kind } }
    },
  },
]

const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'warning', 'info']

const CONFIG_RULES = new Set(['sandbox-change', 'permission-change'])

export function auditSession(
  session: ParsedSession,
  rules: AuditRule[] = DEFAULT_RULES,
): AuditReport {
  // The first permission/sandbox event is the session baseline, not a change.
  // A later event only matters when its value differs from the previous one.
  const lastConfig = new Map<string, string>()
  const changedConfig = new Set<number>()
  let suppressed = 0
  for (const event of session.events) {
    if (
      event.type !== 'permission/preset' &&
      event.type !== 'sandbox/mode' &&
      event.type !== 'approval/policy'
    ) {
      continue
    }
    const value = JSON.stringify(event.data)
    if (!lastConfig.has(event.type)) {
      lastConfig.set(event.type, value)
      suppressed++
      continue
    }
    if (lastConfig.get(event.type) === value) {
      suppressed++
      continue
    }
    lastConfig.set(event.type, value)
    changedConfig.add(event.seq)
  }

  const findings: AuditFinding[] = []
  for (const event of session.events) {
    for (const rule of rules) {
      if (CONFIG_RULES.has(rule.id) && !changedConfig.has(event.seq)) continue
      const hit = rule.match(event)
      if (hit === undefined) continue
      const severity = typeof rule.severity === 'function' ? rule.severity(event) : rule.severity
      findings.push({
        ruleId: rule.id,
        severity,
        category: hit.category ?? rule.category,
        seq: event.seq,
        time: event.time,
        ...hit,
      })
    }
  }
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.seq - b.seq,
  )
  const counts: Record<Severity, number> = { critical: 0, serious: 0, warning: 0, info: 0 }
  for (const finding of findings) counts[finding.severity]++
  return { findings, counts, scanned: session.events.length, rules: rules.length, suppressed }
}
