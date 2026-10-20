# Privacy

dsh-replay is a local, read-only viewer for DeepSeek Harness session logs.

## What it reads

- Session headers and event logs through DSH's `ctx.sessionQuery` service.
- The local DSH web server serves the UI and the replay API on loopback.

It does **not** send session content to a model, a cloud service, or an
analytics endpoint.

## What it stores

- The plugin writes **no session data**.
- The browser stores two small preferences in `localStorage`:
  `dshr-lang` (language) and `dshr-pricing-overrides` (your price edits).
- Exported HTML files contain the session data you chose to export. They are
  written by your browser to your download folder.

## Network access

- The UI calls the local DSH origin only (`/replay/api/...`).
- The exported HTML is fully self-contained and makes no network requests.
- The README/demo link to GitHub and the demo site; those are ordinary web
  pages, not part of the plugin runtime.

## Sharing

Session logs are raw data. They can contain API keys, `.env` contents, customer
data, home-directory paths, and private prompts. The export dialog masks common
credentials and home paths and shows how many values will be masked, but this is
best-effort. Review the file before posting it publicly.

For a private report, use the security advisory flow in [SECURITY.md](SECURITY.md).
