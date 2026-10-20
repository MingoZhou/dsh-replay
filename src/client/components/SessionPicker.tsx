<<<<<<< HEAD
import React, { useMemo, useState } from 'react'
import { formatRelativeTime, shortId, type SessionEntry } from '../api.js'
=======
import React, { useEffect, useState } from 'react'
import { formatDuration, shortId, type ReplayApi, type SessionEntry } from '../api.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
import { useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'

export function SessionPicker({
<<<<<<< HEAD
  entries,
  loading = false,
  onPick,
}: {
  entries: SessionEntry[]
  loading?: boolean
  onPick: (id: string) => void
}): React.ReactElement {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState('')
  const [workspace, setWorkspace] = useState('')

  const workspaces = useMemo(
    () =>
      [...new Set(entries.map(entry => entry.header.cwd).filter((cwd): cwd is string => typeof cwd === 'string'))].sort(),
    [entries],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter(entry => workspace === '' || entry.header.cwd === workspace)
      .filter(entry => {
        if (q === '') return true
        return `${entry.title ?? ''} ${entry.header.id} ${entry.header.cwd ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => b.header.createdAt - a.header.createdAt)
  }, [entries, query, workspace])

  if (loading && entries.length === 0) return <MascotState mood="idle" text={t('app.loadingText')} />
  if (entries.length === 0) return <MascotState mood="happy" text={t('picker.empty')} />

  return (
    <div className="dshr-picker">
      <div className="dshr-section-label">{t('picker.title')}</div>
      <div className="dshr-picker-toolbar">
        <input
          className="dshr-filter-input dshr-picker-search"
          type="search"
          placeholder={t('picker.search')}
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label={t('picker.search')}
        />
        <select
          className="dshr-select"
          value={workspace}
          onChange={event => setWorkspace(event.target.value)}
          aria-label={t('picker.allWorkspaces')}
        >
          <option value="">{t('picker.allWorkspaces')}</option>
          {workspaces.map(cwd => (
            <option key={cwd} value={cwd}>
              {cwd}
            </option>
          ))}
        </select>
        <span className="dshr-spacer" />
        <span className="dshr-picker-count">{t('picker.count', { n: rows.length })}</span>
      </div>
      {rows.map(entry => (
        <button key={entry.header.id} className="dshr-picker-row" onClick={() => onPick(entry.header.id)}>
          <span className="dshr-picker-title">
            {entry.title ?? shortId(entry.header.id)}
            {entry.header.origin === 'subagent' && <span className="dshr-picker-tag">{t('picker.subagent')}</span>}
            {entry.header.parentSession !== undefined && entry.header.origin !== 'subagent' && (
              <span className="dshr-picker-tag">{t('picker.fork')}</span>
            )}
            {entry.live === true && <span className="dshr-live-pill">{t('picker.live')}</span>}
=======
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
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          </span>
          <span className="dshr-picker-sub">
            {shortId(entry.header.id)}
            {entry.header.cwd !== undefined ? ` · ${entry.header.cwd}` : ''}
          </span>
          <span className="dshr-picker-age">
<<<<<<< HEAD
            {formatRelativeTime(entry.header.createdAt, Date.now(), lang)}
          </span>
        </button>
      ))}
      {rows.length === 0 && <MascotState mood="happy" text={t('audit.empty')} />}
=======
            {Number.isFinite(entry.header.createdAt) && entry.header.createdAt <= now
              ? formatDuration(now - entry.header.createdAt)
              : ''}
          </span>
        </button>
      ))}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    </div>
  )
}
