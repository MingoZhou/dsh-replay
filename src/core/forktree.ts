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
}

export function buildForkForest(entries: SessionListEntry[]): ForkForest {
  const nodes = new Map<string, ForkNode>()
  for (const { header, title } of entries) {
    nodes.set(header.id, {
      id: header.id,
      header,
      title,
      children: [],
      seedLength: header.seedLength,
      depth: 0,
      row: 0,
    })
  }
  const roots: ForkNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.header.parentSession
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
    const parentId = current.header.parentSession
    current = parentId === undefined ? undefined : forest.nodes.get(parentId)
  }
  return path
}
