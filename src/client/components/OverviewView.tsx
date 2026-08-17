import React, { useMemo, useRef, useState } from 'react'
import type { AuditReport } from '../../core/audit.js'
import { estimateCost, formatUsd } from '../../core/cost.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { useI18n } from '../i18n.js'

/** Cumulative token samples for the line chart. */
interface Point {
  x: number // event time (ms)
  seq: number
  turn: number
  step: number
  cumInput: number
  cumOutput: number
}

const W = 640
const H = 200
const PAD = { top: 12, right: 16, bottom: 24, left: 52 }

function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return ticks
}

function CumulativeTokensChart({ model }: { model: TimelineModel }): React.ReactElement | null {
  const { t } = useI18n()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number>() // point index

  const points = useMemo<Point[]>(() => {
    let cumInput = 0
    let cumOutput = 0
    const seqTime = new Map(model.items.map(i => [i.seq, i.time]))
    return model.usageSamples.map(s => {
      cumInput += s.usage.inputTokens + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0)
      cumOutput += s.usage.outputTokens
      return {
        x: seqTime.get(s.seq) ?? model.startTime,
        seq: s.seq, turn: s.turn, step: s.step,
        cumInput, cumOutput,
      }
    })
  }, [model])

  if (points.length === 0) return null

  const x0 = model.startTime
  const x1 = Math.max(model.endTime, points.at(-1)!.x)
  const yMax = Math.max(points.at(-1)!.cumInput, points.at(-1)!.cumOutput, 1)
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const sx = (x: number): number => PAD.left + ((x - x0) / Math.max(1, x1 - x0)) * plotW
  const sy = (y: number): number => PAD.top + plotH - (y / yMax) * plotH

  const path = (key: 'cumInput' | 'cumOutput'): string =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p[key]).toFixed(1)}`).join(' ')
  const area = (key: 'cumInput' | 'cumOutput'): string =>
    `${path(key)} L ${sx(points.at(-1)!.x).toFixed(1)} ${sy(0)} L ${sx(points[0].x).toFixed(1)} ${sy(0)} Z`

  const ticks = niceTicks(yMax)
  const hovered = hover !== undefined ? points[hover] : undefined

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = ((event.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - mx)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  return (
    <div className="dshr-panel">
      <div className="dshr-panel-head">
        <span className="dshr-panel-title">{t('ov.tokensChart')}</span>
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
      </div>
      <div className="dshr-chart-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="dshr-chart"
          role="img"
          aria-label={t('ov.tokensChart')}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(undefined)}
        >
          {ticks.map(v => (
            <g key={v}>
              <line className="dshr-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} />
              <text className="dshr-axis-label" x={PAD.left - 8} y={sy(v) + 3} textAnchor="end">
                {formatTokens(v)}
              </text>
            </g>
          ))}
          <text className="dshr-axis-label" x={PAD.left} y={H - 6}>
            {formatClock(x0, model.startTime)}
          </text>
          <text className="dshr-axis-label" x={W - PAD.right} y={H - 6} textAnchor="end">
            {formatClock(x1, model.startTime)}
          </text>
          <path d={area('cumInput')} fill="var(--dshr-s-assistant)" opacity={0.1} />
          <path d={path('cumInput')} className="dshr-line" stroke="var(--dshr-s-assistant)" />
          <path d={path('cumOutput')} className="dshr-line" stroke="var(--dshr-s-tool)" />
          {/* end markers + end labels */}
          <circle cx={sx(points.at(-1)!.x)} cy={sy(points.at(-1)!.cumInput)} r={4}
            fill="var(--dshr-s-assistant)" stroke="var(--dshr-bg)" strokeWidth={2} />
          <circle cx={sx(points.at(-1)!.x)} cy={sy(points.at(-1)!.cumOutput)} r={4}
            fill="var(--dshr-s-tool)" stroke="var(--dshr-bg)" strokeWidth={2} />
          {hovered && (
            <g>
              <line className="dshr-crosshair" x1={sx(hovered.x)} x2={sx(hovered.x)} y1={PAD.top} y2={PAD.top + plotH} />
              <circle cx={sx(hovered.x)} cy={sy(hovered.cumInput)} r={4}
                fill="var(--dshr-s-assistant)" stroke="var(--dshr-bg)" strokeWidth={2} />
              <circle cx={sx(hovered.x)} cy={sy(hovered.cumOutput)} r={4}
                fill="var(--dshr-s-tool)" stroke="var(--dshr-bg)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hovered && (
          <div
            className="dshr-tooltip"
            style={{
              left: `${(sx(hovered.x) / W) * 100}%`,
              transform: `translateX(${sx(hovered.x) > W * 0.7 ? '-100%' : '8px'})`,
            }}
          >
            <div className="dshr-tooltip-title">
              t+{formatClock(hovered.x, model.startTime)} · turn {hovered.turn} · step {hovered.step}
            </div>
            <div>
              <span className="dshr-legend-swatch" style={{ background: 'var(--dshr-s-assistant)' }} />{' '}
              {t('ts.input')} <b>{formatTokens(hovered.cumInput)}</b>
            </div>
            <div>
              <span className="dshr-legend-swatch" style={{ background: 'var(--dshr-s-tool)' }} />{' '}
              {t('ts.output')} <b>{formatTokens(hovered.cumOutput)}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolTimeBars({ model }: { model: TimelineModel }): React.ReactElement | null {
  const { t } = useI18n()
  const rows = useMemo(() => {
    const byTool = new Map<string, { ms: number; calls: number }>()
    for (const call of model.toolCalls) {
      const entry = byTool.get(call.name) ?? { ms: 0, calls: 0 }
      entry.ms += call.durationMs ?? 0
      entry.calls += 1
      byTool.set(call.name, entry)
    }
    return [...byTool.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
  }, [model])

  if (rows.length === 0) return null
  const max = Math.max(...rows.map(r => r.ms), 1)

  return (
    <div className="dshr-panel">
      <div className="dshr-panel-head">
        <span className="dshr-panel-title">{t('ov.toolTime')}</span>
      </div>
      <div className="dshr-hbars">
        {rows.map(row => (
          <div key={row.name} className="dshr-hbar-row" title={`${row.name} — ${formatDuration(row.ms)} · ×${row.calls}`}>
            <span className="dshr-hbar-name">{row.name}</span>
            <span className="dshr-hbar-track">
              <span className="dshr-hbar-fill" style={{ width: `${(row.ms / max) * 100}%` }} />
            </span>
            <span className="dshr-hbar-value">
              {formatDuration(row.ms)} <span className="dshr-hbar-calls">×{row.calls}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewView({
  model,
  report,
  onOpenAudit,
}: {
  model: TimelineModel
  report: AuditReport
  onOpenAudit: () => void
}): React.ReactElement {
  const { t } = useI18n()
  const steps = model.turns.reduce((n, turn) => n + turn.steps.length, 0)
  const alerts = report.counts.critical + report.counts.serious
  const cost = estimateCost(model.totals, model.models)
  const tiles: { value: string; label: string; alert?: boolean; onClick?: () => void }[] = [
    { value: formatDuration(model.durationMs), label: t('cmp.duration') },
    { value: String(model.turns.length), label: t('cmp.turns') },
    { value: String(steps), label: t('cmp.steps') },
    { value: String(model.toolCalls.length), label: t('cmp.toolCalls') },
    { value: formatTokens(model.totals.billedInput), label: t('ov.inputTokens') },
    { value: formatTokens(model.totals.output), label: t('ov.outputTokens') },
    ...(cost !== undefined
      ? [{ value: formatUsd(cost.usd), label: t('ov.cost', { label: cost.label }) }]
      : []),
    { value: String(report.findings.length), label: t('ov.findings'), alert: alerts > 0, onClick: onOpenAudit },
  ]
  return (
    <div className="dshr-overview">
      <div className="dshr-tiles">
        {tiles.map(tile => (
          <button
            key={tile.label}
            className="dshr-tile"
            data-alert={tile.alert || undefined}
            data-static={tile.onClick === undefined || undefined}
            onClick={tile.onClick}
          >
            <span className="dshr-tile-value">
              {tile.value}
              {tile.alert ? <span className="dshr-tile-flag">⛔ {alerts}</span> : null}
            </span>
            <span className="dshr-tile-label">{tile.label}</span>
          </button>
        ))}
      </div>
      <CumulativeTokensChart model={model} />
      <ToolTimeBars model={model} />
    </div>
  )
}
