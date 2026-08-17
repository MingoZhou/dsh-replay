/**
 * Security-audit pass over a decoded session: classify events into findings
 * with a severity, grouped for the audit view. Rules are data, not code —
 * extend `DEFAULT_RULES` or pass your own list.
 *
 * Severity vocabulary mirrors a standard status palette:
 * 'critical' | 'serious' | 'warning' | 'info'.
 */
import type { ParsedSession, SessionEvent } from './types.js'

export type Severity = 'critical' | 'serious' | 'warning' | 'info'

export interface AuditFinding {
  ruleId: string
  severity: Severity
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
  severity: Severity | ((event: SessionEvent) => Severity)
  /** Return a finding title when the event matches, undefined otherwise. */
  match: (event: SessionEvent) => {
    title: string
    detail?: string
    messageKey?: string
    params?: Record<string, string>
  } | undefined
}

export interface AuditReport {
  findings: AuditFinding[]
  counts: Record<Severity, number>
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? ''
}

const SHELL_TOOLS = /^(bash|shell|exec|run_command|terminal|subprocess)/iu
const WRITE_TOOLS = /^(write|edit|create_file|str_replace|apply_patch|notebook_edit|fs_write|mv|rm|delete)/iu
const NETWORK_TOOLS = /^(fetch|web_fetch|http|curl|download|web_search|browser)/iu

const DANGEROUS_SHELL = [
  { re: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+/iu, why: 'recursive/forced delete', key: 'rm-rf' },
  { re: /\bsudo\b/u, why: 'privilege escalation', key: 'sudo' },
  { re: /\bchmod\s+([0-7]{3,4}|\+x)/u, why: 'permission change', key: 'chmod' },
  { re: /\b(curl|wget)\b[^|;&]*\|\s*(ba)?sh\b/iu, why: 'pipe remote script to shell', key: 'curl-pipe' },
  { re: /\bgit\s+push\s+.*--force/iu, why: 'force push', key: 'force-push' },
  { re: /\b(dd|mkfs|fdisk)\b/u, why: 'raw disk operation', key: 'disk' },
  { re: /(\bssh\b|\bscp\b|\brsync\b.*@)/u, why: 'remote host access', key: 'remote' },
  { re: /\b(export|echo)\b.*\b(API_?KEY|TOKEN|SECRET|PASSWORD)\b/iu, why: 'credential material in command', key: 'creds' },
]

const SENSITIVE_PATH = /(\.env\b|\.ssh\/|id_rsa|\.aws\/|credentials|\.npmrc|\.netrc|secrets?\.|\.pem\b)/iu

export const DEFAULT_RULES: AuditRule[] = [
  {
    id: 'shell-exec',
    severity: event => {
      const args = str(get(event.data, 'arguments'))
      return DANGEROUS_SHELL.some(p => p.re.test(args)) ? 'critical' : 'warning'
    },
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!SHELL_TOOLS.test(name)) return undefined
      const args = str(get(event.data, 'arguments'))
      const hit = DANGEROUS_SHELL.find(p => p.re.test(args))
      return {
        title: hit ? `shell: ${hit.why}` : `shell command via ${name}`,
        detail: args.slice(0, 400),
        messageKey: hit ? 'f.shell.dangerous' : 'f.shell.plain',
        params: (hit ? { whyKey: hit.key, why: hit.why } : { name }) as Record<string, string>,
      }
    },
  },
  {
    id: 'file-write',
    severity: event =>
      SENSITIVE_PATH.test(str(get(event.data, 'arguments'))) ? 'critical' : 'info',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!WRITE_TOOLS.test(name)) return undefined
      const args = str(get(event.data, 'arguments'))
      const sensitive = SENSITIVE_PATH.test(args)
      return {
        title: sensitive ? `file write touches sensitive path` : `file mutation via ${name}`,
        detail: args.slice(0, 400),
        messageKey: sensitive ? 'f.file.sensitive' : 'f.file.write',
        params: { name },
      }
    },
  },
  {
    id: 'sensitive-read',
    severity: 'serious',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const args = str(get(event.data, 'arguments'))
      const name = str(get(event.data, 'name'))
      if (WRITE_TOOLS.test(name) || SHELL_TOOLS.test(name)) return undefined
      if (!SENSITIVE_PATH.test(args)) return undefined
      return {
        title: `access to sensitive path via ${name}`,
        detail: args.slice(0, 400),
        messageKey: 'f.read.sensitive',
        params: { name },
      }
    },
  },
  {
    id: 'network',
    severity: 'info',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!NETWORK_TOOLS.test(name)) return undefined
      return {
        title: `network access via ${name}`,
        detail: str(get(event.data, 'arguments')).slice(0, 400),
        messageKey: 'f.network',
        params: { name },
      }
    },
  },
  {
    id: 'approval-denied',
    severity: 'warning',
    match: event => {
      if (event.type !== 'approval/decided') return undefined
      const outcome = str(get(event.data, 'outcome') ?? get(event.data, 'decision'))
      if (!/den|reject|refus/iu.test(outcome)) return undefined
      return { title: 'user denied an approval', detail: outcome, messageKey: 'f.approval.denied' }
    },
  },
  {
    id: 'sandbox-change',
    severity: 'serious',
    match: event =>
      event.type === 'sandbox/mode'
        ? { title: 'sandbox mode changed', detail: JSON.stringify(event.data), messageKey: 'f.sandbox.change' }
        : undefined,
  },
  {
    id: 'permission-change',
    severity: 'serious',
    match: event =>
      event.type === 'permission/preset'
        ? { title: 'permission preset changed', detail: JSON.stringify(event.data), messageKey: 'f.permission.change' }
        : undefined,
  },
  {
    id: 'subagent',
    severity: 'info',
    match: event =>
      event.type === 'subagent/descriptor'
        ? {
            title: `subagent spawned (${str(get(event.data, 'mode'))})`,
            detail: str(get(event.data, 'persona') ?? get(event.data, 'label') ?? ''),
            messageKey: 'f.subagent',
            params: { mode: str(get(event.data, 'mode')) },
          }
        : undefined,
  },
  {
    id: 'tool-error',
    severity: 'warning',
    match: event => {
      if (event.type !== 'tool/result') return undefined
      const error = get(event.data, 'error')
      if (error === undefined) return undefined
      return {
        title: `tool failed: ${str(get(error, 'name'))}`,
        detail: str(get(error, 'code')),
        messageKey: 'f.tool.error',
        params: { name: str(get(error, 'name')) },
      }
    },
  },
  {
    id: 'turn-error',
    severity: 'warning',
    match: event => {
      if (event.type !== 'turn/end') return undefined
      const kind = str(get(get(event.data, 'reason'), 'kind'))
      if (kind === 'completed' || kind === '') return undefined
      return { title: `turn ended abnormally: ${kind}`, messageKey: 'f.turn.error', params: { kind } }
    },
  },
]

const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'warning', 'info']

export function auditSession(
  session: ParsedSession,
  rules: AuditRule[] = DEFAULT_RULES,
): AuditReport {
  const findings: AuditFinding[] = []
  for (const event of session.events) {
    for (const rule of rules) {
      const hit = rule.match(event)
      if (hit === undefined) continue
      const severity = typeof rule.severity === 'function' ? rule.severity(event) : rule.severity
      findings.push({ ruleId: rule.id, severity, seq: event.seq, time: event.time, ...hit })
    }
  }
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.seq - b.seq,
  )
  const counts: Record<Severity, number> = { critical: 0, serious: 0, warning: 0, info: 0 }
  for (const finding of findings) counts[finding.severity]++
  return { findings, counts }
}
