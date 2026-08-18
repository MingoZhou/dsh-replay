# Contributing

Thanks for your interest! / 感谢参与!

## Dev setup

    npm install
    npm run build     # host + client + viewer + demo bundles
    npm test          # 27 unit tests (vitest)
    npm run demo      # http://localhost:4173 — full UI over sample logs, no harness needed

## Where things live

- `src/core` — dependency-free log analysis (decode / timeline / audit / cost / forktree / compare). Add tests in `tests/` for any change here.
- `src/index.ts` — harness host adapter (HTTP API)
- `src/client` — React UI + slot registrations
- Audit rules are plain data in `src/core/audit.ts` — new rules welcome.

## PRs

Keep PRs focused; run `npm run build && npm test` before pushing. For UI changes, attach a screenshot from demo mode. / PR 尽量小而聚焦,提交前跑构建和测试,UI 改动请附 demo 模式截图。