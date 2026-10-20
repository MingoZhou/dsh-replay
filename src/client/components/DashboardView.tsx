import React, { useMemo, useState } from 'react'
import { estimateCost, estimateCostDetailed, formatMoney } from '../../core/cost.js'
import {
  formatDuration,
  formatRelativeTime,
  formatTokens,
  shortId,
  type SessionEntry,
  type SessionSummaryEntry,
} from '../api.js'
import { useI18n } from '../i18n.js'
import { usePricing } from '../pricing.js'
import { MascotState } from '../mascot.js'

type Period = 'month' | 'all'
type Currency = 'USD' | 'CNY'

export function DashboardView({
  entries,
  summaries,
  loading,
  onPick,
}: {
  entries: SessionEntry[]
  summaries: SessionSummaryEntry[]
  loading: boolean
  onPick: (id: string) => void
}): React.ReactElement {
  const { t, lang } = useI18n()
  const pricing = usePricing()
  const [query, setQuery] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [currency, setCurrency] = useState<Currency>('USD')

  const summaryMap = useMemo(
    () => new Map(summaries.map(summary => [summary.header.id, summary])),
    [summaries],
  )
  const workspaces = useMemo(
    () => [...new Set(entries.map(entry => entry.header.cwd).filter((cwd): cwd is string => typeof cwd === 'string'))].sort(),
    [entries],
  )
  const periodStart = useMemo(() => {
    const now = new Date()
    return period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() : 0
  }, [period])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter(entry => entry.header.createdAt >= periodStart)
      .filter(entry => workspace === '' || entry.header.cwd === workspace)
      .filter(entry => {
        if (q === '') return true
        const haystack = `${entry.title ?? ''} ${entry.header.id} ${entry.header.cwd ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
  }, [entries, periodStart, query, workspace])

  const costFor = (summary: SessionSummaryEntry | undefined): number | undefined => {
    if (summary?.summary === undefined) return undefined
    const detailed = estimateCostDetailed(summary.summary.modelTotals, pricing)
    if (detailed !== undefined) return detailed.usd
    return estimateCost(summary.summary.tokens, summary.summary.models, pricing)?.usd
  }

  const totals = useMemo(() => {
    let tokens = 0
    let cost = 0
    let risk = 0
    let errors = 0
    for (const row of rows) {
      const summary = summaryMap.get(row.header.id)?.summary
      if (summary === undefined) continue
      tokens += summary.tokens.billedInput + summary.tokens.output
      cost += costFor(summaryMap.get(row.header.id)) ?? 0
      risk += summary.critical + summary.serious
      errors += summary.toolErrors
    }
    return { tokens, cost, risk, errors }
  }, [rows, summaryMap, pricing])

  if (loading && entries.length === 0) {
    return (
      <div className="dshr-dashboard">
        <div className="dshr-dash-cards">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="dshr-dash-card dshr-skeleton" />
          ))}
        </div>
        <div className="dshr-dash-list">
          {[0, 1, 2, 3, 4].map(index => (
            <div key={index} className="dshr-dash-row dshr-skeleton" />
          ))}
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return <MascotState mood="happy" text={t('dash.empty')} />
  }

  return (
    <div className="dshr-dashboard">
      <div className="dshr-dash-head">
        <div>
          <div className="dshr-dash-subtitle">{t('dash.subtitle')}</div>
          <div className="dshr-dash-scanned">{t('dash.scanned', { n: summaries.length })}</div>
        </div>
        <span className="dshr-spacer" />
        <span className="dshr-segmented" role="group" aria-label={t('dash.sessions')}>
          <button data-active={period === 'month' || undefined} onClick={() => setPeriod('month')}>
            {t('dash.thisMonth')}
          </button>
          <button data-active={period === 'all' || undefined} onClick={() => setPeriod('all')}>
            {t('dash.allTime')}
          </button>
        </span>
      </div>

      <div className="dshr-dash-cards">
        <div className="dshr-dash-card">
          <div className="dshr-dash-value">{rows.length}</div>
          <div className="dshr-dash-label">{t('dash.sessions')}</div>
        </div>
        <div className="dshr-dash-card">
          <div className="dshr-dash-value">{formatTokens(totals.tokens)}</div>
          <div className="dshr-dash-label">{t('dash.tokens')}</div>
        </div>
        <button
          className="dshr-dash-card dshr-dash-card-action"
          onClick={() => setCurrency(value => (value === 'USD' ? 'CNY' : 'USD'))}
          title={t('ov.currency')}
        >
          <div className="dshr-dash-value">{formatMoney(totals.cost, currency)}</div>
          <div className="dshr-dash-label">
            {t('dash.cost')} · {currency}
          </div>
        </button>
        <div className={`dshr-dash-card${totals.risk > 0 ? ' dshr-dash-risk' : ''}`}>
          <div className="dshr-dash-value">{totals.risk}</div>
          <div className="dshr-dash-label">
            {t('dash.risk')} · {t('dash.errors')} {totals.errors}
          </div>
        </div>
      </div>

      <div className="dshr-dash-toolbar">
        <input
          className="dshr-filter-input dshr-dash-search"
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
        <span className="dshr-dash-count">{t('picker.count', { n: rows.length })}</span>
      </div>

      <div className="dshr-dash-list">
        {rows.map(entry => {
          const summary = summaryMap.get(entry.header.id)
          const data = summary?.summary
          const cost = costFor(summary)
          const risk = data === undefined ? 0 : data.critical + data.serious
          return (
            <button
              key={entry.header.id}
              className="dshr-dash-row"
              onClick={() => onPick(entry.header.id)}
            >
              <span className="dshr-dash-main">
                <span className="dshr-dash-title">
                  {entry.title ?? shortId(entry.header.id)}
                  {entry.header.origin === 'subagent' && (
                    <span className="dshr-picker-tag">{t('picker.subagent')}</span>
                  )}
                  {entry.header.parentSession !== undefined && entry.header.origin !== 'subagent' && (
                    <span className="dshr-picker-tag">{t('picker.fork')}</span>
                  )}
                  {entry.live === true && <span className="dshr-live-pill">{t('picker.live')}</span>}
                </span>
                <span className="dshr-dash-sub">
                  {shortId(entry.header.id)}
                  {entry.header.cwd !== undefined ? ` · ${entry.header.cwd}` : ''}
                  {' · '}
                  {formatRelativeTime(entry.header.createdAt, Date.now(), lang)}
                </span>
              </span>
              <span className="dshr-dash-metrics">
                {data !== undefined ? (
                  <>
                    <span title={t('cmp.turns')}>{t('hdr.turns', { n: data.turns })}</span>
                    <span title={t('dash.tokens')}>
                      {formatTokens(data.tokens.billedInput + data.tokens.output)}
                    </span>
                    <span title={t('dash.cost')}>
                      {cost !== undefined ? formatMoney(cost, currency) : '—'}
                    </span>
                    <span title={t('dash.risk')} className={risk > 0 ? 'dshr-risk-badge' : 'dshr-ok-badge'}>
                      {risk > 0 ? `⚠ ${risk}` : '✓'}
                    </span>
                    <span className="dshr-dash-duration">{formatDuration(data.durationMs)}</span>
                  </>
                ) : (
                  <span className="dshr-dash-pending">—</span>
                )}
              </span>
            </button>
          )
        })}
        {rows.length === 0 && <MascotState mood="happy" text={t('audit.noRisk')} />}
      </div>
    </div>
  )
}
