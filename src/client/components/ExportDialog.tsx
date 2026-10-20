import React, { useEffect, useMemo, useState } from 'react'
import { redactSession } from '../../core/redact.js'
import type { ParsedSession } from '../../core/types.js'
import { shortId, type ReplayApi } from '../api.js'
import { buildReplayHtml, downloadReplayHtml, formatBytes } from '../export.js'
import { useI18n } from '../i18n.js'

export function ExportDialog({
  api,
  session,
  title,
  onClose,
}: {
  api: ReplayApi
  session: ParsedSession
  title?: string
  onClose: () => void
}): React.ReactElement {
  const { t, lang } = useI18n()
  const [redact, setRedact] = useState(true)
  const [viewer, setViewer] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [loadingViewer, setLoadingViewer] = useState(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const getViewerSource = api.getViewerSource
    if (getViewerSource === undefined) {
      setError('viewer bundle unavailable')
      setLoadingViewer(false)
      return
    }
    setLoadingViewer(true)
    getViewerSource
      .call(api)
      .then(source => {
        if (cancelled) return
        setViewer(source)
        setLoadingViewer(false)
      })
      .catch(reason => {
        if (cancelled) return
        setError(String(reason))
        setLoadingViewer(false)
      })
    return () => {
      cancelled = true
    }
  }, [api])

  const redacted = useMemo(
    () => (redact ? redactSession(session) : { session, count: 0, kinds: [] as string[] }),
    [redact, session],
  )
  const html = useMemo(() => {
    if (viewer === undefined) return ''
    return buildReplayHtml(
      viewer,
      [{ header: redacted.session.header, events: redacted.session.events, title }],
      { lang, title },
    )
  }, [lang, redacted, title, viewer])
  const size = useMemo(() => (html === '' ? 0 : new Blob([html]).size), [html])

  const handleExport = (): void => {
    if (html === '') return
    setBusy(true)
    try {
      downloadReplayHtml(html, `replay-${shortId(session.header.id).replace('…', '')}.html`)
      onClose()
    } catch (reason) {
      setError(String(reason))
      setBusy(false)
    }
  }

  return (
    <div className="dshr-modal-backdrop dshr-export-backdrop" onClick={onClose}>
      <div
        className="dshr-modal dshr-export"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dshr-export-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="dshr-modal-chrome">
          <span className="dshr-modal-title" id="dshr-export-title">
            {t('exp.title')}
          </span>
          <span className="dshr-spacer" />
          <button className="dshr-modal-close" onClick={onClose} aria-label={t('modal.close')}>
            ✕
          </button>
        </div>
        <div className="dshr-export-body">
          <p className="dshr-export-warning">{t('exp.warning')}</p>
          <label className="dshr-check">
            <input type="checkbox" checked={redact} onChange={event => setRedact(event.target.checked)} />
            <span>{t('exp.redact')}</span>
          </label>
          {redact ? (
            <p className="dshr-export-meta">{t('exp.redactions', { n: redacted.count })}</p>
          ) : (
            <p className="dshr-export-danger">{t('exp.includeRaw')}</p>
          )}
          <p className="dshr-export-meta">
            {t('exp.size', { size: loadingViewer ? '…' : formatBytes(size) })}
          </p>
          <p className="dshr-export-note">{t('exp.note')}</p>
          {error !== undefined && <p className="dshr-export-danger">{error}</p>}
          <div className="dshr-export-actions">
            <button className="dshr-btn" onClick={onClose}>
              {t('exp.cancel')}
            </button>
            <button
              className="dshr-btn dshr-btn-primary"
              disabled={busy || loadingViewer || html === ''}
              onClick={handleExport}
            >
              {busy ? '…' : t('exp.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
