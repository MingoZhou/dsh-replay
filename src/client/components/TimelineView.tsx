import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineItem, TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { localizeItemLabel, useI18n } from '../i18n.js'
import { ItemDetail } from './ItemDetail.js'

const SPEEDS = [1, 2, 4, 8, 16]

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
<<<<<<< HEAD
  let max = 1
  for (const sample of samples) {
    const value =
      sample.usage.inputTokens +
      (sample.usage.cacheReadTokens ?? 0) +
      (sample.usage.cacheWriteTokens ?? 0) +
      sample.usage.outputTokens
    if (value > max) max = value
  }
  // Precompute the next sample seq so the current-bar test is O(1), not O(n²).
  const nextSeq = new Map<number, number>()
  for (let index = 0; index < samples.length; index++) {
    const next = samples[index + 1]
    if (next !== undefined) nextSeq.set(samples[index].seq, next.seq)
  }
=======
  const max = Math.max(
    ...samples.map(s => s.usage.inputTokens + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0) + s.usage.outputTokens),
    1,
  )
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  return (
    <div className="dshr-tokenstrip">
      <div className="dshr-tokenstrip-head">
        <span>{t('ts.title')}</span>
        <span className="dshr-legend">
          <span className="dshr-legend-item">
            <span className="dshr-legend-swatch" style={{ background: 'var(--dshr-s-assistant)' }} />
            {t('ts.input')}
          </span>
          <span className="dshr-legend-item">
            <span className="dshr-legend-swatch" style={{ background: 'var(--dshr-s-tool)' }} />
            {t('ts.output')}
          </span>
        </span>
        <span className="dshr-spacer" />
        <span>
          {t('ts.total', { in: formatTokens(model.totals.billedInput), out: formatTokens(model.totals.output) })}
          {model.totals.cacheRead > 0 ? t('ts.cacheRead', { n: formatTokens(model.totals.cacheRead) }) : ''}
        </span>
      </div>
      <div className="dshr-bars" role="img" aria-label={t('ts.title')}>
        {samples.map(sample => {
          const input =
            sample.usage.inputTokens + (sample.usage.cacheReadTokens ?? 0) + (sample.usage.cacheWriteTokens ?? 0)
          const output = sample.usage.outputTokens
          const isCurrent =
<<<<<<< HEAD
            currentSeq >= sample.seq && (nextSeq.get(sample.seq) ?? Number.POSITIVE_INFINITY) > currentSeq
=======
            currentSeq >= sample.seq &&
            (samples.find(s => s.seq > sample.seq)?.seq ?? Number.POSITIVE_INFINITY) > currentSeq
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          return (
            <button
              key={`${sample.turn}/${sample.step}`}
              className="dshr-bar"
              data-current={isCurrent || undefined}
              title={t('ts.barTitle', {
                turn: sample.turn, step: sample.step,
                in: formatTokens(input), out: formatTokens(output),
              })}
              onClick={() => onJump(sample.seq)}
            >
              <div className="dshr-bar-out" style={{ height: `${(output / max) * 100}%` }} />
              <div className="dshr-bar-in" style={{ height: `${(input / max) * 100}%` }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TimelineView({
  model,
  jumpToSeq,
<<<<<<< HEAD
  jumpNonce,
}: {
  model: TimelineModel
  jumpToSeq?: number
  jumpNonce?: number
=======
}: {
  model: TimelineModel
  jumpToSeq?: number
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
}): React.ReactElement {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<string>>(new Set(['user', 'assistant', 'tool', 'meta']))
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return model.items.filter(item => {
      if (!kinds.has(item.kind)) return false
      if (q === '') return true
      return (
        item.label.toLowerCase().includes(q) ||
        (item.text?.toLowerCase().includes(q) ?? false) ||
<<<<<<< HEAD
        (item.reasoningText?.toLowerCase().includes(q) ?? false) ||
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        (item.toolCall !== undefined &&
          (item.toolCall.name.toLowerCase().includes(q) ||
            item.toolCall.argumentsRaw.toLowerCase().includes(q) ||
            (item.toolCall.resultText?.toLowerCase().includes(q) ?? false)))
      )
    })
  }, [model.items, query, kinds])
<<<<<<< HEAD
  const [selectedSeq, setSelectedSeq] = useState<number>()
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const railRef = useRef<HTMLDivElement>(null)

  // Derive the cursor from the selected seq. When a filter hides the selected
  // event, prefer the next visible event instead of jumping to an unrelated
  // array index.
  const cursor = useMemo(() => {
    if (items.length === 0) return 0
    if (selectedSeq === undefined) return items.length - 1
    const exact = items.findIndex(item => item.seq === selectedSeq)
    if (exact >= 0) return exact
    const next = items.findIndex(item => item.seq >= selectedSeq)
    return next >= 0 ? next : items.length - 1
  }, [items, selectedSeq])
  const current: TimelineItem | undefined = items[Math.min(cursor, Math.max(0, items.length - 1))]

  const select = (seq: number): void => {
    setSelectedSeq(seq)
    setPlaying(false)
  }
=======
  const [cursor, setCursor] = useState(items.length > 0 ? items.length - 1 : 0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const railRef = useRef<HTMLDivElement>(null)
  const current: TimelineItem | undefined = items[Math.min(cursor, items.length - 1)]

  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, items.length - 1)))
  }, [items.length])
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

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

  useEffect(() => {
    if (jumpToSeq === undefined) return
<<<<<<< HEAD
    const index = items.findIndex(item => item.seq >= jumpToSeq)
    if (index >= 0) {
      setSelectedSeq(items[index].seq)
      setPlaying(false)
    }
  }, [jumpToSeq, jumpNonce, items])
=======
    const index = items.findIndex(i => i.seq >= jumpToSeq)
    if (index >= 0) {
      setCursor(index)
      setPlaying(false)
    }
  }, [jumpToSeq, items])
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

  useEffect(() => {
    if (!playing) return
    if (cursor >= items.length - 1) {
      setPlaying(false)
      return
    }
<<<<<<< HEAD
    const timer = setTimeout(() => {
      const next = items[cursor + 1]
      if (next !== undefined) setSelectedSeq(next.seq)
    }, delayFor(items[cursor], items[cursor + 1], speed))
=======
    const timer = setTimeout(
      () => setCursor(c => Math.min(c + 1, items.length - 1)),
      delayFor(items[cursor], items[cursor + 1], speed),
    )
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    return () => clearTimeout(timer)
  }, [playing, cursor, speed, items])

  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const grouped = useMemo(() => {
    const rows: ({ head: { turn: number; reason?: string; durationMs?: number } } | { item: TimelineItem; index: number })[] = []
    let lastTurn: number | undefined
    items.forEach((item, index) => {
      if (item.turn !== undefined && item.turn !== lastTurn) {
        lastTurn = item.turn
<<<<<<< HEAD
        const turnModel = model.turns.find(turn => turn.turn === item.turn)
=======
        const turnModel = model.turns.find(t => t.turn === item.turn)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        rows.push({
          head: {
            turn: item.turn,
            reason: turnModel?.endReason,
            durationMs:
              turnModel?.endTime !== undefined ? turnModel.endTime - turnModel.startTime : undefined,
          },
        })
      }
      rows.push({ item, index })
    })
    return rows
  }, [items, model.turns])

  if (model.items.length === 0) {
    return <div className="dshr-center">{t('tl.empty')}</div>
  }

  const togglePlay = (): void => {
<<<<<<< HEAD
    if (!playing && cursor >= items.length - 1) {
      const first = items[0]
      if (first !== undefined) setSelectedSeq(first.seq)
    }
    setPlaying(value => !value)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (items.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J') {
      event.preventDefault()
      const next = items[Math.min(cursor + 1, items.length - 1)]
      if (next !== undefined) select(next.seq)
    } else if (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'K') {
      event.preventDefault()
      const previous = items[Math.max(cursor - 1, 0)]
      if (previous !== undefined) select(previous.seq)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const first = items[0]
      if (first !== undefined) select(first.seq)
    } else if (event.key === 'End') {
      event.preventDefault()
      const last = items[items.length - 1]
      if (last !== undefined) select(last.seq)
    } else if (event.key === ' ') {
      event.preventDefault()
      togglePlay()
    }
=======
    if (!playing && cursor >= items.length - 1) setCursor(0)
    setPlaying(p => !p)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  }

  return (
    <>
      <div className="dshr-playbar">
        <button
          className="dshr-play-btn"
          data-playing={playing || undefined}
          onClick={togglePlay}
<<<<<<< HEAD
          aria-label={playing ? t('tl.pause') : t('tl.play')}
=======
          aria-label={playing ? 'pause' : 'play'}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          className="dshr-speed"
<<<<<<< HEAD
          onClick={() => setSpeed(value => SPEEDS[(SPEEDS.indexOf(value) + 1) % SPEEDS.length])}
          title={t('tl.speed')}
=======
          onClick={() => setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
          title="playback speed"
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
        >
          {speed}×
        </button>
        <input
          className="dshr-scrub"
          type="range"
          min={0}
          max={Math.max(0, items.length - 1)}
          value={Math.min(cursor, Math.max(0, items.length - 1))}
<<<<<<< HEAD
          onChange={event => {
            const next = items[Number(event.target.value)]
            if (next !== undefined) select(next.seq)
=======
          onChange={e => {
            setCursor(Number(e.target.value))
            setPlaying(false)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          }}
          aria-label={t('play.position')}
        />
        <span className="dshr-clock">
          {current ? formatClock(current.time, model.startTime) : '00:00'} /{' '}
          {formatClock(model.endTime, model.startTime)} · {t('play.event', { i: Math.min(cursor, Math.max(0, items.length - 1)) + 1, n: items.length })}
        </span>
        <input
          className="dshr-filter-input"
          type="search"
          placeholder={t('flt.search')}
          value={query}
<<<<<<< HEAD
          onChange={event => {
            setQuery(event.target.value)
=======
          onChange={e => {
            setQuery(e.target.value)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            setPlaying(false)
          }}
          aria-label={t('flt.search')}
        />
        <span className="dshr-kind-chips">
          {(['user', 'assistant', 'tool', 'meta'] as const).map(kind => (
            <button
              key={kind}
              className="dshr-kind-chip"
              data-on={kinds.has(kind) || undefined}
              data-kind={kind}
              onClick={() => toggleKind(kind)}
            >
              <span className="dshr-kind-dot" />
              {t(`kind.${kind}`)}
            </button>
          ))}
        </span>
      </div>
      <TokenStrip
        model={model}
        currentSeq={current?.seq ?? 0}
        onJump={seq => {
<<<<<<< HEAD
          const index = items.findIndex(item => item.seq >= seq)
          if (index >= 0) select(items[index].seq)
        }}
      />
      <div className="dshr-timeline">
        <div
          className="dshr-rail"
          ref={railRef}
          tabIndex={0}
          role="listbox"
          aria-label={t('tab.timeline')}
          onKeyDown={onKeyDown}
        >
          {grouped.map((row, index) =>
=======
          const index = items.findIndex(i => i.seq >= seq)
          if (index >= 0) {
            setCursor(index)
            setPlaying(false)
          }
        }}
      />
      <div className="dshr-timeline">
        <div className="dshr-rail" ref={railRef}>
          {grouped.map((row, i) =>
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            'head' in row ? (
              <div key={`h${row.head.turn}`} className="dshr-turn-head">
                <span>{t('tl.turn', { n: row.head.turn })}</span>
                {row.head.durationMs !== undefined && (
                  <span className="dshr-turn-reason">{formatDuration(row.head.durationMs)}</span>
                )}
                {row.head.reason !== undefined && row.head.reason !== 'completed' && (
                  <span className="dshr-turn-reason">· {row.head.reason}</span>
                )}
              </div>
            ) : (
              <button
                key={row.item.seq}
                className="dshr-item"
<<<<<<< HEAD
                role="option"
                aria-selected={row.index === cursor}
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
                data-kind={row.item.kind}
                data-selected={row.index === cursor || undefined}
                data-future={row.index > cursor || undefined}
                data-shadowed={row.item.shadowed || undefined}
<<<<<<< HEAD
                onClick={() => select(row.item.seq)}
=======
                onClick={() => {
                  setCursor(row.index)
                  setPlaying(false)
                }}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
              >
                <span className="dshr-item-kind">
                  {row.item.kind === 'tool'
                    ? row.item.toolCall?.name.slice(0, 10) ?? t('kind.tool')
                    : t(`kind.${row.item.kind}`)}
                </span>
<<<<<<< HEAD
                <span className="dshr-item-label">
                  {row.item.kind === 'tool'
                    ? row.item.toolCall?.summary ?? row.item.label
                    : localizeItemLabel(t, row.item)}
                </span>
                {row.item.reasoningText !== undefined && row.item.reasoningText !== '' && (
                  <span className="dshr-item-thinking" title={t('tl.reasoning')}>
                    ✦
                  </span>
                )}
=======
                <span className="dshr-item-label">{localizeItemLabel(t, row.item)}</span>
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
                <span className="dshr-item-time">{formatClock(row.item.time, model.startTime)}</span>
              </button>
            ),
          )}
        </div>
        <div className="dshr-detail">{current && <ItemDetail item={current} model={model} />}</div>
      </div>
    </>
  )
}
