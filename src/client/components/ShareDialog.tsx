import React, { useMemo, useState } from 'react'
import { redactSession, type RedactOptions } from '../../core/redact.js'
import type { TimelineModel } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import { shortId, type ReplayApi } from '../api.js'
import { buildReplayHtml, downloadReplayHtml, downloadText } from '../export.js'
import { useI18n } from '../i18n.js'
import { updateSettings, useSettings } from '../settings.js'
import { CopyButton, Dialog, Icon } from '../ui.js'

type Scope = 'all' | 'turn' | 'custom'

export function ShareDialog({
  api,
  session,
  model,
  title,
  cursorSeq,
  markdown,
  onClose,
}: {
  api: ReplayApi
  session: ParsedSession
  model: TimelineModel
  title?: string
  cursorSeq?: number
  /** Builds the Markdown summary with the given redaction options. */
  markdown: (redact: RedactOptions) => string
  onClose: () => void
}): React.ReactElement {
  const { t, lang } = useI18n()
  const settings = useSettings()
  const options = settings.redact
  const setOption = (patch: Partial<RedactOptions>): void => updateSettings({ redact: { ...options, ...patch } })
  const [scope, setScope] = useState<Scope>('all')
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(model.lastSeq)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const turn = model.turns.find(tm => cursorSeq !== undefined && tm.startSeq <= cursorSeq && (tm.endSeq ?? Number.POSITIVE_INFINITY) >= cursorSeq) ?? model.turns.at(-1)

  const range = useMemo(() => {
    if (scope === 'turn' && turn) return { fromSeq: turn.startSeq, toSeq: turn.endSeq ?? model.lastSeq }
    if (scope === 'custom') return { fromSeq: Math.min(from, to), toSeq: Math.max(from, to) }
    return {}
  }, [scope, turn, from, to, model.lastSeq])
  const result = useMemo(() => redactSession(session, options, range), [session, options, range])
  const anyOn = options.secrets || options.paths || options.emails
  const name = `replay-${shortId(session.header.id).replace('…', '')}`

  const exportHtml = async (): Promise<void> => {
    if (api.getViewerSource === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      const viewer = await api.getViewerSource()
      const html = buildReplayHtml(
        viewer,
        [{ header: result.session.header, events: result.session.events, title, inheritedEventCount: result.session.inheritedEventCount }],
        { exportedAt: Date.now(), redactions: result.total, partial: scope !== 'all', pricing: settings.pricing, lang },
      )
      downloadReplayHtml(html, `${name}.html`)
    } catch (e) {
      setError(t('exp.fail', { error: String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={t('share.title')}
      onClose={onClose}
      footer={
        <>
          {error !== undefined && <span className="dshr-errorline">{error}</span>}
          <span className="dshr-spacer" />
          <CopyButton text={markdown(options)} label={t('share.copyMd')} done={t('common.copied')} />
          <button className="dshr-btn" onClick={() => downloadText(markdown(options), `${name}.md`, 'text/markdown')}>
            <Icon name="download" size={12} /> {t('share.downloadMd')}
          </button>
          {api.getViewerSource !== undefined && (
            <button className="dshr-btn" data-primary disabled={busy || result.session.events.length === 0} onClick={() => void exportHtml()}>
              <Icon name="download" size={12} /> {busy ? t('share.building') : t('share.exportHtml')}
            </button>
          )}
        </>
      }
    >
      <div className="dshr-form">
        <div className="dshr-form-row">
          <span className="dshr-form-label">{t('share.scope')}</span>
          <span className="dshr-seg">
            <button data-on={scope === 'all' || undefined} onClick={() => setScope('all')}>
              {t('share.scope.all')}
            </button>
            {turn && (
              <button data-on={scope === 'turn' || undefined} onClick={() => setScope('turn')}>
                {t('share.scope.turn', { n: turn.turn })}
              </button>
            )}
            <button data-on={scope === 'custom' || undefined} onClick={() => setScope('custom')}>
              {t('share.scope.custom')}
            </button>
          </span>
          {scope === 'custom' && (
            <span className="dshr-inline">
              #
              <input className="dshr-input dshr-input-num" type="number" min={0} max={model.lastSeq} value={from} onChange={e => setFrom(Number(e.target.value))} aria-label="from seq" />
              –
              <input className="dshr-input dshr-input-num" type="number" min={0} max={model.lastSeq} value={to} onChange={e => setTo(Number(e.target.value))} aria-label="to seq" />
            </span>
          )}
          <span className="dshr-muted">{t('share.events', { n: result.session.events.length })}</span>
        </div>
        <div className="dshr-form-row">
          <span className="dshr-form-label">{t('share.redact')}</span>
          {(['secrets', 'paths', 'emails'] as const).map(key => (
            <label key={key} className="dshr-check">
              <input type="checkbox" checked={options[key]} onChange={e => setOption({ [key]: e.target.checked })} />
              {t(`share.redact.${key}`)}
            </label>
          ))}
        </div>

        <div className="dshr-redact" data-clean={result.total === 0 || undefined}>
          <div className="dshr-redact-head">
            <Icon name={result.total > 0 ? 'eyeOff' : 'check'} />
            {!anyOn ? t('share.off') : result.total > 0 ? t('share.found', { n: result.total }) : t('share.clean')}
          </div>
          {result.hits.length > 0 && (
            <table className="dshr-mini-table">
              <tbody>
                {result.hits.map(hit => (
                  <tr key={`${hit.category}/${hit.kind}`}>
                    <td>{t(`share.kind.${hit.kind}`)}</td>
                    <td className="dshr-mono dshr-ellipsis">{hit.sample}</td>
                    <td className="dshr-num">×{hit.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="dshr-note">
          <Icon name="warn" size={12} /> {t('share.caveat')}
        </p>
        {api.getViewerSource === undefined && <p className="dshr-note">{t('share.noViewer')}</p>}
      </div>
    </Dialog>
  )
}
