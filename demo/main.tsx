/** Standalone demo page: the same components, fed by StaticReplayApi. */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { StaticReplayApi } from '../src/client/api.js'
import { ReplayApp } from '../src/client/components/ReplayApp.js'
import { SAMPLE_LOGS, SESSION_E_ID } from './samples.js'
// eslint-disable-next-line import/no-unresolved
import cssText from '../src/client/styles.css'

const api = new StaticReplayApi(SAMPLE_LOGS).withViewer('./dist/viewer.js')
const params = new URLSearchParams(location.search)
const start = params.get('view') === 'home' ? undefined : params.get('session') ?? SESSION_E_ID

function DemoShell(): React.ReactElement {
  const [dark, setDark] = useState(params.get('theme') === 'dark')
  return (
    <div className="dshr-shell" data-theme={dark ? 'dark' : 'light'}>
      <div className="dshr-shell-main">
        <ReplayApp api={api} sessionId={start} initialLang={params.get('lang') === 'en' ? 'en' : params.get('lang') === 'zh' ? 'zh' : undefined} />
      </div>
      <div className="dshr-shell-foot">
        <span>
          <strong>dsh-replay</strong> demo — sample sessions, no harness required
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

createRoot(document.getElementById('root')!).render(<DemoShell />)
