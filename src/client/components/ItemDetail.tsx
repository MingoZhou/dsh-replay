<<<<<<< HEAD
import React, { useState } from 'react'
=======
import React from 'react'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
import type { TimelineItem, TimelineModel } from '../../core/timeline.js'
import { formatClock, formatDuration, formatTokens } from '../api.js'
import { useI18n } from '../i18n.js'

const KIND_COLOR: Record<string, string> = {
  user: 'var(--dshr-s-user)',
  assistant: 'var(--dshr-s-assistant)',
  tool: 'var(--dshr-s-tool)',
  meta: 'var(--dshr-s-meta)',
}

<<<<<<< HEAD
function CopyButton({ text }: { text: string }): React.ReactElement {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button className="dshr-copy-btn" onClick={copy} type="button">
      {copied ? t('detail.copied') : t('detail.copy')}
    </button>
  )
}

=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
export function ItemDetail({
  item,
  model,
}: {
  item: TimelineItem
  model: TimelineModel
}): React.ReactElement {
  const { t } = useI18n()
  const usage = item.usage
  return (
    <div>
      <h3>
        <span className="dshr-badge" style={{ background: KIND_COLOR[item.kind] }}>
          {t(`kind.${item.kind}`)}
        </span>
        {item.kind === 'tool' ? item.toolCall?.name : item.type}
        {item.shadowed && (
          <span className="dshr-badge" style={{ background: 'var(--dshr-s-meta)' }}>
            {t('detail.shadowed')}
          </span>
        )}
      </h3>
      <div className="dshr-detail-meta">
        seq {item.seq} · t+{formatClock(item.time, model.startTime)}
        {item.turn !== undefined && ` · turn ${item.turn}`}
        {item.step !== undefined && ` · step ${item.step}`}
      </div>

<<<<<<< HEAD
      {item.reasoningText !== undefined && item.reasoningText !== '' && (
        <details className="dshr-reasoning">
          <summary>{t('detail.reasoning')}</summary>
          <pre className="dshr-pre">{item.reasoningText}</pre>
        </details>
      )}

      {item.text !== undefined && item.text !== '' && (
        <>
          <div className="dshr-section-label">
            {t('detail.message')}
            <CopyButton text={item.text} />
          </div>
=======
      {item.text !== undefined && item.text !== '' && (
        <>
          <div className="dshr-section-label">{t('detail.message')}</div>
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
          <pre className="dshr-pre">{item.text}</pre>
        </>
      )}

      {item.toolCall && (
        <>
          <dl className="dshr-kv">
            <dt>{t('detail.callId')}</dt>
            <dd>{item.toolCall.callId}</dd>
            <dt>{t('detail.duration')}</dt>
            <dd>
              {item.toolCall.durationMs !== undefined
                ? formatDuration(item.toolCall.durationMs)
                : t('detail.noResult')}
            </dd>
            {item.toolCall.error && (
              <>
                <dt>{t('detail.error')}</dt>
                <dd>
                  {item.toolCall.error.name} ({item.toolCall.error.code})
                </dd>
              </>
            )}
          </dl>
<<<<<<< HEAD
          <div className="dshr-section-label">
            {t('detail.arguments')}
            <CopyButton text={item.toolCall.argumentsPretty ?? item.toolCall.argumentsRaw} />
          </div>
          <pre className="dshr-pre">{item.toolCall.argumentsPretty ?? item.toolCall.argumentsRaw}</pre>
          {item.toolCall.resultText !== undefined && item.toolCall.resultText !== '' && (
            <>
              <div className="dshr-section-label">
                {t('detail.result')}
                <CopyButton text={item.toolCall.resultText} />
              </div>
=======
          <div className="dshr-section-label">{t('detail.arguments')}</div>
          <pre className="dshr-pre">{item.toolCall.argumentsPretty ?? item.toolCall.argumentsRaw}</pre>
          {item.toolCall.resultText !== undefined && item.toolCall.resultText !== '' && (
            <>
              <div className="dshr-section-label">{t('detail.result')}</div>
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
              <pre className="dshr-pre">{item.toolCall.resultText}</pre>
            </>
          )}
        </>
      )}

      {usage && (
        <>
          <div className="dshr-section-label">{t('detail.usage')}</div>
          <dl className="dshr-kv">
            <dt>{t('detail.inputUncached')}</dt>
            <dd>{formatTokens(usage.inputTokens)}</dd>
            {usage.cacheReadTokens !== undefined && (
              <>
                <dt>{t('detail.cacheRead')}</dt>
                <dd>{formatTokens(usage.cacheReadTokens)}</dd>
              </>
            )}
            {usage.cacheWriteTokens !== undefined && (
              <>
                <dt>{t('detail.cacheWrite')}</dt>
                <dd>{formatTokens(usage.cacheWriteTokens)}</dd>
              </>
            )}
            <dt>{t('detail.output')}</dt>
            <dd>{formatTokens(usage.outputTokens)}</dd>
            {usage.reasoningTokens !== undefined && (
              <>
                <dt>{t('detail.reasoning')}</dt>
                <dd>{formatTokens(usage.reasoningTokens)}</dd>
              </>
            )}
          </dl>
        </>
      )}

      {item.kind === 'meta' && (
        <>
          <div className="dshr-section-label">{t('detail.eventData')}</div>
          <pre className="dshr-pre">{JSON.stringify(item.event.data, null, 2)}</pre>
        </>
      )}
    </div>
  )
}
