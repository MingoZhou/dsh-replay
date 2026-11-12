/**
 * Security-audit pass over a decoded session: classify events into findings
 * with a severity, grouped by rule for the audit view. Rules are data, not
 * code — extend `DEFAULT_RULES` or pass your own list.
 *
 * Calibration (v1): an ordinary shell command is `info`, not a warning; a
 * recursive delete is judged by what it deletes; PowerShell (`pwsh`) is a
 * first-class shell with its own dangerous-pattern table.
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

export interface RuleHit {
  title: string
  detail?: string
  messageKey?: string
  params?: Record<string, string>
  /** Overrides the rule's static severity for this hit. */
  severity?: Severity
}

export interface AuditRule {
  id: string
  severity: Severity | ((event: SessionEvent) => Severity)
  /** Return a hit when the event matches, undefined otherwise. */
  match: (event: SessionEvent) => RuleHit | undefined
}

export interface AuditGroup {
  ruleId: string
  /** Highest severity among the group's findings. */
  severity: Severity
  findings: AuditFinding[]
}

export interface AuditReport {
  findings: AuditFinding[]
  counts: Record<Severity, number>
  /** Findings grouped by rule, most severe group first. */
  groups: AuditGroup[]
  /** How many findings the `ignore` set removed. */
  ignored: number
}

function get(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? ''
}

export const SHELL_TOOLS = /^(bash|sh|zsh|pwsh|powershell|cmd|shell|exec|run_command|terminal|subprocess)/iu
export const WRITE_TOOLS = /^(write|edit|create_file|str_replace|apply_patch|notebook_edit|fs_write|mv|rm|delete)/iu
const NETWORK_TOOLS = /^(fetch|web_fetch|http|curl|download|web_search|browser)/iu

/** Pull the command text out of a shell tool's raw JSON arguments. */
export function shellCommand(event: SessionEvent): string {
  const raw = str(get(event.data, 'arguments'))
  try {
    const parsed = JSON.parse(raw) as unknown
    for (const key of ['command', 'cmd', 'script', 'input']) {
      const value = get(parsed, key)
      if (typeof value === 'string') return value
    }
  } catch {
    /* not JSON — audit the raw text */
  }
  return raw
}

/** Build output and caches that are routinely wiped and rebuilt. */
const DISPOSABLE_DIR = /^(node_modules|dist|build|out|target|coverage|tmp|temp|__pycache__|\.cache|\.next|\.nuxt|\.turbo|\.vite|\.pytest_cache|\.mypy_cache|\.venv|venv|bin|obj)$/iu
const DISPOSABLE_FILE = /(\.(log|tmp|lock|pyc)|^package-lock\.json|^pnpm-lock\.yaml|^yarn\.lock)$/iu

function isDisposable(target: string): boolean {
  const parts = target.split(/[/\\]/u).filter(p => p !== '' && p !== '.')
  if (parts.length === 0) return false
  return parts.some(p => DISPOSABLE_DIR.test(p)) || DISPOSABLE_FILE.test(parts.at(-1)!)
}

