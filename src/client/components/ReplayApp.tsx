import React, { useEffect, useMemo, useState } from 'react'
import { auditSession } from '../../core/audit.js'
import { buildTimeline } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDuration, formatTokens, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { buildReplayHtml, downloadReplayHtml } from '../export.js'
import { detectLang, I18nContext, makeT, persistLang, type Lang } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { SessionPicker } from './SessionPicker.js'
import { AuditView } from './AuditView.js'
import { CompareView } from './CompareView.js'
import { ForkTreeView } from './ForkTreeView.js'
import { OverviewView } from './OverviewView.js'
import { TimelineView } from './TimelineView.js'

type Tab = 'overview' | 'timeline' | 'audit' | 'forks' | 'compare'

const TABS: { id: Tab; labelKey: string }[] = [
  { id: 'overview', labelKey: 'tab.overview' },
  { id: 'timeline', labelKey: 'tab.timeline' },
  { id: 'audit', labelKey: 'tab.audit' },
  { id: 'forks', labelKey: 'tab.forks' },
  { id: 'compare', labelKey: 'tab.compare' },
]

export function ReplayApp({
  api,
  sessionId,
  initialLang,
  onSwitchSession,
}: {
  api: ReplayApi
  /** Omit to start on the session picker (modal / standalone modes). */
  sessionId?: string
  /** Override the detected language ('en' | 'zh'). */
  initialLang?: Lang
  /** Optional host-provided navigation; falls back to internal state. */
  onSwitchSession?: (id: string) => void
}): React.ReactElement {
  const [lang, setLangState] = useState<Lang>(initialLang ?? detectLang())
  const [tab, setTab] = useState<Tab>('overview')
  const [currentId, setCurrentId] = useState<string | undefined>(sessionId)
  const [session, setSession] = useState<ParsedSession>()
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [error, setError] = useState<string>()
  const [jumpToSeq, setJumpToSeq] = useState<number>()

  const t = useMemo(() => makeT(lang), [lang])
  const setLang = (next: Lang): void => {
    setLangState(next)
    persistLang(next)
  }
  const i18n = useMemo(() => ({ lang, t, setLang }), [lang, t])

  useEffect(() => {
    if (sessionId !== undefined) setCurrentId(sessionId)
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    if (currentId !== undefined) {
      setSession(undefined)
      api
        .getSession(currentId)
        .then(s => !cancelled && setSession(s))
        .catch(e => !cancelled && setError(String(e)))
    }
    api
      .listSessions()
      .then(list => !cancelled && setEntries(list))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [api, currentId])

  const model = useMemo(() => (session ? buildTimeline(session) : undefined), [session])
  const report = useMemo(() => (session ? auditSession(session) : undefined), [session])
  const title = entries.find(e => e.header.id === currentId)?.title ?? model?.title

  const switchSession = (id: string): void => {
    setJumpToSeq(undefined)
    if (onSwitchSession) onSwitchSession(id)
    setCurrentId(id)
    setTab('overview')
  }

  const jump = (seq: number): void => {
    setTab('timeline')
    setJumpToSeq(seq)
  }

  const handleExport = async (): Promise<void> => {
    if (session === undefined || api.getViewerSource === undefined) return
    try {
      const viewer = await api.getViewerSource()
      const html = buildReplayHtml(viewer, [
        { header: session.header, events: session.events, title },
      ])
      downloadReplayHtml(html, `replay-${shortId(session.header.id).replace('…', '')}.html`)
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(t('exp.fail', { error: String(e) }))
    }
  }

  const langToggle = (
    <button
      className="dshr-tab"
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      title={lang === 'en' ? '切换到中文' : 'Switch to English'}
      aria-label="language"
    >
      {lang === 'en' ? '中' : 'EN'}
    </button>
  )

  if (currentId === undefined) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="dshr-root">
          <div className="dshr-header">
            <span className="dshr-title">Replay</span>
            <span className="dshr-spacer" />
            {langToggle}
          </div>
          <SessionPicker api={api} onPick={switchSession} />
        </div>
      </I18nContext.Provider>
    )
  }
  if (error !== undefined) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="dshr-root">
          <div className="dshr-header">
            <span className="dshr-title">Replay</span>
            <span className="dshr-spacer" />
            {langToggle}
          </div>
          <MascotState mood="alert" text={t('app.error', { error })} />
        </div>
      </I18nContext.Provider>
    )
  }
  if (session === undefined || model === undefined || report === undefined) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="dshr-root">
          <MascotState mood="idle" text={t('app.loadingText')} />
        </div>
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={i18n}>
      <div className="dshr-root">
        <div className="dshr-header">
          <span className="dshr-title">Replay</span>
          <nav className="dshr-tabs">
            {TABS.map(item => (
              <button
                key={item.id}
                className="dshr-tab"
                data-active={tab === item.id || undefined}
                onClick={() => setTab(item.id)}
              >
                {t(item.labelKey)}
                {item.id === 'audit' && report.counts.critical + report.counts.serious > 0
                  ? ` (${report.counts.critical + report.counts.serious})`
                  : ''}
              </button>
            ))}
          </nav>
          <span className="dshr-spacer" />
          <span className="dshr-header-stat">
            {title ?? shortId(currentId)} · {t('hdr.turns', { n: model.turns.length })} ·{' '}
            {formatTokens(model.totals.billedInput + model.totals.output)} tok ·{' '}
            {formatDuration(model.durationMs)}
            {model.models.length > 0 ? ` · ${model.models.join(', ')}` : ''}
          </span>
          {api.getViewerSource !== undefined && (
            <button className="dshr-tab" onClick={() => void handleExport()} title={t('exp.button')}>
              ⬇ {t('exp.button')}
            </button>
          )}
          {langToggle}
        </div>
        {tab === 'overview' && (
          <OverviewView model={model} report={report} onOpenAudit={() => setTab('audit')} />
        )}
        {tab === 'timeline' && <TimelineView model={model} jumpToSeq={jumpToSeq} />}
        {tab === 'audit' && <AuditView report={report} model={model} onJump={jump} />}
        {tab === 'forks' && (
          <ForkTreeView entries={entries} currentId={currentId} onSelect={switchSession} />
        )}
        {tab === 'compare' && (
          <CompareView api={api} session={session} entries={entries} title={title} />
        )}
      </div>
    </I18nContext.Provider>
  )
}
