/**
 * Decode a DeepSeek Harness session log (JSONL text or pre-parsed records)
 * into a `ParsedSession`: header + flat, seq-ordered `SessionEvent[]`.
 *
 * Handles the two wire realities documented in the harness:
 *  - the header line (`type: 'session'`) is not an event;
 *  - runs of streaming chunks may be packed into `*-chunks` rows
 *    (`seq0`/`time0`/`dt[]`) that expand back into `assistant/chunk` events.
 *
 * A torn final line (crash tail without newline) is tolerated and reported
 * in `malformed`, mirroring the harness's own committed-bytes semantics.
 */
import type {
  ChunkRowBase,
  ParsedSession,
  SessionEvent,
  SessionHeader,
  StorageRecord,
} from './types.js'

const CHUNK_ROW_TYPES = new Set(['text-chunks', 'reasoning-chunks', 'tool-call-chunks'])

export function isChunkRow(record: StorageRecord): record is ChunkRowBase {
  return CHUNK_ROW_TYPES.has(record.type)
}

/** Expand one packed chunk row into its constituent `assistant/chunk` events. */
export function expandChunkRow(row: ChunkRowBase): SessionEvent[] {
  const { seq0, time0, data } = row
  const { turn, step, index, dt } = data
  const events: SessionEvent[] = []
  const count = (row.type === 'tool-call-chunks' ? data.args?.length : data.texts?.length) ?? 0
  let time = time0
  for (let k = 0; k < count; k++) {
    if (k > 0) time += dt[k - 1] ?? 0
    let chunk: Record<string, unknown>
    if (row.type === 'text-chunks') {
      chunk = { type: 'text-delta', index, text: data.texts![k] }
    } else if (row.type === 'reasoning-chunks') {
      chunk = { type: 'reasoning-delta', index, text: data.texts![k] }
    } else {
      chunk = {
        type: 'tool-call-delta',
        index,
        id: data.id,
        ...(k === 0 && data.name !== undefined ? { name: data.name } : {}),
        args: data.args![k],
      }
    }
    events.push({
      type: 'assistant/chunk',
      seq: seq0 + k,
      time,
      data: { turn, step, chunk } as SessionEvent['data'],
    })
  }
  return events
}

/** Decode one storage record (already JSON.parsed) into 0..n events. */
export function decodeStorageRecord(record: StorageRecord): SessionEvent[] {
  if (isChunkRow(record)) return expandChunkRow(record)
  return [record]
}

function isHeaderLine(value: Record<string, unknown>): boolean {
  return value['type'] === 'session' && typeof value['id'] === 'string'
}

/**
 * Parse raw JSONL text (uncompressed). The first line must be the session
 * header; every further line is a `StorageRecord`.
 */
export function parseSessionJsonl(text: string): ParsedSession {
  const lines = text.split('\n')
  const malformed: ParsedSession['malformed'] = []
  let header: SessionHeader | undefined
  const events: SessionEvent[] = []
  const endsWithNewline = text.endsWith('\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') continue
    const isLastLine = i === lines.length - 1
    let value: Record<string, unknown>
    try {
      value = JSON.parse(raw) as Record<string, unknown>
    } catch (error) {
      if (isLastLine && !endsWithNewline) {
        malformed.push({ line: i + 1, raw, error: 'torn tail (uncommitted final record)' })
      } else {
        malformed.push({ line: i + 1, raw, error: String(error) })
      }
      continue
    }
    if (header === undefined) {
      if (!isHeaderLine(value)) {
        malformed.push({ line: i + 1, raw, error: 'expected session header line' })
        continue
      }
      header = value as unknown as SessionHeader
      continue
    }
    try {
      events.push(...decodeStorageRecord(value as unknown as StorageRecord))
    } catch (error) {
      malformed.push({ line: i + 1, raw, error: String(error) })
    }
  }

  if (header === undefined) {
    throw new Error('session log has no header line')
  }
  events.sort((a, b) => a.seq - b.seq)
  return { header, events, malformed }
}

/** Build a ParsedSession from an already-materialized header + events (e.g. an API response). */
export function fromInspection(
  header: SessionHeader,
  records: StorageRecord[],
): ParsedSession {
  const events = records.flatMap(decodeStorageRecord).sort((a, b) => a.seq - b.seq)
  return { header, events, malformed: [] }
}
