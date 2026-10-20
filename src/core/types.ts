/**
 * Structural types for the DeepSeek Harness session log (format version 0).
 *
 * These are intentionally *structural* copies of the shapes in
 * `@deepseek-ai/dsh-session` — the core analysis layer has zero runtime
 * dependencies on harness packages so it can run in the browser, in tests,
 * and inside the host plugin alike. Field names track the upstream
 * vocabulary exactly; unknown event types are preserved untyped.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/** Session header — line 1 of a JSONL log / `sessions` row in SQLite. */
export interface SessionHeader {
  version?: number
  id: string
  createdAt: number
  cwd?: string
  parentSession?: string
  seedLength?: number
  origin?: 'subagent'
  delegationDepth?: number
  agentPreset?: string
}

/** The event envelope. `seq` is contiguous and monotonic from 0. */
export interface SessionEvent {
  type: string
  seq: number
  time: number
  data: JsonValue
  ignorable?: true
  sourceEventSeqs?: number[]
  surfaceOp?: 'append' | { op: 'replace'; start: number; end: number }
}

/** Disjoint token counts. Billed input = input + cacheRead + cacheWrite. */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/** Packed chunk rows — the one wire shape that is not a SessionEvent. */
export interface ChunkRowBase {
  type: 'text-chunks' | 'reasoning-chunks' | 'tool-call-chunks'
  seq0: number
  time0: number
  data: {
    turn: number
    step: number
    index: number
    dt: number[]
    texts?: string[]
    id?: string
    name?: string
    args?: string[]
  }
}

export type StorageRecord = SessionEvent | ChunkRowBase

export interface ContentBlock {
  type: string
  text?: string
  [key: string]: JsonValue | undefined
}

export interface MessageLike {
  id?: string
  role?: string
  content?: ContentBlock[]
  source?: { kind?: string; [key: string]: JsonValue | undefined }
}

/** A parsed session: header + fully decoded, seq-ordered events. */
export interface ParsedSession {
  header: SessionHeader
  events: SessionEvent[]
  /** Lines (or rows) that failed to decode — kept for diagnostics, never dropped silently. */
  malformed: { line: number; raw: string; error: string }[]
}
