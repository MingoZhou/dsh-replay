<<<<<<< HEAD
import React, { useMemo, useState } from 'react'
=======
import React from 'react'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
import type { AuditReport, Severity } from '../../core/audit.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock } from '../api.js'
import { localizeFinding, useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'

const SEV_META: Record<Severity, { color: string; icon: string }> = {
  critical: { color: 'var(--dshr-critical)', icon: '⛔' },
  serious: { color: 'var(--dshr-serious)', icon: '⚠' },
  warning: { color: 'var(--dshr-warning)', icon: '△' },
  info: { color: 'var(--dshr-good)', icon: 'ℹ' },
}

<<<<<<< HEAD
const SEVERITIES: Severity[] = ['critical', 'serious', 'warning', 'info']

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
export function AuditView({
  report,
  model,
  onJump,
<<<<<<< HEAD
  sessionId,
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}: {
  report: AuditReport
  model: TimelineModel
  onJump: (seq: number) => void
<<<<<<< HEAD
  sessionId?: string
}): React.ReactElement {
  const { t } = useI18n()
  const [severity, setSeverity] = useState<Severity>()

  const findings = useMemo(
    () => (severity === undefined ? report.findings : report.findings.filter(finding => finding.severity === severity)),
    [report.findings, severity],
  )

  const exportReport = (): void => {
    const lines = [
      `# dsh-replay audit report`,
      ``,
      `- session: ${sessionId ?? 'unknown'}`,
      `- generated: ${new Date().toISOString()}`,
      `- scanned events: ${report.scanned}`,
      `- rules: ${report.rules}`,
      `- ignored baseline config events: ${report.suppressed}`,
      ``,
      `| severity | category | seq | time | finding | detail |`,
      `| --- | --- | --- | --- | --- | --- |`,
      ...report.findings.map(finding => {
        const detail = (finding.detail ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
        return `| ${finding.severity} | ${finding.category ?? ''} | ${finding.seq} | ${formatClock(finding.time, model.startTime)} | ${localizeFinding(t, finding).replaceAll('|', '\\|')} | ${detail} |`
      }),
      ``,
      `> ${t('audit.coverage')}`,
      ``,
    ]
    downloadText(lines.join('\n'), `audit-${(sessionId ?? 'session').slice(0, 24)}.md`)
  }

  return (
    <div className="dshr-audit">
      <div className="dshr-audit-head">
        <span className="dshr-audit-coverage">
          {t('audit.scanned', { n: report.scanned, rules: report.rules })}
          {report.suppressed > 0 ? ` · ${t('audit.baseline', { n: report.suppressed })}` : ''}
        </span>
        <span className="dshr-spacer" />
        {report.findings.length > 0 && (
          <button className="dshr-tab" onClick={exportReport}>
            ⬇ {t('audit.export')}
          </button>
        )}
      </div>

      <div className="dshr-audit-summary">
        {SEVERITIES.map(sev => (
          <button
            key={sev}
            className="dshr-audit-tile"
            data-active={severity === sev || undefined}
            onClick={() => setSeverity(current => (current === sev ? undefined : sev))}
            title={t('audit.riskOnly')}
          >
=======
}): React.ReactElement {
  const { t } = useI18n()
  return (
    <div className="dshr-audit">
      <div className="dshr-audit-summary">
        {(Object.keys(SEV_META) as Severity[]).map(sev => (
          <div key={sev} className="dshr-audit-tile">
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            <div className="dshr-count">{report.counts[sev]}</div>
            <div className="dshr-cap">
              <span className="dshr-sev-dot" style={{ background: SEV_META[sev].color }} />
              {SEV_META[sev].icon} {t(`sev.${sev}`)}
            </div>
<<<<<<< HEAD
          </button>
        ))}
      </div>

      <p className="dshr-audit-note">{t('audit.coverage')}</p>

      {report.findings.length === 0 ? (
        <MascotState mood="happy" text={t('audit.empty')} />
      ) : findings.length === 0 ? (
        <MascotState mood="happy" text={t('audit.noRisk')} />
      ) : (
        findings.map((finding, index) => (
          <button
            key={`${finding.ruleId}-${finding.seq}-${index}`}
            className="dshr-finding"
            onClick={() => onJump(finding.seq)}
          >
=======
          </div>
        ))}
      </div>
      {report.findings.length === 0 ? (
        <MascotState mood="happy" text={t('audit.empty')} />
      ) : (
        report.findings.map((finding, i) => (
          <button key={i} className="dshr-finding" onClick={() => onJump(finding.seq)}>
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            <span className="dshr-sev">
              <span className="dshr-sev-dot" style={{ background: SEV_META[finding.severity].color }} />
              {SEV_META[finding.severity].icon} {t(`sev.${finding.severity}`)}
            </span>
<<<<<<< HEAD
            <span className="dshr-finding-body">
              <span className="dshr-finding-title">
                {localizeFinding(t, finding)}
                {finding.category !== undefined && (
                  <span className="dshr-category">{t(`audit.category.${finding.category}`)}</span>
                )}
              </span>
              {finding.detail !== undefined && finding.detail !== '' && (
                <span className="dshr-finding-detail">{finding.detail}</span>
              )}
            </span>
=======
            <span className="dshr-finding-title">{localizeFinding(t, finding)}</span>
            {finding.detail !== undefined && finding.detail !== '' && (
              <span className="dshr-finding-detail">{finding.detail}</span>
            )}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            <span className="dshr-item-time">{formatClock(finding.time, model.startTime)}</span>
          </button>
        ))
      )}
    </div>
  )
}
