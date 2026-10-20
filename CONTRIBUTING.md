# Contributing

Thanks for your interest! / 感谢参与！

## Dev setup

```sh
npm install
npm run build     # host + client + viewer + demo bundles
npm test          # 37 unit tests (vitest)
npm run demo      # http://localhost:4173 — full UI over sample logs, no harness needed
```

Node 22+ is required. Windows is a first-class target: the audit tests include
`pwsh`/PowerShell cases, not only bash.

## Where things live

- `src/core` — dependency-free log analysis (decode / timeline / audit / cost /
  forktree / compare / redact). Add tests in `tests/` for any change here.
- `src/index.ts` — Harness host adapter (read-only HTTP API + dashboard summaries)
- `src/client` — React UI + slot registrations
- `src/client/pricing.ts` — editable price table persisted in `localStorage`
- `demo/` — the same components over four sample sessions
- `scripts/build.mjs` — esbuild bundles + minimal mascot embedding

Audit rules are plain data in `src/core/audit.ts` — new rules welcome. Keep the
noise budget in mind: a clean session should produce **zero** findings. Baseline
configuration, ordinary writes and ordinary fetches are not findings.

## Screenshots

```sh
npm run demo
node scripts/screenshot.mjs
```

The script uses Playwright with a local Edge/Chromium. Set `CHROMIUM_PATH` if
needed. It writes `assets/dashboard-*.png`, `overview-*.png`, `audit-*.png`,
`export-*.png`, `timeline-*.png`, `forks-*.png`, `compare-*.png` for both
languages.

## PRs

Keep PRs focused; run `npm run build && npm test` before pushing. For UI changes,
attach a screenshot from demo mode and mention the viewport width. / PR 尽量小而
聚焦，提交前跑构建和测试，UI 改动请附 demo 模式截图和窗口宽度。

For security reports, use [SECURITY.md](SECURITY.md) instead of a public issue.
