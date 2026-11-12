/**
 * Sample session logs in the harness wire format (format version 4), used by
 * the demo page and the test suite.
 *
 *  A — root session: tool calls, an approval, a failing test run, a reasoning
 *      block, a sensitive write and a cleanup delete;
 *  B — a fork of A after turn 1 (v4 style: `isSeeded`, no `parentSession`,
 *      inherited prefix + `session/end-seed {inherited:true}`);
 *  C — a subagent child of A doing web research;
 *  D — a clean one-turn Q&A;
 *  E — a long Windows (`pwsh`) refactor that goes wrong in instructive ways:
 *      a retry loop, a failed model attempt, a compaction, a download-and-run,
 *      a leaked key, mixed models and peak-hour billing;
 *  plus a seeded batch of small sessions spread over two weeks so the
 *  cross-session dashboard has something to chart.
 */

type Line = Record<string, unknown>

export const SESSION_A_ID = 'a7f3c2d1-4b5e-4a6f-8c9d-0e1f2a3b4c5d'
export const SESSION_B_ID = 'b8e4d3c2-5c6f-4b7a-9d0e-1f2a3b4c5d6e'
export const SESSION_C_ID = 'c9f5e4d3-6d7a-4c8b-a0e1-2f3a4b5c6d7e'
export const SESSION_D_ID = 'd0a6f5e4-7e8b-4d9c-b1f2-3a4b5c6d7e8f'
export const SESSION_E_ID = 'e1b7a6f5-8f9c-4eae-c2a3-4b5c6d7e8f90'

/** 2026-11-10 20:30 Asia/Shanghai — an off-peak evening. */
export const B0 = Date.UTC(2026, 10, 10, 12, 30, 0)
const FLASH = 'deepseek-flash'
const PRO = 'deepseek-v4-pro'

interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/** Small fluent writer that keeps seq / time / turn / step bookkeeping honest. */
class LogWriter {
  readonly lines: Line[] = []
  seq = 0
  time: number
  turnNo = 0
  stepNo = 0
  private msg = 0
  private call = 0
  model = FLASH

  constructor(private readonly header: Line, start: number, private readonly tag: string) {
    this.time = start
  }

  emit(type: string, data: unknown, extra: Line = {}): number {
    const seq = this.seq++
    this.lines.push({ type, seq, time: this.time, data, ...extra })
    return seq
  }

  wait(ms: number): this {
    this.time += ms
    return this
  }

  context(model = this.model, contextWindow = 1_000_000): this {
    this.model = model
    this.emit('request/header', { header: { config: { provider: 'deepseek', model } }, reason: this.seq === 0 ? 'initial' : 'change' })
    this.emit('request/context', { provider: 'deepseek', model, contextWindow })
    return this
  }

  turn(prompt: string, body: () => void, reason: Line = { kind: 'completed' }): this {
    this.turnNo++
    this.stepNo = 0
    this.emit('turn/start', { turn: this.turnNo })
    this.wait(60)
    this.emit(
      'user/message',
      { id: `msg-${this.tag}-u${++this.msg}`, role: 'user', content: [{ type: 'text', text: prompt }], source: { kind: 'user' } },
      { surfaceOp: 'append' },
    )
    body()
    this.wait(40)
    this.emit('turn/end', { turn: this.turnNo, reason })
    return this
  }

  step(body: () => void): this {
    this.stepNo++
    this.wait(120)
    this.emit('step/start', { turn: this.turnNo, step: this.stepNo })
    body()
    this.wait(30)
    this.emit('step/end', { turn: this.turnNo, step: this.stepNo })
    return this
  }

  /** The model's reply for the current step. `ms` is the whole model call; ttft is ~18% of it. */
  say(text: string, usage: Usage, ms = 3000, opts: { reasoning?: string } = {}): this {
    const start = this.time
    const first = start + Math.round(ms * 0.18)
    this.wait(ms)
    const content: Line[] = []
    const stream: Line[] = []
    if (opts.reasoning !== undefined) {
      content.push({ type: 'reasoning', text: opts.reasoning })
      stream.push({ type: 'reasoning-chunks', time0: first, index: content.length - 1, dt: [], texts: [opts.reasoning] })
    }
    if (text !== '') {
      content.push({ type: 'text', text })
      stream.push({ type: 'text-chunks', time0: first + 40, index: content.length - 1, dt: [], texts: [text] })
    }
    stream.push({ type: 'chunk', time: this.time, chunk: { type: 'usage', usage } })
    this.emit(
      'assistant/message',
      {
        turn: this.turnNo, step: this.stepNo,
        message: {
          id: `msg-${this.tag}-a${++this.msg}`, role: 'assistant', content,
          source: { kind: 'model', provider: 'deepseek', model: this.model },
        },
        stream, usage,
      },
      { surfaceOp: 'append' },
    )
    return this
  }

