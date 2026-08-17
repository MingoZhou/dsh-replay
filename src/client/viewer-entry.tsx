/**
 * Standalone viewer entry — bundled (react inlined) into lib/viewer.js and
 * embedded into exported HTML files. Reads `window.__DSHR_DATA__`:
 *   { sessions: [{ header, events, title? }] }
 */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { SessionEvent, SessionHeader } from '../core/types.js'
import { StaticReplayApi } from './api.js'
import { ReplayApp } from './components/ReplayApp.js'
// eslint-disable-next-line import/no-unresolved
import cssText from './styles.css'

interface ViewerData {
  sessions: { header: SessionHeader; events: SessionEvent[]; title?: string }[]
}

const data = (window as unknown as { __DSHR_DATA__?: ViewerData }).__DSHR_DATA__ ?? { sessions: [] }
const api = StaticReplayApi.fromParsed(data.sessions)
const first = data.sessions[0]?.header.id

function ViewerShell(): React.ReactElement {
  const [dark, setDark] = useState(
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )
  return (
    <div data-theme={dark ? 'dark' : 'light'} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontSize: 13,
          borderBottom: '1px solid ' + (dark ? '#2c2c2a' : '#e1e0d9'),
          background: dark ? '#0d0d0d' : '#f9f9f7', color: dark ? '#fff' : '#0b0b0b',
        }}
      >
        <strong>dsh-replay</strong>
        <span style={{ opacity: 0.6 }}>exported session replay</span>
        <span style={{ flex: 1 }} />
        <a
          href="https://github.com/MingoZhou/dsh-replay"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', opacity: 0.7 }}
        >
          GitHub
        </a>
        <button
          onClick={() => setDark(d => !d)}
          style={{
            font: 'inherit', cursor: 'pointer', border: '1px solid ' + (dark ? '#2c2c2a' : '#e1e0d9'),
            borderRadius: 6, padding: '2px 9px', background: 'transparent', color: 'inherit',
          }}
        >
          {dark ? 'light' : 'dark'}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReplayApp api={api} sessionId={first} />
      </div>
    </div>
  )
}

const style = document.createElement('style')
style.textContent = (cssText as unknown as string) + '\nhtml, body, #root { height: 100%; margin: 0; }'
document.head.append(style)
createRoot(document.getElementById('root')!).render(<ViewerShell />)
