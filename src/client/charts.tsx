/**
 * Small dependency-free SVG charts. Chrome (surfaces, ink, gridlines) rides
 * the host theme tokens; series colours are the role-scoped `--dshr-c*`
 * custom properties stepped per mode. Every chart ships a hover layer and
 * keeps text in ink tokens — marks carry the colour, labels never do.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'

export function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      const w = el.clientWidth
      if (w > 0) setWidth(w)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export interface TipRow {
  color?: string
  label: string
  value: string
}

export interface Tip {
  x: number
  y: number
  title: string
  rows?: TipRow[]
  note?: string
}

export function ChartTip({ tip, width }: { tip: Tip | undefined; width: number }): React.ReactElement | null {
  if (tip === undefined) return null
  const flip = tip.x > width * 0.6
  return (
    <div
      className="dshr-tip"
      style={{ left: flip ? undefined : tip.x + 12, right: flip ? width - tip.x + 12 : undefined, top: Math.max(0, tip.y) }}
      role="status"
    >
      <div className="dshr-tip-title">{tip.title}</div>
      {tip.rows?.map(row => (
        <div key={row.label} className="dshr-tip-row">
          {row.color !== undefined && <span className="dshr-swatch" style={{ background: row.color }} />}
          <span className="dshr-tip-label">{row.label}</span>
          <span className="dshr-tip-value">{row.value}</span>
        </div>
      ))}
      {tip.note !== undefined && <div className="dshr-tip-note">{tip.note}</div>}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; shape?: 'line' | 'square' }[] }): React.ReactElement {
  return (
    <span className="dshr-legend">
      {items.map(item => (
        <span key={item.label} className="dshr-legend-item">
          <span className="dshr-swatch" data-shape={item.shape ?? 'square'} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </span>
  )
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) ?? raw
  const ticks: number[] = []
  // Always end on a tick at or above the data so marks never poke past the top gridline.
  const steps = Math.max(1, Math.ceil(max / step - 1e-9))
  for (let i = 0; i <= steps; i++) ticks.push(Number((i * step).toPrecision(12)))
  return ticks
}

/* ------------------------------------------------------------------ line / area */

export interface LineSeries {
  key: string
  label: string
  color: string
  values: number[]
  /** Draw a faint wash under the line. */
  area?: boolean
  /** Step-after interpolation (for sawtooth quantities like context size). */
  step?: boolean
}