  /** One tool call and its result. */
  tool(name: string, args: unknown, result: string, ms: number, error?: { name: string; code: string; reason?: string }): this {
    const callId = `call_${this.tag}_${++this.call}`
    this.wait(80)
    this.emit('tool/call', { turn: this.turnNo, step: this.stepNo, callId, name, arguments: JSON.stringify(args) })
    this.wait(ms)
    this.emit(
      'tool/result',
      {
        turn: this.turnNo, step: this.stepNo,
        message: {
          id: `msg-${callId}-result`, role: 'tool', toolCallId: callId,
          content: [{ type: 'text', text: result }],
          source: { kind: 'tool', callId },
          ...(error ? { isError: true } : {}),
        },
        ...(error ? { error } : {}),
      },
      { surfaceOp: 'append' },
    )
    return this
  }

  jsonl(): string {
    return [this.header, ...this.lines].map(l => JSON.stringify(l)).join('\n') + '\n'
  }
}

const header = (id: string, createdAt: number, extra: Line = {}): Line => ({
  type: 'session', version: 4, id, createdAt, isSeeded: false, ...extra,
})

/** Turn 1 of session A — also the prefix a fork inherits verbatim. */
function turnOne(log: LogWriter): void {
  log.context(FLASH).wait(900)
  log.turn('Build me a small REST API in Express with tests. Keep it minimal.', () => {
    log.step(() => {
      log.say("I'll scaffold the project first, then add routes and a test suite.",
        { inputTokens: 1_240, outputTokens: 184, cacheReadTokens: 0, cacheWriteTokens: 900 }, 2_600)
      log.tool('bash', { command: 'mkdir -p api && cd api && npm init -y && npm i express supertest jest' }, 'added 214 packages in 16s', 16_400)
      log.tool('write', { file_path: 'api/server.js', content: "const express = require('express')\nconst app = express()\napp.use(express.json())\n\napp.get('/health', (_req, res) => res.json({ ok: true }))\n\nmodule.exports = app\n" }, 'Created file api/server.js', 240)
    })
    log.step(() => {
      log.say('Project scaffolded. Wrote server.js with a health route and user CRUD, plus jest config.',
        { inputTokens: 460, outputTokens: 342, cacheReadTokens: 1_180, cacheWriteTokens: 300 }, 2_900)
    })
  })
}

