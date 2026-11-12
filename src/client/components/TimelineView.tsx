import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PricingConfig } from '../../core/cost.js'
import type { TimelineItem, TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { localizeItemLabel, useI18n } from '../i18n.js'
import { Icon } from '../ui.js'
import { ItemDetail } from './ItemDetail.js'

const SPEEDS = [1, 2, 4, 8, 16]
const ROW = 30
const KINDS = ['user', 'assistant', 'tool', 'meta'] as const

/** Compress log time into playback time: per-item delay from real dt, clamped. */
function delayFor(prev: TimelineItem | undefined, next: TimelineItem, speed: number): number {
  const dt = prev === undefined ? 0 : Math.max(0, next.time - prev.time)
  return Math.min(1400, Math.max(120, dt)) / speed
}

function TokenStrip({
  model,
  currentSeq,
  onJump,
}: {
  model: TimelineModel
  currentSeq: number
  onJump: (seq: number) => void
}): React.ReactElement | null {
  const { t } = useI18n()
  const samples = model.usageSamples
  if (samples.length === 0) return null
  const sizes = samples.map(s => ({
    input: (s.usage.inputTokens ?? 0) + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0),
    output: s.usage.outputTokens ?? 0,
  }))
  const max = Math.max(1, ...sizes.map(s => s.input + s.output))
  return (
    <div className="dshr-tokenstrip">
      <div className="dshr-tokenstrip-head">
        <span className="dshr-panel-title">{t('ts.title')}</span>
        <span className="dshr-legend">
          <span className="dshr-legend-item">
            <span className="dshr-swatch" style={{ background: 'var(--dshr-c1)' }} />
            {t('ts.input')}
          </span>
          <span className="dshr-legend-item">
            <span className="dshr-swatch" style={{ background: 'var(--dshr-c2)' }} />
            {t('ts.output')}
          </span>
        </span>
        <span className="dshr-spacer" />
        <span className="dshr-muted dshr-num">
          {t('ts.total', { in: formatTokens(model.totals.billedInput), out: formatTokens(model.totals.output) })}
          {model.totals.cacheRead > 0 ? t('ts.cacheRead', { n: formatTokens(model.totals.cacheRead) }) : ''}
        </span>
      </div>
      <div className="dshr-bars" role="img" aria-label={t('ts.title')}>
        {samples.map((sample, i) => {
          const next = samples[i + 1]?.seq ?? Number.POSITIVE_INFINITY
          const isCurrent = currentSeq >= sample.seq && next > currentSeq
          return (
            <button
              key={`${sample.turn}/${sample.step}`}
              className="dshr-bar"
              data-current={isCurrent || undefined}
              title={t('ts.barTitle', {
                turn: sample.turn, step: sample.step,
                in: formatTokens(sizes[i].input), out: formatTokens(sizes[i].output),
              })}
              onClick={() => onJump(sample.seq)}
            >
              <span className="dshr-bar-out" style={{ height: `${(sizes[i].output / max) * 100}%` }} />
              <span className="dshr-bar-in" style={{ height: `${(sizes[i].input / max) * 100}%` }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Row =
  | { head: { turn: number; reason?: string; durationMs?: number } }
  | { item: TimelineItem; index: number }

export function TimelineView({
  model,
  jumpToSeq,
  pricing,
  follow,
  onFork,
  onCursor,
}: {
  model: TimelineModel
  jumpToSeq?: { seq: number; nonce: number }
  pricing: PricingConfig
  /** Live mode: stick to the newest event while the cursor is at the tail. */
  follow?: boolean
  onFork?: (seq: number) => void
  onCursor?: (seq: number) => void
}): React.ReactElement {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<string>>(new Set(KINDS))
  const [onlyFailed, setOnlyFailed] = useState(false)
  const seqQuery = /^#(\d+)$/u.exec(query.trim())
  const items = useMemo(() => {
    const q = seqQuery ? '' : query.trim().toLowerCase()
    return model.items.filter(item => {
      if (!kinds.has(item.kind)) return false
      if (onlyFailed && !(item.toolCall?.failed || item.type === 'assistant/attempt' || item.type === 'turn/end')) return false
      if (q === '') return true
      return (
        item.label.toLowerCase().includes(q) ||
        (item.text?.toLowerCase().includes(q) ?? false) ||
        (item.reasoningText?.toLowerCase().includes(q) ?? false) ||
        (item.toolCall !== undefined &&
          (item.toolCall.name.toLowerCase().includes(q) ||
            item.toolCall.argumentsRaw.toLowerCase().includes(q) ||
            (item.toolCall.resultText?.toLowerCase().includes(q) ?? false)))
      )
    })
  }, [model.items, query, kinds, onlyFailed, seqQuery !== null])
  const [cursor, setCursor] = useState(Math.max(0, items.length - 1))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const railRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(600)
  const safeCursor = Math.min(cursor, Math.max(0, items.length - 1))
  const current: TimelineItem | undefined = items[safeCursor]
  const atTail = useRef(true)

  const select = useCallback((index: number): void => {
    setCursor(index)
    setPlaying(false)
  }, [])

  // Live follow: when new items arrive and the cursor sat on the last one, move with them.
  const prevLength = useRef(items.length)
  useEffect(() => {
    if (follow && atTail.current && items.length > prevLength.current) setCursor(items.length - 1)
    prevLength.current = items.length
  }, [items.length, follow])
  useEffect(() => {
    atTail.current = safeCursor >= items.length - 1
  }, [safeCursor, items.length])

  useEffect(() => {
    if (current) onCursor?.(current.seq)
  }, [current?.seq])

  const jumpSeq = useCallback(
    (seq: number): void => {
      const index = items.findIndex(i => i.seq >= seq)
      if (index >= 0) select(index)
    },
    [items, select],
  )
  useEffect(() => {
    if (jumpToSeq !== undefined) jumpSeq(jumpToSeq.seq)
  }, [jumpToSeq?.nonce])
  useEffect(() => {
    if (seqQuery) jumpSeq(Number(seqQuery[1]))
  }, [seqQuery?.[1]])

  useEffect(() => {
    if (!playing) return
    if (safeCursor >= items.length - 1) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(
      () => setCursor(c => Math.min(c + 1, items.length - 1)),
      delayFor(items[safeCursor], items[safeCursor + 1], speed),
    )
    return () => clearTimeout(timer)
  }, [playing, safeCursor, speed, items])

  const { rows, rowOfIndex } = useMemo(() => {
    const list: Row[] = []
    const map: number[] = []
    let lastTurn: number | undefined
    items.forEach((item, index) => {
      if (item.turn !== undefined && item.turn !== lastTurn) {
        lastTurn = item.turn
        const turnModel = model.turns.find(turn => turn.turn === item.turn)
        list.push({
          head: {
            turn: item.turn,
            reason: turnModel?.endReason,
            durationMs: turnModel?.endTime !== undefined ? turnModel.endTime - turnModel.startTime : undefined,
          },
        })
      }
      map[index] = list.length
      list.push({ item, index })
    })
    return { rows: list, rowOfIndex: map }
  }, [items, model.turns])

  // Virtual list bookkeeping.
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const measure = (): void => setViewH(el.clientHeight || 600)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const el = railRef.current
    const row = rowOfIndex[safeCursor]
    if (!el || row === undefined) return
    const top = row * ROW
    if (top < el.scrollTop + ROW) el.scrollTop = Math.max(0, top - ROW)
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight + 4
  }, [safeCursor, rowOfIndex])

  const first = Math.max(0, Math.floor(scrollTop / ROW) - 12)
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW) + 12)

  const togglePlay = (): void => {
    if (!playing && safeCursor >= items.length - 1) setCursor(0)
    setPlaying(p => !p)
  }
  const toggleKind = (kind: string): void => {
    setKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind)
      } else {
        next.add(kind)
      }
      return next
    })
  }
  const moveTurn = (direction: 1 | -1): void => {
    const turn = current?.turn
    if (direction === 1) {
      const index = items.findIndex((i, k) => k > safeCursor && i.turn !== undefined && i.turn !== turn)
      if (index >= 0) select(index)
    } else {
      const startOfThis = items.findIndex(i => i.turn === turn)
      if (startOfThis >= 0 && startOfThis < safeCursor) {
        select(startOfThis)
        return
      }
      for (let k = safeCursor - 1; k >= 0; k--) {
        if (items[k].turn !== undefined && items[k].turn !== turn) {
          select(items.findIndex(i => i.turn === items[k].turn))
          return
        }
      }
    }
  }
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const target = event.target as HTMLElement
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    if (typing) {
      if (event.key === 'Escape') (target as HTMLInputElement).blur()
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const step = event.shiftKey ? 10 : 1
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        select(Math.min(items.length - 1, safeCursor + step))
        break
      case 'k':
      case 'ArrowUp':
        select(Math.max(0, safeCursor - step))
        break
      case ' ':
        togglePlay()
        break
      case '/':
        searchRef.current?.focus()
        break
      case 'Home':
      case 'g':
        select(0)
        break
      case 'End':
      case 'G':
        select(items.length - 1)
        break
      case ']':
        moveTurn(1)
        break
      case '[':
        moveTurn(-1)
        break
      case 'e': {
        const index = items.findIndex((i, k) => k > safeCursor && i.toolCall?.failed)
        if (index >= 0) select(index)
        break
      }
      default:
        return
    }
    event.preventDefault()
  }

  if (model.items.length === 0) {
    return <div className="dshr-center">{t('tl.empty')}</div>
  }

  return (
    <div className="dshr-tl" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="dshr-playbar">
        <button className="dshr-play-btn" data-playing={playing || undefined} onClick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
          <Icon name={playing ? 'pause' : 'play'} size={13} />
        </button>
        <button className="dshr-speed" onClick={() => setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} title={t('play.speed')}>
          {speed}×
        </button>
        <input
          className="dshr-scrub"
          type="range"
          min={0}
          max={Math.max(0, items.length - 1)}
          value={safeCursor}
          onChange={e => select(Number(e.target.value))}
          aria-label={t('play.position')}
        />
        <span className="dshr-clock">
          {current ? formatClock(current.time, model.startTime) : '00:00'} / {formatClock(model.endTime, model.startTime)}
          <span className="dshr-muted"> · {t('play.event', { i: items.length === 0 ? 0 : safeCursor + 1, n: items.length })}</span>
        </span>
        <span className="dshr-search">
          <Icon name="search" size={12} />
          <input
            ref={searchRef}
            type="search"
            placeholder={t('flt.search')}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setPlaying(false)
            }}
            aria-label={t('flt.search')}
          />
        </span>
        <span className="dshr-kind-chips">
          {KINDS.map(kind => (
            <button key={kind} className="dshr-chip" data-on={kinds.has(kind) || undefined} data-kind={kind} onClick={() => toggleKind(kind)}>
              <span className="dshr-kind-dot" />
              {t(`kind.${kind}`)}
            </button>
          ))}
          <button className="dshr-chip" data-on={onlyFailed || undefined} data-kind="failed" onClick={() => setOnlyFailed(f => !f)}>
            <span className="dshr-kind-dot" />
            {t('flt.failed')}
          </button>
        </span>
      </div>
      <TokenStrip model={model} currentSeq={current?.seq ?? 0} onJump={jumpSeq} />
      <div className="dshr-timeline">
        <div className="dshr-rail" ref={railRef} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
          {items.length === 0 ? (
            <div className="dshr-empty dshr-pad">{t('tl.noMatch')}</div>
          ) : (
            <div style={{ height: rows.length * ROW, position: 'relative' }}>
              {rows.slice(first, last).map((row, offset) => {
                const top = (first + offset) * ROW
                if ('head' in row) {
                  return (
                    <div key={`h${row.head.turn}`} className="dshr-turn-head" style={{ top, height: ROW }}>
                      <span>{t('tl.turn', { n: row.head.turn })}</span>
                      {row.head.durationMs !== undefined && <span className="dshr-muted">{formatDuration(row.head.durationMs)}</span>}
                      {row.head.reason !== undefined && row.head.reason !== 'completed' && (
                        <span className="dshr-badge" data-tone="warning">{row.head.reason}</span>
                      )}
                    </div>
                  )
                }
                const { item, index } = row
                return (
                  <button
                    key={item.seq}
                    className="dshr-item"
                    style={{ top, height: ROW }}
                    data-kind={item.kind}
                    data-selected={index === safeCursor || undefined}
                    data-future={index > safeCursor || undefined}
                    data-shadowed={item.shadowed || undefined}
                    data-failed={item.toolCall?.failed || undefined}
                    onClick={() => select(index)}
                  >
                    <span className="dshr-item-kind">
                      {item.kind === 'tool' ? item.toolCall?.name ?? t('kind.tool') : item.type === 'context' ? t('kind.context') : t(`kind.${item.kind}`)}
                    </span>
                    <span className="dshr-item-label">{localizeItemLabel(t, item)}</span>
                    {item.toolCall?.durationMs !== undefined && item.toolCall.durationMs >= 1000 && (
                      <span className="dshr-item-dur">{formatDuration(item.toolCall.durationMs)}</span>
                    )}
                    <span className="dshr-item-time">{formatClock(item.time, model.startTime)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="dshr-detail">
          {current && <ItemDetail key={current.seq} item={current} model={model} pricing={pricing} onFork={onFork} />}
        </div>
      </div>
      <div className="dshr-keys">
        <kbd>J</kbd>/<kbd>K</kbd> {t('keys.move')} · <kbd>[</kbd>/<kbd>]</kbd> {t('keys.turn')} · <kbd>E</kbd> {t('keys.error')} · <kbd>Space</kbd>{' '}
        {t('keys.play')} · <kbd>/</kbd> {t('keys.search')} · <code>#123</code> {t('keys.seq')}
      </div>
    </div>
  )
}
