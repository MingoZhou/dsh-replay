/** Tiny static server for the demo page: `npm run demo` → http://localhost:4173 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const port = Number(process.env.PORT ?? 4173)

createServer(async (req, res) => {
  const path = normalize(new URL(req.url ?? '/', 'http://x').pathname).replace(/^([./\\])+/u, '')
  const file = join(root, path === '' || path === '.' ? 'index.html' : path)
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`dsh-replay demo: http://localhost:${port}`))
