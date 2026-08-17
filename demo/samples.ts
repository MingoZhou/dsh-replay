/**
 * Realistic sample session logs in the harness wire format (format version 0),
 * used by the demo page and the test suite. Three sessions:
 *  A — root session with tool calls, approvals, a failing test run, packed
 *      chunk rows, and a couple of audit-worthy commands;
 *  B — a fork of A at the end of turn 1 (parentSession + seedLength +
 *      session/end-seed marker), continuing differently;
 *  C — a subagent session doing web research.
 */

const B0 = 1_755_100_000_000

type Line = Record<string, unknown>

function jsonl(lines: Line[]): string {
  return lines.map(l => JSON.stringify(l)).join('\n') + '\n'
}

function user(seq: number, time: number, id: string, text: string): Line {
  return {
    type: 'user/message', seq, time,
    data: { id, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } },
    surfaceOp: 'append',
  }
}

function assistant(
  seq: number, time: number, turn: number, step: number, id: string, text: string,
  usage: Record<string, number>,
): Line {
  return {
    type: 'assistant/message', seq, time,
    data: {
      turn, step,
      message: {
        id, role: 'assistant', content: [{ type: 'text', text }],
        source: { kind: 'model', provider: 'deepseek', model: 'deepseek-v4' },
      },
      usage,
    },
    surfaceOp: 'append',
  }
}

function toolCall(seq: number, time: number, turn: number, step: number, callId: string, name: string, args: unknown): Line {
  return {
    type: 'tool/call', seq, time,
    data: { turn, step, callId, name, arguments: JSON.stringify(args) },
  }
}

function toolResult(
  seq: number, time: number, turn: number, step: number, callId: string, text: string,
  error?: { name: string; code: string },
): Line {
  return {
    type: 'tool/result', seq, time,
    data: {
      turn, step,
      message: {
        id: `msg-${callId}-result`, role: 'user',
        content: [{ type: 'tool_result', text }],
        source: { kind: 'tool', callId },
      },
      ...(error ? { error } : {}),
    },
    surfaceOp: 'append',
  }
}

export const SESSION_A_ID = 'a7f3c2d1-4b5e-4a6f-8c9d-0e1f2a3b4c5d'
export const SESSION_B_ID = 'b8e4d3c2-5c6f-4b7a-9d0e-1f2a3b4c5d6e'
export const SESSION_C_ID = 'c9f5e4d3-6d7a-4c8b-a0e1-2f3a4b5c6d7e'
export const SESSION_D_ID = 'd0a6f5e4-7e8b-4d9c-b1f2-3a4b5c6d7e8f'

/** Events 0..15 of session A — also the seed a fork inherits verbatim. */
function turnOneEvents(): Line[] {
  return [
    { type: 'request/header', seq: 0, time: B0, data: { header: { config: { model: 'deepseek-v4' } }, reason: 'initial' } },
    { type: 'request/context', seq: 1, time: B0, data: { provider: 'deepseek', model: 'deepseek-v4', contextWindow: 128_000 } },
    { type: 'turn/start', seq: 2, time: B0 + 1_000, data: { turn: 1 } },
    user(3, B0 + 1_050, 'msg-u1', 'Build me a small REST API in Express with tests. Keep it minimal.'),
    { type: 'step/start', seq: 4, time: B0 + 1_400, data: { turn: 1, step: 1 } },
    // packed chunk row: occupies seqs 5,6,7
    {
      type: 'text-chunks', seq0: 5, time0: B0 + 2_000,
      data: { turn: 1, step: 1, index: 0, dt: [140, 220], texts: ["I'll scaffold the project", ' first, then add routes', ' and a test suite.'] },
    },
    assistant(8, B0 + 4_200, 1, 1, 'msg-a1',
      "I'll scaffold the project first, then add routes and a test suite.",
      { inputTokens: 1_240, outputTokens: 184, cacheReadTokens: 0, cacheWriteTokens: 900 }),
    { type: 'step/end', seq: 9, time: B0 + 4_250, data: { turn: 1, step: 1 } },
    { type: 'step/start', seq: 10, time: B0 + 4_300, data: { turn: 1, step: 2 } },
    toolCall(11, B0 + 4_350, 1, 2, 'call_1', 'bash', { command: 'mkdir -p api && cd api && npm init -y && npm i express supertest jest' }),
    toolResult(12, B0 + 21_000, 1, 2, 'call_1', 'added 214 packages in 16s'),
    assistant(13, B0 + 24_000, 1, 2, 'msg-a2',
      'Project scaffolded. Wrote server.js with a health route and user CRUD, plus jest config.',
      { inputTokens: 460, outputTokens: 342, cacheReadTokens: 1_180, cacheWriteTokens: 300 }),
    { type: 'step/end', seq: 14, time: B0 + 24_050, data: { turn: 1, step: 2 } },
    { type: 'turn/end', seq: 15, time: B0 + 24_100, data: { turn: 1, reason: { kind: 'completed' } } },
  ]
}

