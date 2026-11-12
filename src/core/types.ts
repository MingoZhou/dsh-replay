/**
 * Structural types for the DeepSeek Harness session log. Written against
 * format version 4 (harness 0.2.x) while staying tolerant of the older
 * shapes (v0 packed chunk rows, index-based surface replacement, `seedLength`).
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
  /** Legacy (≤ v2) exact inherited prefix length. */
  seedLength?: number
  /** v3+: the session carries a fork-inherited event prefix. */
  isSeeded?: boolean
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
  surfaceOp?:
    | 'append'
    /** v4 addresses replaced nodes by seq; legacy logs used surface indexes. */
    | { op: 'replace'; startSeq?: number; endSeq?: number; start?: number; end?: number }
}

/** Disjoint token counts. Billed input = input + cacheRead + cacheWrite. */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}

/** Compact timed stream record embedded in `assistant/message` / `assistant/attempt` (v4). */
export interface StreamRecord {
  type: string
  time0?: number
  time?: number
  dt?: number[]
  texts?: string[]
  chunk?: { type?: string; [key: string]: JsonValue | undefined }
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
  isError?: boolean
  toolCallId?: string
  content?: ContentBlock[]
  source?: { kind?: string; [key: string]: JsonValue | undefined }
}

/** A parsed session: header + fully decoded, seq-ordered events. */
export interface ParsedSession {
  header: SessionHeader
  events: SessionEvent[]
  /** Lines (or rows) that failed to decode — kept for diagnostics, never dropped silently. */
  malformed: { line: number; raw: string; error: string }[]
  /** Exact fork-inherited prefix length when the reader reported it. */
  inheritedEventCount?: number
}
