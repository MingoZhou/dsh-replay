import React, { useEffect, useMemo, useState } from 'react'
<<<<<<< HEAD
import { auditSession } from '../../core/audit.js'
import { compareSessions, type CompareResult } from '../../core/compare.js'
import { estimateCostDetailed, formatMoney } from '../../core/cost.js'
import { redactText } from '../../core/redact.js'
import { buildTimeline } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDuration, formatTokens, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { useI18n } from '../i18n.js'
import { usePricing } from '../pricing.js'
=======
import { compareSessions, type CompareResult } from '../../core/compare.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDuration, formatTokens, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { useI18n } from '../i18n.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

function Row({
  label,
  a,
  b,
  format = String,
}: {
  label: string
  a: number
  b: number
  format?: (n: number) => string
}): React.ReactElement {
  return (
    <tr>
      <td>{label}</td>
      <td>{format(a)}</td>
      <td>{format(b)}</td>
      <td style={{ color: 'var(--dshr-ink-3)' }}>
        {a === b ? '=' : a > b ? `+${format(a - b)}` : `−${format(b - a)}`}
      </td>
    </tr>
  )
}

<<<<<<< HEAD
function preview(event: { type: string; data: unknown } | undefined): string {
  if (event === undefined) return '—'
  const data = redactText(JSON.stringify(event.data) ?? '').text
  return `${event.type}\n${data.slice(0, 700)}${data.length > 700 ? '…' : ''}`
}

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
export function CompareView({
  api,
  session,
  entries,
  title,
<<<<<<< HEAD
  onOpenSession,
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}: {
  api: ReplayApi
  session: ParsedSession
  entries: SessionEntry[]
  title?: string
<<<<<<< HEAD
  onOpenSession?: (id: string) => void
}): React.ReactElement {
  const { t } = useI18n()
  const pricing = usePricing()
  const others = useMemo(
    () => entries.filter(entry => entry.header.id !== session.header.id),
    [entries, session],
  )
  const parentMap = useMemo(
    () => new Map(entries.map(entry => [entry.header.id, entry.header.parentSession])),
    [entries],
  )
  const defaultOther =
    others.find(entry => entry.header.id === session.header.parentSession)?.header.id ??
    others.find(entry => entry.header.parentSession === session.header.id)?.header.id ??
=======
}): React.ReactElement {
  const { t } = useI18n()
  const others = useMemo(
    () => entries.filter(e => e.header.id !== session.header.id),
    [entries, session],
  )
  const defaultOther =
    others.find(e => e.header.id === session.header.parentSession)?.header.id ??
    others.find(e => e.header.parentSession === session.header.id)?.header.id ??
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    others[0]?.header.id
  const [otherId, setOtherId] = useState(defaultOther)
  const [other, setOther] = useState<ParsedSession>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    setOtherId(defaultOther)
  }, [defaultOther])

  useEffect(() => {
    if (otherId === undefined) return
    let cancelled = false
    api
      .getSession(otherId)
<<<<<<< HEAD
      .then(value => {
        if (!cancelled) {
          setOther(value)
          setError(undefined)
        }
      })
      .catch(reason => !cancelled && setError(String(reason)))
=======
      .then(s => {
        if (!cancelled) {
          setOther(s)
          setError(undefined)
        }
      })
      .catch(e => !cancelled && setError(String(e)))
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    return () => {
      cancelled = true
    }
  }, [api, otherId])

  const result: CompareResult | undefined = useMemo(() => {
    if (other === undefined) return undefined
<<<<<<< HEAD
    return compareSessions(
      session,
      other,
      { a: title, b: others.find(entry => entry.header.id === other.header.id)?.title },
      id => parentMap.get(id),
    )
  }, [session, other, title, others, parentMap])

  const costA = useMemo(() => {
    const model = buildTimeline(session)
    return estimateCostDetailed(model.modelTotals, pricing)
  }, [session, pricing])
  const costB = useMemo(() => {
    if (other === undefined) return undefined
    const model = buildTimeline(other)
    return estimateCostDetailed(model.modelTotals, pricing)
  }, [other, pricing])
  const riskA = useMemo(() => {
    const report = auditSession(session)
    return report.counts.critical + report.counts.serious
  }, [session])
  const riskB = useMemo(() => {
    if (other === undefined) return 0
    const report = auditSession(other)
    return report.counts.critical + report.counts.serious
  }, [other])
