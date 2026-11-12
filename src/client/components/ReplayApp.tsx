import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { auditSession } from '../../core/audit.js'
import { estimateCost } from '../../core/cost.js'
import { baselineFor, priceSummary } from '../../core/dashboard.js'
import { collectFileChanges } from '../../core/files.js'
import { buildInsights } from '../../core/insights.js'
import type { SessionSummary } from '../../core/summary.js'
import { buildTimeline } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDateTime, formatDuration, shortId, type HostBridge, type ReplayApi, type SessionEntry } from '../api.js'
import type { ExportMeta } from '../export.js'
import { detectLang, I18nContext, makeT, persistLang, type Lang } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { buildReportMarkdown } from '../report-md.js'
import { useSettings } from '../settings.js'
import { Icon } from '../ui.js'
import { AuditView } from './AuditView.js'
import { CompareView } from './CompareView.js'
import { DashboardView } from './DashboardView.js'
import { FilesView } from './FilesView.js'
import { ForkTreeView } from './ForkTreeView.js'
import { ReportView } from './ReportView.js'
import { SettingsDialog } from './SettingsDialog.js'
import { ShareDialog } from './ShareDialog.js'
import { TimelineView } from './TimelineView.js'

type Tab = 'overview' | 'timeline' | 'files' | 'audit' | 'forks' | 'compare'
const TABS: Tab[] = ['overview', 'timeline', 'files', 'audit', 'forks', 'compare']
const LIVE_POLL_MS = 2500

