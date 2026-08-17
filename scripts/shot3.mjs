import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 1360, height: 820 } })
await page.goto('http://localhost:4173')
await page.waitForSelector('.dshr-tile')
await page.screenshot({ path: 'assets/overview-light.png' })
// timeline with filter bar
await page.click('.dshr-tab:has-text("Timeline")')
await page.waitForTimeout(300)
await page.fill('.dshr-filter-input', 'jest')
await page.waitForTimeout(300)
await page.screenshot({ path: 'assets/timeline-filter.png' })
// test export works
const download = await Promise.all([
  page.waitForEvent('download'),
  page.click('button:has-text("Export HTML")'),
]).then(([d]) => d)
const path = await download.path()
console.log('export ok:', await download.suggestedFilename())
// open exported file to verify it renders
const page2 = await browser.newPage({ viewport: { width: 1360, height: 820 } })
await page2.goto('file://' + path)
await page2.waitForSelector('.dshr-tile', { timeout: 8000 })
await page2.screenshot({ path: 'assets/export-standalone.png' })
console.log('export renders ok')
await browser.close()
