/**
 * Capture README screenshots from the demo page.
 *
 *   npm run demo            # terminal 1
 *   node scripts/screenshot.mjs
 *
 * Uses a locally installed Edge/Chromium via Playwright. Set
 * PLAYWRIGHT_CHANNEL or CHROMIUM_PATH if your browser is elsewhere.
 */
import { chromium } from 'playwright'

const base = process.env.DEMO_URL ?? 'http://127.0.0.1:4173'
const executablePath = process.env.CHROMIUM_PATH
const channel = process.env.PLAYWRIGHT_CHANNEL ?? (executablePath === undefined ? 'msedge' : undefined)
const browser = await chromium.launch({ headless: true, channel, executablePath })

async function capture(lang) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  await page.addInitScript(code => localStorage.setItem('dshr-lang', code), lang)
  await page.goto(base)
  await page.waitForSelector('.dshr-dash-row', { timeout: 15000 })
  await page.waitForTimeout(500)
  const suffix = lang === 'zh' ? 'zh' : 'light'
  const tab = text => page.locator('.dshr-tab', { hasText: text }).first()

  await page.screenshot({ path: `assets/dashboard-${suffix}.png` })
  await page.click('.dshr-dash-row:has-text("Build REST API")')
  await page.waitForSelector('.dshr-tile', { timeout: 15000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `assets/overview-${suffix}.png` })
  await page.locator('.dshr-cost-panel').screenshot({ path: `assets/cost-${suffix}.png` })

  await tab(lang === 'zh' ? '时间线' : 'Timeline').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `assets/timeline-${suffix}.png` })

  await tab(lang === 'zh' ? '审计' : 'Audit').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `assets/audit-${suffix}.png` })

  await tab(lang === 'zh' ? '分支' : 'Forks').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `assets/forks-${suffix}.png` })

  await tab(lang === 'zh' ? '对比' : 'Compare').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `assets/compare-${suffix}.png` })

  await tab(lang === 'zh' ? '导出 HTML' : 'Export HTML').click()
  await page.waitForSelector('.dshr-export', { timeout: 10000 })
  await page.waitForSelector('.dshr-export .dshr-btn-primary:not([disabled])', { timeout: 15000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `assets/export-${suffix}.png` })
  await page.close()
}

await capture('zh')
await capture('en')
await browser.close()
console.log('screenshots written to assets/')
