/**
 * Capture the README screenshots from the demo page.
 *   npm run build && npm run demo   (in another terminal)
 *   npm run screenshots
 * Playwright writes PNG; the README uses WebP copies (e.g. `cwebp -q 84 x.png -o x.webp`).
 * Override the demo address with DEMO_URL and the browser with CHROMIUM_PATH.
 */
import { chromium } from 'playwright'

const base = process.env.DEMO_URL ?? 'http://localhost:4173'
const A = 'a7f3c2d1-4b5e-4a6f-8c9d-0e1f2a3b4c5d'
const tab = n => `.dshr-tab:nth-child(${n})`

/** name → query string + clicks to perform before the capture. */
const shots = [
  { name: 'report-zh', q: 'lang=zh', h: 1180 },
  { name: 'report-en', q: 'lang=en', h: 1180 },
  { name: 'report-dark', q: 'lang=zh&theme=dark', h: 1180 },
  { name: 'dashboard-zh', q: 'lang=zh&view=home', h: 1040 },
  { name: 'dashboard-dark', q: 'lang=en&view=home&theme=dark', h: 1040 },
  { name: 'timeline-zh', q: 'lang=zh', steps: [tab(2), '.dshr-item[data-failed]'] },
  { name: 'timeline-diff', q: 'lang=zh', steps: [tab(2)], fill: 'apply_patch', then: ['.dshr-item[data-kind=tool]'] },
  { name: 'files-zh', q: 'lang=zh', steps: [tab(3)] },
  { name: 'audit-zh', q: 'lang=zh', steps: [tab(4)], h: 640 },
  { name: 'forks-zh', q: `lang=zh&session=${A}`, steps: [tab(5)], h: 640 },
  { name: 'compare-zh', q: `lang=zh&session=${A}`, steps: [tab(6)], h: 700 },
  { name: 'share-zh', q: 'lang=zh', steps: ['.dshr-header .dshr-btn'], h: 760 },
  { name: 'pricing-zh', q: 'lang=zh', steps: ['.dshr-header .dshr-iconbtn:nth-last-child(2)'], h: 860 },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined })
for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: 1360, height: shot.h ?? 860 },
    deviceScaleFactor: Number(process.env.DPR ?? 1.5),
    locale: shot.q.includes('lang=en') ? 'en-US' : 'zh-CN',
  })
  const page = await context.newPage()
  await page.goto(`${base}/index.html?${shot.q}`)
  await page.waitForSelector('.dshr-tile, .dshr-item')
  for (const selector of shot.steps ?? []) {
    await page.click(selector)
    await page.waitForTimeout(350)
  }
  if (shot.fill !== undefined) {
    await page.fill('.dshr-search input', shot.fill)
    await page.waitForTimeout(200)
  }
  for (const selector of shot.then ?? []) {
    await page.click(selector)
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(300)
  await page.screenshot({ path: `assets/${shot.name}.png` })
  console.log('captured', `assets/${shot.name}.png`)
  await context.close()
}
await browser.close()
