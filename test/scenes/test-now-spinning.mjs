/**
 * Now Spinning display page (#694): every state in the contract renders.
 *
 * Loads public/now-spinning.html with ?fixture=<name> for every example in
 * test/fixtures/now-spinning-states.json, the same file the Worker's tests produce and the tvOS
 * app's previews read. Asserts properties of what is drawn against what the state says, so a
 * fixture regenerated with new copy still passes and a page that drops a field fails.
 *
 * The live half (WebSocket, polling, reconnect, the 10-minute black screen) needs a Worker and is
 * checked after deploy (#694's Done-when list).
 */

import { readFileSync } from 'node:fs'
import { setupBrowser, CONFIG } from '../utils/helpers.mjs'

const STATES = JSON.parse(readFileSync(new URL('../fixtures/now-spinning-states.json', import.meta.url), 'utf8'))
const PAGE = `${CONFIG.BASE_URL}/now-spinning.html`

async function run() {
  console.log('🧪 Now Spinning page — every state in the contract\n')
  const { browser, page } = await setupBrowser({ headless: true })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const apiCalls = []
  page.on('request', request => { if (request.url().includes('/api/now-spinning')) apiCalls.push(request.url()) })
  const failures = []
  const fail = (name, why) => { failures.push(`${name}: ${why}`); console.log(`  ✗ ${name} — ${why}`) }

  try {
    // The page itself: not indexed, no analytics, and no token means no connection attempt.
    await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
    const head = await page.evaluate(() => ({
      robots: document.querySelector('meta[name="robots"]')?.content ?? '',
      analytics: !!document.querySelector('script[src*="googletagmanager"], script[src*="gtag"]'),
      conn: diag.conn,
    }))
    if (!head.robots.includes('noindex')) fail('page', 'missing noindex')
    if (head.analytics) fail('page', 'has an analytics tag')
    if (head.conn !== 'no token') fail('page', `without a token it should say "no token", says "${head.conn}"`)

    for (const [name, state] of Object.entries(STATES)) {
      if (name.startsWith('_')) continue
      await page.goto(`${PAGE}?fixture=${name}`, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
      await page.waitForFunction(() => diag.raw !== null, { timeout: 10000 }).catch(() => {})
      const seen = await page.evaluate(() => ({
        stage: document.getElementById('stage').className,
        title: document.querySelector('.info .title')?.textContent ?? null,
        big: document.querySelector('.info .big')?.textContent ?? null,
        nights: document.querySelectorAll('.info .nights li').length,
        text: document.getElementById('stage').innerText,
        note: document.getElementById('idleNote').textContent,
        raw: diag.raw,
      }))
      const before = failures.length
      if (!seen.raw) { fail(name, 'fixture never loaded'); continue }

      if (state.kind === 'idle') {
        if (!seen.stage.includes('idle')) fail(name, `idle state not shown (${seen.stage})`)
        if ((state.notice ?? '') !== seen.note) fail(name, `notice "${seen.note}", expected "${state.notice ?? ''}"`)
      } else if (state.kind === 'unmatched') {
        if (seen.title !== 'Listening…') fail(name, `title "${seen.title}"`)
      } else {
        const t = state.track
        if (seen.title !== t.title) fail(name, `title "${seen.title}", expected "${t.title}"`)
        if (!seen.text.includes(t.artist)) fail(name, `artist "${t.artist}" not shown`)
        if (!seen.text.includes(t.headline)) fail(name, `headline not shown: "${t.headline}"`)
        for (const line of t.lines) if (!seen.text.includes(line)) fail(name, `line not shown: "${line}"`)
        if (t.count && !seen.big?.startsWith(String(t.count.n))) fail(name, `numeral "${seen.big}", expected ${t.count.n}`)
        if (t.count && seen.big?.includes('×') !== t.count.times) fail(name, `"×" should be ${t.count.times ? 'drawn' : 'absent'}`)
        const nights = Math.min(4, t.nights.length) + (t.moreNights > 0 ? 1 : 0)
        if (seen.nights !== nights) fail(name, `${seen.nights} night rows, expected ${nights}`)
        // The fixture's gap began 90 s before it was sent: the words have stepped back.
        if (state.kind === 'gap' && !seen.stage.includes('faded')) fail(name, `gap past 90 s not faded (${seen.stage})`)
      }
      if (failures.length === before) console.log(`  ✓ ${name}`)
    }

    // A fixture that doesn't exist leaves the idle screen up and says why.
    await page.goto(`${PAGE}?fixture=no-such-state`, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
    const missing = await page.evaluate(() => ({ stage: document.getElementById('stage').className, conn: diag.conn }))
    if (!missing.stage.includes('idle') || !missing.conn.includes('not found')) fail('no-such-state', JSON.stringify(missing))
    else console.log('  ✓ an unknown fixture leaves the idle screen up')

    if (apiCalls.length) fail('page', `called the Worker without a token: ${apiCalls.join(', ')}`)
    if (pageErrors.length) fail('page', `uncaught error(s): ${pageErrors.join(' | ')}`)

    if (failures.length) {
      console.error(`\n❌ ${failures.length} Now Spinning check(s) failed`)
      throw new Error(`${failures.length} Now Spinning check(s) failed`)
    }
    console.log('\n✅ Every state renders')
  } finally {
    await browser.close()
  }
}

run().catch(error => {
  console.error(`\n💥 ${error.message}`)
  process.exit(1)
})
