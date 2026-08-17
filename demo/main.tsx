/** Standalone demo page: the same components, fed by StaticReplayApi. */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StaticReplayApi } from '../src/client/api.js'
import { ReplayApp } from '../src/client/components/ReplayApp.js'
import { SAMPLE_LOGS, SESSION_A_ID } from './samples.js'
// eslint-disable-next-line import/no-unresolved
import cssText from '../src/client/styles.css'

const api = new StaticReplayApi(SAMPLE_LOGS)
api.viewerUrl = './dist/viewer.js'

function DemoShell(): React.ReactElement {
  const [dark, setDark] = useState(false)
  return (
    <div data-theme={dark ? 'dark' : 'light'} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 13,
          borderBottom: '1px solid ' + (dark ? '#2c2c2a' : '#e1e0d9'),
          background: dark ? '#0d0d0d' : '#f9f9f7', color: dark ? '#fff' : '#0b0b0b',
        }}
      >
        <strong>dsh-replay</strong>
        <span style={{ opacity: 0.6 }}>demo mode — sample sessions, no harness required</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setDark(d => !d)}
          style={{
            font: 'inherit', cursor: 'pointer', border: '1px solid ' + (dark ? '#2c2c2a' : '#e1e0d9'),
            borderRadius: 6, padding: '3px 10px', background: 'transparent', color: 'inherit',
          }}
        >
          {dark ? 'light' : 'dark'} mode
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <ReplayApp api={api} sessionId={SESSION_A_ID} />
      </div>
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  (cssText as unknown as string) +
  '\nhtml, body, #root { height: 100%; margin: 0; }'
document.head.append(style)

createRoot(document.getElementById('root')!).render(<DemoShell />)
