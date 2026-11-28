#!/usr/bin/env tsx
/**
 * Share cards for the How It Works pages: what a link to them shows when it is posted or sent.
 *
 *   public/og/how-it-works/the-archive.jpg  — the chapter's opening picture: one real row of the
 *                                              spreadsheet and the six things it becomes
 *   public/og/how-it-works/landing.jpg      — both chapters side by side
 *
 * The Now Spinning chapter already has its own card (public/og/how-it-works/now-spinning.jpg, a
 * crop of the living-room photo); the landing card reuses it.
 *
 * REQUIRES A RUNNING SITE, like og:generate: it opens the real chapter page, so the picture is the
 * one on the page, in the page's own fonts and colours.
 *
 *   npm run dev                                         # in another terminal, then
 *   npm run og:how-it-works
 *
 *   OG_SITE_URL=https://concerts.morperhaus.org npm run og:how-it-works
 *
 * Wired into workers/meta-injector/worker.js (injectHowItWorksMeta).
 */
import puppeteer from 'puppeteer'
import sharp from 'sharp'
import fs from 'fs'

const SITE_URL = process.env.OG_SITE_URL || 'http://localhost:5173'
const OUT_DIR = 'public/og/how-it-works'
const W = 1200
const H = 630

const CARD_CSS = `
  html, body { margin: 0; background: #070b1f; }
  .og { width: ${W}px; height: ${H}px; box-sizing: border-box; position: relative; overflow: hidden;
        background: radial-gradient(1200px 600px at 20% 0%, #121a4a 0%, #070b1f 60%); color: #eef0ff; }
  .og .kicker { display: flex; align-items: center; gap: 12px; }
  .og .kicker span.dot { animation: none; }
  .og .brand { position: absolute; right: 56px; bottom: 40px; text-align: right; font-family: var(--font-serif);
               font-size: 22px; color: #c7d2fe; line-height: 1.1; }
  .og .brand small { display: block; font-family: var(--font-sans); font-size: 12px; letter-spacing: 0.2em;
                     text-transform: uppercase; color: #8189b5; margin-top: 4px; }
`

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
  })
  try {
    const page = await browser.newPage()
    // Reduced motion: the picture's streams are drawn in full at once instead of animating in.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${SITE_URL}/how-it-works/the-archive`, { waitUntil: 'networkidle2', timeout: 60_000 })
    const heroSel = 'figure[aria-label="One row of the spreadsheet, and what it becomes"] svg'
    await page.waitForSelector(heroSel, { timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    const hero = await page.$eval(heroSel, (el) => el.outerHTML)

    const shoot = async (name: string, body: string) => {
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 })
      await page.evaluate(
        (css, html) => {
          document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)
          document.body.innerHTML = `<div class="hiw og">${html}</div>`
          window.scrollTo(0, 0)
        },
        CARD_CSS,
        body,
      )
      await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))))
      await page.evaluate(() => document.fonts.ready)
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: 'png' })
      const out = `${OUT_DIR}/${name}.jpg`
      await sharp(png).resize(W, H).jpeg({ quality: 86, mozjpeg: true }).toFile(out)
      console.log(`✓ ${out}`)
    }

    // The archive chapter: title on top, the real opening picture below
    await shoot(
      'the-archive',
      `<div style="padding:48px 56px 0">
         <div class="hiw-kicker kicker"><span class="hiw-dot dot"></span>How It Works · Chapter 1</div>
         <div class="hiw-title" style="font-size:58px;margin-top:16px">How the Archive Is Built</div>
         <div style="font-family:var(--font-sans);font-size:23px;color:#b9c0e8;margin-top:12px">
           A few words in a spreadsheet become forty years of live music.</div>
       </div>
       <div style="position:absolute;left:40px;right:40px;bottom:-6px">${hero.replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>`,
    )

    // The landing page: both chapters
    await shoot(
      'landing',
      `<div style="padding:48px 56px 0">
         <div class="hiw-kicker kicker"><span class="hiw-dot dot"></span>Morperhaus Concert Archives</div>
         <div class="hiw-title" style="font-size:64px;margin-top:14px">How It Works</div>
         <div style="font-family:var(--font-sans);font-size:23px;color:#b9c0e8;margin-top:10px">
           The machinery behind forty years of live music, explained for the curious.</div>
       </div>
       <div style="position:absolute;left:56px;right:56px;top:262px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
         ${tile('How the Archive Is Built', `<div style="background:#0a0e26;height:100%;display:flex;align-items:center;padding:0 8px">${hero.replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>`)}
         ${tile('Now Spinning', `<img src="${SITE_URL}/og/how-it-works/now-spinning.jpg" style="width:100%;height:100%;object-fit:cover;display:block" />`)}
       </div>`,
    )
  } finally {
    await browser.close()
  }
}

function tile(title: string, inner: string) {
  return `<div>
    <div style="height:236px;border-radius:16px;overflow:hidden;border:1px solid rgba(165,180,252,0.25)">${inner}</div>
    <div style="font-family:var(--font-serif);font-size:26px;font-weight:700;margin-top:14px">${title}</div>
  </div>`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
