import React, { useMemo, useState } from 'react'
import { SHELL_TOOLS } from '../../core/audit.js'
import { bucketOf, formatMoney, priceBucket, type PricingConfig } from '../../core/cost.js'
import { collectFileChanges } from '../../core/files.js'
import type { TimelineItem, TimelineModel } from '../../core/timeline.js'
import type { JsonValue } from '../../core/types.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { useI18n } from '../i18n.js'
import { Markdown } from '../md.js'
import { CopyButton, DiffView, Icon, JsonTree } from '../ui.js'

function LongText({ text, lines = 40 }: { text: string; lines?: number }): React.ReactElement {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const all = text.split('\n')
  const long = all.length > lines || text.length > 6000
  const shown = !long || open ? text : all.slice(0, lines).join('\n').slice(0, 6000)
  return (
    <>
      <pre className="dshr-pre">{shown}</pre>
      {long && (
        <button className="dshr-linkbtn" onClick={() => setOpen(o => !o)}>
          {open ? t('common.less') : t('detail.showAll', { n: all.length })}
        </button>
      )}
    </>
  )
}

function Section({
  label,
  children,
  actions,
  defaultOpen = true,
}: {
  label: string
  children: React.ReactNode
  actions?: React.ReactNode
  defaultOpen?: boolean
}): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="dshr-section">
      <div className="dshr-section-head">
        <button className="dshr-section-label" data-open={open || undefined} onClick={() => setOpen(o => !o)}>
          <Icon name="chevron" size={10} />
          {label}
        </button>
        <span className="dshr-spacer" />
        {open && actions}
      </div>
      {open && children}
    </div>
  )
}

