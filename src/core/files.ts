/**
 * Rebuild "what did this session change on disk" from the mutating tool
 * calls in the log: `write`, `edit`, `apply_patch` (harness tool-fs) and the
 * common aliases other tool sets use. Diffs come from the call arguments, so
 * they show what the model asked for; a failed call is kept and flagged.
 */
import { diffLines, diffStat, type DiffLine } from './diff.js'
import type { TimelineModel, ToolCallInfo } from './timeline.js'

export type FileOpKind = 'create' | 'write' | 'edit' | 'delete' | 'move'

export interface FileOp {
  kind: FileOpKind
  seq: number
  time: number
  tool: string
  turn?: number
  added: number
  removed: number
  lines: DiffLine[]
  failed: boolean
  /** Destination for a move. */
  movedTo?: string
}

export interface FileChange {
  path: string
  ops: FileOp[]
  added: number
  removed: number
  /** Net state after the last successful op. */
  status: 'created' | 'modified' | 'deleted'
}

export interface FileChangeReport {
  files: FileChange[]
  added: number
  removed: number
  ops: number
}

const WRITE = /^(write|write_file|create_file|fs_write)$/iu
const EDIT = /^(edit|edit_file|str_replace|str_replace_editor|str_replace_based_edit_tool)$/iu
const PATCH = /^apply_patch$/iu

function s(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function pathOf(args: Record<string, unknown>): string | undefined {
  return s(args['file_path']) ?? s(args['path']) ?? s(args['filePath']) ?? s(args['filename'])
}

interface PatchFile {
  kind: FileOpKind
  path: string
  movedTo?: string
  lines: DiffLine[]
}

/** Parse the `*** Begin Patch` envelope used by `apply_patch`. */
export function parsePatch(input: string): PatchFile[] {
  const files: PatchFile[] = []
  let current: PatchFile | undefined
  for (const raw of input.split('\n')) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/u.exec(raw)
    if (header) {
      current = {
        kind: header[1] === 'Add' ? 'create' : header[1] === 'Delete' ? 'delete' : 'edit',
        path: header[2].trim(),
        lines: [],
      }
      files.push(current)
      continue
    }
    if (current === undefined) continue
    const move = /^\*\*\* Move to: (.+)$/u.exec(raw)
    if (move) {
      current.movedTo = move[1].trim()
      current.kind = 'move'
      continue
    }
    if (raw.startsWith('*** ') || raw.startsWith('@@')) continue
    if (raw.startsWith('+')) current.lines.push({ op: '+', text: raw.slice(1) })
    else if (raw.startsWith('-')) current.lines.push({ op: '-', text: raw.slice(1) })
    else if (raw.startsWith(' ')) current.lines.push({ op: ' ', text: raw.slice(1) })
  }
  return files
}

function opsOf(call: ToolCallInfo): { path: string; op: Omit<FileOp, 'seq' | 'time' | 'tool' | 'turn' | 'failed'> }[] {
  const args = (call.args ?? {}) as Record<string, unknown>
  if (PATCH.test(call.name)) {
    const input = s(args['input']) ?? s(args['patch']) ?? ''
    return parsePatch(input).map(file => {
      const stat = diffStat(file.lines)
      return { path: file.path, op: { kind: file.kind, lines: file.lines, movedTo: file.movedTo, ...stat } }
    })
  }
  const path = pathOf(args)
  if (path === undefined) return []
  if (WRITE.test(call.name)) {
    const content = s(args['content']) ?? s(args['text']) ?? ''
    const lines: DiffLine[] = (content === '' ? [] : content.replace(/\n$/u, '').split('\n')).map(text => ({ op: '+', text }))
    return [{ path, op: { kind: 'write', lines, added: lines.length, removed: 0 } }]
  }
  if (EDIT.test(call.name)) {
    const before = s(args['old_string']) ?? s(args['old_str']) ?? s(args['old']) ?? ''
    const after = s(args['new_string']) ?? s(args['new_str']) ?? s(args['new']) ?? ''
    const lines = diffLines(before, after)
    return [{ path, op: { kind: 'edit', lines, ...diffStat(lines) } }]
  }
  return []
}

export function collectFileChanges(model: Pick<TimelineModel, 'toolCalls'>): FileChangeReport {
  const byPath = new Map<string, FileChange>()
  let ops = 0
  for (const call of model.toolCalls) {
    for (const { path, op } of opsOf(call)) {
      ops++
      let file = byPath.get(path)
      if (file === undefined) {
        file = { path, ops: [], added: 0, removed: 0, status: 'modified' }
        byPath.set(path, file)
      }
      const failed = call.failed === true
      // The first successful whole-file write with no earlier op is treated as a creation.
      const kind: FileOpKind = op.kind === 'write' && file.ops.every(o => o.failed) ? 'create' : op.kind
      file.ops.push({ ...op, kind, seq: call.callSeq, time: call.callTime, tool: call.name, turn: call.turn, failed })
      if (failed) continue
      file.added += op.added
      file.removed += op.removed
      if (kind === 'delete') file.status = 'deleted'
      else if (kind === 'create') file.status = 'created'
      else if (file.status === 'deleted') file.status = 'modified'
    }
  }
  const files = [...byPath.values()].sort((a, b) => b.added + b.removed - (a.added + a.removed) || a.path.localeCompare(b.path))
  return {
    files,
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0),
    ops,
  }
}
