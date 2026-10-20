# GitHub metadata checklist

These settings live in the repository UI and cannot be changed from source.
Do them once after merging 0.4.2.

## Topics

`deepseek-harness`, `deepseek-harness-plugin`, `deepseek-harness-plugins`, `dsh`,
`dsh-plugin`, `dsh-plugins`, `session-replay`, `session-review`,
`observability`, `agent-observability`, `llmops`, `trace-viewer`, `ai-agents`,
`typescript`, `react`

## Social preview

Upload `assets/social-preview.png` (1200×630) in
**Settings → General → Social preview**. It uses the real overview screenshot,
the mascot, and the “只读 · 成本 · 审计 · 对比 · 一键分享” line.

## Discussions

Enable **Discussions** and create:

- **Q&A** — link it from `.github/ISSUE_TEMPLATE/config.yml`.
- **Show and tell** — for forks/tools built on `dsh-replay/core`.
- **Announcements** — release notes.

Pin the “Read this before asking: replay is read-only” discussion if you want a
single canonical answer.

## Releases and npm

0.4.2 is prepared in `package.json` and `CHANGELOG.md`. From a clean checkout:

```sh
npm ci
npm run build
npm test
npm pack --dry-run          # inspect the tarball; lib/viewer.js is the big file
npm publish --access public
git tag v0.4.2 && git push --tags
```

Then create a GitHub Release from `v0.4.2` with the 0.4.2 section of
`CHANGELOG.md`. Do not claim a release date before publishing.

## Issue labels

Suggested labels: `bug`, `enhancement`, `audit`, `windows`, `cost`, `export`,
`good first issue`, `needs reproduction`.

## Pin

Pin issue #2 (“回放是指重新将 session 发给模型吗？”) for a few weeks after the
launch; it is the single most useful objection to answer publicly.