/** How dangerous is deleting this set of targets? */
function deleteSeverity(targets: string[]): Severity {
  // PowerShell takes comma-separated lists: `Remove-Item a, b`.
  const list = targets.flatMap(t => t.split(',')).map(t => t.trim().replaceAll(/^["']|["']$/gu, '')).filter(t => t !== '')
  if (list.length === 0) return 'serious'
  let worst: Severity = 'info'
  for (const target of list) {
    const outside =
      /^(\/|~|[a-z]:[\\/]|\\\\|\$home|\$env:|%[a-z]+%|\$\{?home)/iu.test(target) ||
      /(^|[/\\])\.\.([/\\]|$)/u.test(target) ||
      /^[*.]$|^\.[\\/]\*$|^\*\.\*$/u.test(target)
    if (outside) return 'critical'
    if (!isDisposable(target)) worst = 'warning'
  }
  return worst
}

function splitArgs(text: string): string[] {
  return text.match(/"[^"]*"|'[^']*'|[^\s;|&]+/gu) ?? []
}

interface ShellPattern {
  key: string
  why: string
  severity: Severity
  /** Returns the matched command slice, or undefined. */
  test: (command: string) => string | undefined
  /** Optional per-hit severity refinement. */
  refine?: (matched: string) => Severity
}

const re = (pattern: RegExp) => (command: string): string | undefined => pattern.exec(command)?.[0]

const SHELL_PATTERNS: ShellPattern[] = [
  {
    key: 'curl-pipe', why: 'pipe remote script to shell', severity: 'critical',
    test: re(/\b(curl|wget)\b[^|;&\n]*\|\s*(sudo\s+)?(ba|z)?sh\b/iu),
  },
  {
    key: 'iwr-iex', why: 'download and execute (Invoke-Expression)', severity: 'critical',
    test: re(/\b(iwr|irm|curl|wget|invoke-webrequest|invoke-restmethod|downloadstring)\b[^\n;]*(\|\s*(iex|invoke-expression)\b|\)\s*\|\s*iex\b)|\b(iex|invoke-expression)\b\s*\(?\s*\(?\s*(new-object\s+net\.webclient|iwr|irm|invoke-webrequest)/iu),
  },
  {
    key: 'disk', why: 'raw disk operation', severity: 'critical',
    test: re(/\b(dd\s+if=|mkfs(\.\w+)?\b|fdisk\b|diskpart\b|format-volume\b|clear-disk\b|format\s+[a-z]:)/iu),
  },
  {
    key: 'rm-rf', why: 'recursive/forced delete', severity: 'serious',
    test: re(/\brm\s+(-[a-z]*[rf][a-z]*\s+)+[^\n;|&]*/iu),
    refine: matched => deleteSeverity(splitArgs(matched).slice(1).filter(a => !a.startsWith('-'))),
  },
  {
    key: 'ps-remove', why: 'recursive delete (Remove-Item)', severity: 'serious',
    test: re(/\b(remove-item|ri|rmdir|rd|del|erase)\b[^\n;|&]*(-recurse\b|-r\b|\/s\b)[^\n;|&]*|\b(remove-item|ri)\b[^\n;|&]*-force\b[^\n;|&]*/iu),
    refine: matched =>
      deleteSeverity(
        splitArgs(matched).slice(1).filter(a => !/^[-/][a-z]/iu.test(a) && !/^\$(true|false)$/iu.test(a)),
      ),
  },
  { key: 'sudo', why: 'privilege escalation', severity: 'serious', test: re(/\bsudo\b|\bstart-process\b[^\n;]*-verb\s+runas/iu) },
  {
    key: 'exec-policy', why: 'execution policy / encoded command', severity: 'serious',
    test: re(/\bset-executionpolicy\b|-e(nc(odedcommand)?)?\s+[a-z0-9+/=]{24,}|-executionpolicy\s+bypass/iu),
  },
  { key: 'force-push', why: 'force push', severity: 'serious', test: re(/\bgit\s+push\b[^\n;|&]*(--force\b|-f\b)/iu) },
  {
    key: 'creds', why: 'credential material in command', severity: 'serious',
    test: re(/(?:\b(?:export|echo|set|setx)\s+|\$env:)[^\n;]*?(API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD)\w*\s*["']?\s*[=:]/iu),
  },
  { key: 'registry', why: 'registry modification', severity: 'serious', test: re(/\breg(\.exe)?\s+(add|delete)\b|\b(set|remove|new)-itemproperty\b[^\n;]*\bhk(lm|cu):/iu) },
  { key: 'git-reset', why: 'discard local changes', severity: 'warning', test: re(/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.)/iu) },
  { key: 'chmod', why: 'permission change', severity: 'warning', test: re(/\bchmod\s+(-R\s+)?([0-7]{3,4}|[ugoa]*\+[rwx]+)|\bicacls\b[^\n;]*\/grant|\bchown\s+-R\b/iu) },
  { key: 'kill', why: 'force-kill process', severity: 'warning', test: re(/\b(kill\s+-9|killall|pkill)\b|\bstop-process\b[^\n;]*-force|\btaskkill\b[^\n;]*\/f\b/iu) },
  { key: 'remote', why: 'remote host access', severity: 'warning', test: re(/(^|[\s;|&])(ssh|scp|sftp)\s+[^\n;|&]*@|\brsync\b[^\n;]*@|\b(enter|new)-pssession\b|\binvoke-command\b[^\n;]*-computername/iu) },
]

export const SENSITIVE_PATH = /(\.env(\.[\w-]+)?\b|\.ssh[/\\]|id_(rsa|ed25519|ecdsa)\b|\.aws[/\\]|\.kube[/\\]config|credentials(\.json)?\b|\.npmrc\b|\.netrc\b|\.pypirc\b|secrets?\.[\w]+|\.pem\b|\.pfx\b|\.p12\b)/iu
/** Paths where even a read or write inside the workspace would be alarming. */
const KEY_MATERIAL = /(\.ssh[/\\]|id_(rsa|ed25519|ecdsa)\b|\.aws[/\\]|\.kube[/\\]config|\.pem\b|\.pfx\b|\.p12\b|\.netrc\b)/iu

function pathArg(event: SessionEvent): string {
  const raw = str(get(event.data, 'arguments'))
  try {
    const parsed = JSON.parse(raw) as unknown
    for (const key of ['file_path', 'path', 'filePath', 'filename']) {
      const value = get(parsed, key)
      if (typeof value === 'string') return value
    }
    const patch = get(parsed, 'input')
    if (typeof patch === 'string') {
      return [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gmu)].map(m => m[1]).join(' ')
    }
  } catch {
    /* fall through */
  }
  return raw
}

export const DEFAULT_RULES: AuditRule[] = [
  {
    id: 'shell-danger',
    severity: 'serious',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      if (!SHELL_TOOLS.test(str(get(event.data, 'name')))) return undefined
      const command = shellCommand(event)
      let best: { pattern: ShellPattern; severity: Severity } | undefined
      for (const pattern of SHELL_PATTERNS) {
        const matched = pattern.test(command)
        if (matched === undefined) continue
        const severity = pattern.refine ? pattern.refine(matched) : pattern.severity
        if (best === undefined || SEVERITY_ORDER.indexOf(severity) < SEVERITY_ORDER.indexOf(best.severity)) {
          best = { pattern, severity }
        }
      }
      if (best === undefined) return undefined
      return {
        title: `shell: ${best.pattern.why}`,
        detail: command.slice(0, 400),
        messageKey: 'f.shell.dangerous',
        params: { whyKey: best.pattern.key, why: best.pattern.why },
        severity: best.severity,
      }
    },
  },
  {
    id: 'shell-exec',
    severity: 'info',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!SHELL_TOOLS.test(name)) return undefined
      const command = shellCommand(event)
      if (SHELL_PATTERNS.some(p => p.test(command) !== undefined)) return undefined
      return {
        title: `shell command via ${name}`,
        detail: command.slice(0, 400),
        messageKey: 'f.shell.plain',
        params: { name },
      }
    },
  },
  {
    id: 'file-sensitive',
    severity: 'serious',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!WRITE_TOOLS.test(name)) return undefined
      const path = pathArg(event)
      if (!SENSITIVE_PATH.test(path)) return undefined
      return {
        title: 'file write touches sensitive path',
        detail: path.slice(0, 400),
        messageKey: 'f.file.sensitive',
        params: { name },
        severity: KEY_MATERIAL.test(path) ? 'critical' : 'serious',
      }
    },
  },
  {
    id: 'file-write',
    severity: 'info',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (!WRITE_TOOLS.test(name)) return undefined
      const path = pathArg(event)
      if (SENSITIVE_PATH.test(path)) return undefined
      return {
        title: `file mutation via ${name}`,
        detail: path.slice(0, 400),
        messageKey: 'f.file.write',
        params: { name },
      }
    },
  },
  {
    id: 'sensitive-read',
    severity: 'serious',
    match: event => {
      if (event.type !== 'tool/call') return undefined
      const name = str(get(event.data, 'name'))
      if (WRITE_TOOLS.test(name)) return undefined
      const text = SHELL_TOOLS.test(name) ? shellCommand(event) : pathArg(event)
      if (!SENSITIVE_PATH.test(text)) return undefined
      // A shell command that merely mentions `.env` (e.g. `cp .env.example .env`) is a warning, not a read.
      const shell = SHELL_TOOLS.test(name)
      return {
        title: `access to sensitive path via ${name}`,
        detail: text.slice(0, 400),
        messageKey: 'f.read.sensitive',
        params: { name },
        severity: KEY_MATERIAL.test(text) ? 'serious' : shell ? 'warning' : 'serious',
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
      const flagged = get(get(event.data, 'message'), 'isError') === true
      if (error === undefined && !flagged) return undefined
      const name = error === undefined ? 'error' : str(get(error, 'name'))
      return {
        title: `tool failed: ${name}`,
        detail: error === undefined ? '' : str(get(error, 'reason') ?? get(error, 'code')),
        messageKey: 'f.tool.error',
        params: { name },
      }
    },
  },
  {
    id: 'turn-error',
    severity: 'warning',
    match: event => {
      if (event.type !== 'turn/end') return undefined
      const kind = str(get(get(event.data, 'reason'), 'kind'))
      if (kind === 'completed' || kind === '' || kind === 'forked') return undefined
      return { title: `turn ended abnormally: ${kind}`, messageKey: 'f.turn.error', params: { kind } }
    },
  },
]

