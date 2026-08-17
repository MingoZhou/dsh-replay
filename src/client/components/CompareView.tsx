import React, { useEffect, useMemo, useState } from 'react'
import { compareSessions, type CompareResult } from '../../core/compare.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDuration, formatTokens, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { useI18n } from '../i18n.js'

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

export function CompareView({
  api,
  session,
  entries,
  title,
}: {
  api: ReplayApi
  session: ParsedSession
  entries: SessionEntry[]
  title?: string
}): React.ReactElement {
  const { t } = useI18n()
  const others = useMemo(
    () => entries.filter(e => e.header.id !== session.header.id),
    [entries, session],
  )
  const defaultOther =
    others.find(e => e.header.id === session.header.parentSession)?.header.id ??
    others.find(e => e.header.parentSession === session.header.id)?.header.id ??
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
      .then(s => {
        if (!cancelled) {
          setOther(s)
          setError(undefined)
        }
      })
      .catch(e => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [api, otherId])

  const result: CompareResult | undefined = useMemo(() => {
    if (other === undefined) return undefined
    return compareSessions(session, other, {
      a: title,
      b: others.find(e => e.header.id === other.header.id)?.title,
    })
  }, [session, other, title, others])

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
          onChange={e => setOtherId(e.target.value)}
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
              {t('cmp.divergence', { seq: result.divergenceSeq })}
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
