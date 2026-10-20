import React, { useMemo, useRef, useState } from 'react'
import type { AuditReport } from '../../core/audit.js'
<<<<<<< HEAD
import {
  DEFAULT_PRICING,
  estimateCostDetailed,
  formatMoney,
  type PricingEntry,
  type PricingRate,
} from '../../core/cost.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { useI18n } from '../i18n.js'
import { resetPricing, setRate, usePricing } from '../pricing.js'
=======
import { estimateCost, formatUsd } from '../../core/cost.js'
import type { TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { useI18n } from '../i18n.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

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
<<<<<<< HEAD
    const seqTime = new Map(model.items.map(item => [item.seq, item.time]))
    return model.usageSamples.map(sample => {
      cumInput += sample.usage.inputTokens + (sample.usage.cacheReadTokens ?? 0) + (sample.usage.cacheWriteTokens ?? 0)
      cumOutput += sample.usage.outputTokens
      return {
        x: seqTime.get(sample.seq) ?? model.startTime,
        seq: sample.seq, turn: sample.turn, step: sample.step,
=======
    const seqTime = new Map(model.items.map(i => [i.seq, i.time]))
    return model.usageSamples.map(s => {
      cumInput += s.usage.inputTokens + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0)
      cumOutput += s.usage.outputTokens
      return {
        x: seqTime.get(s.seq) ?? model.startTime,
        seq: s.seq, turn: s.turn, step: s.step,
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x).toFixed(1)} ${sy(point[key]).toFixed(1)}`).join(' ')
=======
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p[key]).toFixed(1)}`).join(' ')
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  const area = (key: 'cumInput' | 'cumOutput'): string =>
    `${path(key)} L ${sx(points.at(-1)!.x).toFixed(1)} ${sy(0)} L ${sx(points[0].x).toFixed(1)} ${sy(0)} Z`

  const ticks = niceTicks(yMax)
  const hovered = hover !== undefined ? points[hover] : undefined

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = ((event.clientX - rect.left) / rect.width) * W
<<<<<<< HEAD
    // Binary search the nearest point by x; mousemove should be O(log n).
    let low = 0
    let high = points.length - 1
    while (low < high) {
      const mid = (low + high) >> 1
      if (sx(points[mid].x) < mx) low = mid + 1
      else high = mid
    }
    const candidate = low > 0 && Math.abs(sx(points[low - 1].x) - mx) <= Math.abs(sx(points[low].x) - mx)
      ? low - 1
      : low
    setHover(candidate)
=======
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
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
          {ticks.map(value => (
            <g key={value}>
              <line className="dshr-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(value)} y2={sy(value)} />
              <text className="dshr-axis-label" x={PAD.left - 8} y={sy(value) + 3} textAnchor="end">
                {formatTokens(value)}
=======
          {ticks.map(v => (
            <g key={v}>
              <line className="dshr-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} />
              <text className="dshr-axis-label" x={PAD.left - 8} y={sy(v) + 3} textAnchor="end">
                {formatTokens(v)}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
=======
          {/* end markers + end labels */}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
      .map(([name, value]) => ({ name, ...value }))
=======
      .map(([name, v]) => ({ name, ...v }))
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
  }, [model])

  if (rows.length === 0) return null
<<<<<<< HEAD
  const max = Math.max(...rows.map(row => row.ms), 1)
=======
  const max = Math.max(...rows.map(r => r.ms), 1)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d

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

<<<<<<< HEAD
function PricingEditor({ pricing, onClose }: { pricing: PricingEntry[]; onClose: () => void }): React.ReactElement {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Record<string, PricingRate>>(() =>
    Object.fromEntries(pricing.map(entry => [entry.label, { ...entry.rate }])),
  )
  const update = (label: string, key: 'input' | 'cacheRead' | 'output', value: string): void => {
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) return
    setDraft(current => ({ ...current, [label]: { ...current[label], [key]: number } }))
  }
  const save = (): void => {
    for (const entry of DEFAULT_PRICING) setRate(entry.label, draft[entry.label])
    onClose()
  }
  return (
    <div className="dshr-price-editor">
      <table className="dshr-table dshr-price-table">
        <thead>
          <tr>
            <th>{t('ov.perModel')}</th>
            <th>{t('ov.inputTokens')}</th>
            <th>{t('detail.cacheRead')}</th>
            <th>{t('ov.outputTokens')}</th>
          </tr>
        </thead>
        <tbody>
          {DEFAULT_PRICING.map(entry => (
            <tr key={entry.label}>
              <td>{entry.label}</td>
              {(['input', 'cacheRead', 'output'] as const).map(key => (
                <td key={key}>
                  <input
                    className="dshr-price-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft[entry.label][key]}
                    onChange={event => update(entry.label, key, event.target.value)}
                    aria-label={`${entry.label} ${key}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dshr-price-actions">
        <button className="dshr-btn" onClick={() => { resetPricing(); onClose() }}>
          {t('ov.priceReset')}
        </button>
        <span className="dshr-spacer" />
        <button className="dshr-btn" onClick={onClose}>{t('exp.cancel')}</button>
        <button className="dshr-btn dshr-btn-primary" onClick={save}>{t('exp.confirm')}</button>
      </div>
    </div>
  )
}

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
  const pricing = usePricing()
  const [currency, setCurrency] = useState<'USD' | 'CNY'>('USD')
  const [editing, setEditing] = useState(false)
  const steps = model.turns.reduce((count, turn) => count + turn.steps.length, 0)
  const risk = report.counts.critical + report.counts.serious
  const cost = estimateCostDetailed(model.modelTotals, pricing)
=======
  const steps = model.turns.reduce((n, turn) => n + turn.steps.length, 0)
  const alerts = report.counts.critical + report.counts.serious
  const cost = estimateCost(model.totals, model.models)
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  const tiles: { value: string; label: string; alert?: boolean; onClick?: () => void }[] = [
    { value: formatDuration(model.durationMs), label: t('cmp.duration') },
    { value: String(model.turns.length), label: t('cmp.turns') },
    { value: String(steps), label: t('cmp.steps') },
    { value: String(model.toolCalls.length), label: t('cmp.toolCalls') },
    { value: formatTokens(model.totals.billedInput), label: t('ov.inputTokens') },
    { value: formatTokens(model.totals.output), label: t('ov.outputTokens') },
<<<<<<< HEAD
    {
      value: cost !== undefined ? formatMoney(cost.usd, currency) : '—',
      label: cost !== undefined ? t('ov.cost', { label: cost.label }) : t('ov.noCost'),
    },
    { value: String(risk), label: t('ov.risk'), alert: risk > 0, onClick: onOpenAudit },
  ]

=======
    ...(cost !== undefined
      ? [{ value: formatUsd(cost.usd), label: t('ov.cost', { label: cost.label }) }]
      : []),
    { value: String(report.findings.length), label: t('ov.findings'), alert: alerts > 0, onClick: onOpenAudit },
  ]
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
<<<<<<< HEAD
              {tile.alert ? <span className="dshr-tile-flag">⛔ {risk}</span> : null}
=======
              {tile.alert ? <span className="dshr-tile-flag">⛔ {alerts}</span> : null}
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            </span>
            <span className="dshr-tile-label">{tile.label}</span>
          </button>
        ))}
      </div>
      <CumulativeTokensChart model={model} />
      <ToolTimeBars model={model} />
<<<<<<< HEAD
      <div className="dshr-panel dshr-cost-panel">
        <div className="dshr-panel-head">
          <span className="dshr-panel-title">{t('ov.costPanel')}</span>
          <span className="dshr-spacer" />
          <span className="dshr-segmented">
            <button data-active={currency === 'USD' || undefined} onClick={() => setCurrency('USD')}>USD</button>
            <button data-active={currency === 'CNY' || undefined} onClick={() => setCurrency('CNY')}>CNY</button>
          </span>
          <button className="dshr-tab" onClick={() => setEditing(value => !value)}>
            {t('ov.editPrices')}
          </button>
        </div>
        {cost !== undefined ? (
          <>
            <div className="dshr-cost-total">
              <span>{t('ov.cost', { label: cost.label })}</span>
              <strong>{formatMoney(cost.usd, currency)}</strong>
            </div>
            {cost.parts.length > 1 && (
              <table className="dshr-table dshr-cost-table">
                <thead>
                  <tr>
                    <th>{t('ov.perModel')}</th>
                    <th>{t('dash.tokens')}</th>
                    <th>{t('dash.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.parts.map(part => (
                    <tr key={part.model}>
                      <td>{part.model}</td>
                      <td>{formatTokens(part.totals.billedInput + part.totals.output)}</td>
                      <td>{formatMoney(part.usd, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="dshr-cost-note">{t('ov.noCost')}</p>
        )}
        <p className="dshr-cost-note">{t('ov.costNote')}</p>
        {editing && <PricingEditor pricing={pricing} onClose={() => setEditing(false)} />}
      </div>
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
    </div>
  )
}
