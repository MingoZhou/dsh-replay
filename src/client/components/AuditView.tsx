import React, { useState } from 'react'
import type { AuditGroup, AuditReport, Severity } from '../../core/audit.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock } from '../api.js'
import { localizeFinding, useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { updateSettings, useSettings } from '../settings.js'
import { Icon } from '../ui.js'

const SEVERITIES: Severity[] = ['critical', 'serious', 'warning', 'info']
const PAGE = 30

function Group({
  group,
  model,
  onJump,
  onIgnore,
}: {
  group: AuditGroup
  model: TimelineModel
  onJump: (seq: number) => void
  onIgnore: () => void
}): React.ReactElement {
  const { t } = useI18n()
  const [open, setOpen] = useState(group.severity === 'critical' || group.severity === 'serious')
  const [limit, setLimit] = useState(PAGE)
  return (
    <div className="dshr-auditgroup" data-sev={group.severity}>
      <div className="dshr-auditgroup-head">
        <button className="dshr-auditgroup-toggle" data-open={open || undefined} onClick={() => setOpen(o => !o)}>
          <Icon name="chevron" size={11} />
          <span className="dshr-sev" data-sev={group.severity}>
            <span className="dshr-sev-dot" />
            {t(`sev.${group.severity}`)}
          </span>
          <span className="dshr-auditgroup-title">{t(`rule.${group.ruleId}`)}</span>
          <span className="dshr-count-pill">{group.findings.length}</span>
        </button>
        <span className="dshr-spacer" />
        <button className="dshr-ghostbtn" onClick={onIgnore} title={t('audit.ignoreTitle')}>
          <Icon name="eyeOff" size={12} />
          {t('audit.ignore')}
        </button>
      </div>
      {open && (
        <div className="dshr-findings">
          {group.findings.slice(0, limit).map((finding, i) => (
            <button key={i} className="dshr-finding" onClick={() => onJump(finding.seq)}>
              <span className="dshr-sev-dot" data-sev={finding.severity} title={t(`sev.${finding.severity}`)} />
              <span className="dshr-finding-title">{localizeFinding(t, finding)}</span>
              {finding.detail !== undefined && finding.detail !== '' && <span className="dshr-finding-detail">{finding.detail}</span>}
              <span className="dshr-item-time">{formatClock(finding.time, model.startTime)}</span>
            </button>
          ))}
          {group.findings.length > limit && (
            <button className="dshr-linkbtn dshr-pad" onClick={() => setLimit(l => l + PAGE * 4)}>
              {t('common.more', { n: group.findings.length - limit })}
            </button>
          )}
        </div>
      )}
    </div>
  )
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
  const { ignoredRules } = useSettings()
  return (
    <div className="dshr-scroll">
      <div className="dshr-audit">
        <div className="dshr-audit-summary">
          {SEVERITIES.map(sev => (
            <div key={sev} className="dshr-audit-tile" data-sev={sev} data-zero={report.counts[sev] === 0 || undefined}>
              <div className="dshr-count">{report.counts[sev]}</div>
              <div className="dshr-sev" data-sev={sev}>
                <span className="dshr-sev-dot" />
                {t(`sev.${sev}`)}
              </div>
            </div>
          ))}
          <div className="dshr-audit-note">{t('audit.note')}</div>
        </div>
        {report.groups.length === 0 ? (
          <MascotState mood="happy" text={t('audit.empty')} />
        ) : (
          report.groups.map(group => (
            <Group
              key={group.ruleId}
              group={group}
              model={model}
              onJump={onJump}
              onIgnore={() => updateSettings({ ignoredRules: [...new Set([...ignoredRules, group.ruleId])] })}
            />
          ))
        )}
        {ignoredRules.length > 0 && (
          <div className="dshr-ignored">
            <span className="dshr-muted">{t('audit.ignored', { n: report.ignored })}</span>
            {ignoredRules.map(rule => (
              <button
                key={rule}
                className="dshr-chip"
                data-on
                onClick={() => updateSettings({ ignoredRules: ignoredRules.filter(r => r !== rule) })}
                title={t('audit.restore')}
              >
                {t(`rule.${rule}`)} <Icon name="close" size={10} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