export function sessionA(): string {
  const log = new LogWriter(header(SESSION_A_ID, B0, { cwd: '/home/mingo/projects/api-demo', agentPreset: 'standard' }), B0, 'a')
  turnOne(log)
  log.wait(36_000)
  log.turn('Add JWT auth and read the secret from .env. Then reinstall deps, node_modules looks corrupted.', () => {
    log.step(() => {
      log.say('', { inputTokens: 380, outputTokens: 96, cacheReadTokens: 1_900, cacheWriteTokens: 120 }, 1_400, {
        reasoning: 'The user wants the secret in .env, so the middleware should read process.env.JWT_SECRET via dotenv. Reinstalling means removing node_modules and the lockfile first.',
      })
      log.tool('write', { file_path: 'api/.env', content: 'JWT_SECRET=dev-secret-do-not-ship\n' }, 'Created file api/.env', 300)
      log.wait(600)
      const callId = 'call_a_approval'
      log.emit('tool/call', { turn: log.turnNo, step: log.stepNo, callId, name: 'bash', arguments: JSON.stringify({ command: 'rm -rf node_modules package-lock.json && npm install' }) })
      log.wait(100)
      log.emit('approval/asked', { approvalId: 'ap-1', toolName: 'bash', callId, reason: 'recursive delete' })
      log.wait(4_600)
      log.emit('approval/decided', { approvalId: 'ap-1', outcome: 'approved' })
      log.wait(34_800)
      log.emit('tool/result', {
        turn: log.turnNo, step: log.stepNo,
        message: { id: 'msg-call_a_approval-result', role: 'tool', toolCallId: callId, content: [{ type: 'text', text: 'added 214 packages in 33s' }], source: { kind: 'tool', callId } },
      }, { surfaceOp: 'append' })
    })
    log.step(() => {
      log.say('Auth middleware added; secret loads from `.env` via dotenv. Dependencies reinstalled cleanly.',
        { inputTokens: 620, outputTokens: 358, cacheReadTokens: 2_310, cacheWriteTokens: 240 }, 3_500)
    })
  })
  log.wait(45_000)
  log.turn('Now run the tests.', () => {
    log.step(() => {
      log.say('Running the suite.', { inputTokens: 210, outputTokens: 42, cacheReadTokens: 2_900, cacheWriteTokens: 60 }, 1_200)
      log.tool('bash', { command: 'cd api && npx jest --ci' },
        'FAIL tests/auth.test.js\n  ● auth › rejects missing token\n    expected 401, got 500\n2 failed, 5 passed', 9_300,
        { name: 'ToolExecutionError', code: 'EXIT_1', reason: 'command exited with code 1' })
    })
    log.step(() => {
      log.say('Two auth tests fail — the middleware throws instead of returning 401. Patching the error branch.',
        { inputTokens: 780, outputTokens: 412, cacheReadTokens: 3_050, cacheWriteTokens: 260 }, 3_200)
      log.tool('edit', {
        file_path: 'api/middleware/auth.js',
        old_string: "  if (!token) {\n    throw new AuthError()\n  }",
        new_string: "  if (!token) {\n    return res.status(401).json({ error: 'unauthorized' })\n  }",
      }, 'Updated file api/middleware/auth.js', 300)
      log.tool('bash', { command: 'cd api && npx jest --ci' }, 'PASS tests/auth.test.js\nPASS tests/routes.test.js\n7 passed, 0 failed', 8_800)
    })
    log.step(() => {
      log.say('All 7 tests green.\n\n**The API is ready:**\n\n- health route\n- user CRUD\n- JWT auth (`Authorization: Bearer …`)\n- jest suite\n\nRun it with:\n\n```sh\ncd api && node index.js\n```',
        { inputTokens: 840, outputTokens: 268, cacheReadTokens: 3_420, cacheWriteTokens: 180, reasoningTokens: 96 }, 3_200)
    })
  })
  return log.jsonl()
}

export function sessionB(): string {
  const created = B0 + 300_000
  const log = new LogWriter(
    header(SESSION_B_ID, created, { cwd: '/home/mingo/projects/api-demo', isSeeded: true, agentPreset: 'standard' }),
    B0, 'a',
  )
  turnOne(log)
  log.time = created + 500
  log.emit('session/end-seed', { inherited: true })
  log.wait(4_500)
  log.turn('Actually — swap Express for Fastify before we go further. Benchmark both first.', () => {
    log.step(() => {
      log.say('Checking current benchmarks before migrating.', { inputTokens: 300, outputTokens: 60, cacheReadTokens: 2_100, cacheWriteTokens: 80 }, 1_500)
      log.tool('web_search', { query: 'fastify vs express benchmark 2026 requests per second' },
        'Top results: Fastify ~72k req/s vs Express ~21k req/s on hello-world…', 3_400)
      log.tool('bash', { command: 'cd api && npm remove express && npm i fastify' }, 'removed 61 packages, added 18 packages', 14_600)
    })
    log.step(() => {
      log.say('Fastify is roughly 3× faster on micro-benchmarks. Migrated server.js to Fastify routes and updated the tests.',
        { inputTokens: 710, outputTokens: 395, cacheReadTokens: 2_260, cacheWriteTokens: 250 }, 3_800)
    })
  })
  return log.jsonl()
}

export function sessionC(): string {
  const created = B0 + 90_000
  const log = new LogWriter(
    header(SESSION_C_ID, created, { cwd: '/home/mingo/projects/api-demo', parentSession: SESSION_A_ID, origin: 'subagent', delegationDepth: 1 }),
    created + 500, 'c',
  )
  log.context(FLASH)
  log.turn('Research: best practices for JWT expiry and refresh-token rotation in 2026.', () => {
    log.step(() => {
      log.say('Fetching the OWASP guidance.', { inputTokens: 620, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 300 }, 1_300)
      log.tool('web_fetch', { url: 'https://owasp.org/www-project-cheat-sheets/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet' },
        'OWASP recommends short-lived access tokens (≤15 min), rotating refresh tokens, and revocation lists…', 3_600)
    })
    log.step(() => {
      log.say('Summary: 15-minute access tokens, single-use rotating refresh tokens, server-side revocation on reuse detection.',
        { inputTokens: 980, outputTokens: 240, cacheReadTokens: 900, cacheWriteTokens: 400 }, 3_800)
    })
  })
  return log.jsonl()
}

