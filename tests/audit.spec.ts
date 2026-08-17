import { describe, expect, it } from 'vitest'
import { auditSession } from '../src/core/audit.js'
import { parseSessionJsonl } from '../src/core/decode.js'
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
})
