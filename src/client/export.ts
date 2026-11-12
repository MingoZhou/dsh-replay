/**
 * Export a session as a single self-contained HTML file: the viewer bundle
 * (react inlined) + the session data, playable offline and shareable in an
 * issue, a blog post, or a chat.
 */
import type { PricingConfig } from '../core/cost.js'
import type { ParsedSession } from '../core/types.js'

export interface ExportSession {
  header: ParsedSession['header']
  events: ParsedSession['events']
  title?: string
  inheritedEventCount?: number
}

export interface ExportMeta {
  /** Epoch ms the file was produced. */
  exportedAt: number
  /** Number of redactions applied before export (0 = exported verbatim). */
  redactions: number
  /** True when only a seq range of the session is included. */
  partial?: boolean
  /** The exporter's pricing table, so the recipient sees the same estimate. */
  pricing?: PricingConfig
  lang?: 'en' | 'zh'
}

export interface ViewerData {
  sessions: ExportSession[]
  meta?: ExportMeta
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function buildReplayHtml(viewerSource: string, sessions: ExportSession[], meta?: ExportMeta): string {
  const payload: ViewerData = { sessions, meta }
  // `<` is escaped so a `</script>` inside log text cannot close the data block;
  // U+2028/2029 are escaped because they are line terminators in older JS parsers.
  const data = JSON.stringify(payload)
    .replaceAll('<', '\\u003c')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029')
  const safeViewer = viewerSource.replaceAll('</script', '<\\/script')
  const title = sessions[0]?.title ?? 'session replay'
  return `<!doctype html>
<html lang="${meta?.lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="dsh-replay" />
<title>${escapeHtml(title)} — dsh-replay</title>
<style>html, body, #root { height: 100%; margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }</style>
</head>
<body>
<div id="root"></div>
<script>window.__DSHR_DATA__ = ${data}</script>
<script>${safeViewer}</script>
</body>
</html>
`
}

export function downloadText(text: string, filename: string, type: string): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadReplayHtml(html: string, filename: string): void {
  downloadText(html, filename, 'text/html')
}