export function LineChart({
  xs,
  series,
  height = 200,
  formatX,
  formatY,
  tipTitle,
  onPick,
  markers = [],
  ceiling,
}: {
  /** Shared x positions (any monotone number — time, index). */
  xs: number[]
  series: LineSeries[]
  height?: number
  formatX: (x: number) => string
  formatY: (y: number) => string
  tipTitle?: (index: number) => string
  onPick?: (index: number) => void
  /** Vertical event markers (e.g. compactions). */
  markers?: { x: number; label: string }[]
  /** Horizontal reference line (e.g. context window). */
  ceiling?: { y: number; label: string }
}): React.ReactElement | null {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number>()
  if (xs.length === 0) return null
  const pad = { top: 12, right: 14, bottom: 24, left: 46 }
  const plotW = Math.max(40, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const x0 = xs[0]
  const x1 = xs.at(-1)!
  const dataMax = Math.max(1e-9, ...series.flatMap(s => s.values))
  const yMax = ceiling !== undefined && ceiling.y <= dataMax * 4 ? Math.max(dataMax, ceiling.y) : dataMax
  const ticks = niceTicks(yMax)
  const top = Math.max(yMax, ticks.at(-1) ?? yMax)
  const sx = (x: number): number => pad.left + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW)
  const sy = (y: number): number => pad.top + plotH - (y / top) * plotH

  const path = (s: LineSeries): string => {
    let d = ''
    s.values.forEach((v, i) => {
      const px = sx(xs[i]).toFixed(1)
      const py = sy(v).toFixed(1)
      if (i === 0) d += `M ${px} ${py}`
      else if (s.step) d += ` H ${px} V ${py}`
      else d += ` L ${px} ${py}`
    })
    return d
  }
  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const mx = event.clientX - rect.left
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    xs.forEach((x, i) => {
      const d = Math.abs(sx(x) - mx)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }
  const tip: Tip | undefined =
    hover === undefined
      ? undefined
      : {
          x: sx(xs[hover]),
          y: pad.top,
          title: tipTitle ? tipTitle(hover) : formatX(xs[hover]),
          rows: series.map(s => ({ color: s.color, label: s.label, value: formatY(s.values[hover] ?? 0) })),
        }

  return (
    <div className="dshr-chart" ref={ref}>
      <svg
        width={width}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(undefined)}
        onClick={() => hover !== undefined && onPick?.(hover)}
        style={{ cursor: onPick ? 'pointer' : 'default' }}
        role="img"
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line className="dshr-grid" x1={pad.left} x2={pad.left + plotW} y1={sy(tick)} y2={sy(tick)} />
            <text className="dshr-axis" x={pad.left - 8} y={sy(tick) + 4} textAnchor="end">
              {formatY(tick)}
            </text>
          </g>
        ))}
        {ceiling !== undefined && ceiling.y <= top && (
          <g>
            <line className="dshr-ceiling" x1={pad.left} x2={pad.left + plotW} y1={sy(ceiling.y)} y2={sy(ceiling.y)} />
            <text className="dshr-axis" x={pad.left + plotW} y={sy(ceiling.y) - 5} textAnchor="end">
              {ceiling.label}
            </text>
          </g>
        )}
        {markers.map((marker, i) => (
          <g key={i}>
            <line className="dshr-marker-line" x1={sx(marker.x)} x2={sx(marker.x)} y1={pad.top} y2={pad.top + plotH} />
            <text className="dshr-axis" x={sx(marker.x) + 4} y={pad.top + 9}>
              {marker.label}
            </text>
          </g>
        ))}
        {series.map(s =>
          s.area ? (
            <path
              key={`${s.key}-area`}
              d={`${path(s)} L ${sx(x1).toFixed(1)} ${sy(0)} L ${sx(x0).toFixed(1)} ${sy(0)} Z`}
              fill={s.color}
              opacity={0.1}
            />
          ) : null,
        )}
        {series.map(s => (
          <path key={s.key} d={path(s)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <text className="dshr-axis" x={pad.left} y={height - 6}>
          {formatX(x0)}
        </text>
        <text className="dshr-axis" x={pad.left + plotW} y={height - 6} textAnchor="end">
          {formatX(x1)}
        </text>
        {hover !== undefined && (
          <g>
            <line className="dshr-crosshair" x1={sx(xs[hover])} x2={sx(xs[hover])} y1={pad.top} y2={pad.top + plotH} />
            {series.map(s => (
              <circle key={s.key} cx={sx(xs[hover])} cy={sy(s.values[hover] ?? 0)} r={4.5} fill={s.color} className="dshr-ring" />
            ))}
          </g>
        )}
        {hover === undefined &&
          series.map(s => (
            <circle key={s.key} cx={sx(x1)} cy={sy(s.values.at(-1) ?? 0)} r={4} fill={s.color} className="dshr-ring" />
          ))}
      </svg>
      <ChartTip tip={tip} width={width} />
    </div>
  )
}

/* ------------------------------------------------------------------ swimlane */

export interface LaneSpan {
  lane: string
  start: number
  end: number
  title: string
  detail?: string
  seq?: number
  failed?: boolean
}

/**
 * Wall-clock map of a run: one lane per actor, spans at their real duration.
 * Long idle gaps between `segments` (turns) are collapsed to a fixed-width
 * break so a lunch break doesn't flatten the interesting parts.
 */
export function Swimlane({
  lanes,
  spans,
  segments,
  formatDuration,
  formatClock,
  failedLabel,
  idleLabel,
  onPick,
}: {
  lanes: { key: string; label: string; color: string }[]
  spans: LaneSpan[]
  segments: { start: number; end: number; label: string }[]
  formatDuration: (ms: number) => string
  formatClock: (time: number) => string
  failedLabel: string
  idleLabel: (ms: number) => string
  onPick?: (span: LaneSpan) => void
}): React.ReactElement | null {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>()
  const labelW = 54
  const laneH = 22
  const top = 18
  const height = top + lanes.length * laneH + 6
  const plotW = Math.max(60, width - labelW - 8)

  const scale = useMemo(() => {
    const ordered = [...segments].filter(s => s.end > s.start).sort((a, b) => a.start - b.start)
    const active = ordered.reduce((n, s) => n + (s.end - s.start), 0)
    const gapPx = ordered.length > 1 ? Math.min(18, plotW * 0.03) : 0
    const usable = Math.max(10, plotW - gapPx * Math.max(0, ordered.length - 1))
    let cursor = 0
    const mapped = ordered.map(s => {
      const w = active > 0 ? ((s.end - s.start) / active) * usable : usable / ordered.length
      const entry = { ...s, x: cursor, w }
      cursor += w + gapPx
      return entry
    })
    const map = (t: number): number => {
      for (const s of mapped) {
        if (t <= s.end) return s.x + (Math.max(0, t - s.start) / Math.max(1, s.end - s.start)) * s.w
      }
      const last = mapped.at(-1)
      return last ? last.x + last.w : 0
    }
    return { mapped, map, gapPx }
  }, [segments, plotW])

  if (segments.length === 0) return null
  const laneIndex = new Map(lanes.map((l, i) => [l.key, i]))

  return (
    <div className="dshr-chart" ref={ref} onMouseLeave={() => setTip(undefined)}>
      <svg width={width} height={height} role="img">
        {lanes.map((lane, i) => (
          <g key={lane.key}>
            <text className="dshr-axis" x={0} y={top + i * laneH + 14}>
              {lane.label}
            </text>
            <rect className="dshr-lane" x={labelW} y={top + i * laneH + 3} width={plotW} height={laneH - 6} rx={3} />
          </g>
        ))}
        {scale.mapped.map((segment, i) => (
          <g key={i}>
            <text className="dshr-axis" x={labelW + segment.x + 1} y={10}>
              {segment.w > 34 ? segment.label : ''}
            </text>
            {i > 0 && (
              <rect
                className="dshr-gap"
                x={labelW + segment.x - scale.gapPx}
                y={top}
                width={scale.gapPx}
                height={lanes.length * laneH}
                onMouseMove={e =>
                  setTip({
                    x: labelW + segment.x - scale.gapPx / 2,
                    y: e.nativeEvent.offsetY,
                    title: idleLabel(segment.start - scale.mapped[i - 1].end),
                  })
                }
              />
            )}
          </g>
        ))}
        {spans.map((span, i) => {
          const lane = laneIndex.get(span.lane)
          if (lane === undefined) return null
          const x = labelW + scale.map(span.start)
          const w = Math.max(2, scale.map(span.end) - scale.map(span.start) - 1)
          const color = span.failed ? 'var(--dshr-critical)' : lanes[lane].color
          return (
            <rect
              key={i}
              className="dshr-span"
              x={x}
              y={top + lane * laneH + 3}
              width={w}
              height={laneH - 6}
              rx={2}
              fill={color}
              onMouseMove={e =>
                setTip({
                  x: e.nativeEvent.offsetX,
                  y: e.nativeEvent.offsetY + 14,
                  title: span.title,
                  rows: [
                    { label: formatClock(span.start), value: formatDuration(span.end - span.start) },
                    ...(span.failed ? [{ color: 'var(--dshr-critical)', label: failedLabel, value: '' }] : []),
                  ],
                  note: span.detail,
                })
              }
              onClick={() => onPick?.(span)}
              style={{ cursor: onPick && span.seq !== undefined ? 'pointer' : 'default' }}
            />
          )
        })}
      </svg>
      <ChartTip tip={tip} width={width} />
    </div>
  )
}

/* ------------------------------------------------------------------ donut & gauge */

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export interface Part {
  key: string
  label: string
  value: number
  color: string
}

export function Donut({
  parts,
  size = 132,
  center,
  format,
}: {
  parts: Part[]
  size?: number
  center: { value: string; label: string }
  format: (value: number) => string
}): React.ReactElement {
  const [hover, setHover] = useState<string>()
  const total = parts.reduce((n, p) => n + p.value, 0)
  const r = size / 2 - 9
  const gap = 0.035
  let angle = -Math.PI / 2
  const visible = parts.filter(p => p.value > 0)
  const active = visible.find(p => p.key === hover)
  return (
    <div className="dshr-donut">
      <svg width={size} height={size} role="img" onMouseLeave={() => setHover(undefined)}>
        <circle cx={size / 2} cy={size / 2} r={r} className="dshr-track" strokeWidth={12} fill="none" />
        {total > 0 &&
          visible.map(part => {
            const sweep = (part.value / total) * Math.PI * 2
            const a0 = angle + (visible.length > 1 ? gap / 2 : 0)
            const a1 = angle + sweep - (visible.length > 1 ? gap / 2 : 0)
            angle += sweep
            if (a1 <= a0) return null
            const full = visible.length === 1
            return full ? (
              <circle key={part.key} cx={size / 2} cy={size / 2} r={r} stroke={part.color} strokeWidth={12} fill="none" onMouseEnter={() => setHover(part.key)} />
            ) : (
              <path
                key={part.key}
                d={arc(size / 2, size / 2, r, a0, a1)}
                stroke={part.color}
                strokeWidth={hover === part.key ? 15 : 12}
                fill="none"
                onMouseEnter={() => setHover(part.key)}
              />
            )
          })}
        <text className="dshr-donut-value" x={size / 2} y={size / 2 + 2} textAnchor="middle">
          {active ? format(active.value) : center.value}
        </text>
        <text className="dshr-axis" x={size / 2} y={size / 2 + 18} textAnchor="middle">
          {active ? active.label : center.label}
        </text>
      </svg>
      <div className="dshr-donut-legend">
        {parts.map(part => (
          <div
            key={part.key}
            className="dshr-donut-row"
            data-active={hover === part.key || undefined}
            onMouseEnter={() => setHover(part.key)}
            onMouseLeave={() => setHover(undefined)}
          >
            <span className="dshr-swatch" style={{ background: part.color }} />
            <span className="dshr-donut-label">{part.label}</span>
            <span className="dshr-num">{format(part.value)}</span>
            <span className="dshr-num dshr-muted">{total > 0 ? `${Math.round((part.value / total) * 100)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RingGauge({
  value,
  tone,
  size = 124,
  caption,
}: {
  /** 0..100 */
  value: number
  tone: 'good' | 'warning' | 'critical'
  size?: number
  caption: string
}): React.ReactElement {
  const r = size / 2 - 10
  const start = Math.PI * 0.75
  const sweep = Math.PI * 1.5
  const end = start + sweep * Math.max(0.001, Math.min(1, value / 100))
  const color = `var(--dshr-${tone})`
  return (
    <svg width={size} height={size} role="img" aria-label={`${caption} ${Math.round(value)}`}>
      <path d={arc(size / 2, size / 2, r, start, start + sweep)} className="dshr-track" strokeWidth={10} fill="none" strokeLinecap="round" />
      <path d={arc(size / 2, size / 2, r, start, end)} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" />
      <text className="dshr-gauge-value" x={size / 2} y={size / 2 + 8} textAnchor="middle">
        {Math.round(value)}
      </text>
      <text className="dshr-axis" x={size / 2} y={size / 2 + 26} textAnchor="middle">
        {caption}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ bars */

export function StackedColumns({
  columns,
  series,
  height = 190,
  formatY,
  onPick,
}: {
  columns: { key: string; label: string; tip: string; values: Record<string, number> }[]
  series: { key: string; label: string; color: string }[]
  height?: number
  formatY: (y: number) => string
  onPick?: (key: string) => void
}): React.ReactElement | null {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number>()
  if (columns.length === 0) return null
  const pad = { top: 10, right: 8, bottom: 22, left: 46 }
  const plotW = Math.max(40, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const totals = columns.map(c => series.reduce((n, s) => n + (c.values[s.key] ?? 0), 0))
  const ticks = niceTicks(Math.max(1e-9, ...totals))
  const top = ticks.at(-1) ?? 1
  const band = plotW / columns.length
  const barW = Math.min(24, Math.max(3, band - 4))
  const sy = (y: number): number => (y / top) * plotH
  const labelEvery = Math.max(1, Math.ceil(columns.length / Math.max(2, Math.floor(plotW / 56))))
  const tip: Tip | undefined =
    hover === undefined
      ? undefined
      : {
          x: pad.left + band * hover + band / 2,
          y: pad.top,
          title: columns[hover].tip,
          rows: [
            ...series
              .filter(s => (columns[hover].values[s.key] ?? 0) > 0)
              .map(s => ({ color: s.color, label: s.label, value: formatY(columns[hover].values[s.key] ?? 0) })),
          ],
          note: series.length > 1 ? `Σ ${formatY(totals[hover])}` : undefined,
        }
  return (
    <div className="dshr-chart" ref={ref}>
      <svg width={width} height={height} role="img" onMouseLeave={() => setHover(undefined)}>
        {ticks.map(tick => (
          <g key={tick}>
            <line className="dshr-grid" x1={pad.left} x2={pad.left + plotW} y1={pad.top + plotH - sy(tick)} y2={pad.top + plotH - sy(tick)} />
            <text className="dshr-axis" x={pad.left - 8} y={pad.top + plotH - sy(tick) + 4} textAnchor="end">
              {formatY(tick)}
            </text>
          </g>
        ))}
        {columns.map((column, i) => {
          const x = pad.left + band * i + (band - barW) / 2
          let y = pad.top + plotH
          const stack = series.filter(s => (column.values[s.key] ?? 0) > 0)
          return (
            <g key={column.key}>
              {stack.map((s, k) => {
                const h = Math.max(1, sy(column.values[s.key] ?? 0) - (k < stack.length - 1 ? 2 : 0))
                y -= sy(column.values[s.key] ?? 0)
                const isTop = k === stack.length - 1
                return isTop ? (
                  <path
                    key={s.key}
                    fill={s.color}
                    d={`M ${x} ${y + h} V ${y + Math.min(4, h)} Q ${x} ${y} ${x + Math.min(4, barW / 2)} ${y} H ${x + barW - Math.min(4, barW / 2)} Q ${x + barW} ${y} ${x + barW} ${y + Math.min(4, h)} V ${y + h} Z`}
                  />
                ) : (
                  <rect key={s.key} x={x} y={y + 2} width={barW} height={h} fill={s.color} />
                )
              })}
              {i % labelEvery === 0 && (
                <text className="dshr-axis" x={pad.left + band * i + band / 2} y={height - 6} textAnchor="middle">
                  {column.label}
                </text>
              )}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={plotH}
                fill={hover === i ? 'var(--dshr-hover)' : 'transparent'}
                onMouseEnter={() => setHover(i)}
                onClick={() => onPick?.(column.key)}
                style={{ cursor: onPick ? 'pointer' : 'default' }}
              />
            </g>
          )
        })}
      </svg>
      <ChartTip tip={tip} width={width} />
    </div>
  )
}

export interface BarRow {
  key: string
  label: string
  value: number
  /** Right-aligned value text. */
  text: string
  sub?: string
  color?: string
  /** Portion of the bar drawn in the critical colour (0..1), e.g. an error rate. */
  failShare?: number
  title?: string
}

export function BarList({
  rows,
  onPick,
  labelWidth = 120,
}: {
  rows: BarRow[]
  onPick?: (key: string) => void
  labelWidth?: number
}): React.ReactElement {
  const max = Math.max(1e-9, ...rows.map(r => r.value))
  return (
    <div className="dshr-barlist" style={{ ['--dshr-label-w' as string]: `${labelWidth}px` }}>
      {rows.map(row => {
        const Tag = onPick ? 'button' : 'div'
        return (
          <Tag key={row.key} className="dshr-barrow" title={row.title ?? row.label} onClick={onPick ? () => onPick(row.key) : undefined}>
            <span className="dshr-barrow-label">{row.label}</span>
            <span className="dshr-barrow-track">
              <span
                className="dshr-barrow-fill"
                style={{ width: `${Math.max(0.6, (row.value / max) * 100)}%`, background: row.color ?? 'var(--dshr-c1)' }}
              >
                {row.failShare !== undefined && row.failShare > 0 && (
                  <span className="dshr-barrow-fail" style={{ width: `${Math.min(100, row.failShare * 100)}%` }} />
                )}
              </span>
            </span>
            <span className="dshr-barrow-value">
              {row.text}
              {row.sub !== undefined && <span className="dshr-muted"> {row.sub}</span>}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}

/** One whole split into parts — thin, fully rounded, no text inside. */
export function SegmentBar({ parts, format }: { parts: Part[]; format: (value: number) => string }): React.ReactElement {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div className="dshr-segbar-wrap">
      <div className="dshr-segbar" role="img" aria-label={parts.map(p => `${p.label} ${format(p.value)}`).join(', ')}>
        {parts
          .filter(p => p.value > 0)
          .map(part => (
            <span
              key={part.key}
              style={{ flexGrow: part.value, background: part.color }}
              title={`${part.label} · ${format(part.value)} · ${total > 0 ? Math.round((part.value / total) * 100) : 0}%`}
            />
          ))}
      </div>
      <div className="dshr-segbar-legend">
        {parts.map(part => (
          <span key={part.key} className="dshr-legend-item">
            <span className="dshr-swatch" style={{ background: part.color }} />
            {part.label}
            <span className="dshr-num">{format(part.value)}</span>
            <span className="dshr-muted">{total > 0 ? `${Math.round((part.value / total) * 100)}%` : ''}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Meter({ ratio, tone = 'accent' }: { ratio: number; tone?: 'accent' | 'good' | 'warning' | 'critical' }): React.ReactElement {
  return (
    <span className="dshr-meter" data-tone={tone}>
      <span style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </span>
  )
}

export function Sparkline({ values, width = 88, height = 24 }: { values: number[]; width?: number; height?: number }): React.ReactElement | null {
  if (values.length < 2) return null
  const max = Math.max(1e-9, ...values)
  const step = (width - 4) / (values.length - 1)
  const points = values.map((v, i) => `${(2 + i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`)
  const last = points.at(-1)!.split(',')
  return (
    <svg width={width} height={height} className="dshr-spark" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  )
}

/* ------------------------------------------------------------------ heatmap */

export function Heatmap({
  cells,
  rowLabels,
  format,
  tipTitle,
}: {
  /** cells[row][col] */
  cells: number[][]
  rowLabels: string[]
  format: (value: number) => string
  tipTitle: (row: number, col: number) => string
}): React.ReactElement {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>()
  const cols = cells[0]?.length ?? 0
  const labelW = 30
  const gap = 2
  const cell = Math.max(6, Math.min(22, (width - labelW - gap * cols) / Math.max(1, cols)))
  const height = cells.length * (cell + gap) + 18
  const max = Math.max(1e-9, ...cells.flat())
  const level = (v: number): number => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)))
  return (
    <div className="dshr-chart" ref={ref} onMouseLeave={() => setTip(undefined)}>
      <svg width={width} height={height} role="img">
        {cells.map((row, r) => (
          <g key={r}>
            <text className="dshr-axis" x={0} y={r * (cell + gap) + cell * 0.72}>
              {rowLabels[r]}
            </text>
            {row.map((value, c) => (
              <rect
                key={c}
                className="dshr-heat"
                data-level={level(value)}
                x={labelW + c * (cell + gap)}
                y={r * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                onMouseEnter={() =>
                  setTip({
                    x: labelW + c * (cell + gap) + cell / 2,
                    y: r * (cell + gap) + cell + 4,
                    title: tipTitle(r, c),
                    rows: [{ label: format(value), value: '' }],
                  })
                }
              />
            ))}
          </g>
        ))}
        {[0, 6, 12, 18, 23].map(h => (
          <text key={h} className="dshr-axis" x={labelW + h * (cell + gap) + cell / 2} y={height - 4} textAnchor="middle">
            {String(h).padStart(2, '0')}
          </text>
        ))}
      </svg>
      <ChartTip tip={tip} width={width} />
    </div>
  )
}
