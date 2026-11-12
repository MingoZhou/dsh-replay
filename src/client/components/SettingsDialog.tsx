import React, { useState } from 'react'
import { DEFAULT_PRICING, sanitizePricing, type PricingConfig, type PricingRate, type PricingRule } from '../../core/cost.js'
import { useI18n } from '../i18n.js'
import { updateSettings, useSettings } from '../settings.js'
import { Dialog, Icon } from '../ui.js'

function Num({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  label: string
  placeholder?: string
}): React.ReactElement {
  return (
    <input
      className="dshr-input dshr-input-num"
      type="number"
      min={0}
      step="any"
      value={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      onChange={e => onChange(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
    />
  )
}

function parseHours(text: string): [number, number][] {
  return text
    .split(/[,，;]/u)
    .map(part => /^\s*(\d{1,2})\s*[-–~]\s*(\d{1,2})\s*$/u.exec(part))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => [Number(m[1]), Number(m[2])] as [number, number])
    .filter(([a, b]) => a < b && b <= 24)
}

export function SettingsDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  const { t } = useI18n()
  const saved = useSettings().pricing
  const [draft, setDraft] = useState<PricingConfig>(() => structuredClone(saved))
  const [hours, setHours] = useState(() => saved.peakHours.map(([a, b]) => `${a}-${b}`).join(', '))

  const setRule = (index: number, patch: Partial<PricingRule>): void =>
    setDraft(d => ({ ...d, rules: d.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) }))
  const setRate = (index: number, which: 'rate' | 'peak', key: keyof PricingRate, value: number | undefined): void =>
    setDraft(d => ({
      ...d,
      rules: d.rules.map((r, i) => {
        if (i !== index) return r
        const base: PricingRate = r[which] ?? { ...r.rate }
        const next = { ...base, [key]: value ?? 0 }
        if (key === 'cacheWrite' && value === undefined) delete next.cacheWrite
        return { ...r, [which]: next, verified: undefined }
      }),
    }))
  const move = (index: number, by: number): void =>
    setDraft(d => {
      const rules = [...d.rules]
      const target = index + by
      if (target < 0 || target >= rules.length) return d
      ;[rules[index], rules[target]] = [rules[target], rules[index]]
      return { ...d, rules }
    })
  const save = (): void => {
    updateSettings({ pricing: sanitizePricing({ ...draft, peakHours: parseHours(hours) }) })
    onClose()
  }

  return (
    <Dialog
      title={t('set.title')}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className="dshr-ghostbtn"
            onClick={() => {
              setDraft(structuredClone(DEFAULT_PRICING))
              setHours(DEFAULT_PRICING.peakHours.map(([a, b]) => `${a}-${b}`).join(', '))
            }}
          >
            {t('set.reset')}
          </button>
          <span className="dshr-spacer" />
          <button className="dshr-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="dshr-btn" data-primary onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="dshr-form">
        <div className="dshr-form-row">
          <span className="dshr-form-label">{t('set.currency')}</span>
          <span className="dshr-seg">
            {(['CNY', 'USD'] as const).map(c => (
              <button key={c} data-on={draft.displayCurrency === c || undefined} onClick={() => setDraft(d => ({ ...d, displayCurrency: c }))}>
                {c === 'CNY' ? '¥ CNY' : '$ USD'}
              </button>
            ))}
          </span>
          <span className="dshr-form-label">{t('set.fx')}</span>
          <Num value={draft.usdToCny} onChange={v => setDraft(d => ({ ...d, usdToCny: v ?? d.usdToCny }))} label={t('set.fx')} />
        </div>
        <div className="dshr-form-row">
          <span className="dshr-form-label">{t('set.peak')}</span>
          <input className="dshr-input" value={hours} onChange={e => setHours(e.target.value)} placeholder="9-12, 14-18" aria-label={t('set.peak')} />
          <span className="dshr-muted">UTC{draft.peakUtcOffset >= 0 ? '+' : ''}{draft.peakUtcOffset} · {t('set.peakHint')}</span>
        </div>

        <div className="dshr-pricing">
          <div className="dshr-pricing-row dshr-pricing-head">
            <span>{t('set.model')}</span>
            <span>{t('set.pattern')}</span>
            <span>{t('set.cur')}</span>
            <span>{t('detail.inputUncached')}</span>
            <span>{t('detail.cacheRead')}</span>
            <span>{t('detail.cacheWrite')}</span>
            <span>{t('detail.output')}</span>
            <span />
          </div>
          {draft.rules.map((rule, i) => (
            <div key={rule.id} className="dshr-pricing-rule">
              <div className="dshr-pricing-row">
                <input className="dshr-input" value={rule.label} onChange={e => setRule(i, { label: e.target.value })} aria-label={t('set.model')} />
                <input className="dshr-input dshr-mono" value={rule.pattern} onChange={e => setRule(i, { pattern: e.target.value })} aria-label={t('set.pattern')} />
                <select className="dshr-select" value={rule.currency} onChange={e => setRule(i, { currency: e.target.value === 'USD' ? 'USD' : 'CNY' })} aria-label={t('set.cur')}>
                  <option value="CNY">¥</option>
                  <option value="USD">$</option>
                </select>
                <Num value={rule.rate.input} onChange={v => setRate(i, 'rate', 'input', v)} label={t('detail.inputUncached')} />
                <Num value={rule.rate.cacheRead} onChange={v => setRate(i, 'rate', 'cacheRead', v)} label={t('detail.cacheRead')} />
                <Num value={rule.rate.cacheWrite} onChange={v => setRate(i, 'rate', 'cacheWrite', v)} label={t('detail.cacheWrite')} placeholder="=" />
                <Num value={rule.rate.output} onChange={v => setRate(i, 'rate', 'output', v)} label={t('detail.output')} />
                <span className="dshr-inline">
                  <button className="dshr-iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="up" title={t('set.up')}>
                    ↑
                  </button>
                  <button className="dshr-iconbtn" onClick={() => setDraft(d => ({ ...d, rules: d.rules.filter((_, k) => k !== i) }))} aria-label="remove" title={t('set.remove')}>
                    <Icon name="close" size={12} />
                  </button>
                </span>
              </div>
              <div className="dshr-pricing-row dshr-pricing-peak">
                <span className="dshr-muted">
                  {rule.verified === false && <span className="dshr-badge" data-tone="warning">{t('set.unverified')}</span>}
                </span>
                <label className="dshr-check">
                  <input
                    type="checkbox"
                    checked={rule.peak !== undefined}
                    onChange={e => setRule(i, { peak: e.target.checked ? { ...rule.rate } : undefined })}
                  />
                  {t('set.peakRate')}
                </label>
                <span />
                {rule.peak !== undefined ? (
                  <>
                    <Num value={rule.peak.input} onChange={v => setRate(i, 'peak', 'input', v)} label={`${t('set.peakRate')} ${t('detail.inputUncached')}`} />
                    <Num value={rule.peak.cacheRead} onChange={v => setRate(i, 'peak', 'cacheRead', v)} label={`${t('set.peakRate')} ${t('detail.cacheRead')}`} />
                    <Num value={rule.peak.cacheWrite} onChange={v => setRate(i, 'peak', 'cacheWrite', v)} label={`${t('set.peakRate')} ${t('detail.cacheWrite')}`} placeholder="=" />
                    <Num value={rule.peak.output} onChange={v => setRate(i, 'peak', 'output', v)} label={`${t('set.peakRate')} ${t('detail.output')}`} />
                  </>
                ) : (
                  <span className="dshr-pricing-span" />
                )}
                <span />
              </div>
            </div>
          ))}
          <button
            className="dshr-ghostbtn"
            onClick={() =>
              setDraft(d => ({
                ...d,
                rules: [
                  { id: `custom-${Date.now()}`, label: t('set.newModel'), pattern: 'my-model', currency: d.displayCurrency, rate: { input: 0, cacheRead: 0, output: 0 } },
                  ...d.rules,
                ],
              }))
            }
          >
            + {t('set.add')}
          </button>
        </div>
        <p className="dshr-note">{t('set.note')}</p>
      </div>
    </Dialog>
  )
}
