/** A tiny format-v0 log (packed chunk rows, index-based replace, `seedLength`) kept to prove old logs still read. */
const T = 1_755_100_000_000
const lines: Record<string, unknown>[] = [
  { type: 'session', version: 0, id: 'legacy-1', createdAt: T, cwd: '/tmp/x', parentSession: 'legacy-0', seedLength: 3 },
  { type: 'request/context', seq: 0, time: T, data: { provider: 'deepseek', model: 'deepseek-v4', contextWindow: 128_000 } },
  { type: 'turn/start', seq: 1, time: T + 1000, data: { turn: 1 } },
  { type: 'user/message', seq: 2, time: T + 1050, data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } }, surfaceOp: 'append' },
  { type: 'step/start', seq: 3, time: T + 1400, data: { turn: 1, step: 1 } },
  { type: 'text-chunks', seq0: 4, time0: T + 2000, data: { turn: 1, step: 1, index: 0, dt: [140, 220], texts: ['a', 'b', 'c'] } },
  { type: 'tool/call', seq: 7, time: T + 3000, data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{"command":"ls"}' } },
  { type: 'tool/result', seq: 8, time: T + 3500, data: { turn: 1, step: 1, message: { id: 'r1', role: 'user', content: [{ type: 'tool_result', text: 'file.txt' }], source: { kind: 'tool', callId: 'c1' } }, error: { name: 'ToolExecutionError', code: 'EXIT_1' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 9, time: T + 4200, data: { turn: 1, step: 1, message: { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'abc' }], source: { kind: 'model', model: 'deepseek-v4' } }, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50 } }, surfaceOp: 'append' },
  { type: 'compaction/summary', seq: 10, time: T + 4300, data: {}, surfaceOp: { op: 'replace', start: 0, end: 1 } },
  { type: 'step/end', seq: 11, time: T + 4400, data: { turn: 1, step: 1 } },
  { type: 'turn/end', seq: 12, time: T + 4500, data: { turn: 1, reason: { kind: 'completed' } } },
]
export const LEGACY_JSONL = lines.map(l => JSON.stringify(l)).join('\n') + '\n'
