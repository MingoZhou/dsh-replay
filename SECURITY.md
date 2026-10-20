# Security policy

dsh-replay reads local session logs. Those logs can contain prompts, source code,
API keys, customer data, and shell output. Treat the plugin and any exported HTML
as sensitive.

## Reporting a vulnerability

Please use GitHub's private **Security advisory** flow:

https://github.com/MingoZhou/dsh-replay/security/advisories/new

Do not post real API keys, session ids, or customer data in a public issue.
If you need to demonstrate a leak, redact the payload first.

Useful reports include:

- the dsh-replay version and DSH version;
- whether the host API was reachable from another origin/host;
- the exact route or UI action;
- a **redacted** sample event.

## Supported versions

| dsh-replay | DSH | Status |
| --- | --- | --- |
| 0.4.2 | Desktop 0.2.1-rc.2 / Web 0.2.x | supported |
| 0.4.1 | rc.8 era | upgrade recommended |
| earlier | — | unsupported |

## Security model

- The plugin makes **no model calls**. "Replay" means read-only visualization.
- The host API is **loopback-only by default**. It registers on the DSH web
  server directly and does not inherit the Connection cookie checks, so
  `allowRemote` is an explicit opt-in and remains unauthenticated.
- The API is read-only (`GET`/`HEAD`); it never writes session logs.
- HTML export is generated in the browser. Redaction is best-effort pattern
  matching, not a guarantee. Review the export dialog's redaction count before
  sharing.
- No telemetry is collected by the plugin. The demo and npm/GitHub pages are
  separate web properties.
