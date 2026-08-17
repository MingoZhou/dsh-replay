import React, { useEffect, useState } from 'react'
import { formatDuration, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'

export function SessionPicker({
  api,
  onPick,
}: {
  api: ReplayApi
  onPick: (id: string) => void
}): React.ReactElement {
  const { t } = useI18n()
  const [entries, setEntries] = useState<SessionEntry[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    api
      .listSessions()
      .then(list => {
        if (!cancelled) setEntries([...list].sort((a, b) => b.header.createdAt - a.header.createdAt))
      })
      .catch(e => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [api])

  if (error !== undefined) return <MascotState mood="alert" text={error} />
  if (entries === undefined) return <MascotState mood="idle" text={t('app.loadingText')} />
  if (entries.length === 0) return <MascotState mood="happy" text={t('picker.empty')} />

  const now = Date.now()
  return (
    <div className="dshr-picker">
      <div className="dshr-section-label">{t('picker.title')}</div>
      {entries.map(entry => (
        <button key={entry.header.id} className="dshr-picker-row" onClick={() => onPick(entry.header.id)}>
          <span className="dshr-picker-title">
            {entry.title ?? shortId(entry.header.id)}
            {entry.header.origin === 'subagent' && <span className="dshr-picker-tag">subagent</span>}
            {entry.header.parentSession !== undefined && entry.header.origin !== 'subagent' && (
              <span className="dshr-picker-tag">fork</span>
            )}
          </span>
          <span className="dshr-picker-sub">
            {shortId(entry.header.id)}
            {entry.header.cwd !== undefined ? ` · ${entry.header.cwd}` : ''}
          </span>
          <span className="dshr-picker-age">
            {Number.isFinite(entry.header.createdAt) && entry.header.createdAt <= now
              ? formatDuration(now - entry.header.createdAt)
              : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
