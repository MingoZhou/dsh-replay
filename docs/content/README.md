# Content pack

This folder contains ready-to-edit posts for the 0.4.2 launch.

- `replay-is-not-rerun.md` — Chinese long-form article (V2EX/知乎/公众号).
- `replay-is-not-rerun.en.md` — English long-form article (blog/X/Reddit).
- `social-posts.md` — short V2EX/小红书/知乎/X/Reddit variants.

## Before posting

1. Replace the illustrative numbers (5 hours / 18M tokens / 87 calls) with a real
   session. Do not invent metrics.
2. Use **dashboard-zh.png** as the first image; it explains the archive at a
   glance. Then cost/audit/export.
3. Export a **sample** session, not a real one, unless you have reviewed every
   line. The export dialog's redaction is best-effort.
4. Check the install path in the post: Desktop is **Plugins → Add plugin**, not
   `dsh plugin --profile desktop` (which the Desktop app refuses).
5. Add UTM-free links? Plain links are fine; do not stuff keywords.

## Suggested order

1. V2EX / 知乎 long-form, with the three screenshots.
2. 小红书 short post, dashboard + audit screenshots.
3. X / Reddit English post, dashboard + export.
4. Reply to the existing issue #2 with the article link and the one-line answer:
   “No model calls, no tokens; it is a recording, not a rematch.”

## Assets

| File | Use |
| --- | --- |
| `assets/dashboard-zh.png` | first image, archive overview |
| `assets/overview-zh.png` | cost + chart |
| `assets/cost-zh.png` | narrow cost card |
| `assets/audit-zh.png` | risk findings, redacted `.env` |
| `assets/export-zh.png` | redaction/size dialog |
| `assets/timeline-zh.png` | reasoning/system prompt/tool summaries |
| `assets/forks-zh.png` | lineage |
| `assets/compare-zh.png` | divergence + cost/risk deltas |
| `assets/demo-poster.jpg` | blog/social still image |
| `assets/social-preview.png` | GitHub social preview / OG |

English counterparts use the `-light` suffix.
