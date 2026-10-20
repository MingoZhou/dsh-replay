import { describe, expect, it } from 'vitest'
import { containsSecret, redactSession, redactText } from '../src/core/redact.js'
import { parseSessionJsonl } from '../src/core/decode.js'
import { sessionA } from '../demo/samples.js'

describe('redactText', () => {
  it('masks common API keys and env assignments', () => {
    const input = 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz\nTOKEN=plain-secret'
    const result = redactText(input)
    expect(result.text).not.toContain('sk-abcdefghijklmnopqrstuvwxyz')
    expect(result.text).not.toContain('plain-secret')
    expect(result.count).toBeGreaterThanOrEqual(2)
  })

  it('masks home paths and private keys', () => {
    const result = redactText('C:\\Users\\alice\\project and -----BEGIN RSA PRIVATE KEY-----abc-----END RSA PRIVATE KEY-----')
    expect(result.text).toContain('C:\\Users\\[user]\\project')
    expect(result.text).toContain('[REDACTED:private-key]')
  })

  it('containsSecret is narrower than redactText', () => {
    expect(containsSecret('alice@example.com')).toBe(false)
    expect(containsSecret('sk-abcdefghijklmnopqrstuvwxyz')).toBe(true)
  })
})

describe('redactSession', () => {
  it('redacts header paths and event payloads without changing the timeline envelope', () => {
    const parsed = parseSessionJsonl(sessionA())
    const result = redactSession(parsed)
    expect(result.session.header.cwd).toContain('[user]')
    expect(result.session.events.map(event => event.seq)).toEqual(parsed.events.map(event => event.seq))
    expect(result.count).toBeGreaterThan(0)
  })
})
