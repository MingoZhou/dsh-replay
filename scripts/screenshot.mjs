/** Capture README screenshots from the demo page (light + dark, all tabs). */
import { chromium } from 'playwright'

const base = process.env.DEMO_URL ?? 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? undefined,
})
const page = await browser.newPage({ viewport: { width: 1360, height: 820 } })
await page.goto(base)
await page.waitForSelector('.dshr-item')

const shots = [
  { tab: null, file: 'assets/timeline-light.png' },
  { tab: 'Audit', file: 'assets/audit-light.png' },
  { tab: 'Forks', file: 'assets/forks-light.png' },
  { tab: 'Compare', file: 'assets/compare-light.png' },
]
for (const { tab, file } of shots) {
  if (tab !== null) await page.click(`.dshr-tab:text-is("${tab}")`).catch(() => page.click(`.dshr-tab:has-text("${tab}")`))
  await page.waitForTimeout(400)
  await page.screenshot({ path: file })
  console.log('captured', file)
}

// dark timeline
await page.click('.dshr-tab:has-text("Timeline")')
await page.click('text=dark mode')
await page.waitForTimeout(300)
await page.screenshot({ path: 'assets/timeline-dark.png' })
console.log('captured assets/timeline-dark.png')

await browser.close()
