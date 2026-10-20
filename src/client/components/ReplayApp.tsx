import React, { useEffect, useMemo, useState } from 'react'
import { auditSession } from '../../core/audit.js'
import { buildTimeline } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import {
  formatDuration,
  formatTokens,
  shortId,
  type ReplayApi,
  type SessionEntry,
  type SessionSummaryEntry,
} from '../api.js'
import { I18nContext, makeT, setLang as setGlobalLang, useLang, type Lang } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { DashboardView } from './DashboardView.js'
import { ExportDialog } from './ExportDialog.js'
import { SessionPicker } from './SessionPicker.js'
import { AuditView } from './AuditView.js'
import { CompareView } from './CompareView.js'
import { ForkTreeView } from './ForkTreeView.js'
import { OverviewView } from './OverviewView.js'
import { TimelineView } from './TimelineView.js'

type Tab = 'dashboard' | 'overview' | 'timeline' | 'audit' | 'forks' | 'compare'

const TABS: { id: Exclude<Tab, 'dashboard'>; labelKey: string }[] = [
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
  standalone = false,
}: {
  api: ReplayApi
  /** Omit to start on the session archive (modal / standalone modes). */
  sessionId?: string
  /** Override the detected language ('en' | 'zh'). */
  initialLang?: Lang
  /** Optional host-provided navigation; falls back to internal state. */
  onSwitchSession?: (id: string) => void
  /** Exported HTML viewer: one session, no archive/forks/compare/export. */
  standalone?: boolean
}): React.ReactElement {
  const lang = useLang()
  const t = useMemo(() => makeT(lang), [lang])
  const [tab, setTab] = useState<Tab>(sessionId !== undefined ? 'overview' : 'dashboard')
  const [currentId, setCurrentId] = useState<string | undefined>(sessionId)
  const [session, setSession] = useState<ParsedSession>()
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [summaries, setSummaries] = useState<SessionSummaryEntry[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string>()
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string>()
  const [refreshTick, setRefreshTick] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<number>()
  const [jumpToSeq, setJumpToSeq] = useState<number>()
  const [jumpNonce, setJumpNonce] = useState(0)
  const [exporting, setExporting] = useState(false)

  const i18n = useMemo(() => ({ lang, t, setLang: setGlobalLang }), [lang, t])

  useEffect(() => {
    if (initialLang !== undefined) setGlobalLang(initialLang)
  }, [initialLang])

  useEffect(() => {
    if (sessionId !== undefined) {
      setCurrentId(sessionId)
      setTab('overview')
    }
  }, [sessionId])

  // The session list and summaries load once, not on every session switch.
  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(undefined)
    api
      .listSessions()
      .then(list => {
        if (cancelled) return
        setEntries([...list].sort((a, b) => b.header.createdAt - a.header.createdAt))
        setListLoading(false)
        setUpdatedAt(Date.now())
      })
      .catch(error => {
        if (cancelled) return
        setListError(String(error))
        setListLoading(false)
      })
    if (api.getSummaries !== undefined) {
      api
        .getSummaries(30)
        .then(list => !cancelled && setSummaries(list))
        .catch(() => {
          /* dashboard cards are optional; the session list still works */
        })
    }
    return () => {
      cancelled = true
    }
  }, [api, refreshTick])

  // Only the current session is fetched on selection.
  useEffect(() => {
    if (currentId === undefined) {
      setSession(undefined)
      setSessionError(undefined)
      return
    }
    let cancelled = false
    setSessionLoading(true)
    setSessionError(undefined)
    setSession(undefined)
    api
      .getSession(currentId)
      .then(value => {
        if (cancelled) return
        setSession(value)
        setSessionLoading(false)
        setUpdatedAt(Date.now())
      })
      .catch(error => {
        if (cancelled) return
        setSessionError(String(error))
        setSessionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, currentId, refreshTick])

  const model = useMemo(() => (session ? buildTimeline(session) : undefined), [session])
  const report = useMemo(() => (session ? auditSession(session) : undefined), [session])
  const currentEntry = entries.find(entry => entry.header.id === currentId)
  const title = currentEntry?.title ?? model?.title

  const availableTabs = useMemo(
    () =>
      TABS.filter(item => {
        if (standalone && (item.id === 'forks' || item.id === 'compare')) return false
        return true
      }),
    [standalone],
  )

  useEffect(() => {
    if (currentId === undefined) {
      setTab('dashboard')
      return
    }
    if (tab === 'dashboard') {
      setTab('overview')
      return
    }
    if (!availableTabs.some(item => item.id === tab)) setTab('overview')
  }, [availableTabs, currentId, tab])

  const switchSession = (id: string): void => {
    setJumpToSeq(undefined)
    if (onSwitchSession) onSwitchSession(id)
    setCurrentId(id)
    setTab('overview')
  }

  const backToArchive = (): void => {
    setCurrentId(undefined)
    setSession(undefined)
    setTab('dashboard')
  }

  const refresh = (): void => setRefreshTick(tick => tick + 1)

  const jump = (seq: number): void => {
    setTab('timeline')
    setJumpToSeq(seq)
    setJumpNonce(nonce => nonce + 1)
  }

  const langToggle = (
    <button
      className="dshr-tab"
      onClick={() => setGlobalLang(lang === 'en' ? 'zh' : 'en')}
      title={t('lang.switch')}
      aria-label={t('lang.switch')}
    >
      {lang === 'en' ? '中' : 'EN'}
    </button>
  )

  const updated = updatedAt !== undefined
    ? t('app.updated', {
        time: new Date(updatedAt).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : undefined

  if (currentId === undefined) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="dshr-root">
          <div className="dshr-header">
            <span className="dshr-title">{t('dash.title')}</span>
            <span className="dshr-header-sub">{t('app.reviewSub')}</span>
            <span className="dshr-spacer" />
            {updated !== undefined && <span className="dshr-header-stat">{updated}</span>}
            <button className="dshr-tab" onClick={refresh} title={t('app.refresh')}>
              ↻ {t('app.refresh')}
            </button>
            {langToggle}
          </div>
          {listError !== undefined ? (
            <MascotState mood="alert" text={t('app.error', { error: listError })} />
          ) : api.getSummaries !== undefined ? (
            <DashboardView
              entries={entries}
              summaries={summaries}
              loading={listLoading}
              onPick={switchSession}
            />
          ) : (
            <SessionPicker entries={entries} loading={listLoading} onPick={switchSession} />
          )}
        </div>
      </I18nContext.Provider>
    )
  }

  if (sessionError !== undefined) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="dshr-root">
          <div className="dshr-header">
            {!standalone && (
              <button className="dshr-tab" onClick={backToArchive}>
                ← {t('app.back')}
              </button>
            )}
            <span className="dshr-title">{t('modal.title')}</span>
            <span className="dshr-spacer" />
            {langToggle}
          </div>
          <div className="dshr-center dshr-error-state">
            <div>
              <p>{t('app.error', { error: sessionError })}</p>
              <button className="dshr-btn" onClick={refresh}>
                {t('app.retry')}
              </button>
            </div>
          </div>
        </div>
      </I18nContext.Provider>
    )
  }

  if (sessionLoading || session === undefined || model === undefined || report === undefined) {
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
          {!standalone && (
            <button className="dshr-tab" onClick={backToArchive} title={t('app.back')}>
              ←
            </button>
          )}
          <span className="dshr-title">{t('modal.title')}</span>
          <nav className="dshr-tabs">
            {availableTabs.map(item => (
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
          <span className="dshr-header-stat dshr-header-session">
            {title ?? shortId(currentId)} · {t('hdr.turns', { n: model.turns.length })} ·{' '}
            {formatTokens(model.totals.billedInput + model.totals.output)} tok ·{' '}
            {formatDuration(model.durationMs)}
            {model.models.length > 0 ? ` · ${model.models.join(', ')}` : ''}
          </span>
          {currentEntry?.live === true && <span className="dshr-live-dot" title={t('picker.live')} />}
          {updated !== undefined && <span className="dshr-header-stat">{updated}</span>}
          <button className="dshr-tab" onClick={refresh} title={t('app.refresh')}>
            ↻
          </button>
          {!standalone && api.getViewerSource !== undefined && (
            <button className="dshr-tab" onClick={() => setExporting(true)} title={t('exp.button')}>
              ⬇ {t('exp.button')}
            </button>
          )}
          {langToggle}
        </div>
        {tab === 'overview' && (
          <OverviewView model={model} report={report} onOpenAudit={() => setTab('audit')} />
        )}
        {tab === 'timeline' && (
          <TimelineView model={model} jumpToSeq={jumpToSeq} jumpNonce={jumpNonce} />
        )}
        {tab === 'audit' && (
          <AuditView report={report} model={model} onJump={jump} sessionId={currentId} />
        )}
        {tab === 'forks' && !standalone && (
          <ForkTreeView entries={entries} currentId={currentId} onSelect={switchSession} />
        )}
        {tab === 'compare' && !standalone && (
          <CompareView
            api={api}
            session={session}
            entries={entries}
            title={title}
            onOpenSession={switchSession}
          />
        )}
        {exporting && (
          <ExportDialog
            api={api}
            session={session}
            title={title}
            onClose={() => setExporting(false)}
          />
        )}
      </div>
    </I18nContext.Provider>
  )
}
