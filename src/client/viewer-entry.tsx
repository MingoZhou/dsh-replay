/**
 * Standalone viewer entry — bundled (react inlined) into lib/viewer.js and
 * embedded into exported HTML files. Reads `window.__DSHR_DATA__`:
 *   { sessions: [{ header, events, title? }], meta? }
 */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StaticReplayApi } from './api.js'
import { ReplayApp } from './components/ReplayApp.js'
import type { ViewerData } from './export.js'
import { seedSettings } from './settings.js'
// eslint-disable-next-line import/no-unresolved
import cssText from './styles.css'

const data = (window as unknown as { __DSHR_DATA__?: ViewerData }).__DSHR_DATA__ ?? { sessions: [] }
const api = StaticReplayApi.fromParsed(data.sessions)
const first = data.sessions[0]?.header.id
if (data.meta?.pricing !== undefined) seedSettings({ pricing: data.meta.pricing })

function ViewerShell(): React.ReactElement {
  const [dark, setDark] = useState(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  return (
    <div className="dshr-shell" data-theme={dark ? 'dark' : 'light'}>
      <div className="dshr-shell-main">
        <ReplayApp api={api} sessionId={first} exportMeta={data.meta} initialLang={data.meta?.lang} single={data.sessions.length <= 1} />
      </div>
      <div className="dshr-shell-foot">
        <span>
          Made with{' '}
          <a href="https://github.com/MingoZhou/dsh-replay" target="_blank" rel="noreferrer">
            dsh-replay
          </a>{' '}
          — session reports for DeepSeek Harness
        </span>
        <span className="dshr-spacer" />
        <button onClick={() => setDark(d => !d)}>{dark ? '☀ light' : '☾ dark'}</button>
      </div>
    </div>
  )
}

const style = document.createElement('style')
style.textContent = (cssText as unknown as string) + '\nhtml, body, #root { height: 100%; margin: 0; }'
document.head.append(style)
createRoot(document.getElementById('root')!).render(<ViewerShell />)