export function sessionD(): string {
  const created = B0 + 400_000
  const log = new LogWriter(header(SESSION_D_ID, created, { cwd: '/home/mingo/projects/api-demo', agentPreset: 'standard' }), created + 500, 'd')
  log.context(FLASH)
  log.turn('Explain the difference between JWT access tokens and refresh tokens in two sentences.', () => {
    log.step(() => {
      log.say('Access tokens are short-lived credentials sent with every request; refresh tokens are longer-lived secrets used only to mint new access tokens. Keeping the two separate limits the blast radius when an access token leaks.',
        { inputTokens: 310, outputTokens: 96, cacheReadTokens: 0, cacheWriteTokens: 120 }, 3_200)
    })
  })
  return log.jsonl()
}

/** Long Windows refactor: starts 2026-11-11 09:40 Asia/Shanghai, i.e. inside the morning peak window. */
export function sessionE(): string {
  const created = Date.UTC(2026, 10, 11, 1, 40, 0)
  const cwd = 'C:\\Users\\mingo\\projects\\glass-ark'
  const log = new LogWriter(header(SESSION_E_ID, created, { cwd, agentPreset: 'standard' }), created, 'e')
  let ctx = 9_000
  const use = (out: number, grow = 2_400): Usage => {
    const usage = { inputTokens: Math.round(grow * 0.9), outputTokens: out, cacheReadTokens: ctx, cacheWriteTokens: Math.round(grow * 0.1) }
    ctx += grow + out
    return usage
  }
  const fail = { name: 'ToolExecutionError', code: 'EXIT_1', reason: 'command exited with code 1' }
  const TEST_FAIL = 'FAIL  tests/render/lights.spec.ts\n  TypeError: renderer.useLegacyLights is not a function\n 3 failed | 41 passed'
  log.context(PRO).wait(700)
  log.turn('Migrate the renderer from three.js r160 to r171 and get the test suite green again.', () => {
    log.step(() => {
      log.say('Let me look at how the renderer is wired before touching versions.', use(140, 5_000), 4_200, {
        reasoning: 'r171 removed the legacy lights flag and changed the color-management defaults. I should read the renderer entry and the test setup first, then bump the dependency.',
      })
      log.tool('read', { file_path: 'src/render/renderer.ts' }, '1\timport * as THREE from "three"\n2\texport function createRenderer(canvas) {…', 180)
      log.tool('read', { file_path: 'package.json' }, '{ "name": "glass-ark", "dependencies": { "three": "^0.160.0" } … }', 120)
    })
    log.step(() => {
      log.say('Bumping three to r171 and clearing the build cache, then running the tests.', use(210), 3_900)
      log.tool('pwsh', { command: 'npm install three@0.171.0' }, 'changed 1 package in 9s', 9_400)
      log.tool('pwsh', { command: 'Remove-Item -Recurse -Force dist, node_modules\\.vite' }, '', 1_300)
      log.tool('pwsh', { command: 'npm test -- --run' }, TEST_FAIL, 21_000, fail)
    })
    const excuses = [
      'Three tests fail on `useLegacyLights`. Re-running to rule out a stale cache.',
      'Same failure. Running once more with a clean worker.',
      'Still failing. One more run to be sure it is deterministic.',
    ]
    excuses.forEach((text, i) => {
      log.step(() => {
        log.say(text, use(120, 3_200), 3_400)
        log.tool('pwsh', { command: 'npm test -- --run' }, TEST_FAIL, 22_500 + i * 1_500, fail)
      })
    })
    log.step(() => {
      log.say('Confirmed: the flag was removed in r165 — this is not a cache problem. I need to change the code, not re-run.', use(150, 3_200), 3_600)
    })
  })
  log.wait(52_000)
  log.turn('Stop re-running the tests. Fix the lighting code, then verify.', () => {
    log.step(() => {
      log.wait(2_600)
      log.emit('assistant/attempt', { turn: log.turnNo, step: log.stepNo, stream: [{ type: 'chunk', time: log.time, chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMITED', message: '429 Too Many Requests' } } } }] })
      log.emit('llm/retry', { turn: log.turnNo, step: log.stepNo, attempt: 1, delayMs: 2_000 }, { ignorable: true })
      log.wait(2_000)
      log.say('Replacing the removed `useLegacyLights` flag and rescaling light intensities by π for physical units.', use(380), 5_200)
      log.tool('edit', {
        file_path: 'src/render/renderer.ts',
        old_string: '  renderer.useLegacyLights = false\n  renderer.outputEncoding = THREE.sRGBEncoding',
        new_string: '  renderer.outputColorSpace = THREE.SRGBColorSpace\n  // r165+: physically based light units are the only mode',
      }, 'Updated file src/render/renderer.ts', 260)
      log.tool('apply_patch', {
        input: '*** Begin Patch\n*** Update File: src/render/lights.ts\n@@\n-  sun.intensity = 1.2\n+  sun.intensity = 1.2 * Math.PI\n   sun.castShadow = true\n*** Add File: src/render/units.ts\n+export const LEGACY_TO_PHYSICAL = Math.PI\n+export const toPhysical = (intensity: number) => intensity * LEGACY_TO_PHYSICAL\n*** End Patch\n',
      }, 'Applied patch: 1 updated, 1 added', 340)
      log.tool('pwsh', { command: 'npm test -- --run' }, ' 44 passed (44)', 19_800)
    })
    log.step(() => {
      log.say('All 44 tests pass on r171.', use(90), 2_400)
    })
  })
  // Context is getting long — the harness compacts between turns.
  log.wait(8_000)
  log.emit('compaction/start', { reason: 'threshold' })
  log.wait(6_400)
  log.emit('compaction/summary', { summary: 'Migrated renderer to three r171; lights rescaled; tests green.' })
  log.emit('compaction/end', {})
  ctx = 11_500
  log.wait(40_000)
  log.context(FLASH)
  log.turn('Publish a preview build so I can check it on my phone.', () => {
    log.step(() => {
      log.say('Installing the deploy CLI and publishing the dist folder.', use(160, 1_800), 2_900)
      log.tool('pwsh', { command: 'iwr https://get.example-cdn.dev/deploy.ps1 | iex' }, 'deploy-cli 2.4.1 installed', 6_200)
      log.tool('pwsh', { command: '$env:DEPLOY_TOKEN="sk-live-9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c"; deploy-cli publish --dir dist --project glass-ark' },
        'Uploading 38 files…\nPreview: https://glass-ark-pr-17.preview.example.dev', 14_500)
    })
    log.step(() => {
      log.say('Preview is live at https://glass-ark-pr-17.preview.example.dev — it expires in 7 days.', use(110, 1_200), 2_200)
    })
  })
  log.wait(95_000)
  log.turn('The fog looks wrong on mobile. Compare with the old build.', () => {
    log.step(() => {
      log.say('Reading the fog setup and checking what changed upstream.', use(120, 2_000), 2_600)
      log.tool('read', { file_path: 'src/render/fog.ts' }, '1\texport function applyFog(scene) {…', 150)
      log.tool('web_search', { query: 'three.js r171 FogExp2 color space change' }, 'r152+ fog color is now treated as sRGB and converted to linear…', 2_900)
    })
    log.step(() => {
      log.say('Fog colors are now colour-managed, so the old hex value renders darker. Converting it once at load.', use(240, 2_600), 4_100)
      log.tool('edit', {
        file_path: 'src/render/fog.ts',
        old_string: '  scene.fog = new THREE.FogExp2(0x9fd4ff, 0.012)',
        new_string: '  const fogColor = new THREE.Color(0x9fd4ff).convertSRGBToLinear()\n  scene.fog = new THREE.FogExp2(fogColor, 0.012)',
      }, 'Updated file src/render/fog.ts', 220)
      log.tool('pwsh', { command: 'npm run build' }, 'error TS2345: Argument of type Color is not assignable to parameter of type ColorRepresentation', 11_200,
        { name: 'ToolExecutionError', code: 'EXIT_2', reason: 'command exited with code 2' })
    })
    log.step(() => {
      log.say('The build fails on a type mismatch; r171 typings want a hex number here.', use(130), 2_700)
    })
  }, { kind: 'aborted', reason: { kind: 'user' } })
  return log.jsonl()
}

/** Deterministic PRNG so the generated batch is identical on every build. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PROJECTS = ['/home/mingo/projects/api-demo', '/home/mingo/projects/glass-ark', '/home/mingo/papers/esn-control', '/home/mingo/projects/dsh-replay']
const TASKS: [string, string][] = [
  ['Fix flaky CI job', 'The integration job fails one run in five. Find out why and fix it.'],
  ['Refactor ESN reservoir', 'Split the reservoir update into a pure function and add tests.'],
  ['Draft related-work section', 'Summarise the five papers in refs/ into a related-work paragraph.'],
  ['Upgrade dependencies', 'Bump minor versions and make sure the build still passes.'],
  ['Add dark mode', 'Add a dark theme that follows the system setting.'],
  ['Profile slow startup', 'Startup takes 4 seconds. Profile it and remove the worst offender.'],
  ['Write API docs', 'Generate reference docs for the public functions in src/.'],
  ['Review pull request', 'Review the open PR for correctness and style.'],
]
const TOOLS: [string, unknown, string, number, number][] = [
  ['bash', { command: 'npm test' }, '42 passed', 9_000, 0.18],
  ['read', { file_path: 'src/index.ts' }, '1\texport …', 150, 0.01],
  ['edit', { file_path: 'src/index.ts', old_string: 'const a = 1', new_string: 'const a = 2' }, 'Updated file src/index.ts', 240, 0.05],
  ['web_search', { query: 'best practice' }, 'Top results…', 2_800, 0.04],
  ['bash', { command: 'git status --short' }, ' M src/index.ts', 300, 0.01],
  ['write', { file_path: 'notes/plan.md', content: '# Plan\n\n- step one\n- step two\n' }, 'Created file notes/plan.md', 200, 0.02],
]

function generated(index: number, rnd: () => number): { jsonl: string; title: string } {
  const [title, prompt] = TASKS[index % TASKS.length]
  const day = Math.floor(rnd() * 14)
  const hour = [1, 2, 3, 5, 6, 7, 8, 12, 13, 14][Math.floor(rnd() * 10)] // UTC → 09..22 in Asia/Shanghai
  const created = Date.UTC(2026, 9, 28 + day, hour, Math.floor(rnd() * 60))
  const id = `f${index.toString(16).padStart(3, '0')}0000-0000-4000-8000-${created.toString(16).padStart(12, '0')}`
  const pro = rnd() < 0.3
  const log = new LogWriter(header(id, created, { cwd: PROJECTS[Math.floor(rnd() * PROJECTS.length)], agentPreset: 'standard' }), created, `g${index}`)
  log.context(pro ? PRO : FLASH)
  let ctx = 6_000 + Math.floor(rnd() * 6_000)
  const turns = 1 + Math.floor(rnd() * 4)
  for (let t = 0; t < turns; t++) {
    log.turn(t === 0 ? prompt : 'Looks good — continue with the next part.', () => {
      const steps = 1 + Math.floor(rnd() * (pro ? 9 : 5))
      for (let s = 0; s < steps; s++) {
        log.step(() => {
          const grow = 1_200 + Math.floor(rnd() * 3_000)
          const out = 80 + Math.floor(rnd() * 420)
          log.say('Done with this step.', { inputTokens: Math.round(grow * 0.85), outputTokens: out, cacheReadTokens: ctx, cacheWriteTokens: Math.round(grow * 0.15) }, 1_800 + Math.floor(rnd() * 4_000))
          ctx += grow + out
          const calls = s === steps - 1 ? 0 : Math.floor(rnd() * 3)
          for (let c = 0; c < calls; c++) {
            const [name, args, result, ms, failRate] = TOOLS[Math.floor(rnd() * TOOLS.length)]
            const fail = rnd() < failRate
            log.tool(name, args, fail ? 'exit code 1' : result, Math.round(ms * (0.6 + rnd())),
              fail ? { name: 'ToolExecutionError', code: 'EXIT_1' } : undefined)
          }
        })
      }
    })
    log.wait(20_000 + Math.floor(rnd() * 90_000))
  }
  return { jsonl: log.jsonl(), title }
}

export function generatedSessions(count = 22): { jsonl: string; title: string }[] {
  const rnd = mulberry32(20261111)
  return Array.from({ length: count }, (_, i) => generated(i, rnd))
}

export const SAMPLE_LOGS: { jsonl: string; title: string }[] = [
  { jsonl: sessionE(), title: 'Migrate renderer to three r171' },
  { jsonl: sessionA(), title: 'Build REST API' },
  { jsonl: sessionB(), title: 'Build REST API (2)' },
  { jsonl: sessionC(), title: 'JWT research (subagent)' },
  { jsonl: sessionD(), title: 'Quick Q&A (clean)' },
  ...generatedSessions(),
]
