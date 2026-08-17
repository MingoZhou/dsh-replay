/**
 * Export a session as a single self-contained HTML file: the viewer bundle
 * (react inlined) + the session data, playable offline and shareable in an
 * issue, a blog post, or a chat.
 */
import type { ParsedSession } from '../core/types.js'

export interface ExportSession {
  header: ParsedSession['header']
  events: ParsedSession['events']
  title?: string
}

export function buildReplayHtml(viewerSource: string, sessions: ExportSession[]): string {
  const data = JSON.stringify({ sessions }).replaceAll('<', '\\u003c')
  const safeViewer = viewerSource.replaceAll('</script>', '<\\/script>')
  const title = sessions[0]?.title ?? 'session replay'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>dsh-replay — ${title.replaceAll('<', '&lt;')}</title>
<style>html, body, #root { height: 100%; margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }</style>
</head>
<body>
<div id="root"></div>
<script>window.__DSHR_DATA__ = ${data}</script>
<script>${safeViewer}</script>
</body>
</html>
`
}

export function downloadReplayHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
