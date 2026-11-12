/**
 * Build the session lineage forest from headers (`parentSession` +
 * `seedLength`), the durable fork/resume metadata the harness keeps
 * out-of-log. Produces a forest plus a deterministic tidy layout
 * (depth = x, DFS row = y) the SVG view renders directly.
 */
import type { SessionHeader } from './types.js'

export interface ForkNode {
  id: string
  header: SessionHeader
  title?: string
  children: ForkNode[]
  /** Inclusive source event count inherited from the parent (undefined for roots). */
  seedLength?: number
  depth: number
  /** Row index assigned by DFS layout. */
  row: number
  /** True when parentSession points at a header we never saw. */
  orphan?: boolean
  /** Parent this node hangs under (header lineage, or inferred for v3+ forks). */
  parentId?: string
  /** True when the edge was inferred from a shared first prompt, not read from the header. */
  inferred?: boolean
}

export interface ForkForest {
  roots: ForkNode[]
  nodes: Map<string, ForkNode>
  rowCount: number
  maxDepth: number
}

export interface SessionListEntry {
  header: SessionHeader
  title?: string
  /**
   * Identity of the session's first user message. Since format v3 an ordinary
   * fork no longer records `parentSession`, but it inherits its source's
   * events verbatim — so forks of one conversation share this key.
   */
  rootKey?: string
  /** Exact inherited prefix length, when the reader reported it. */
  inheritedEventCount?: number
}

/**
 * Infer a parent for seeded sessions whose header carries none: the oldest
 * non-seeded session sharing the same first prompt (else the oldest member).
 */
export function inferForkParents(entries: SessionListEntry[]): Map<string, string> {
  const families = new Map<string, SessionListEntry[]>()
  for (const entry of entries) {
    if (entry.rootKey === undefined || entry.header.origin === 'subagent') continue
    const list = families.get(entry.rootKey) ?? []
    list.push(entry)
    families.set(entry.rootKey, list)
  }
  const parents = new Map<string, string>()
  for (const family of families.values()) {
    if (family.length < 2) continue
    const byAge = [...family].sort((a, b) => a.header.createdAt - b.header.createdAt)
    const root = byAge.find(e => e.header.isSeeded !== true && e.header.seedLength === undefined) ?? byAge[0]
    for (const entry of family) {
      if (entry === root || entry.header.parentSession !== undefined) continue
      parents.set(entry.header.id, root.header.id)
    }
  }
  return parents
}

export function buildForkForest(entries: SessionListEntry[]): ForkForest {
  const nodes = new Map<string, ForkNode>()
  const inferred = inferForkParents(entries)
  for (const { header, title, inheritedEventCount } of entries) {
    const inferredParent = header.parentSession === undefined ? inferred.get(header.id) : undefined
    nodes.set(header.id, {
      id: header.id,
      header,
      title,
      children: [],
      seedLength: header.seedLength ?? (inheritedEventCount !== undefined && inheritedEventCount > 0 ? inheritedEventCount : undefined),
      depth: 0,
      row: 0,
      parentId: header.parentSession ?? inferredParent,
      inferred: inferredParent !== undefined || undefined,
    })
  }
  const roots: ForkNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.parentId
    if (parentId === undefined) {
      roots.push(node)
      continue
    }
    const parent = nodes.get(parentId)
    if (parent === undefined) {
      node.orphan = true
      roots.push(node)
    } else {
      parent.children.push(node)
    }
  }
  const byCreated = (a: ForkNode, b: ForkNode): number =>
    a.header.createdAt - b.header.createdAt || a.id.localeCompare(b.id)
  roots.sort(byCreated)
  for (const node of nodes.values()) node.children.sort(byCreated)

  // Cycle guard (corrupt lineage should degrade, not hang): DFS with visited set.
  let row = 0
  let maxDepth = 0
  const visited = new Set<string>()
  const assign = (node: ForkNode, depth: number): void => {
    if (visited.has(node.id)) return
    visited.add(node.id)
    node.depth = depth
    node.row = row++
    maxDepth = Math.max(maxDepth, depth)
    for (const child of node.children) assign(child, depth + 1)
  }
  for (const root of roots) assign(root, 0)
  // Lineage cycles have no root: promote one unvisited member per cycle.
  for (const node of nodes.values()) {
    if (!visited.has(node.id)) {
      node.orphan = true
      roots.push(node)
      assign(node, 0)
    }
  }
  return { roots, nodes, rowCount: row, maxDepth }
}

/** Path from root to the given session (inclusive), for breadcrumbs. */
export function lineageOf(forest: ForkForest, id: string): ForkNode[] {
  const path: ForkNode[] = []
  let current = forest.nodes.get(id)
  const guard = new Set<string>()
  while (current !== undefined && !guard.has(current.id)) {
    guard.add(current.id)
    path.unshift(current)
    const parentId = current.parentId
    current = parentId === undefined ? undefined : forest.nodes.get(parentId)
  }
  return path
}
