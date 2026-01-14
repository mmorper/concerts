import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()

console.log('Navigating to geography scene...')
await page.goto('http://localhost:5173?scene=geography', {
  waitUntil: 'networkidle2',
  timeout: 30000
})

await new Promise(r => setTimeout(r, 2500))

const allTestIds = await page.evaluate(() => {
  const elements = document.querySelectorAll('[data-testid]')
  return Array.from(elements).map(el => el.getAttribute('data-testid'))
})

console.log('All test IDs:', allTestIds.slice(0, 30))

await browser.close()