export function ReplayApp({
  api,
  sessionId,
  initialLang,
  onSwitchSession,
  host,
  exportMeta,
  single,
}: {
  api: ReplayApi
  /** Omit to start on the all-sessions dashboard (modal / standalone modes). */
  sessionId?: string
  /** Override the detected language ('en' | 'zh'). */
  initialLang?: Lang
  /** Optional host-provided navigation; falls back to internal state. */
  onSwitchSession?: (id: string) => void
  /** Harness-only actions (fork). */
  host?: HostBridge
  /** Set when rendering an exported file. */
  exportMeta?: ExportMeta
  /** A single shared session: hide cross-session navigation. */
  single?: boolean
}): React.ReactElement {
  const [lang, setLangState] = useState<Lang>(initialLang ?? detectLang())
  const [tab, setTab] = useState<Tab>('overview')
  const [currentId, setCurrentId] = useState<string | undefined>(sessionId)
  const [session, setSession] = useState<ParsedSession>()
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [summaries, setSummaries] = useState<SessionSummary[]>()
  const [error, setError] = useState<string>()
  const [jump, setJump] = useState<{ seq: number; nonce: number }>()
  const [cursorSeq, setCursorSeq] = useState<number>()
  const [dialog, setDialog] = useState<'share' | 'settings'>()
  const [liveOn, setLiveOn] = useState(true)
  const [liveState, setLiveState] = useState<boolean>()
  const [toast, setToast] = useState<{ text: string; openId?: string; tone?: 'critical' }>()
  const settings = useSettings()
  const pricing = settings.pricing

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
      setLiveState(undefined)
      api
        .getSession(currentId)
        .then(s => !cancelled && setSession(s))
        .catch(e => !cancelled && setError(String(e)))
    }
    return () => {
      cancelled = true
    }
  }, [api, currentId])

  // The session list is cheap (headers + titles); summaries are folded host-side and cached.
  useEffect(() => {
    let cancelled = false
    api
      .listSessions()
      .then(list => !cancelled && setEntries(list))
      .catch(() => {})
    if (!single) {
      api
        .getSummaries()
        .then(result => !cancelled && setSummaries(result.summaries))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [api, single])

  const entry = entries.find(e => e.header.id === currentId)
  const isLive = liveState ?? entry?.live ?? false

  // Live follow: poll for events past the last seq we hold.
  const lastSeqRef = useRef(-1)
  lastSeqRef.current = session?.events.at(-1)?.seq ?? -1
  useEffect(() => {
    if (!isLive || !liveOn || currentId === undefined || api.getSessionSince === undefined || session === undefined) return
    let stopped = false
    const tick = async (): Promise<void> => {
      try {
        const delta = await api.getSessionSince!(currentId, lastSeqRef.current)
        if (stopped) return
        if (delta.live !== undefined) setLiveState(delta.live)
        const fresh = delta.events.filter(e => e.seq > lastSeqRef.current)
        if (fresh.length > 0) setSession(prev => (prev ? { ...prev, events: [...prev.events, ...fresh] } : prev))
      } catch {
        /* a failed poll is retried on the next tick */
      }
    }
    const timer = setInterval(() => void tick(), LIVE_POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [api, currentId, isLive, liveOn, session === undefined])

  const model = useMemo(() => (session ? buildTimeline(session) : undefined), [session])
  const report = useMemo(
    () => (session ? auditSession(session, { ignore: settings.ignoredRules }) : undefined),
    [session, settings.ignoredRules],
  )
  const insights = useMemo(() => (model && report ? buildInsights(model, report) : undefined), [model, report])
  const cost = useMemo(() => (model ? estimateCost(model, pricing) : undefined), [model, pricing])
  const files = useMemo(() => (model ? collectFileChanges(model) : undefined), [model])
  const baseline = useMemo(() => {
    if (summaries === undefined || currentId === undefined) return undefined
    const base = baselineFor(summaries.map(s => priceSummary(s, pricing)), currentId)
    return base.n >= 3 ? base : undefined
  }, [summaries, pricing, currentId])
  const lineage = useMemo<SessionEntry[]>(() => {
    const byId = new Map(summaries?.map(s => [s.id, s]))
    return entries.map(e => {
      const s = byId.get(e.header.id)
      return s === undefined ? e : { ...e, rootKey: s.rootKey, inheritedEventCount: s.inheritedEventCount }
    })
  }, [entries, summaries])
  const title = entry?.title ?? model?.title

  const switchSession = useCallback(
    (id: string | undefined): void => {
      setJump(undefined)
      setCursorSeq(undefined)
      if (id !== undefined && onSwitchSession) onSwitchSession(id)
      setCurrentId(id)
      setTab('overview')
      setLiveOn(true)
    },
    [onSwitchSession],
  )
  const jumpTo = useCallback((seq: number): void => {
    setTab('timeline')
    setJump({ seq, nonce: Date.now() + Math.random() })
  }, [])

  const fork =
    host?.fork !== undefined && currentId !== undefined
      ? (seq: number): void => {
          setToast({ text: t('fork.working', { seq }) })
          host.fork!(currentId, seq).then(
            childId => {
              setToast({ text: t('fork.done', { id: shortId(childId) }), openId: childId })
              api.listSessions().then(setEntries).catch(() => {})
            },
            e => setToast({ text: t('fork.fail', { error: String(e) }), tone: 'critical' }),
          )
        }
      : undefined

  const langToggle = (
    <button className="dshr-iconbtn dshr-lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} title={lang === 'en' ? '切换到中文' : 'Switch to English'} aria-label="language">
      {lang === 'en' ? '中' : 'EN'}
    </button>
  )
  const settingsButton = (
    <button className="dshr-iconbtn" onClick={() => setDialog('settings')} title={t('set.title')} aria-label={t('set.title')}>
      <Icon name="gear" />
    </button>
  )
  const brand = <span className="dshr-title">Replay</span>
  const wrap = (children: React.ReactNode): React.ReactElement => (
    <I18nContext.Provider value={i18n}>
      <div className="dshr-root" data-lang={lang}>
        {children}
        {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(undefined)} />}
        {toast !== undefined && (
          <div className="dshr-toast" data-tone={toast.tone} role="status">
            <span>{toast.text}</span>
            {toast.openId !== undefined && (
              <button
                className="dshr-linkbtn"
                onClick={() => {
                  switchSession(toast.openId)
                  setToast(undefined)
                }}
              >
                {t('fork.open')}
              </button>
            )}
            <button className="dshr-iconbtn" onClick={() => setToast(undefined)} aria-label="dismiss">
              <Icon name="close" size={11} />
            </button>
          </div>
        )}
      </div>
    </I18nContext.Provider>
  )

  if (currentId === undefined) {
    return wrap(
      <>
        <div className="dshr-header">
          {brand}
          <span className="dshr-header-stat">{t('dash.subtitle')}</span>
          <span className="dshr-spacer" />
          {settingsButton}
          {langToggle}
        </div>
        <DashboardView api={api} pricing={pricing} onOpen={switchSession} summaries={summaries} />
      </>,
    )
  }
  if (error !== undefined) {
    return wrap(
      <>
        <div className="dshr-header">
          {brand}
          <span className="dshr-spacer" />
          {langToggle}
        </div>
        <MascotState mood="alert" text={t('app.error', { error })} />
      </>,
    )
  }
  if (session === undefined || model === undefined || report === undefined || insights === undefined || cost === undefined || files === undefined) {
    return wrap(<MascotState mood="idle" text={t('app.loadingText')} />)
  }

  const alerts = report.counts.critical + report.counts.serious
  const badge = (id: Tab): React.ReactNode => {
    if (id === 'audit' && alerts > 0) return <span className="dshr-tab-badge" data-tone="critical">{alerts}</span>
    if (id === 'files' && files.files.length > 0) return <span className="dshr-tab-badge">{files.files.length}</span>
    return null
  }
  const markdown = (redact: typeof settings.redact): string =>
    buildReportMarkdown({ t, title: title ?? shortId(currentId), model, report, insights, cost, files, pricing, redact })

  return wrap(
    <>
      <div className="dshr-header">
        {!single && (
          <button className="dshr-iconbtn" onClick={() => switchSession(undefined)} title={t('dash.title')} aria-label={t('dash.title')}>
            <Icon name="home" />
          </button>
        )}
        {brand}
        <nav className="dshr-tabs" role="tablist">
          {TABS.filter(id => !single || (id !== 'forks' && id !== 'compare')).map(id => (
            <button key={id} role="tab" aria-selected={tab === id} className="dshr-tab" data-active={tab === id || undefined} onClick={() => setTab(id)}>
              {t(`tab.${id}`)}
              {badge(id)}
            </button>
          ))}
        </nav>
        <span className="dshr-spacer" />
        <span className="dshr-header-stat" title={`${title ?? currentId} · ${formatDateTime(model.startTime)}`}>
          <span className="dshr-ellipsis">{title ?? shortId(currentId)}</span>
          <span className="dshr-muted"> · {formatDuration(model.activeMs)}</span>
          {exportMeta !== undefined && exportMeta.redactions > 0 && (
            <span className="dshr-badge" title={t('exp.redactedTitle')}>
              <Icon name="eyeOff" size={11} /> {t('exp.redacted', { n: exportMeta.redactions })}
            </span>
          )}
          {exportMeta?.partial && <span className="dshr-badge">{t('exp.partial')}</span>}
        </span>
        {isLive && api.getSessionSince !== undefined && (
          <button className="dshr-livebtn" data-on={liveOn || undefined} onClick={() => setLiveOn(v => !v)} title={liveOn ? t('live.pause') : t('live.resume')}>
            <span className="dshr-live-dot" />
            {liveOn ? t('live.on') : t('live.paused')}
          </button>
        )}
        <button className="dshr-btn" onClick={() => setDialog('share')}>
          <Icon name="share" size={13} /> {t('share.button')}
        </button>
        {settingsButton}
        {langToggle}
      </div>
      {tab === 'overview' && (
        <ReportView
          model={model} report={report} insights={insights} cost={cost} files={files}
          baseline={baseline} pricing={pricing} onJump={jumpTo} onTab={setTab}
        />
      )}
      {tab === 'timeline' && (
        <TimelineView model={model} jumpToSeq={jump} pricing={pricing} follow={isLive && liveOn} onFork={fork} onCursor={setCursorSeq} />
      )}
      {tab === 'files' && <FilesView files={files} model={model} onJump={jumpTo} />}
      {tab === 'audit' && <AuditView report={report} model={model} onJump={jumpTo} />}
      {tab === 'forks' && <ForkTreeView entries={lineage} currentId={currentId} onSelect={switchSession} />}
      {tab === 'compare' && <CompareView api={api} session={session} entries={lineage} title={title} pricing={pricing} onJump={jumpTo} />}
      {dialog === 'share' && (
        <ShareDialog
          api={api} session={session} model={model} title={title} cursorSeq={cursorSeq}
          markdown={markdown} onClose={() => setDialog(undefined)}
        />
      )}
    </>,
  )
}
