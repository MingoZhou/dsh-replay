import React, { useEffect, useMemo, useState } from 'react'
import { compareSessions, type AlignedCall, type CompareResult } from '../../core/compare.js'
import { estimateCost, formatMoney, type PricingConfig } from '../../core/cost.js'
import { buildTimeline, primaryArgument, type ToolCallInfo } from '../../core/timeline.js'
import type { ParsedSession } from '../../core/types.js'
import { formatDuration, formatTokens, shortId, type ReplayApi, type SessionEntry } from '../api.js'
import { Legend } from '../charts.js'
import { useI18n } from '../i18n.js'
import { MascotState } from '../mascot.js'
import { Icon, Panel } from '../ui.js'

function PairRow({
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
  const max = Math.max(a, b, 1e-9)
  const diff = a === b ? '=' : b > a ? `+${format(b - a)}` : `−${format(a - b)}`
  return (
    <div className="dshr-pair">
      <span className="dshr-pair-label">{label}</span>
      <span className="dshr-pair-bars">
        <span className="dshr-pair-bar" data-side="a" style={{ width: `${Math.max(0.5, (a / max) * 100)}%` }} />
        <span className="dshr-pair-bar" data-side="b" style={{ width: `${Math.max(0.5, (b / max) * 100)}%` }} />
      </span>
      <span className="dshr-pair-values">
        <span className="dshr-num">{format(a)}</span>
        <span className="dshr-num">{format(b)}</span>
      </span>
      <span className="dshr-pair-delta dshr-num dshr-muted">{diff}</span>
    </div>
  )
}

function CallCell({ call, onJump }: { call?: ToolCallInfo; onJump?: (seq: number) => void }): React.ReactElement {
  if (call === undefined) return <span className="dshr-align-cell" data-empty />
  const Tag = onJump ? 'button' : 'span'
  return (
    <Tag className="dshr-align-cell" data-failed={call.failed || undefined} onClick={onJump ? () => onJump(call.callSeq) : undefined} title={primaryArgument(call)}>
      <span className="dshr-align-name">{call.name}</span>
      <span className="dshr-align-arg">{primaryArgument(call).replaceAll(/\s+/gu, ' ').slice(0, 120)}</span>
      {call.failed && <Icon name="warn" size={11} />}
    </Tag>
  )
}

function Alignment({ rows, first, onJump }: { rows: AlignedCall[]; first?: number; onJump: (seq: number) => void }): React.ReactElement {
  const { t } = useI18n()
  const [showShared, setShowShared] = useState(false)
  const [limit, setLimit] = useState(120)
  const sharedPrefix = first ?? rows.length
  const start = !showShared && sharedPrefix > 3 ? sharedPrefix : 0
  const visible = rows.slice(start, start + limit)
  return (
    <div className="dshr-align">
      {start > 0 && (
        <button className="dshr-align-fold" onClick={() => setShowShared(true)}>
          <Icon name="check" size={12} /> {t('cmp.sharedPrefix', { n: start })}
        </button>
      )}
      {visible.map((row, i) => {
        const index = start + i
        return (
          <React.Fragment key={index}>
            {index === first && <div className="dshr-align-diverge">{t('cmp.divergeHere')}</div>}
            <div className="dshr-align-row" data-kind={row.kind}>
              <span className="dshr-align-idx dshr-num">{index + 1}</span>
              <CallCell call={row.a} onJump={onJump} />
              <span className="dshr-align-mark" title={t(`cmp.kind.${row.kind}`)}>
                {row.kind === 'same' ? '=' : row.kind === 'args' ? '≠' : row.kind === 'only-a' ? '←' : '→'}
              </span>
              <CallCell call={row.b} />
            </div>
          </React.Fragment>
        )
      })}
      {rows.length > start + limit && (
        <button className="dshr-linkbtn dshr-pad" onClick={() => setLimit(l => l + 400)}>
          {t('common.more', { n: rows.length - start - limit })}
        </button>
      )}
      {first === undefined && rows.length > 0 && <div className="dshr-empty dshr-pad">{t('cmp.identical')}</div>}
    </div>
  )
}

export function CompareView({
  api,
  session,
  entries,
  title,
  pricing,
  onJump,
}: {
  api: ReplayApi
  session: ParsedSession
  entries: SessionEntry[]
  title?: string
  pricing: PricingConfig
  onJump: (seq: number) => void
}): React.ReactElement {
  const { t } = useI18n()
  const others = useMemo(
    () =>
      entries
        .filter(e => e.header.id !== session.header.id)
        .sort((a, b) => b.header.createdAt - a.header.createdAt),
    [entries, session],
  )
  const own = entries.find(e => e.header.id === session.header.id)
  // Prefer a fork of the same conversation, then the parent, then a child, then the most recent.
  const defaultOther =
    (own?.rootKey !== undefined ? others.find(e => e.rootKey === own.rootKey && e.header.origin !== 'subagent')?.header.id : undefined) ??
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
    setOther(undefined)
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

  const otherTitle = others.find(e => e.header.id === otherId)?.title
  const result: CompareResult | undefined = useMemo(
    () => (other === undefined ? undefined : compareSessions(session, other, { a: title, b: otherTitle })),
    [session, other, title, otherTitle],
  )
  const costs = useMemo(() => {
    if (other === undefined) return undefined
    return { a: estimateCost(buildTimeline(session), pricing).cny, b: estimateCost(buildTimeline(other), pricing).cny }
  }, [session, other, pricing])

  if (others.length === 0) return <MascotState mood="idle" text={t('cmp.none')} />
  const nameA = title ?? shortId(session.header.id)
  const nameB = otherTitle ?? (otherId ? shortId(otherId) : '')
  const sameFamily = (entry: SessionEntry): boolean => own?.rootKey !== undefined && entry.rootKey === own.rootKey
  const relation = (entry: SessionEntry): string =>
    entry.header.id === session.header.parentSession
      ? ` ${t('cmp.parent')}`
      : entry.header.origin === 'subagent' && entry.header.parentSession === session.header.id
        ? ` (${t('forks.subagent')})`
        : entry.header.parentSession === session.header.id || sameFamily(entry)
          ? ` ${t('cmp.fork')}`
          : ''

  return (
    <div className="dshr-scroll">
      <div className="dshr-compare">
        <div className="dshr-compare-picker">
          <span className="dshr-swatch" style={{ background: 'var(--dshr-c1)' }} />
          <strong className="dshr-ellipsis">{nameA}</strong>
          <span className="dshr-muted">{t('cmp.with')}</span>
          <span className="dshr-swatch" style={{ background: 'var(--dshr-c2)' }} />
          <select className="dshr-select" value={otherId} onChange={e => setOtherId(e.target.value)} aria-label={t('cmp.aria')}>
            {others.map(entry => (
              <option key={entry.header.id} value={entry.header.id}>
                {entry.title ?? shortId(entry.header.id)}
                {relation(entry)}
              </option>
            ))}
          </select>
          {result?.related && result.divergenceSeq !== undefined && (
            <button className="dshr-badge" data-tone="accent" onClick={() => onJump(result.divergenceSeq!)}>
              <Icon name="fork" size={11} /> {t('cmp.divergence', { seq: result.divergenceSeq })}
            </button>
          )}
        </div>
        {error !== undefined && <div className="dshr-errorline">{error}</div>}
        {result === undefined || costs === undefined ? (
          error === undefined && <div className="dshr-empty dshr-pad">{t('app.loading')}</div>
        ) : (
          <div className="dshr-grid-2">
            <Panel title={t('cmp.metric')} actions={<Legend items={[{ label: nameA, color: 'var(--dshr-c1)' }, { label: nameB, color: 'var(--dshr-c2)' }]} />}>
              <div className="dshr-pairs">
                <PairRow label={t('rep.cost')} a={costs.a} b={costs.b} format={n => formatMoney(n, pricing)} />
                <PairRow label={t('cmp.duration')} a={result.a.durationMs} b={result.b.durationMs} format={formatDuration} />
                <PairRow label={t('cmp.inputTokens')} a={result.a.billedInputTokens} b={result.b.billedInputTokens} format={formatTokens} />
                <PairRow label={t('cmp.outputTokens')} a={result.a.outputTokens} b={result.b.outputTokens} format={formatTokens} />
                <PairRow label={t('cmp.cacheTokens')} a={result.a.cacheReadTokens} b={result.b.cacheReadTokens} format={formatTokens} />
                <PairRow label={t('cmp.turns')} a={result.a.turns} b={result.b.turns} />
                <PairRow label={t('cmp.steps')} a={result.a.steps} b={result.b.steps} />
                <PairRow label={t('cmp.toolCalls')} a={result.a.toolCallCount} b={result.b.toolCallCount} />
                <PairRow label={t('cmp.toolErrors')} a={result.a.toolErrors} b={result.b.toolErrors} />
              </div>
              {result.toolNames.length > 0 && (
                <>
                  <div className="dshr-subhead">{t('cmp.toolMix')}</div>
                  <div className="dshr-pairs">
                    {result.toolNames.map(name => (
                      <PairRow key={name} label={name} a={result.a.toolMix[name] ?? 0} b={result.b.toolMix[name] ?? 0} />
                    ))}
                  </div>
                </>
              )}
            </Panel>
            <Panel title={t('cmp.sequence')} hint={t('cmp.sequenceHint')}>
              {result.alignment.length === 0 ? (
                <div className="dshr-empty">{t('rep.noTools')}</div>
              ) : (
                <Alignment rows={result.alignment} first={result.firstDifference} onJump={onJump} />
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
