# Changelog

## 1.0.0 — 2026-11-12

Replay stops competing with the harness's built-in Trajectory tab on step-by-step
inspection and becomes the report on top of it: cost, health, files, audit,
cross-session totals, sharing.

### New
- **Report** replaces the overview: transparent 0–100 run score, six headline
  numbers with a median-of-last-10 baseline, a real-duration swimlane, cumulative
  cost / token chart, context-size chart with compaction markers, and a clickable
  "needs attention" list (loops, failures, slow calls, retries, aborted turns).
- **All-sessions dashboard**: spend per day stacked by model, weekday × hour
  heatmap, most expensive sessions, per-project totals, tool failure share.
  Summaries are folded and cached on the host (`GET /summaries`).
- **Files** tab: per-file diffs rebuilt from `write` / `edit` / `apply_patch` calls.
- **Share** dialog: redaction preview (keys, tokens, secret assignments, URL
  passwords, home-directory user names, optional e-mails), whole session / one
  turn / seq range, HTML export and Markdown summary.
- **Pricing settings**: editable table persisted in the browser, CNY or USD display.
- **Live follow** for running sessions (`GET /session/<id>?since=<seq>`).
- **Fork here** from any timeline event, when the host offers its client
  `sessions` service.
- **Compare**: paired metric bars plus an aligned tool sequence with the first
  difference marked.
- Timeline: virtual scrolling, keyboard control, reasoning text, Markdown
  rendering, JSON tree, diff view, failed-only filter, `#seq` jump.

### Changed
- **Cost is computed and shown in CNY.** DeepSeek defaults follow the official
  CNY price page with separate peak / off-peak rates; each step is priced with
  the model that answered it at the tariff in force at that time. (Previously
  CNY figures were labelled with a `$`.)
- **Audit recalibrated.** `pwsh` / `powershell` are audited as shells with their
  own patterns; an ordinary shell command is `info`, not a warning; a recursive
  delete is judged by its target (`node_modules` / `dist` is cleanup, a path
  outside the workspace is critical). Findings are grouped by rule and any rule
  can be ignored.
- Reads session log format v4 (harness 0.2.x): embedded stream records,
  `assistant/attempt`, seq-addressed surface replacement, `isSeeded`. Older
  logs still read. Forks without `parentSession` are linked by their shared
  first prompt and labelled as inferred.
- UI chrome now uses the harness `--dsw-alias-*` tokens throughout; the mascot
  appears only in empty and loading states.
- Client bundle is about 225 KB (was about 2 MB): the embedded mascot is a
  192 px WebP instead of the full-size PNG.

### Removed
- `formatUsd`, `estimateCost(totals, models)` and the RegExp-based
  `DEFAULT_PRICING` from `core` — use `estimateCost(model, pricing)`,
  `priceBuckets` and `formatMoney`. `AuditReport` gains `groups` / `ignored`;
  rule id `shell-exec` now covers only ordinary commands (`shell-danger` and
  `file-sensitive` are new).
- `assets/demo.gif` (28 MB) and the pre-1.0 screenshots.

## 0.4.1 — fix: harness rc.8 compatibility

## 0.4.0 — 2026-08-18
- Published to npm as `@mingozhou/dsh-replay` (prebuilt, one-command install)
- README restructured: online demo → npm → clone from source
- License copyright holder updated

## 0.3.x — 2026-08-17
- Real session titles from `session/title` events
- Fork view v2: family trees + responsive card grid
- Jing Xiaoshen (鲸小深) mascot, auto-embedded from `assets/jingxiaoshen.png`
- Sidebar button matches native footer typography; modal GitHub link
- Uninstall docs & troubleshooting FAQ

## 0.2.0
- Sidebar entry + full-screen modal with session picker
- Filter & search in the timeline; cost estimation; one-click HTML export
- EN/中文 bilingual UI

## 0.1.0
- Timeline replay, overview dashboard, security audit, fork tree, compare
- Standalone demo mode with sample sessions