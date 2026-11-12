/**
 * Build the three artifacts:
 *   lib/index.js   — host half (ESM, externals: @deepseek-ai/*, node:*)
 *   lib/client.js  — browser half, classic script registering a lazy CJS
 *                    factory with window.__ModuleLoader__ (the dsh web
 *                    loader contract); externals resolve via the injected
 *                    require from the loader's module table.
 *   demo/dist/demo.js — fully self-contained demo bundle (react inlined).
 */
import { build } from 'esbuild'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'

const cssAsText = { loader: { '.css': 'text' } }

await mkdir('lib', { recursive: true })
await mkdir('demo/dist', { recursive: true })

// ---- mascot artwork ----
// The UI embeds a small avatar only: assets/mascot-192.{webp,png,jpg} (a
// 192 px square, ~10 KB). Anything over 60 KB is refused — the image is
// inlined into the client bundle, the viewer bundle and every exported HTML
// file, so its weight is paid three times. Without one, the built-in SVG is used.
{
  const { readFile, stat } = await import('node:fs/promises')
  const candidates = [
    ['assets/mascot-192.webp', 'image/webp'],
    ['assets/mascot-192.png', 'image/png'],
    ['assets/mascot-192.jpg', 'image/jpeg'],
  ]
  let source = 'export const mascotImage: string | undefined = undefined\n'
  let found = false
  for (const [file, mime] of candidates) {
    try {
      const info = await stat(file)
      found = true
      if (info.size > 60_000) {
        console.warn(`mascot: ${file} is ${Math.round(info.size / 1024)} KB — resize it to 192×192 (≤60 KB) to embed; using built-in SVG for now`)
      } else {
        const b64 = (await readFile(file)).toString('base64')
        source = `export const mascotImage: string | undefined = 'data:${mime};base64,${b64}'\n`
        console.log(`mascot: embedded ${file} (${(info.size / 1024).toFixed(1)} KB)`)
      }
      break
    } catch {
      /* try next candidate */
    }
  }
  if (!found) console.log('mascot: no assets/mascot-192.{webp,png,jpg} found — using built-in SVG fallback')
  await writeFile('src/client/mascot-image.ts', source)
}

// ---- host half ----
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: ['@deepseek-ai/*', 'node:*'],
  ...{},
})

// ---- core as its own importable entry (for standalone/tooling use) ----
await build({
  entryPoints: ['src/core/index.ts'],
  outfile: 'lib/core.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
})

// ---- browser half ----
const client = await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  ...cssAsText,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*'],
  minify: true,
  write: false,
})
const cjs = client.outputFiles[0].text
const wrapped = `/* dsh-replay client bundle — registers a lazy CJS factory with the dsh web loader. */
;(function () {
  var factory = function (require) {
    var module = { exports: {} };
    (function (require, module, exports) {
${cjs}
    })(require, module, module.exports);
    return module.exports;
  };
  if (typeof window !== 'undefined' && window.__ModuleLoader__) {
    window.__ModuleLoader__.load({ id: '@mingozhou/dsh-replay', factory: factory });
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(typeof require === 'function' ? require : function (id) {
      throw new Error('unresolvable external: ' + id);
    });
  }
})();
`
await writeFile('lib/client.js', wrapped)

// ---- standalone viewer (react inlined; embedded into exported HTML) ----
await build({
  entryPoints: ['src/client/viewer-entry.tsx'],
  outfile: 'lib/viewer.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  ...cssAsText,
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
})
await copyFile('lib/viewer.js', 'demo/dist/viewer.js')

// ---- demo ----
await build({
  entryPoints: ['demo/main.tsx'],
  outfile: 'demo/dist/demo.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  ...cssAsText,
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
})

{
  const { stat } = await import('node:fs/promises')
  const sizes = await Promise.all(
    ['lib/index.js', 'lib/core.js', 'lib/client.js', 'lib/viewer.js', 'demo/dist/demo.js'].map(
      async file => `${file} ${((await stat(file)).size / 1024).toFixed(0)} KB`,
    ),
  )
  console.log(`build ok: ${sizes.join(' · ')}`)
}
