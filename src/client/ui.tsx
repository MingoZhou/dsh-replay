/** Shared presentational pieces: panels, stat tiles, dialog shell, icons, JSON tree, diff view. */
import React, { useEffect, useState } from 'react'
import { compactDiff, type DiffLine } from '../core/diff.js'
import type { JsonValue } from '../core/types.js'

const ICONS: Record<string, string> = {
  home: 'M2.5 7.2 8 2.6l5.5 4.6M4 6.4v6.6h8V6.4M6.6 13v-3.4h2.8V13',
  share: 'M8 10V2.6M5.2 5.2 8 2.4l2.8 2.8M3 8.6v4.6h10V8.6',
  gear: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM8 1.6v1.7M8 12.7v1.7M1.6 8h1.7M12.7 8h1.7M3.5 3.5l1.2 1.2M11.3 11.3l1.2 1.2M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2',
  play: 'M5 3.2v9.6l8-4.8-8-4.8Z',
  pause: 'M4.6 3.2v9.6M11.4 3.2v9.6',
  close: 'M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8',
  copy: 'M5.6 5.6V3h7.4v7.4h-2.6M3 5.6h7.4V13H3V5.6Z',
  fork: 'M4.4 2.6v4.2c0 1.6 1.2 2.6 3.6 2.6s3.6 1 3.6 2.6v1.4M4.4 6.8v6.6M2.8 4.2l1.6-1.6L6 4.2M10 11.8l1.6 1.6 1.6-1.6',
  chevron: 'M6 3.6 10.4 8 6 12.4',
  check: 'M3 8.4l3.2 3.2L13 4.8',
  warn: 'M8 2.4 14 13H2L8 2.4ZM8 6.6v3M8 11.2v.2',
  search: 'M7 2.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4ZM10.2 10.2 13.4 13.4',
  eyeOff: 'M2.4 2.4l11.2 11.2M6.4 6.5A2.2 2.2 0 0 0 9.5 9.6M4.3 4.5C2.9 5.4 2 6.7 1.6 8c.9 2.6 3.4 4.4 6.4 4.4 1 0 2-.2 2.8-.6M7 3.7c.3 0 .7-.1 1-.1 3 0 5.5 1.8 6.4 4.4-.3.9-.8 1.7-1.5 2.4',
  live: 'M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.600ZM4.3 4.300a5.2 5.2 0 0 0 0 7.400M11.7 4.300a5.2 5.2 0 0 1 0 7.4',
  file: 'M4 2.4h5l3 3v8.200H4V2.400ZM9 2.400v3h3',
  download: 'M8 2.600V10M5.2 7.4 8 10.200l2.8-2.800M3 12.800h10',
}

export function Icon({ name, size = 14 }: { name: keyof typeof ICONS | string; size?: number }): React.ReactElement {
  return (
    <svg className="dshr-icon" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={ICONS[name] ?? ''} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill={name === 'play' ? 'currentColor' : 'none'} />
    </svg>
  )
}