export function sessionA(): string {
  const header: Line = {
    type: 'session', version: 0, id: SESSION_A_ID, createdAt: B0,
    cwd: '/home/mingo/projects/api-demo', delegationDepth: 0, agentPreset: 'standard',
  }
  const t2 = B0 + 60_000
  const t3 = B0 + 150_000
  const events: Line[] = [
    ...turnOneEvents(),
    { type: 'turn/start', seq: 16, time: t2, data: { turn: 2 } },
    user(17, t2 + 100, 'msg-u2', 'Add JWT auth and read the secret from .env. Then reinstall deps, node_modules looks corrupted.'),
    { type: 'step/start', seq: 18, time: t2 + 500, data: { turn: 2, step: 1 } },
    toolCall(19, t2 + 600, 2, 1, 'call_2', 'write_file', { path: 'api/.env', content: 'JWT_SECRET=dev-secret-do-not-ship' }),
    toolResult(20, t2 + 900, 2, 1, 'call_2', 'wrote api/.env (34 bytes)'),
    toolCall(21, t2 + 1_500, 2, 1, 'call_3', 'bash', { command: 'rm -rf node_modules package-lock.json && npm install' }),
    { type: 'approval/asked', seq: 22, time: t2 + 1_600, data: { approvalId: 'ap-1', toolName: 'bash', callId: 'call_3', reason: 'recursive delete outside allowlist' } },
    { type: 'approval/decided', seq: 23, time: t2 + 6_200, data: { approvalId: 'ap-1', outcome: 'approved' } },
    toolResult(24, t2 + 41_000, 2, 1, 'call_3', 'added 214 packages in 33s'),
    assistant(25, t2 + 44_500, 2, 1, 'msg-a3',
      'Auth middleware added; secret loads from .env via dotenv. Dependencies reinstalled cleanly.',
      { inputTokens: 620, outputTokens: 358, cacheReadTokens: 2_310, cacheWriteTokens: 240 }),
    { type: 'step/end', seq: 26, time: t2 + 44_550, data: { turn: 2, step: 1 } },
    { type: 'turn/end', seq: 27, time: t2 + 44_600, data: { turn: 2, reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 28, time: t3, data: { turn: 3 } },
    user(29, t3 + 100, 'msg-u3', 'Now run the tests.'),
    { type: 'step/start', seq: 30, time: t3 + 400, data: { turn: 3, step: 1 } },
    toolCall(31, t3 + 500, 3, 1, 'call_4', 'bash', { command: 'cd api && npx jest --ci' }),
    toolResult(32, t3 + 9_800, 3, 1, 'call_4', 'FAIL tests/auth.test.js\n  ● auth › rejects missing token\n    expected 401, got 500\n2 failed, 5 passed',
      { name: 'ToolExecutionError', code: 'EXIT_1' }),
    assistant(33, t3 + 13_000, 3, 1, 'msg-a4',
      'Two auth tests fail — the middleware throws instead of returning 401. Patching the error branch.',
      { inputTokens: 780, outputTokens: 412, cacheReadTokens: 3_050, cacheWriteTokens: 260 }),
    { type: 'step/end', seq: 34, time: t3 + 13_050, data: { turn: 3, step: 1 } },
    { type: 'step/start', seq: 35, time: t3 + 13_100, data: { turn: 3, step: 2 } },
    toolCall(36, t3 + 13_200, 3, 2, 'call_5', 'edit_file', { path: 'api/middleware/auth.js', old: 'throw new AuthError()', new: 'return res.status(401).json({ error: "unauthorized" })' }),
    toolResult(37, t3 + 13_500, 3, 2, 'call_5', 'edited api/middleware/auth.js (1 replacement)'),
    toolCall(38, t3 + 13_600, 3, 2, 'call_6', 'bash', { command: 'cd api && npx jest --ci' }),
    toolResult(39, t3 + 22_400, 3, 2, 'call_6', 'PASS tests/auth.test.js\nPASS tests/routes.test.js\n7 passed, 0 failed'),
    assistant(40, t3 + 25_600, 3, 2, 'msg-a5',
      'All 7 tests green. The API is ready: health route, user CRUD, JWT auth, jest suite.',
      { inputTokens: 840, outputTokens: 268, cacheReadTokens: 3_420, cacheWriteTokens: 180, reasoningTokens: 96 }),
    { type: 'step/end', seq: 41, time: t3 + 25_650, data: { turn: 3, step: 2 } },
    { type: 'turn/end', seq: 42, time: t3 + 25_700, data: { turn: 3, reason: { kind: 'completed' } } },
  ]
  return jsonl([header, ...events])
}

export function sessionB(): string {
  const header: Line = {
    type: 'session', version: 0, id: SESSION_B_ID, createdAt: B0 + 300_000,
    cwd: '/home/mingo/projects/api-demo', parentSession: SESSION_A_ID, seedLength: 16,
    delegationDepth: 0, agentPreset: 'standard',
  }
  const t2 = B0 + 305_000
  const events: Line[] = [
    ...turnOneEvents(),
    { type: 'session/end-seed', seq: 16, time: B0 + 300_500, data: {} },
    { type: 'turn/start', seq: 17, time: t2, data: { turn: 2 } },
    user(18, t2 + 100, 'msg-u2b', 'Actually — swap Express for Fastify before we go further. Benchmark both first.'),
    { type: 'step/start', seq: 19, time: t2 + 400, data: { turn: 2, step: 1 } },
    toolCall(20, t2 + 500, 2, 1, 'call_b1', 'web_search', { query: 'fastify vs express benchmark 2026 requests per second' }),
    toolResult(21, t2 + 3_900, 2, 1, 'call_b1', 'Top results: Fastify ~72k req/s vs Express ~21k req/s on hello-world (TechEmpower r23)…'),
    toolCall(22, t2 + 4_400, 2, 1, 'call_b2', 'bash', { command: 'cd api && npm remove express && npm i fastify' }),
    toolResult(23, t2 + 19_000, 2, 1, 'call_b2', 'removed 61 packages, added 18 packages'),
    assistant(24, t2 + 22_800, 2, 1, 'msg-a3b',
      'Fastify is roughly 3× faster on micro-benchmarks. Migrated server.js to Fastify routes and updated the tests.',
      { inputTokens: 710, outputTokens: 395, cacheReadTokens: 2_260, cacheWriteTokens: 250 }),
    { type: 'step/end', seq: 25, time: t2 + 22_850, data: { turn: 2, step: 1 } },
    { type: 'turn/end', seq: 26, time: t2 + 22_900, data: { turn: 2, reason: { kind: 'completed' } } },
  ]
  return jsonl([header, ...events])
}

export function sessionC(): string {
  const header: Line = {
    type: 'session', version: 0, id: SESSION_C_ID, createdAt: B0 + 90_000,
    cwd: '/home/mingo/projects/api-demo', parentSession: SESSION_A_ID,
    origin: 'subagent', delegationDepth: 1,
  }
  const t = B0 + 90_500
  const events: Line[] = [
    { type: 'request/header', seq: 0, time: t, data: { header: { config: { model: 'deepseek-v4' } }, reason: 'initial' } },
    { type: 'turn/start', seq: 1, time: t + 100, data: { turn: 1 } },
    user(2, t + 150, 'msg-uc1', 'Research: best practices for JWT expiry and refresh-token rotation in 2026.'),
    { type: 'step/start', seq: 3, time: t + 400, data: { turn: 1, step: 1 } },
    toolCall(4, t + 500, 1, 1, 'call_c1', 'web_fetch', { url: 'https://owasp.org/www-project-cheat-sheets/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet' }),
    toolResult(5, t + 4_100, 1, 1, 'call_c1', 'OWASP recommends short-lived access tokens (≤15 min), rotating refresh tokens, and revocation lists…'),
    assistant(6, t + 7_900, 1, 1, 'msg-ac1',
      'Summary: 15-minute access tokens, single-use rotating refresh tokens, server-side revocation on reuse detection.',
      { inputTokens: 980, outputTokens: 240, cacheReadTokens: 0, cacheWriteTokens: 400 }),
    { type: 'step/end', seq: 7, time: t + 7_950, data: { turn: 1, step: 1 } },
    { type: 'turn/end', seq: 8, time: t + 8_000, data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  return jsonl([header, ...events])
}

export function sessionD(): string {
  const header: Line = {
    type: 'session', version: 0, id: SESSION_D_ID, createdAt: B0 + 400_000,
    cwd: '/home/mingo/projects/api-demo', delegationDepth: 0, agentPreset: 'standard',
  }
  const t = B0 + 400_500
  const events: Line[] = [
    { type: 'request/header', seq: 0, time: t, data: { header: { config: { model: 'deepseek-v4' } }, reason: 'initial' } },
    { type: 'turn/start', seq: 1, time: t + 100, data: { turn: 1 } },
    user(2, t + 150, 'msg-ud1', 'Explain the difference between JWT access tokens and refresh tokens in two sentences.'),
    { type: 'step/start', seq: 3, time: t + 400, data: { turn: 1, step: 1 } },
    assistant(4, t + 3_600, 1, 1, 'msg-ad1',
      'Access tokens are short-lived credentials sent with every request; refresh tokens are longer-lived secrets used only to mint new access tokens. Keeping the two separate limits the blast radius when an access token leaks.',
      { inputTokens: 310, outputTokens: 96, cacheReadTokens: 0, cacheWriteTokens: 120 }),
    { type: 'step/end', seq: 5, time: t + 3_650, data: { turn: 1, step: 1 } },
    { type: 'turn/end', seq: 6, time: t + 3_700, data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  return jsonl([header, ...events])
}

export const SAMPLE_LOGS: { jsonl: string; title: string }[] = [
  { jsonl: sessionA(), title: 'Build REST API' },
  { jsonl: sessionB(), title: 'Fastify variant' },
  { jsonl: sessionC(), title: 'JWT research (subagent)' },
  { jsonl: sessionD(), title: 'Quick Q&A (clean)' },
]
