#!/usr/bin/env tsx
/**
 * Share cards for the How It Works pages: what a link to them shows when it is posted or sent.
 *
 * Driven by public/data/how-it-works.json, the same list the site and the link-preview Worker read:
 *
 * - every chapter whose share card is "rendered" gets public/og/how-it-works/{id}.jpg: its title
 *   and subtitle over its opening picture, taken from the real chapter page (the element marked
 *   `data-og-picture`). A chapter with no marked picture gets a card with its title and subtitle;
 * - a chapter whose card is "photo" keeps its hand-made image (Now Spinning's living-room photo);
 * - the landing page gets landing.jpg, with a tile for every chapter, however many there are.
 *
 * REQUIRES A RUNNING SITE, like og:generate: it opens the real chapter pages, so each picture is
 * the one on the page, in the page's own fonts and colours.
 *
 *   npm run dev                                         # in another terminal, then
 *   npm run og:how-it-works
 *
 *   OG_SITE_URL=https://concerts.morperhaus.org npm run og:how-it-works
 *
 * test/pipeline/how-it-works-share.test.ts fails while any chapter is missing its card.
 */
import puppeteer, { type Page } from 'puppeteer'
import sharp from 'sharp'
import fs from 'fs'
import data from '../public/data/how-it-works.json'

const SITE_URL = process.env.OG_SITE_URL || 'http://localhost:5173'
const W = 1200
const H = 630

type Chapter = (typeof data.chapters)[number]

const CARD_CSS = `
  html, body { margin: 0; background: #070b1f; }
  .og { width: ${W}px; height: ${H}px; box-sizing: border-box; position: relative; overflow: hidden;
        background: radial-gradient(1200px 600px at 20% 0%, #121a4a 0%, #070b1f 60%); color: #eef0ff; }
  .og .bar { width: 40px; height: 4px; border-radius: 2px; background: #818cf8; }
  .og .title { font-family: var(--font-serif); font-size: 58px; font-weight: 700; line-height: 1.15; margin-top: 16px; }
  .og .sub { font-family: var(--font-sans); font-size: 23px; color: #b9c0e8; margin-top: 12px; }
  .og svg[data-og-picture] { width: 100%; height: auto; display: block; }
`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const outPath = (image: string) => `public${image}`

/** The chapter page's marked opening picture, or null if it has none. */
async function pictureOf(page: Page, chapter: Chapter): Promise<string | null> {
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 })
  await page.goto(`${SITE_URL}${chapter.path}`, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  return page.$eval('[data-og-picture]', (el) => el.outerHTML).catch(() => null)
}

async function shoot(page: Page, file: string, body: string) {
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
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))),
  )
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: 'png' })
  await sharp(png).resize(W, H).jpeg({ quality: 86, mozjpeg: true }).toFile(file)
  console.log(`✓ ${file}`)
}

async function main() {
  fs.mkdirSync('public/og/how-it-works', { recursive: true })
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox'],
  })
  try {
    const page = await browser.newPage()
    // Reduced motion: animated pictures are captured finished, not mid-draw.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

    const pictures = new Map<string, string | null>()
    for (const chapter of data.chapters) {
      const picture = await pictureOf(page, chapter)
      pictures.set(chapter.id, picture)
      if (chapter.share.card !== 'rendered') {
        if (!fs.existsSync(outPath(chapter.share.image))) console.warn(`! ${chapter.id}: hand-made card ${chapter.share.image} is missing`)
        continue
      }
      const subtitle = (chapter.share as { subtitle?: string }).subtitle ?? chapter.dek
      await shoot(
        page,
        outPath(chapter.share.image),
        `<div style="padding:48px 56px 0">
           <div class="bar"></div>
           <div class="title">${esc(chapter.title)}</div>
           <div class="sub">${esc(subtitle)}</div>
         </div>
         ${picture ? `<div style="position:absolute;left:40px;right:40px;bottom:-6px">${picture}</div>` : ''}`,
      )
    }

    // The landing page: a tile for every chapter
    const tiles = data.chapters
      .map((c) => {
        const picture = pictures.get(c.id)
        const inner =
          c.share.card === 'photo' || !picture
            ? `<img src="${SITE_URL}${c.share.image}" style="width:100%;height:100%;object-fit:cover;display:block" />`
            : `<div style="background:#0a0e26;height:100%;display:flex;align-items:center;padding:0 8px">${picture}</div>`
        return `<div>
          <div style="height:236px;border-radius:16px;overflow:hidden;border:1px solid rgba(165,180,252,0.25)">${inner}</div>
          <div style="font-family:var(--font-serif);font-size:26px;font-weight:700;margin-top:14px">${esc(c.title)}</div>
        </div>`
      })
      .join('')
    await shoot(
      page,
      outPath(data.landing.share.image),
      `<div style="padding:48px 56px 0">
         <div class="bar"></div>
         <div class="title">${esc(data.landing.title)}</div>
         <div class="sub">${esc(data.landing.dek)}</div>
       </div>
       <div style="position:absolute;left:56px;right:56px;top:262px;display:grid;grid-template-columns:repeat(${data.chapters.length},1fr);gap:24px">
         ${tiles}
       </div>`,
    )
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
