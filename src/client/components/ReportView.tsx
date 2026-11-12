import React, { useMemo, useState } from 'react'
import type { AuditReport } from '../../core/audit.js'
import { formatMoney, type CostEstimate, type PricingConfig } from '../../core/cost.js'
import type { Baseline } from '../../core/dashboard.js'
import type { FileChangeReport } from '../../core/files.js'
import type { Insights } from '../../core/insights.js'
import { primaryArgument, type TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatPercent, formatTokens } from '../api.js'
import { BarList, Donut, Legend, LineChart, Meter, RingGauge, SegmentBar, Swimlane, type LaneSpan } from '../charts.js'
import { useI18n } from '../i18n.js'
import { updateSettings, useSettings } from '../settings.js'
import { Icon, Panel, StatTile, type Delta } from '../ui.js'

function delta(value: number, base: number | undefined, label: (pct: string) => string, higherIsWorse = true): Delta | undefined {
  if (base === undefined || base <= 0) return undefined
  const ratio = value / base - 1
  const text =
    Math.abs(ratio) < 0.1 ? '≈' : ratio > 0 ? (ratio >= 1 ? `${(ratio + 1).toFixed(1)}×` : `+${Math.round(ratio * 100)}%`) : `−${Math.round(-ratio * 100)}%`
  return { ratio, higherIsWorse, label: label(text) }
}

interface Attention {
  key: string
  tone: 'critical' | 'warning' | 'info'
  title: string
  detail?: string
  meta?: string
  seq?: number
  tab?: 'audit' | 'files'
}