=======
    return compareSessions(session, other, {
      a: title,
      b: others.find(e => e.header.id === other.header.id)?.title,
    })
  }, [session, other, title, others])
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

  if (others.length === 0) {
    return <div className="dshr-center">{t('cmp.none')}</div>
  }

  return (
    <div className="dshr-compare">
      <div className="dshr-compare-picker">
        <span>{t('cmp.with')}</span>
        <select
          className="dshr-select"
          value={otherId}
<<<<<<< HEAD
          onChange={event => setOtherId(event.target.value)}
=======
          onChange={e => setOtherId(e.target.value)}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          aria-label={t('cmp.aria')}
        >
          {others.map(entry => (
            <option key={entry.header.id} value={entry.header.id}>
              {entry.title ?? shortId(entry.header.id)}
              {entry.header.id === session.header.parentSession ? ` ${t('cmp.parent')}` : ''}
              {entry.header.parentSession === session.header.id ? ` ${t('cmp.fork')}` : ''}
            </option>
          ))}
        </select>
      </div>
      {error !== undefined && <div className="dshr-center">{error}</div>}
      {result && (
        <>
          {result.related && result.divergenceSeq !== undefined && (
            <div className="dshr-divergence">
<<<<<<< HEAD
              <div className="dshr-divergence-title">
                {t('cmp.divergence', { seq: result.divergenceSeq })}
              </div>
              <div className="dshr-diff-grid">
                <div className="dshr-diff-side">
                  <div className="dshr-section-label">{t('cmp.divergenceA')}</div>
                  <pre className="dshr-pre">{preview(result.divergenceA)}</pre>
                  <button className="dshr-tab" onClick={() => onOpenSession?.(result.a.id)}>
                    {t('forks.open')}
                  </button>
                </div>
                <div className="dshr-diff-side">
                  <div className="dshr-section-label">{t('cmp.divergenceB')}</div>
                  <pre className="dshr-pre">{preview(result.divergenceB)}</pre>
                  <button className="dshr-tab" onClick={() => onOpenSession?.(result.b.id)}>
                    {t('forks.open')}
                  </button>
                </div>
              </div>
=======
              {t('cmp.divergence', { seq: result.divergenceSeq })}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            </div>
          )}
          <div className="dshr-compare-grid">
          <table className="dshr-table">
            <thead>
              <tr>
                <th>{t('cmp.metric')}</th>
                <th>{result.a.title ?? shortId(result.a.id)}</th>
                <th>{result.b.title ?? shortId(result.b.id)}</th>
                <th>{t('cmp.delta')}</th>
              </tr>
            </thead>
            <tbody>
<<<<<<< HEAD
              <tr>
                <td>{t('cmp.relation')}</td>
                <td colSpan={3}>{t(`cmp.relation.${result.relation}`)}</td>
              </tr>
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
              <Row label={t('cmp.turns')} a={result.a.turns} b={result.b.turns} />
              <Row label={t('cmp.steps')} a={result.a.steps} b={result.b.steps} />
              <Row label={t('cmp.events')} a={result.a.events} b={result.b.events} />
              <Row label={t('cmp.toolCalls')} a={result.a.toolCallCount} b={result.b.toolCallCount} />
              <Row label={t('cmp.toolErrors')} a={result.a.toolErrors} b={result.b.toolErrors} />
              <Row
                label={t('cmp.inputTokens')}
                a={result.a.billedInputTokens}
                b={result.b.billedInputTokens}
                format={formatTokens}
              />
              <Row
                label={t('cmp.outputTokens')}
                a={result.a.outputTokens}
                b={result.b.outputTokens}
                format={formatTokens}
              />
              <Row
                label={t('cmp.cacheTokens')}
                a={result.a.cacheReadTokens}
                b={result.b.cacheReadTokens}
                format={formatTokens}
              />
              <Row
                label={t('cmp.duration')}
                a={result.a.durationMs}
                b={result.b.durationMs}
                format={formatDuration}
              />
<<<<<<< HEAD
              <Row label={t('cmp.risk')} a={riskA} b={riskB} />
              {costA !== undefined && costB !== undefined && (
                <tr>
                  <td>{t('cmp.cost')}</td>
                  <td>{formatMoney(costA.usd, 'USD')}</td>
                  <td>{formatMoney(costB.usd, 'USD')}</td>
                  <td style={{ color: 'var(--dshr-ink-3)' }}>
                    {costA.usd === costB.usd
                      ? '='
                      : costA.usd > costB.usd
                        ? `+${formatMoney(costA.usd - costB.usd, 'USD')}`
                        : `−${formatMoney(costB.usd - costA.usd, 'USD')}`}
                  </td>
                </tr>
              )}
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            </tbody>
          </table>
          {result.toolNames.length > 0 && (
            <div>
              <div className="dshr-section-label">{t('cmp.toolMix')}</div>
              <table className="dshr-table">
                <thead>
                  <tr>
                    <th>{t('cmp.tool')}</th>
                    <th>{result.a.title ?? shortId(result.a.id)}</th>
                    <th>{result.b.title ?? shortId(result.b.id)}</th>
                    <th>{t('cmp.delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.toolNames.map(name => (
                    <Row
                      key={name}
                      label={name}
                      a={result.a.toolMix[name] ?? 0}
                      b={result.b.toolMix[name] ?? 0}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  )
}
