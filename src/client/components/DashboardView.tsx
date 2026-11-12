import React, { useEffect, useMemo, useState } from 'react'
import { formatMoney, type PricingConfig } from '../../core/cost.js'
import { buildDashboard, projectName, type PricedSummary } from '../../core/dashboard.js'
import type { SessionSummary } from '../../core/summary.js'
import { formatDateTime, formatDuration, formatPercent, formatTokens, shortId, type ReplayApi } from '../api.js'
import { BarList, Heatmap, Legend, Meter, Sparkline, StackedColumns } from '../charts.js'
import { useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { Icon, Panel, StatTile } from '../ui.js'

type Range = '7' | '30' | 'all'
type Sort = 'recent' | 'cost' | 'tokens' | 'duration'
const DAY = 86_400_000
/** Fixed entity → colour slots (validated order); a 9th model folds into the last slot. */
const SERIES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']

export function DashboardView({
  api,
  pricing,
  onOpen,
  summaries: provided,
}: {
  api: ReplayApi
  pricing: PricingConfig
  onOpen: (id: string) => void
  summaries?: SessionSummary[]
}): React.ReactElement {
  const { t, lang } = useI18n()
  const [loaded, setLoaded] = useState<{ summaries: SessionSummary[]; truncated?: boolean; total?: number }>()
  const [error, setError] = useState<string>()
  const [range, setRange] = useState<Range>('30')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(40)
  const [project, setProject] = useState<string>()

  useEffect(() => {
    if (provided !== undefined) {
      setLoaded({ summaries: provided })
      return
    }
    let cancelled = false
    api
      .getSummaries()
      .then(result => !cancelled && setLoaded(result))
      .catch(e => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [api, provided])

  const anchor = useMemo(() => Math.max(0, ...(loaded?.summaries ?? []).map(s => s.startTime)), [loaded])
  const dash = useMemo(() => {
    if (loaded === undefined) return undefined
    const from = range === 'all' ? undefined : anchor - Number(range) * DAY
    const scoped = project === undefined ? loaded.summaries : loaded.summaries.filter(s => projectName(s.cwd) === project)
    return buildDashboard(scoped, pricing, { from })
  }, [loaded, pricing, range, anchor, project])

  const money = (cny: number): string => formatMoney(cny, pricing)

  const columns = useMemo(() => {
    if (dash === undefined || dash.days.length === 0) return []
    const byTime = new Map(dash.days.map(d => [d.time, d]))
    const first = dash.days[0].time
    const lastDay = dash.days.at(-1)!.time
    const span = Math.min(90, Math.round((lastDay - first) / DAY) + 1)
    const out = []
    for (let i = 0; i < span; i++) {
      // Walk calendar days through Date so DST shifts cannot skip or repeat a day.
      const d = new Date(first)
      d.setDate(d.getDate() + i)
      const day = byTime.get(d.getTime())
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      out.push({
        key: String(d.getTime()),
        label,
        tip: `${d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })} · ${t('dash.nSessions', { n: day?.sessions ?? 0 })}`,
        values: day?.byModel ?? {},
      })
    }
    return out
  }, [dash, lang, t])

  const sessions = useMemo(() => {
    if (dash === undefined) return []
    const q = query.trim().toLowerCase()
    const list = dash.sessions.filter(
      s => q === '' || (s.title ?? '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.cwd ?? '').toLowerCase().includes(q),
    )
    const by: Record<Sort, (s: PricedSummary) => number> = {
      recent: s => s.createdAt,
      cost: s => s.cny,
      tokens: s => s.totalTokens,
      duration: s => s.activeMs,
    }
    return [...list].sort((a, b) => by[sort](b) - by[sort](a))
  }, [dash, query, sort])

  if (error !== undefined) return <MascotState mood="alert" text={t('app.error', { error })} />
  if (loaded === undefined || dash === undefined) return <MascotState mood="idle" text={t('app.loadingText')} />
  if (loaded.summaries.length === 0) return <MascotState mood="happy" text={t('picker.empty')} />

  const series = dash.models.map((label, i) => ({ key: label, label, color: `var(--dshr-${SERIES[Math.min(i, SERIES.length - 1)]})` }))
  const failRate = dash.totals.toolCalls > 0 ? dash.totals.toolErrors / dash.totals.toolCalls : 0
  const weekdays = lang === 'zh' ? ['一', '二', '三', '四', '五', '六', '日'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const daily = columns.map(c => Object.values(c.values).reduce((a, b) => a + b, 0))

  return (
    <div className="dshr-scroll">
      <div className="dshr-dash">
        <div className="dshr-dash-bar">
          <h2 className="dshr-h2">{t('dash.title')}</h2>
          {project !== undefined && (
            <button className="dshr-chip" data-on onClick={() => setProject(undefined)}>
              {project} <Icon name="close" size={10} />
            </button>
          )}
          <span className="dshr-spacer" />
          <span className="dshr-seg">
            {(['7', '30', 'all'] as const).map(r => (
              <button key={r} data-on={range === r || undefined} onClick={() => setRange(r)}>
                {t(`dash.range.${r}`)}
              </button>
            ))}
          </span>
        </div>
        {loaded.truncated && (
          <div className="dshr-note">{t('dash.truncated', { n: loaded.summaries.length, total: loaded.total ?? '?' })}</div>
        )}

        <div className="dshr-tiles dshr-tiles-6">
          <StatTile label={t('dash.spend')} value={money(dash.totals.cny)} sub={t('rep.estimate')}>
            <Sparkline values={daily} />
          </StatTile>
          <StatTile label={t('dash.sessions')} value={dash.totals.sessions} sub={dash.days.length > 0 ? t('dash.activeDays', { n: dash.days.length }) : undefined} />
          <StatTile label={t('rep.tokens')} value={formatTokens(dash.totals.tokens)} />
          <StatTile label={t('rep.active')} value={formatDuration(dash.totals.activeMs)} />
          <StatTile label={t('rep.cache')} value={formatPercent(dash.totals.cacheHitRate)}>
            <Meter ratio={dash.totals.cacheHitRate} tone={dash.totals.cacheHitRate >= 0.5 ? 'good' : 'warning'} />
          </StatTile>
          <StatTile
            label={t('dash.failRate')}
            value={formatPercent(failRate, failRate > 0 && failRate < 0.1 ? 1 : 0)}
            sub={t('dash.failSub', { n: dash.totals.toolErrors, total: dash.totals.toolCalls })}
            tone={failRate > 0.15 ? 'warning' : undefined}
          />
        </div>

        {dash.sessions.length === 0 ? (
          <div className="dshr-empty dshr-pad">{t('dash.emptyRange')}</div>
        ) : (
          <>
            <div className="dshr-grid-2 dshr-grid-wide-left">
              <Panel title={t('dash.daily')} hint={t('dash.dailyHint')} actions={series.length > 1 ? <Legend items={series} /> : undefined}>
                <StackedColumns columns={columns} series={series} formatY={money} />
              </Panel>
              <Panel title={t('dash.heat')} hint={t('dash.heatHint')}>
                <Heatmap
                  cells={dash.activity}
                  rowLabels={weekdays}
                  format={v => `${formatTokens(v)} tok`}
                  tipTitle={(r, c) => `${weekdays[r]} ${String(c).padStart(2, '0')}:00`}
                />
                <div className="dshr-heat-legend">
                  <span className="dshr-muted">{t('dash.less')}</span>
                  {[1, 2, 3, 4, 5].map(l => (
                    <span key={l} className="dshr-heat-swatch" data-level={l} />
                  ))}
                  <span className="dshr-muted">{t('dash.more')}</span>
                </div>
              </Panel>
            </div>

            <div className="dshr-grid-3">
              <Panel title={t('dash.top')}>
                <BarList
                  labelWidth={150}
                  onPick={onOpen}
                  rows={dash.top.map(s => ({
                    key: s.id,
                    label: s.title ?? shortId(s.id),
                    value: s.cny,
                    text: money(s.cny),
                    sub: formatTokens(s.totalTokens),
                    title: `${s.title ?? s.id} · ${formatDateTime(s.createdAt)}`,
                  }))}
                />
              </Panel>
              <Panel title={t('dash.projects')}>
                <BarList
                  labelWidth={110}
                  onPick={key => setProject(p => (p === key ? undefined : key))}
                  rows={dash.byProject.slice(0, 8).map(p => ({
                    key: p.key,
                    label: p.key,
                    value: p.cny,
                    text: money(p.cny),
                    sub: `×${p.sessions}`,
                    color: 'var(--dshr-c3)',
                  }))}
                />
              </Panel>
              <Panel title={t('dash.tools')} hint={t('dash.toolsHint')}>
                <BarList
                  labelWidth={92}
                  rows={dash.tools.slice(0, 8).map(tool => ({
                    key: tool.name,
                    label: tool.name,
                    value: tool.count,
                    text: `×${tool.count}`,
                    sub: tool.errors > 0 ? formatPercent(tool.errorRate) : '',
                    color: 'var(--dshr-c2)',
                    failShare: tool.errorRate,
                    title: t('rep.toolFailTitle', { name: tool.name, n: tool.errors, total: tool.count }),
                  }))}
                />
              </Panel>
            </div>
          </>
        )}

        <Panel
          title={t('dash.list')}
          hint={String(sessions.length)}
          actions={
            <>
              <span className="dshr-search">
                <Icon name="search" size={12} />
                <input type="search" placeholder={t('dash.search')} value={query} onChange={e => setQuery(e.target.value)} aria-label={t('dash.search')} />
              </span>
              <span className="dshr-seg">
                {(['recent', 'cost', 'tokens', 'duration'] as const).map(s => (
                  <button key={s} data-on={sort === s || undefined} onClick={() => setSort(s)}>
                    {t(`dash.sort.${s}`)}
                  </button>
                ))}
              </span>
            </>
          }
        >
          <div className="dshr-sessions">
            {sessions.slice(0, limit).map(s => {
              const alerts = s.audit.critical + s.audit.serious
              return (
                <button key={s.id} className="dshr-session" onClick={() => onOpen(s.id)}>
                  <span className="dshr-session-main">
                    <span className="dshr-session-title">
                      {s.live && <span className="dshr-live-dot" title={t('live.on')} />}
                      {s.title ?? shortId(s.id)}
                      {s.origin === 'subagent' && <span className="dshr-picker-tag">{t('forks.subagent')}</span>}
                      {s.origin !== 'subagent' && s.isSeeded && <span className="dshr-picker-tag">{t('forks.forkTag')}</span>}
                    </span>
                    <span className="dshr-session-sub">
                      {formatDateTime(s.createdAt)} · {projectName(s.cwd)} · {s.models.join(', ') || '—'}
                    </span>
                  </span>
                  {alerts > 0 && (
                    <span className="dshr-badge" data-tone={s.audit.critical > 0 ? 'critical' : 'warning'} title={t('tab.audit')}>
                      <Icon name="warn" size={11} /> {alerts}
                    </span>
                  )}
                  <span className="dshr-session-num">
                    {t('hdr.turns', { n: s.turns })}
                    <span className="dshr-muted"> · {s.toolCalls} {t('dash.callsUnit')}</span>
                  </span>
                  <span className="dshr-session-num">{formatDuration(s.activeMs)}</span>
                  <span className="dshr-session-num">{formatTokens(s.totalTokens)}</span>
                  <span className="dshr-session-num dshr-session-cost">{money(s.cny)}</span>
                </button>
              )
            })}
            {sessions.length === 0 && <div className="dshr-empty dshr-pad">{t('tl.noMatch')}</div>}
            {sessions.length > limit && (
              <button className="dshr-linkbtn dshr-pad" onClick={() => setLimit(l => l + 100)}>
                {t('common.more', { n: sessions.length - limit })}
              </button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
