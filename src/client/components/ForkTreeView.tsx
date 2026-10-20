import React, { useMemo } from 'react'
import type { SessionEntry } from '../api.js'
import { shortId } from '../api.js'
import { buildForkForest, type ForkNode } from '../../core/forktree.js'
import { useI18n, type T } from '../i18n.js'
import { MascotState } from '../mascot.js'

function formatWhen(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return ''
  const date = new Date(createdAt)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function NodeCard({
  node,
  currentId,
  onSelect,
  t,
  edgeLabel,
}: {
  node: ForkNode
  currentId?: string
  onSelect: (id: string) => void
  t: T
  edgeLabel?: string
}): React.ReactElement {
  const tags: string[] = []
  if (node.header.origin === 'subagent') tags.push(t('forks.subagent'))
  else if (node.header.parentSession !== undefined && !node.orphan) tags.push(t('forks.forkTag'))
  if (node.orphan) tags.push(t('forks.orphan'))
  return (
    <button
      className="dshr-forkcard"
      data-current={node.id === currentId || undefined}
      onClick={() => onSelect(node.id)}
      title={node.title ?? node.id}
    >
      <span className="dshr-forkcard-title">
        {node.title ?? `${t('forks.untitled')} · ${formatWhen(node.header.createdAt)}`}
      </span>
      <span className="dshr-forkcard-sub">
        {edgeLabel !== undefined ? `${edgeLabel} · ` : ''}
        {node.title !== undefined ? `${formatWhen(node.header.createdAt)} · ` : ''}
        {shortId(node.id)}
        {tags.join('')}
      </span>
    </button>
  )
}

function FamilyBlock({
  node,
  currentId,
  onSelect,
  t,
  edgeLabel,
}: {
  node: ForkNode
  currentId?: string
  onSelect: (id: string) => void
  t: T
  edgeLabel?: string
}): React.ReactElement {
  return (
    <div className="dshr-family-node">
      <NodeCard node={node} currentId={currentId} onSelect={onSelect} t={t} edgeLabel={edgeLabel} />
      {node.children.map(child => (
        <div key={child.id} className="dshr-branch">
          <FamilyBlock
            node={child}
            currentId={currentId}
            onSelect={onSelect}
            t={t}
            edgeLabel={
              child.seedLength !== undefined ? t('forks.edge', { n: child.seedLength }) : undefined
            }
          />
        </div>
      ))}
    </div>
  )
}

export function ForkTreeView({
  entries,
  currentId,
  onSelect,
}: {
  entries: SessionEntry[]
  currentId?: string
  onSelect: (id: string) => void
}): React.ReactElement {
  const { t } = useI18n()
  const forest = useMemo(() => buildForkForest(entries), [entries])

  if (forest.roots.length === 0) {
    return <MascotState mood="happy" text={t('forks.empty')} />
  }

  // Families (roots with descendants) span the full width and draw their
  // tree; standalone sessions flow into a responsive card grid.
  const families = forest.roots.filter(root => root.children.length > 0)
  const singles = forest.roots.filter(root => root.children.length === 0)

  return (
    <div className="dshr-forks">
      <div className="dshr-forks-hint">{t('forks.hint')}</div>
      {families.map(root => (
        <div key={root.id} className="dshr-family">
          <FamilyBlock node={root} currentId={currentId} onSelect={onSelect} t={t} />
        </div>
      ))}
      {singles.length > 0 && (
        <div className="dshr-forkgrid">
          {singles.map(root => (
            <NodeCard key={root.id} node={root} currentId={currentId} onSelect={onSelect} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
