import React, { useState } from 'react'
import type { FileChangeReport } from '../../core/files.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock } from '../api.js'
import { useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { DiffView, Icon } from '../ui.js'

const STATUS_MARK: Record<string, string> = { created: 'A', modified: 'M', deleted: 'D' }

export function FilesView({
  files,
  model,
  onJump,
}: {
  files: FileChangeReport
  model: TimelineModel
  onJump: (seq: number) => void
}): React.ReactElement {
  const { t } = useI18n()
  const [selected, setSelected] = useState<string | undefined>(files.files[0]?.path)
  if (files.files.length === 0) return <MascotState mood="happy" text={t('files.empty')} />
  const file = files.files.find(f => f.path === selected) ?? files.files[0]
  const max = Math.max(1, ...files.files.map(f => f.added + f.removed))
  return (
    <div className="dshr-files">
      <div className="dshr-filelist">
        <div className="dshr-filelist-head">
          {t('files.summary', { n: files.files.length })}
          <span className="dshr-diffstat">
            <span data-op="add">+{files.added}</span>
            <span data-op="del">−{files.removed}</span>
          </span>
        </div>
        {files.files.map(f => {
          const name = f.path.split(/[\\/]/u).at(-1) ?? f.path
          const dir = f.path.slice(0, f.path.length - name.length)
          return (
            <button key={f.path} className="dshr-filerow" data-selected={f.path === file.path || undefined} onClick={() => setSelected(f.path)} title={f.path}>
              <span className="dshr-filestatus" data-status={f.status} title={t(`files.status.${f.status}`)}>
                {STATUS_MARK[f.status]}
              </span>
              <span className="dshr-filename">
                {name}
                <span className="dshr-muted"> {dir}</span>
              </span>
              <span className="dshr-filebar" aria-hidden="true">
                <span data-op="add" style={{ width: `${(f.added / max) * 100}%` }} />
                <span data-op="del" style={{ width: `${(f.removed / max) * 100}%` }} />
              </span>
              <span className="dshr-diffstat">
                <span data-op="add">+{f.added}</span>
                <span data-op="del">−{f.removed}</span>
              </span>
            </button>
          )
        })}
        <div className="dshr-filelist-note">{t('files.note')}</div>
      </div>
      <div className="dshr-filedetail">
        <div className="dshr-filepath">
          <Icon name="file" />
          {file.path}
        </div>
        {file.ops.map(op => (
          <div key={op.seq} className="dshr-fileop" data-failed={op.failed || undefined}>
            <div className="dshr-fileop-head">
              <span className="dshr-badge">{t(`files.op.${op.kind}`)}</span>
              <span className="dshr-muted">
                {op.tool}
                {op.turn !== undefined && ` · ${t('tl.turn', { n: op.turn })}`} · t+{formatClock(op.time, model.startTime)}
              </span>
              {op.failed && (
                <span className="dshr-badge" data-tone="critical">
                  <Icon name="warn" size={11} /> {t('files.failed')}
                </span>
              )}
              {op.movedTo !== undefined && <span className="dshr-muted">→ {op.movedTo}</span>}
              <span className="dshr-spacer" />
              <span className="dshr-diffstat">
                <span data-op="add">+{op.added}</span>
                <span data-op="del">−{op.removed}</span>
              </span>
              <button className="dshr-linkbtn" onClick={() => onJump(op.seq)}>
                #{op.seq} <Icon name="chevron" size={10} />
              </button>
            </div>
            {op.lines.length > 0 ? <DiffView lines={op.lines} /> : <div className="dshr-empty">{t('files.noBody')}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