export function ItemDetail({
  item,
  model,
  pricing,
  onFork,
}: {
  item: TimelineItem
  model: TimelineModel
  pricing: PricingConfig
  /** Present only inside a running harness. */
  onFork?: (seq: number) => void
}): React.ReactElement {
  const { t } = useI18n()
  const [raw, setRaw] = useState(false)
  const usage = item.usage
  const call = item.toolCall
  const copyLabels = { label: t('common.copy'), done: t('common.copied') }
  const fileOps = useMemo(() => (call ? collectFileChanges({ toolCalls: [call] }).files : []), [call])
  const stepCost = useMemo(() => {
    if (!usage) return undefined
    const priced = priceBucket(bucketOf(usage, item.model ?? model.models[0], item.time, pricing), pricing)
    if (!priced) return undefined
    return priced.parts.input + priced.parts.cacheRead + priced.parts.cacheWrite + priced.parts.output
  }, [usage, item, model, pricing])
  const command = call && SHELL_TOOLS.test(call.name) && typeof call.args?.['command'] === 'string' ? (call.args['command'] as string) : undefined

  return (
    <div className="dshr-detail-inner">
      <div className="dshr-detail-head">
        <span className="dshr-badge" data-kind={item.kind}>
          {t(`kind.${item.kind}`)}
        </span>
        <span className="dshr-detail-name">{call ? call.name : item.type}</span>
        {call?.failed && (
          <span className="dshr-badge" data-tone="critical">
            <Icon name="warn" size={11} /> {t('detail.failed')}
          </span>
        )}
        {item.shadowed && <span className="dshr-badge">{t('detail.shadowed')}</span>}
        <span className="dshr-spacer" />
        <CopyButton text={`#${item.seq}`} label={`#${item.seq}`} done={t('common.copied')} />
        {onFork !== undefined && (
          <button className="dshr-ghostbtn" onClick={() => onFork(item.seq)} title={t('detail.forkTitle')}>
            <Icon name="fork" size={12} />
            {t('detail.fork')}
          </button>
        )}
      </div>
      <div className="dshr-detail-meta">
        t+{formatClock(item.time, model.startTime)}
        {item.turn !== undefined && ` · ${t('tl.turn', { n: item.turn })}`}
        {item.step !== undefined && ` / ${item.step}`}
        {item.model !== undefined && ` · ${item.model}`}
        {call?.durationMs !== undefined && ` · ${formatDuration(call.durationMs)}`}
      </div>

      {item.reasoningText !== undefined && (
        <Section label={t('detail.reasoning')} defaultOpen={item.text === undefined || item.text === ''}>
          <div className="dshr-reasoning">
            <Markdown text={item.reasoningText} />
          </div>
        </Section>
      )}

      {item.text !== undefined && item.text !== '' && (
        <Section
          label={t('detail.message')}
          actions={
            <>
              <button className="dshr-ghostbtn" onClick={() => setRaw(r => !r)}>
                {raw ? t('detail.rendered') : t('detail.raw')}
              </button>
              <CopyButton text={item.text} {...copyLabels} />
            </>
          }
        >
          {raw ? <LongText text={item.text} lines={80} /> : <Markdown text={item.text} />}
        </Section>
      )}

      {call && (
        <>
          {fileOps.length > 0 ? (
            fileOps.map(file => (
              <Section
                key={file.path}
                label={file.path}
                actions={
                  <span className="dshr-diffstat">
                    <span data-op="add">+{file.ops[0].added}</span>
                    <span data-op="del">−{file.ops[0].removed}</span>
                  </span>
                }
              >
                <DiffView lines={file.ops[0].lines} limit={200} />
              </Section>
            ))
          ) : command !== undefined ? (
            <Section label={t('detail.command')} actions={<CopyButton text={command} {...copyLabels} />}>
              <pre className="dshr-code">{command}</pre>
            </Section>
          ) : null}
          <Section
            label={t('detail.arguments')}
            defaultOpen={fileOps.length === 0 && command === undefined}
            actions={<CopyButton text={call.argumentsPretty ?? call.argumentsRaw} {...copyLabels} />}
          >
            {call.args !== undefined ? <JsonTree value={call.args as JsonValue} /> : <LongText text={call.argumentsRaw} />}
          </Section>
          <Section
            label={call.failed ? t('detail.error') : t('detail.result')}
            actions={call.resultText ? <CopyButton text={call.resultText} {...copyLabels} /> : undefined}
          >
            {call.resultSeq === undefined ? (
              <div className="dshr-empty">{t('detail.noResult')}</div>
            ) : (
              <>
                {call.error !== undefined && (
                  <div className="dshr-errorline">
                    {call.error.name} · {call.error.code}
                    {call.error.reason !== undefined && ` — ${call.error.reason}`}
                  </div>
                )}
                {call.resultText ? <LongText text={call.resultText} /> : <div className="dshr-empty">{t('detail.emptyResult')}</div>}
              </>
            )}
          </Section>
        </>
      )}

      {usage && (
        <Section label={t('detail.usage')}>
          <dl className="dshr-kv">
            <dt>{t('detail.inputUncached')}</dt>
            <dd>{formatTokens(usage.inputTokens ?? 0)}</dd>
            <dt>{t('detail.cacheRead')}</dt>
            <dd>{formatTokens(usage.cacheReadTokens ?? 0)}</dd>
            <dt>{t('detail.cacheWrite')}</dt>
            <dd>{formatTokens(usage.cacheWriteTokens ?? 0)}</dd>
            <dt>{t('detail.output')}</dt>
            <dd>{formatTokens(usage.outputTokens ?? 0)}</dd>
            {usage.reasoningTokens !== undefined && (
              <>
                <dt>└ {t('detail.reasoningTokens')}</dt>
                <dd>{formatTokens(usage.reasoningTokens)}</dd>
              </>
            )}
            {stepCost !== undefined && (
              <>
                <dt>{t('detail.stepCost')}</dt>
                <dd>{formatMoney(stepCost, pricing)}</dd>
              </>
            )}
          </dl>
        </Section>
      )}

      <Section label={t('detail.eventData')} defaultOpen={item.kind === 'meta' && (item.text === undefined || item.text === '')}>
        <JsonTree value={item.event.data} />
      </Section>
    </div>
  )
}
