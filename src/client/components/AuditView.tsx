import React from 'react'
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

export function AuditView({
  report,
  model,
  onJump,
}: {
  report: AuditReport
  model: TimelineModel
  onJump: (seq: number) => void
}): React.ReactElement {
  const { t } = useI18n()
  return (
    <div className="dshr-audit">
      <div className="dshr-audit-summary">
        {(Object.keys(SEV_META) as Severity[]).map(sev => (
          <div key={sev} className="dshr-audit-tile">
            <div className="dshr-count">{report.counts[sev]}</div>
            <div className="dshr-cap">
              <span className="dshr-sev-dot" style={{ background: SEV_META[sev].color }} />
              {SEV_META[sev].icon} {t(`sev.${sev}`)}
            </div>
          </div>
        ))}
      </div>
      {report.findings.length === 0 ? (
        <MascotState mood="happy" text={t('audit.empty')} />
      ) : (
        report.findings.map((finding, i) => (
          <button key={i} className="dshr-finding" onClick={() => onJump(finding.seq)}>
            <span className="dshr-sev">
              <span className="dshr-sev-dot" style={{ background: SEV_META[finding.severity].color }} />
              {SEV_META[finding.severity].icon} {t(`sev.${finding.severity}`)}
            </span>
            <span className="dshr-finding-title">{localizeFinding(t, finding)}</span>
            {finding.detail !== undefined && finding.detail !== '' && (
              <span className="dshr-finding-detail">{finding.detail}</span>
            )}
            <span className="dshr-item-time">{formatClock(finding.time, model.startTime)}</span>
          </button>
        ))
      )}
    </div>
  )
}
