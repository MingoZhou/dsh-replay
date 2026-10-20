/** Standalone demo page: the same components, fed by StaticReplayApi. */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StaticReplayApi } from '../src/client/api.js'
import { ReplayApp } from '../src/client/components/ReplayApp.js'
<<<<<<< HEAD
import { SAMPLE_LOGS } from './samples.js'
=======
import { SAMPLE_LOGS, SESSION_A_ID } from './samples.js'
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
// eslint-disable-next-line import/no-unresolved
import cssText from '../src/client/styles.css'

const api = new StaticReplayApi(SAMPLE_LOGS)
api.viewerUrl = './dist/viewer.js'

function DemoShell(): React.ReactElement {
  const [dark, setDark] = useState(false)
<<<<<<< HEAD
  const darkBg = dark ? '#0d0d0d' : '#f9f9f7'
  const border = dark ? '#2c2c2a' : '#e1e0d9'
=======
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
  return (
    <div data-theme={dark ? 'dark' : 'light'} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 13,
<<<<<<< HEAD
          borderBottom: `1px solid ${border}`,
          background: darkBg, color: dark ? '#fff' : '#0b0b0b',
        }}
      >
        <strong>dsh-replay</strong>
        <span style={{ opacity: 0.6 }}>demo · sample data · read-only</span>
        <span style={{ flex: 1 }} />
        <a
          href="https://github.com/MingoZhou/dsh-replay#install"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '3px 10px' }}
        >
          Install
        </a>
        <a
          href="https://github.com/MingoZhou/dsh-replay"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', opacity: 0.75, textDecoration: 'none' }}
        >
          Star ★
        </a>
        <button
          onClick={() => setDark(value => !value)}
          style={{
            font: 'inherit', cursor: 'pointer', border: `1px solid ${border}`,
=======
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
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
            borderRadius: 6, padding: '3px 10px', background: 'transparent', color: 'inherit',
          }}
        >
          {dark ? 'light' : 'dark'} mode
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
<<<<<<< HEAD
        <ReplayApp api={api} />
=======
        <ReplayApp api={api} sessionId={SESSION_A_ID} />
>>>>>>> 930f5bc9d31d316009e2f372989c19ffd642b08d
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