export function ReportView({
  model,
  report,
  insights,
  cost,
  files,
  baseline,
  pricing,
  onJump,
  onTab,
}: {
  model: TimelineModel
  report: AuditReport
  insights: Insights
  cost: CostEstimate
  files: FileChangeReport
  baseline?: Baseline
  pricing: PricingConfig
  onJump: (seq: number) => void
  onTab: (tab: 'audit' | 'files' | 'timeline') => void
}): React.ReactElement {
  const { t } = useI18n()
  const { chartUnit } = useSettings()
  const [showAll, setShowAll] = useState(false)
  const money = (cny: number): string => formatMoney(cny, pricing)
  const steps = model.turns.reduce((n, turn) => n + turn.steps.length, 0)
  const tone = insights.score >= 85 ? 'good' : insights.score >= 60 ? 'warning' : 'critical'
  const vs = (pct: string): string => t('rep.vsMedian', { pct, n: baseline?.n ?? 0 })
  const totalTokens = model.totals.billedInput + model.totals.output

  const attention = useMemo<Attention[]>(() => {
    const list: Attention[] = []
    const alerts = report.counts.critical + report.counts.serious
    if (alerts > 0) {
      list.push({
        key: 'audit', tone: report.counts.critical > 0 ? 'critical' : 'warning', tab: 'audit',
        title: t('rep.att.audit', { critical: report.counts.critical, serious: report.counts.serious }),
        detail: report.findings[0]?.detail,
      })
    }
    for (const loop of insights.loops.filter(l => l.consecutive >= 3)) {
      list.push({
        key: `loop-${loop.firstSeq}`, tone: 'warning', seq: loop.firstSeq,
        title: t('rep.att.loop', { name: loop.name, n: loop.consecutive }),
        detail: (() => {
          try {
            const pairs = JSON.parse(loop.signature) as [string, unknown][]
            return pairs.map(([, v]) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ')
          } catch {
            return loop.signature
          }
        })(),
        meta: formatDuration(loop.totalMs),
      })
    }
    for (const turn of insights.abnormalTurns) {
      list.push({ key: `turn-${turn.turn}`, tone: 'warning', seq: turn.seq, title: t('rep.att.turn', { n: turn.turn, reason: turn.reason }) })
    }
    if (insights.failedCalls.length > 0) {
      const first = insights.failedCalls[0]
      list.push({
        key: 'failed', tone: 'warning', seq: first.callSeq,
        title: t('rep.att.failed', { n: insights.failedCalls.length, total: model.toolCalls.length }),
        detail: `${first.name} · ${first.error?.reason ?? first.error?.code ?? (first.resultText ?? '').split('\n')[0]}`,
      })
    }
    if (insights.retries > 0) {
      const item = model.items.find(i => i.type === 'assistant/attempt' || i.type === 'llm/retry')
      list.push({ key: 'retries', tone: 'info', seq: item?.seq, title: t('rep.att.retries', { n: insights.retries }) })
    }
    for (const call of insights.slowestCalls) {
      if ((call.durationMs ?? 0) < 5_000) continue
      list.push({
        key: `slow-${call.callSeq}`, tone: 'info', seq: call.callSeq,
        title: t('rep.att.slow', { name: call.name }),
        detail: primaryArgument(call).slice(0, 160),
        meta: formatDuration(call.durationMs ?? 0),
      })
    }
    if (insights.compactions > 0) {
      const item = model.items.find(i => i.type.startsWith('compaction/'))
      list.push({ key: 'compaction', tone: 'info', seq: item?.seq, title: t('rep.att.compaction', { n: insights.compactions }) })
    }
    if (cost.unpriced.length > 0) {
      list.push({ key: 'unpriced', tone: 'info', title: t('rep.att.unpriced', { models: cost.unpriced.join(', ') }) })
    }
    return list
  }, [report, insights, model, cost, t])

  const lanes = [
    { key: 'user', label: t('kind.user'), color: 'var(--dshr-c3)' },
    { key: 'model', label: t('rep.lane.model'), color: 'var(--dshr-c1)' },
    { key: 'tool', label: t('kind.tool'), color: 'var(--dshr-c2)' },
  ]
  const spans = useMemo<LaneSpan[]>(() => {
    const out: LaneSpan[] = []
    for (const turn of model.turns) {
      const prompt = turn.items.find(i => i.kind === 'user')
      if (prompt) {
        out.push({ lane: 'user', start: prompt.time, end: prompt.time + 1, title: t('tl.turn', { n: turn.turn }), detail: prompt.label, seq: prompt.seq })
      }
      for (const step of turn.steps) {
        const message = step.items.find(i => i.kind === 'assistant')
        if (message && step.llmMs !== undefined) {
          out.push({
            lane: 'model', start: step.startTime, end: step.startTime + step.llmMs, seq: message.seq,
            title: `${step.model ?? t('rep.lane.model')} · ${t('tl.turn', { n: turn.turn })} / ${step.step}`,
            detail: message.label,
          })
        }
      }
    }
    for (const call of model.toolCalls) {
      out.push({
        lane: 'tool', start: call.callTime, end: call.resultTime ?? call.callTime + 1, seq: call.callSeq,
        title: call.name, detail: primaryArgument(call).slice(0, 140), failed: call.failed,
      })
    }
    return out
  }, [model, t])
  const segments = model.turns.map(turn => ({
    start: turn.startTime,
    end: turn.endTime ?? turn.items.at(-1)?.time ?? turn.startTime + 1,
    label: t('tl.turnShort', { n: turn.turn }),
  }))

  const xs = model.usageSamples.map(s => s.time)
  const cumulative = useMemo(() => {
    let input = 0
    let output = 0
    return model.usageSamples.map(s => {
      input += (s.usage.inputTokens ?? 0) + (s.usage.cacheReadTokens ?? 0) + (s.usage.cacheWriteTokens ?? 0)
      output += s.usage.outputTokens ?? 0
      return { input, output }
    })
  }, [model])
  const other = Math.max(0, insights.activeMs - insights.modelMs - insights.toolMs)
  const shown = showAll ? attention : attention.slice(0, 6)

  return (
    <div className="dshr-scroll">
      <div className="dshr-report">
        <div className="dshr-hero">
          <Panel className="dshr-score">
            <RingGauge value={insights.score} tone={tone} caption={t('rep.score')} />
            <div className="dshr-score-side">
              <div className="dshr-score-verdict" data-tone={tone}>
                <Icon name={tone === 'good' ? 'check' : 'warn'} size={13} />
                {t(`rep.verdict.${tone}`)}
              </div>
              {insights.deductions.length === 0 ? (
                <div className="dshr-muted">{t('rep.noDeductions')}</div>
              ) : (
                <ul className="dshr-deductions">
                  {insights.deductions.map(d => (
                    <li key={d.key}>
                      <span className="dshr-num">−{d.points}</span>
                      {t(`rep.ded.${d.key}`, { n: d.count })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
          <div className="dshr-tiles">
            <StatTile
              label={t('rep.cost')}
              value={money(cost.cny)}
              sub={cost.peakShare > 0 ? t('rep.peakShare', { pct: formatPercent(cost.peakShare) }) : t('rep.estimate')}
              delta={delta(cost.cny, baseline?.cny, vs)}
            />
            <StatTile
              label={t('rep.active')}
              value={formatDuration(insights.activeMs)}
              sub={insights.idleMs > 1000 ? t('rep.idle', { d: formatDuration(insights.idleMs) }) : undefined}
              delta={delta(insights.activeMs, baseline?.activeMs, vs)}
            />
            <StatTile
              label={t('rep.tokens')}
              value={formatTokens(totalTokens)}
              sub={t('rep.tokensSub', { in: formatTokens(model.totals.billedInput), out: formatTokens(model.totals.output) })}
              delta={delta(totalTokens, baseline?.tokens, vs)}
            />
            <StatTile
              label={t('rep.cache')}
              value={formatPercent(insights.cacheHitRate)}
              sub={cost.savedByCache > 0 ? t('rep.saved', { money: money(cost.savedByCache) }) : undefined}
            >
              <Meter ratio={insights.cacheHitRate} tone={insights.cacheHitRate >= 0.5 ? 'good' : 'warning'} />
            </StatTile>
            <StatTile
              label={t('rep.calls')}
              value={model.toolCalls.length}
              sub={
                insights.failedCalls.length > 0
                  ? t('rep.callsFailed', { n: insights.failedCalls.length })
                  : t('rep.callsClean')
              }
              tone={insights.failedCalls.length > 0 ? 'warning' : undefined}
              delta={delta(model.toolCalls.length, baseline?.toolCalls, vs)}
            />
            <StatTile
              label={t('rep.turns')}
              value={`${model.turns.length} / ${steps}`}
              sub={
                insights.avgTtftMs !== undefined
                  ? t('rep.ttft', { d: formatDuration(insights.avgTtftMs) })
                  : model.models.join(', ')
              }
            />
          </div>
        </div>

        <Panel
          title={t('rep.timeMap')}
          hint={t('rep.timeMapHint')}
          actions={<Legend items={[...lanes.map(l => ({ label: l.label, color: l.color })), { label: t('rep.failed'), color: 'var(--dshr-critical)' }]} />}
        >
          <Swimlane
            lanes={lanes}
            spans={spans}
            segments={segments}
            formatDuration={formatDuration}
            formatClock={time => `t+${formatClock(time, model.startTime)}`}
            failedLabel={t('rep.failed')}
            idleLabel={ms => t('rep.idleGap', { d: formatDuration(ms) })}
            onPick={span => span.seq !== undefined && onJump(span.seq)}
          />
          <SegmentBar
            format={formatDuration}
            parts={[
              { key: 'model', label: t('rep.split.model'), value: insights.modelMs, color: 'var(--dshr-c1)' },
              { key: 'tool', label: t('rep.split.tool'), value: insights.toolMs, color: 'var(--dshr-c2)' },
              { key: 'other', label: t('rep.split.other'), value: other, color: 'var(--dshr-c4)' },
              { key: 'idle', label: t('rep.split.idle'), value: insights.idleMs, color: 'var(--dshr-neutral)' },
            ]}
          />
        </Panel>

        <div className="dshr-grid-2">
          <Panel
            title={chartUnit === 'cost' ? t('rep.cumCost') : t('rep.cumTokens')}
            actions={
              <span className="dshr-seg">
                {(['cost', 'tokens'] as const).map(unit => (
                  <button key={unit} data-on={chartUnit === unit || undefined} onClick={() => updateSettings({ chartUnit: unit })}>
                    {t(`rep.unit.${unit}`)}
                  </button>
                ))}
              </span>
            }
          >
            {xs.length === 0 ? (
              <div className="dshr-empty">{t('rep.noUsage')}</div>
            ) : chartUnit === 'cost' ? (
              <LineChart
                xs={xs}
                series={[{ key: 'cost', label: t('rep.cost'), color: 'var(--dshr-c1)', values: cost.cumulative, area: true }]}
                formatX={x => formatClock(x, model.startTime)}
                formatY={money}
                tipTitle={i => `${t('tl.turn', { n: model.usageSamples[i].turn })} / ${model.usageSamples[i].step} · ${formatClock(xs[i], model.startTime)}`}
                onPick={i => onJump(model.usageSamples[i].seq)}
              />
            ) : (
              <>
                <LineChart
                  xs={xs}
                  series={[
                    { key: 'in', label: t('ts.input'), color: 'var(--dshr-c1)', values: cumulative.map(c => c.input), area: true },
                    { key: 'out', label: t('ts.output'), color: 'var(--dshr-c2)', values: cumulative.map(c => c.output) },
                  ]}
                  formatX={x => formatClock(x, model.startTime)}
                  formatY={formatTokens}
                  tipTitle={i => `${t('tl.turn', { n: model.usageSamples[i].turn })} / ${model.usageSamples[i].step}`}
                  onPick={i => onJump(model.usageSamples[i].seq)}
                />
                <Legend
                  items={[
                    { label: t('ts.input'), color: 'var(--dshr-c1)', shape: 'line' },
                    { label: t('ts.output'), color: 'var(--dshr-c2)', shape: 'line' },
                  ]}
                />
              </>
            )}
          </Panel>
          <Panel
            title={t('rep.context')}
            hint={
              insights.contextWindow !== undefined
                ? t('rep.contextPeak', {
                    peak: formatTokens(insights.peakContext),
                    pct: formatPercent(insights.peakContext / insights.contextWindow, insights.peakContext / insights.contextWindow < 0.1 ? 1 : 0),
                  })
                : formatTokens(insights.peakContext)
            }
          >
            {insights.context.length === 0 ? (
              <div className="dshr-empty">{t('rep.noUsage')}</div>
            ) : (
              <LineChart
                xs={insights.context.map(c => c.time)}
                series={[{ key: 'ctx', label: t('rep.contextSeries'), color: 'var(--dshr-c7)', values: insights.context.map(c => c.tokens), area: true, step: true }]}
                formatX={x => formatClock(x, model.startTime)}
                formatY={formatTokens}
                tipTitle={i => `${t('tl.turn', { n: insights.context[i].turn })} / ${insights.context[i].step}`}
                onPick={i => onJump(insights.context[i].seq)}
                markers={model.items
                  .filter(i => i.type === 'compaction/summary' || i.type === 'compaction/prune')
                  .map(i => ({ x: i.time, label: t('rep.compactMark') }))}
                ceiling={insights.contextWindow !== undefined ? { y: insights.contextWindow, label: t('rep.window') } : undefined}
              />
            )}
          </Panel>
        </div>

        <div className="dshr-grid-3">
          <Panel title={t('rep.attention')} hint={attention.length > 0 ? String(attention.length) : undefined}>
            {attention.length === 0 ? (
              <div className="dshr-empty">
                <Icon name="check" /> {t('rep.attentionEmpty')}
              </div>
            ) : (
              <div className="dshr-attention">
                {shown.map(item => {
                  const clickable = item.seq !== undefined || item.tab !== undefined
                  const Tag = clickable ? 'button' : 'div'
                  return (
                    <Tag
                      key={item.key}
                      className="dshr-att"
                      data-tone={item.tone}
                      onClick={clickable ? () => (item.tab ? onTab(item.tab) : onJump(item.seq!)) : undefined}
                    >
                      <span className="dshr-att-dot" />
                      <span className="dshr-att-body">
                        <span className="dshr-att-title">{item.title}</span>
                        {item.detail !== undefined && item.detail !== '' && <span className="dshr-att-detail">{item.detail}</span>}
                      </span>
                      {item.meta !== undefined && <span className="dshr-num dshr-muted">{item.meta}</span>}
                      {clickable && <Icon name="chevron" size={11} />}
                    </Tag>
                  )
                })}
                {attention.length > 6 && (
                  <button className="dshr-linkbtn" onClick={() => setShowAll(s => !s)}>
                    {showAll ? t('common.less') : t('common.more', { n: attention.length - 6 })}
                  </button>
                )}
              </div>
            )}
          </Panel>

          <Panel title={t('rep.costParts')} hint={cost.byModel.some(m => !m.verified) ? t('rep.unverified') : undefined}>
            <Donut
              center={{ value: money(cost.cny), label: t('rep.estimate') }}
              format={money}
              parts={[
                { key: 'input', label: t('detail.inputUncached'), value: cost.parts.input, color: 'var(--dshr-c1)' },
                { key: 'output', label: t('detail.output'), value: cost.parts.output, color: 'var(--dshr-c2)' },
                { key: 'cacheRead', label: t('detail.cacheRead'), value: cost.parts.cacheRead, color: 'var(--dshr-c3)' },
                { key: 'cacheWrite', label: t('detail.cacheWrite'), value: cost.parts.cacheWrite, color: 'var(--dshr-c4)' },
              ]}
            />
            {cost.byModel.length > 0 && (
              <table className="dshr-mini-table">
                <tbody>
                  {cost.byModel.map(m => (
                    <tr key={m.model}>
                      <td title={m.model}>{m.label}</td>
                      <td className="dshr-num">{formatTokens(m.tokens)} tok</td>
                      <td className="dshr-num">{m.peakShare > 0 ? t('rep.peakShort', { pct: formatPercent(m.peakShare) }) : ''}</td>
                      <td className="dshr-num">{money(m.cny)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title={t('rep.tools')}
            hint={files.files.length > 0 ? undefined : undefined}
            actions={
              files.files.length > 0 ? (
                <button className="dshr-linkbtn" onClick={() => onTab('files')}>
                  {t('rep.filesLink', { n: files.files.length, add: files.added, del: files.removed })}
                </button>
              ) : undefined
            }
          >
            {insights.toolStats.length === 0 ? (
              <div className="dshr-empty">{t('rep.noTools')}</div>
            ) : (
              <BarList
                labelWidth={92}
                rows={insights.toolStats.slice(0, 8).map(stat => ({
                  key: stat.name,
                  label: stat.name,
                  value: stat.ms,
                  text: formatDuration(stat.ms),
                  sub: `×${stat.count}`,
                  color: 'var(--dshr-c2)',
                  failShare: stat.count > 0 ? stat.errors / stat.count : 0,
                  title: stat.errors > 0 ? t('rep.toolFailTitle', { name: stat.name, n: stat.errors, total: stat.count }) : stat.name,
                }))}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