export const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'warning', 'info']

export interface AuditOptions {
  rules?: AuditRule[]
  /** Rule ids whose findings are dropped (the UI's "ignore this rule"). */
  ignore?: Iterable<string>
}

export function auditSession(session: ParsedSession, options: AuditOptions | AuditRule[] = {}): AuditReport {
  const opts: AuditOptions = Array.isArray(options) ? { rules: options } : options
  const rules = opts.rules ?? DEFAULT_RULES
  const ignore = new Set(opts.ignore ?? [])
  const findings: AuditFinding[] = []
  let ignored = 0
  for (const event of session.events) {
    for (const rule of rules) {
      const hit = rule.match(event)
      if (hit === undefined) continue
      if (ignore.has(rule.id)) {
        ignored++
        continue
      }
      const { severity: hitSeverity, ...rest } = hit
      const severity =
        hitSeverity ?? (typeof rule.severity === 'function' ? rule.severity(event) : rule.severity)
      findings.push({ ruleId: rule.id, severity, seq: event.seq, time: event.time, ...rest })
    }
  }
  const rank = (s: Severity): number => SEVERITY_ORDER.indexOf(s)
  findings.sort((a, b) => rank(a.severity) - rank(b.severity) || a.seq - b.seq)
  const counts: Record<Severity, number> = { critical: 0, serious: 0, warning: 0, info: 0 }
  const groups = new Map<string, AuditGroup>()
  for (const finding of findings) {
    counts[finding.severity]++
    const group = groups.get(finding.ruleId)
    if (group === undefined) {
      groups.set(finding.ruleId, { ruleId: finding.ruleId, severity: finding.severity, findings: [finding] })
    } else {
      group.findings.push(finding)
      if (rank(finding.severity) < rank(group.severity)) group.severity = finding.severity
    }
  }
  return {
    findings,
    counts,
    groups: [...groups.values()].sort(
      (a, b) => rank(a.severity) - rank(b.severity) || b.findings.length - a.findings.length,
    ),
    ignored,
  }
}
