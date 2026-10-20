# Changelog

## 0.4.2 — 2026-10-20

The “still alive” maintenance release: trust, first-run, and archive-wide review.

### Fixed

- **Audit missed Windows entirely.** `SHELL_TOOLS` now includes `pwsh`,
  PowerShell and `cmd`; added Windows destructive commands (`Remove-Item
  -Recurse -Force`, `del /s /q`, `rd /s /q`, `format`, `reg delete`,
  `Set-ExecutionPolicy`, encoded PowerShell, `iwr | iex`, …), credential reads,
  exfiltration, persistence and remote execution.
- **Every session had 2 serious findings.** The initial `permission/preset` and
  `sandbox/mode` are baseline, not a change. Only a later, different value is a
  finding. A clean session now shows zero.
- **The audit was mostly noise.** Ordinary writes, edits and network fetches no
  longer produce findings; the list is risk-only. Secret material written to a
  file or returned by a tool is now critical.
- **Mixed-model cost was wrong.** `estimateCostDetailed()` prices each model
  separately instead of applying the first matching rate to every token.
- **The title fallback never worked.** Current `readTitle` returns a string;
  snapshots are now mapped by `value.session.id`, not array index.
- **Literal NUL in `compare.ts`.** GitHub treated the file as binary; replaced
  with a `\u0000` escape.
- **Selected event jumped under filters.** The timeline keeps the selected seq
  and picks the nearest visible event instead of reusing an array index.
- **Session ages showed “1512h”.** Relative dates now read “3 days ago” /
  “2 months ago”.
- **Desktop install docs were wrong.** Desktop profiles are app-managed; the
  README now leads with **Plugins → Add plugin**. Uninstall uses the full scoped
  name.
- **UI could leak secrets on export.** Added redaction preview/count/size and an
  explicit unredacted opt-in; audit details are redacted at the source.
- **Tool labels were raw JSON.** Rails show a command/path/URL/query summary.

### Added

- Archive dashboard: all sessions, month/all-time tokens, cost, high-risk
  findings, search by title/id/workspace, live badge.
- Per-model cost panel, USD/CNY toggle, editable price table persisted in
  `localStorage`.
- Reasoning text and system prompts in the timeline/detail view.
- Windows/audit rule coverage and new baseline/secret-output tests; 37 tests total.
- `SECURITY.md`, `PRIVACY.md`, feature-request/Q&A issue links, content pack.
- `engines.dsh` (`>=0.2.0-rc.8`) and a compatibility table.
- Responsive breakpoints, focus-visible styles, reduced-motion support, stronger
  tertiary-text contrast.

### Changed

- Display name: **Session Review / 会话复盘** (the package name stays
  `dsh-replay`). README explains read-only up front.
- **Client bundle: 2.0 MB → 232 KB.** Mascot: 1.4 MB → 73 KB (256 px, still
  colorful; sidebar keeps the mascot, not a monochrome glyph). README GIF:
  28.8 MB → 164 KB; added a 15-second 116 KB WebP (English and Chinese).
- Host API is loopback-only by default; `allowRemote` is explicit and
  unauthenticated. Viewer source is cached; `HEAD` is body-free; errors no
  longer leak paths.
- Historical “ships no viewer” claim retained with a strikethrough and a note
  that DSH 0.2.1-rc.2 ships Trajectory.
- English/Chinese READMEs use the new screenshots and absolute raw image URLs
  (npm-safe).

## 0.4.1 — 2026-08-20

Fix: compatible with DeepSeek Harness rc.8. The client bundle registers under
the package name.

## 0.4.0 — 2026-08-18

- Published to npm as `@mingozhou/dsh-replay` (prebuilt, one-command install).
- README restructured: online demo → npm → clone from source.
- License copyright holder updated.

## 0.3.x — 2026-08-17

- Real session titles from `session/title` events.
- Fork view v2: family trees + responsive card grid.
- Jing Xiaoshen mascot, auto-embedded from `assets/jingxiaoshen.png`.
- Sidebar button matches native footer typography; modal GitHub link.
- Uninstall docs & troubleshooting FAQ.

## 0.2.0

- Sidebar entry + full-screen modal with session picker.
- Filter & search in the timeline; cost estimation; one-click HTML export.
- EN/中文 bilingual UI.

## 0.1.0

- Timeline replay, overview dashboard, security audit, fork tree, compare.
- Standalone demo mode with sample sessions.
