import { describe, expect, it } from 'vitest'
import { auditSession } from '../src/core/audit.js'
import { parseSessionJsonl } from '../src/core/decode.js'
<<<<<<< HEAD
import { sessionA } from '../demo/samples.js'

function log(events: Record<string, unknown>[]): string {
  return [
    { type: 'session', version: 0, id: 'test-session', createdAt: 1 },
    ...events,
  ].map(line => JSON.stringify(line)).join('\n') + '\n'
}

function call(seq: number, name: string, args: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'tool/call', seq, time: seq,
    data: { turn: 1, step: 1, callId: `call-${seq}`, name, arguments: JSON.stringify(args) },
  }
}

describe('auditSession', () => {
  it('flags destructive Unix shell commands as critical', () => {
    const report = auditSession(parseSessionJsonl(sessionA()))
    expect(
      report.findings.some(
        finding =>
          finding.ruleId === 'shell-exec' &&
          finding.severity === 'critical' &&
          finding.title.includes('recursive/forced delete'),
      ),
    ).toBe(true)
  })

  it('flags sensitive file writes, but not ordinary code edits', () => {
    const report = auditSession(parseSessionJsonl(sessionA()))
    expect(
      report.findings.some(
        finding => finding.ruleId === 'file-write' && finding.severity === 'critical' && finding.detail?.includes('.env'),
      ),
    ).toBe(true)
    expect(
      report.findings.some(
        finding => finding.ruleId === 'file-write' && finding.detail?.includes('auth.js'),
      ),
    ).toBe(false)
  })

  it('does not report ordinary shell commands or ordinary network reads', () => {
    const parsed = parseSessionJsonl(
      log([
        call(0, 'bash', { command: 'npm test' }),
        call(1, 'web_fetch', { url: 'https://example.com/docs' }),
      ]),
    )
    const report = auditSession(parsed)
    expect(report.findings).toHaveLength(0)
    expect(report.scanned).toBe(2)
  })

  it('understands pwsh and Windows destructive commands', () => {
    const parsed = parseSessionJsonl(
      log([
        call(0, 'pwsh', { command: 'Remove-Item -Recurse -Force C:\\temp\\build' }),
        call(1, 'pwsh', { command: 'Get-ChildItem' }),
      ]),
    )
    const findings = auditSession(parsed).findings.filter(finding => finding.ruleId === 'shell-exec')
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('critical')
    expect(findings[0].title).toContain('recursive/forced delete')
  })

  it('treats the initial permission/sandbox state as baseline, not a finding', () => {
    const parsed = parseSessionJsonl(
      log([
        { type: 'permission/preset', seq: 0, time: 0, data: { preset: 'workspace-write' } },
        { type: 'sandbox/mode', seq: 1, time: 0, data: { mode: 'workspace-write' } },
        { type: 'sandbox/mode', seq: 2, time: 1, data: { mode: 'workspace-write' } },
      ]),
    )
    const report = auditSession(parsed)
    expect(report.findings).toHaveLength(0)
    expect(report.suppressed).toBeGreaterThanOrEqual(2)
  })

  it('flags a later sandbox change, especially danger-full-access', () => {
    const parsed = parseSessionJsonl(
      log([
        { type: 'sandbox/mode', seq: 0, time: 0, data: { mode: 'workspace-write' } },
        { type: 'sandbox/mode', seq: 1, time: 1, data: { mode: 'danger-full-access' } },
      ]),
    )
    const report = auditSession(parsed)
    expect(report.findings.some(finding => finding.ruleId === 'sandbox-change' && finding.severity === 'critical')).toBe(true)
  })

  it('flags credential material written to a file and secret tool output', () => {
    const parsed = parseSessionJsonl(
      log([
        call(0, 'write', { path: 'server.js', content: 'const JWT_SECRET=super-secret-value' }),
        {
          type: 'tool/result', seq: 1, time: 1,
          data: { message: { role: 'tool', content: [{ type: 'text', text: 'token: sk-abc12345678901234567890' }] } },
        },
      ]),
    )
    const report = auditSession(parsed)
    expect(report.findings.some(finding => finding.ruleId === 'file-write' && finding.severity === 'critical')).toBe(true)
    expect(report.findings.some(finding => finding.ruleId === 'secret-output' && finding.severity === 'critical')).toBe(true)
  })

  it('keeps tool errors and sorts by severity then seq', () => {
    const report = auditSession(parseSessionJsonl(sessionA()))
    expect(report.findings.some(finding => finding.ruleId === 'tool-error')).toBe(true)
    const order = ['critical', 'serious', 'warning', 'info']
    const indices = report.findings.map(finding => order.indexOf(finding.severity))
    expect([...indices].sort((a, b) => a - b)).toEqual(indices)
    const total = Object.values(report.counts).reduce((sum, count) => sum + count, 0)
    expect(total).toBe(report.findings.length)
  })
=======
import { sessionA, sessionC } from '../demo/samples.js'

describe('auditSession', () => {
  const report = auditSession(parseSessionJsonl(sessionA()))

  it('flags dangerous shell commands as critical', () => {
    const critical = report.findings.filter(f => f.severity === 'critical')
    expect(critical.some(f => f.ruleId === 'shell-exec' && f.title.includes('recursive/forced delete'))).toBe(true)
  })

  it('flags writes to sensitive paths as critical', () => {
    expect(
      report.findings.some(f => f.ruleId === 'file-write' && f.severity === 'critical' && f.detail?.includes('.env')),
    ).toBe(true)
  })

  it('flags tool errors and keeps plain shell as warning', () => {
    expect(report.findings.some(f => f.ruleId === 'tool-error')).toBe(true)
    const plainShell = report.findings.filter(f => f.ruleId === 'shell-exec' && f.severity === 'warning')
    expect(plainShell.length).toBeGreaterThan(0)
  })

  it('sorts by severity then seq and counts match', () => {
    const order = ['critical', 'serious', 'warning', 'info']
    const indices = report.findings.map(f => order.indexOf(f.severity))
    expect([...indices].sort((a, b) => a - b)).toEqual(indices)
    const total = Object.values(report.counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(report.findings.length)
  })

  it('classifies network access in the subagent session as info', () => {
    const sub = auditSession(parseSessionJsonl(sessionC()))
    expect(sub.findings.some(f => f.ruleId === 'network' && f.severity === 'info')).toBe(true)
    expect(sub.counts.critical).toBe(0)
  })
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
})
