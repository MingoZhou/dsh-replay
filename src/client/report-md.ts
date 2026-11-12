/** Markdown summary of a session report — for pasting into an issue, a chat or a post. */
import type { AuditReport } from '../core/audit.js'
import { formatMoney, type CostEstimate, type PricingConfig } from '../core/cost.js'
import type { FileChangeReport } from '../core/files.js'
import type { Insights } from '../core/insights.js'
import { redactText, type RedactOptions } from '../core/redact.js'
import { primaryArgument, type TimelineModel } from '../core/timeline.js'
import { formatDateTime, formatDuration, formatPercent, formatTokens } from './api.js'
import { localizeFinding, type T } from './i18n.js'

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll(/\s+/gu, ' ').trim()
const code = (text: string, max = 110): string => {
  const flat = text.replaceAll(/\s+/gu, ' ').replaceAll('`', "'").trim()
  return `\`${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}\``
}

export function buildReportMarkdown(input: {
  t: T
  title: string
  model: TimelineModel
  report: AuditReport
  insights: Insights
  cost: CostEstimate
  files: FileChangeReport
  pricing: PricingConfig
  redact?: RedactOptions
}): string {
  const { t, model, report, insights, cost, files, pricing } = input
  const money = (cny: number): string => formatMoney(cny, pricing)
  const steps = model.turns.reduce((n, turn) => n + turn.steps.length, 0)
  const lines: string[] = []
  lines.push(`# ${t('md.title', { title: input.title })}`, '')
  lines.push(
    `${formatDateTime(model.startTime)} · ${model.models.join(', ') || '—'} · ${t('rep.score')} **${insights.score}/100**`,
    '',
  )
  lines.push(`| ${t('cmp.metric')} | |`, '|---|---|')
  const row = (label: string, value: string): void => void lines.push(`| ${cell(label)} | ${cell(value)} |`)
  row(t('rep.cost'), `${money(cost.cny)} (${t('rep.estimate')})`)
  row(t('rep.active'), `${formatDuration(insights.activeMs)} — ${t('rep.split.model')} ${formatDuration(insights.modelMs)}, ${t('rep.split.tool')} ${formatDuration(insights.toolMs)}`)
  row(t('rep.tokens'), t('rep.tokensSub', { in: formatTokens(model.totals.billedInput), out: formatTokens(model.totals.output) }))
  row(t('rep.cache'), formatPercent(insights.cacheHitRate))
  row(t('rep.turns'), `${model.turns.length} / ${steps}`)
  row(t('rep.calls'), `${model.toolCalls.length}${insights.failedCalls.length > 0 ? ` (${t('rep.callsFailed', { n: insights.failedCalls.length })})` : ''}`)
  lines.push('')

  const notes: string[] = []
  for (const finding of report.findings.filter(f => f.severity === 'critical' || f.severity === 'serious').slice(0, 8)) {
    notes.push(`- **${t(`sev.${finding.severity}`)}** — ${localizeFinding(t, finding)}${finding.detail ? `: ${code(finding.detail)}` : ''}`)
  }
  for (const loop of insights.loops.filter(l => l.consecutive >= 3)) {
    notes.push(`- ${t('rep.att.loop', { name: loop.name, n: loop.consecutive })} (${formatDuration(loop.totalMs)})`)
  }
  for (const turn of insights.abnormalTurns) notes.push(`- ${t('rep.att.turn', { n: turn.turn, reason: turn.reason })}`)
  if (insights.retries > 0) notes.push(`- ${t('rep.att.retries', { n: insights.retries })}`)
  if (insights.compactions > 0) notes.push(`- ${t('rep.att.compaction', { n: insights.compactions })}`)
  for (const call of insights.slowestCalls.filter(c => (c.durationMs ?? 0) >= 5000)) {
    notes.push(`- ${t('rep.att.slow', { name: call.name })} — ${formatDuration(call.durationMs ?? 0)}: ${code(primaryArgument(call))}`)
  }
  lines.push(`## ${t('rep.attention')}`, '', ...(notes.length > 0 ? notes : [`- ${t('rep.attentionEmpty')}`]), '')

  if (files.files.length > 0) {
    lines.push(`## ${t('tab.files')} (+${files.added} −${files.removed})`, '')
    for (const file of files.files.slice(0, 30)) lines.push(`- \`${file.path}\` +${file.added} −${file.removed}`)
    if (files.files.length > 30) lines.push(`- … ${files.files.length - 30}`)
    lines.push('')
  }
  if (insights.toolStats.length > 0) {
    lines.push(`## ${t('rep.tools')}`, '', `| ${t('cmp.tool')} | × | ${t('cmp.duration')} | ${t('cmp.toolErrors')} |`, '|---|---:|---:|---:|')
    for (const stat of insights.toolStats.slice(0, 12)) {
      lines.push(`| ${cell(stat.name)} | ${stat.count} | ${formatDuration(stat.ms)} | ${stat.errors} |`)
    }
    lines.push('')
  }
  lines.push('---', t('md.footer'), '')
  const text = lines.join('\n')
  return input.redact ? redactText(text, input.redact).text : text
}
