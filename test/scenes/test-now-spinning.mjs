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

    await rules(browser, fail)

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

/**
 * The page's rules that aren't one fixture: the token, a refused token, the contract's
 * forward-compatibility rules, mirroring, and the black screen. States go in through the page's
 * own apply(), which is where every WebSocket message and poll arrives; the Worker's 401 is faked
 * by intercepting the page's requests.
 */
async function rules(browser, fail) {
  const TOKEN = 'ab'.repeat(32)
  const OTHER = 'cd'.repeat(32)
  const page = await browser.newPage()
  page.on('pageerror', e => fail('rules', `uncaught error: ${e.message}`))
  const urls = []
  let answer = { status: 401, body: '{"error":"unauthorized"}' }
  await page.setRequestInterception(true)
  page.on('request', r => {
    urls.push(r.url())
    if (r.url().includes('/api/now-spinning')) r.respond({ ...answer, contentType: 'application/json' })
    else r.continue()
  })
  const ok = (name, pass, why = '') => (pass ? console.log(`  ✓ ${name}`) : fail(name, why))
  const at = msAgo => new Date(Date.now() - msAgo).toISOString()
  const stage = () => page.evaluate(() => document.getElementById('stage').className)

  // The token: kept, taken out of the address, never in a URL; a 401 stops the page on idle.
  await page.goto(`${PAGE}#token=${TOKEN}&debug`, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
  await page.waitForFunction(() => diag.conn === 'token refused', { timeout: 15000 }).catch(() => {})
  const first = await page.evaluate(() => ({ hash: location.hash, stored: localStorage.getItem('nowSpinning.token'), conn: diag.conn }))
  ok('the token is kept and taken out of the address', first.hash === '#debug' && first.stored === TOKEN, JSON.stringify(first))
  // What reaches a server: everything before the fragment. (Puppeteer reports the page's own
  // address with its #fragment, which a browser never sends.)
  const sent = urls.map(u => u.split('#')[0])
  ok('the token never reaches a server in a URL', !sent.some(u => u.includes(TOKEN)), sent.filter(u => u.includes(TOKEN)).join(', '))
  ok('a refused token stops on the idle screen', first.conn === 'token refused' && (await stage()).includes('idle'), first.conn)

  // A new token in the same tab starts again, without a reload.
  answer = { status: 200, body: JSON.stringify({ v: 1, kind: 'idle', at: at(0), now: at(0) }) }
  await page.evaluate(t => { location.hash = `token=${t}&debug` }, OTHER)
  await page.waitForFunction(() => diag.conn !== 'token refused', { timeout: 10000 }).catch(() => {})
  const second = await page.evaluate(() => ({ conn: diag.conn, stored: localStorage.getItem('nowSpinning.token') }))
  ok('a new token after a refusal starts again', second.conn !== 'token refused' && second.stored === OTHER, JSON.stringify(second))
  await page.close()

  // The heartbeat, with a stand-in WebSocket: a pong keeps the socket; a missing pong by the next
  // ping drops it, and the page falls back to polling and reconnects.
  const h = await browser.newPage()
  h.on('pageerror', e => fail('rules', `uncaught error: ${e.message}`))
  await h.setRequestInterception(true)
  h.on('request', r => (r.url().includes('/api/now-spinning') ? r.respond({ ...answer, contentType: 'application/json' }) : r.continue()))
  await h.evaluateOnNewDocument(() => {
    // Count the live 30 s heartbeat timers, through every reconnect.
    const active = new Map()
    const si = window.setInterval.bind(window)
    const ci = window.clearInterval.bind(window)
    window.setInterval = (fn, ms, ...rest) => { const id = si(fn, ms, ...rest); active.set(id, ms); return id }
    window.clearInterval = id => { active.delete(id); ci(id) }
    window.__beats = () => [...active.values()].filter(ms => ms === 30000).length
    window.__sent = []
    window.__closed = 0
    window.WebSocket = class {
      static OPEN = 1
      constructor() {
        this.readyState = 0
        window.__sock = this
        setTimeout(() => { this.readyState = 1; this.onopen && this.onopen() }, 20)
      }
      send(m) { window.__sent.push(m) }
      close() { this.readyState = 3; window.__closed++ }
    }
  })
  await h.goto(`${PAGE}#token=${TOKEN}`, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
  await h.waitForFunction(() => diag.conn === 'live', { timeout: 5000 }).catch(() => {})
  const beat = await h.evaluate(() => {
    heartbeat()                                   // ping
    const sentFirst = [...window.__sent]
    window.__sock.onmessage({ data: 'pong' })     // answered
    heartbeat()                                   // ping again: still alive
    const closedAfterPong = window.__closed
    heartbeat()                                   // no pong since the last ping: dead
    return { sentFirst, sent: window.__sent.length, closedAfterPong, closed: window.__closed, conn: diag.conn, raw: diag.raw }
  })
  ok('the page sends a heartbeat ping', beat.sentFirst.length === 1 && beat.sentFirst[0] === 'ping', JSON.stringify(beat))
  ok('a pong keeps the socket, and is not taken for a state', beat.closedAfterPong === 0 && beat.raw === null, JSON.stringify(beat))
  ok('no pong by the next ping drops the socket and reconnects', beat.closed === 1 && beat.conn !== 'live', JSON.stringify(beat))
  const dropped = await h.evaluate(() => ({ beats: window.__beats(), drop: diag.lastDrop && diag.lastDrop.reason, panel: document.getElementById('debug').innerText }))
  ok('a dropped socket stops its heartbeat, and the panel says why', dropped.beats === 0 && dropped.drop === 'no heartbeat', JSON.stringify({ ...dropped, panel: undefined }))

  const live = () => h.waitForFunction(() => diag.conn === 'live', { timeout: 10000 }).catch(() => {})
  await live()
  ok('a live socket runs exactly one 30 s heartbeat', (await h.evaluate(() => window.__beats())) === 1)
  for (let i = 0; i < 3; i++) {
    await h.evaluate(() => window.__sock.onclose())   // the network drops it; the page reconnects
    await h.waitForFunction(() => diag.conn !== 'live', { timeout: 2000 }).catch(() => {})
    await live()
  }
  ok('reconnecting never stacks heartbeats', (await h.evaluate(() => window.__beats())) === 1, String(await h.evaluate(() => window.__beats())))

  answer = { status: 401, body: '{"error":"unauthorized"}' }
  await h.evaluate(() => window.__sock.onclose())
  await h.waitForFunction(() => diag.conn === 'token refused', { timeout: 15000 }).catch(() => {})
  ok('a refused token stops the heartbeat', (await h.evaluate(() => [diag.conn, window.__beats()].join(','))) === 'token refused,0')

  answer = { status: 200, body: JSON.stringify({ v: 1, kind: 'idle', at: at(0), now: at(0) }) }
  await h.evaluate(t => { location.hash = `token=${t}` }, OTHER)
  await live()
  ok('a new token starts one heartbeat again', (await h.evaluate(() => window.__beats())) === 1)
  await h.close()

  // The rest needs no Worker: states straight into apply(), as the socket would deliver them.
  const p = await browser.newPage()
  p.on('pageerror', e => fail('rules', `uncaught error: ${e.message}`))
  await p.goto(PAGE, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUTS.navigation })
  await p.evaluate(() => localStorage.removeItem('nowSpinning.flip'))
  const send = s => p.evaluate(s => apply(s), s)
  const cls = () => p.evaluate(() => document.getElementById('stage').className)
  const heard = STATES.heard

  await send({ v: 1, kind: 'party', at: at(0), now: at(0) })
  ok('an unknown kind renders as idle', (await cls()).includes('idle'))

  await send({ ...heard, at: at(0), now: at(0), track: { ...heard.track, screen: 'future-screen', title: 'Song Only' } })
  const unknownScreen = await p.evaluate(() => ({ title: document.querySelector('.info .title')?.textContent, live: !!document.querySelector('.info .live') }))
  ok('an unknown screen renders the song only', unknownScreen.title === 'Song Only' && !unknownScreen.live, JSON.stringify(unknownScreen))

  // Mirroring: each record after idle flips the layout, and the choice is remembered.
  await send({ v: 1, kind: 'idle', at: at(0), now: at(0) })
  await send({ ...heard, at: at(0), now: at(0) })
  const flip1 = (await cls()).includes('flip')
  await send({ v: 1, kind: 'idle', at: at(0), now: at(0) })
  await send({ ...heard, at: at(0), now: at(0), track: { ...heard.track, title: 'Next Record' } })
  const flip2 = (await cls()).includes('flip')
  const stored = await p.evaluate(() => localStorage.getItem('nowSpinning.flip'))
  ok('each new record mirrors the layout, and it is remembered', flip1 !== flip2 && stored === (flip2 ? '1' : '0'), `${flip1} → ${flip2}, stored ${stored}`)

  // Idle for 10 minutes, by the Worker's clock: black. A notice stays, dim.
  const old = at(11 * 60_000)
  await send({ v: 1, kind: 'idle', at: old, now: at(0), notice: 'The listener has been offline since 3:12 PM.' })
  await new Promise(r => setTimeout(r, 300))
  const dark = await p.evaluate(() => {
    const n = document.getElementById('darkNote')
    return { cls: document.getElementById('stage').className, note: n.classList.contains('on'), pos: n.style.left + ',' + n.style.top }
  })
  ok('idle for 10 minutes goes black, keeping the notice', dark.cls.includes('dark') && dark.note, JSON.stringify(dark))

  // The same state again (a poll, with a new `now`) changes nothing on screen.
  await send({ v: 1, kind: 'idle', at: old, now: at(-10_000), notice: 'The listener has been offline since 3:12 PM.' })
  await new Promise(r => setTimeout(r, 300))
  const pos = await p.evaluate(() => { const n = document.getElementById('darkNote'); return n.style.left + ',' + n.style.top })
  ok('a repeated state (a poll) leaves the screen as it was', pos === dark.pos, `${dark.pos} → ${pos}`)
  await p.close()
}

run().catch(error => {
  console.error(`\n💥 ${error.message}`)
  process.exit(1)
})