export function Panel({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode
  hint?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <section className={`dshr-panel${className ? ` ${className}` : ''}`}>
      {(title !== undefined || actions !== undefined) && (
        <header className="dshr-panel-head">
          <span className="dshr-panel-title">{title}</span>
          {hint !== undefined && <span className="dshr-panel-hint">{hint}</span>}
          <span className="dshr-spacer" />
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export interface Delta {
  /** Signed ratio vs the baseline (0.3 = 30% above). */
  ratio: number
  /** True when higher is the bad direction (cost, duration). */
  higherIsWorse: boolean
  label: string
}

export function StatTile({
  label,
  value,
  sub,
  delta,
  children,
  onClick,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  delta?: Delta
  children?: React.ReactNode
  onClick?: () => void
  tone?: 'critical' | 'warning'
}): React.ReactElement {
  const Tag = onClick ? 'button' : 'div'
  const direction = delta === undefined || Math.abs(delta.ratio) < 0.1 ? 'flat' : delta.ratio > 0 ? 'up' : 'down'
  const verdict =
    direction === 'flat' ? 'flat' : (direction === 'up') === (delta?.higherIsWorse ?? true) ? 'worse' : 'better'
  return (
    <Tag className="dshr-tile" data-tone={tone} onClick={onClick}>
      <span className="dshr-tile-label">{label}</span>
      <span className="dshr-tile-value">{value}</span>
      {sub !== undefined && <span className="dshr-tile-sub">{sub}</span>}
      {delta !== undefined && (
        <span className="dshr-delta" data-verdict={verdict} title={delta.label}>
          {direction === 'flat' ? '≈' : direction === 'up' ? '▲' : '▼'} {delta.label}
        </span>
      )}
      {children}
    </Tag>
  )
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}): React.ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className="dshr-dialog-backdrop" onClick={onClose}>
      <div className="dshr-dialog" data-wide={wide || undefined} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <header className="dshr-dialog-head">
          <span className="dshr-dialog-title">{title}</span>
          <span className="dshr-spacer" />
          <button className="dshr-iconbtn" onClick={onClose} aria-label="close">
            <Icon name="close" />
          </button>
        </header>
        <div className="dshr-dialog-body">{children}</div>
        {footer !== undefined && <footer className="dshr-dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="dshr-ghostbtn"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          },
          () => {},
        )
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
      {copied ? done : label}
    </button>
  )
}

/* ---- JSON tree ---- */

function JsonNode({ name, value, depth }: { name?: string; value: JsonValue; depth: number }): React.ReactElement {
  const isObject = typeof value === 'object' && value !== null
  const entries: [string, JsonValue][] = isObject
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value)
    : []
  const [open, setOpen] = useState(depth < 2 && entries.length <= 40)
  const [expanded, setExpanded] = useState(false)
  const label = name !== undefined ? <span className="dshr-json-key">{name}: </span> : null
  if (!isObject) {
    if (typeof value === 'string') {
      const long = value.length > 320 || value.split('\n').length > 6
      const shown = long && !expanded ? `${value.slice(0, 280)}…` : value
      return (
        <div className="dshr-json-line">
          {label}
          <span className="dshr-json-string">{shown}</span>
          {long && (
            <button className="dshr-json-more" onClick={() => setExpanded(e => !e)}>
              {expanded ? '▴' : `+${value.length - 280}`}
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="dshr-json-line">
        {label}
        <span className="dshr-json-atom">{String(value)}</span>
      </div>
    )
  }
  const brackets = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  if (entries.length === 0) {
    return (
      <div className="dshr-json-line">
        {label}
        <span className="dshr-json-atom">{brackets.join('')}</span>
      </div>
    )
  }
  return (
    <div className="dshr-json-node">
      <button className="dshr-json-toggle" data-open={open || undefined} onClick={() => setOpen(o => !o)}>
        <Icon name="chevron" size={10} />
        {label}
        <span className="dshr-json-atom">
          {brackets[0]}
          {!open && ` ${entries.length} ${brackets[1]}`}
        </span>
      </button>
      {open && (
        <div className="dshr-json-children">
          {entries.map(([key, child]) => (
            <JsonNode key={key} name={key} value={child} depth={depth + 1} />
          ))}
          <div className="dshr-json-atom">{brackets[1]}</div>
        </div>
      )}
    </div>
  )
}

export function JsonTree({ value }: { value: JsonValue }): React.ReactElement {
  return (
    <div className="dshr-json">
      <JsonNode value={value} depth={0} />
    </div>
  )
}

/* ---- diff ---- */

export function DiffView({ lines, context = 3, limit = 400 }: { lines: DiffLine[]; context?: number; limit?: number }): React.ReactElement {
  const [all, setAll] = useState(false)
  const compact = compactDiff(lines, context)
  const shown = all ? compact : compact.slice(0, limit)
  return (
    <div className="dshr-diff">
      {shown.map((line, i) =>
        line.op === '…' ? (
          <div key={i} className="dshr-diff-gap">
            ⋯ {line.text}
          </div>
        ) : (
          <div key={i} className="dshr-diff-line" data-op={line.op === '+' ? 'add' : line.op === '-' ? 'del' : 'ctx'}>
            <span className="dshr-diff-mark">{line.op === ' ' ? '' : line.op}</span>
            <span className="dshr-diff-text">{line.text === '' ? ' ' : line.text}</span>
          </div>
        ),
      )}
      {!all && compact.length > limit && (
        <button className="dshr-diff-gap" onClick={() => setAll(true)}>
          + {compact.length - limit}
        </button>
      )}
    </div>
  )
}
