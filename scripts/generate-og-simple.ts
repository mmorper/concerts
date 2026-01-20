#!/usr/bin/env tsx
/**
 * Simplified OG Image Generator
 *
 * Takes a screenshot of the Venues scene and overlays title + dynamic stats
 */

import puppeteer from 'puppeteer'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = process.env.OG_SITE_URL || 'http://localhost:5173'
const OUTPUT_PATH = 'public/og-image.jpg'
const CACHE_PATH = 'public/og-image-stats.json'
const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = 630

interface OGStats {
  concerts: number
  scenes: number
  artists: number
  venues: number
}

function loadCachedStats(): OGStats | null {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
    }
  } catch {
    // Cache file corrupted or missing, regenerate
  }
  return null
}

function saveCachedStats(stats: OGStats): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(stats, null, 2))
}

function statsMatch(a: OGStats, b: OGStats): boolean {
  return a.concerts === b.concerts &&
         a.scenes === b.scenes &&
         a.artists === b.artists &&
         a.venues === b.venues
}

async function main() {
  console.log('🎨 OG Image Generator\n')

  // Read stats directly from data file
  const dataPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const concertsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const concerts = concertsData.concerts.length
  const scenes = 5

  // Count unique artists (headliners + openers)
  const artistSet = new Set<string>()
  concertsData.concerts.forEach((concert: any) => {
    if (concert.headliner) artistSet.add(concert.headliner)
    concert.openers?.forEach((opener: string) => artistSet.add(opener))
  })
  const artists = artistSet.size

  // Count unique venues
  const venueSet = new Set(concertsData.concerts.map((c: any) => c.venue))
  const venues = venueSet.size

  const stats: OGStats = { concerts, scenes, artists, venues }

  console.log(`Current stats: ${stats.concerts} shows, ${stats.artists} artists, ${stats.venues} venues, ${stats.scenes} scenes`)

  // Check if stats have changed
  const cachedStats = loadCachedStats()
  const ogImageExists = fs.existsSync(OUTPUT_PATH)
  const forceRegenerate = process.argv.includes('--force')

  if (cachedStats && statsMatch(cachedStats, stats) && ogImageExists && !forceRegenerate) {
    console.log('\n✓ No data changes detected - skipping OG image generation')
    console.log('  (use --force to regenerate anyway)')
    return
  }

  if (forceRegenerate) {
    console.log('\n--force flag detected, regenerating...')
  } else if (!ogImageExists) {
    console.log('\nOG image missing, generating...')
  } else {
    console.log('\nData changed, regenerating OG image...')
    if (cachedStats) {
      console.log(`  Previous: ${cachedStats.concerts} shows, ${cachedStats.artists} artists, ${cachedStats.venues} venues`)
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  })

  const page = await browser.newPage()

  console.log(`\nLoading ${SITE_URL}...`)
  await page.goto(SITE_URL, { waitUntil: 'networkidle0' })
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Navigate to Venues scene (scene 2)
  console.log('\nCapturing Venues scene...')
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.snap-y')
    if (scrollContainer) {
      const windowHeight = window.innerHeight
      scrollContainer.scrollTo({
        top: windowHeight, // Scene 2 (Venues)
        behavior: 'instant' as ScrollBehavior
      })
    }
  })

  // Wait for force graph to render
  await new Promise(resolve => setTimeout(resolve, 6000))
  await page.waitForSelector('svg', { timeout: 10000 }).catch(() => {})
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Hide UI elements for cleaner OG image
  await page.evaluate(() => {
    // Hide title and subtitle
    const title = document.querySelector('h1') as HTMLElement | null
    if (title) title.style.display = 'none'

    const subtitle = document.querySelector('p.text-lg, p.text-xl') as HTMLElement | null
    if (subtitle) subtitle.style.display = 'none'

    // Hide buttons
    const buttons = document.querySelectorAll('button')
    buttons.forEach(btn => (btn as HTMLElement).style.display = 'none')

    // Hide footer text (but keep venue node labels in SVG)
    const footerTexts = document.querySelectorAll('p')
    footerTexts.forEach(p => {
      const text = p.textContent?.toLowerCase() || ''
      if (text.includes('click') || text.includes('drag') || text.includes('explore')) {
        (p as HTMLElement).style.display = 'none'
      }
    })
  })

  // Take screenshot
  const screenshotBuffer = await page.screenshot({
    type: 'png',
    fullPage: false
  })

  await browser.close()
  console.log('✓ Screenshot captured')

  // Calculate decades dynamically
  const currentYear = new Date().getFullYear()
  const startYear = 1984
  const decades = Math.ceil((currentYear - startYear) / 10)

  // Create text overlay
  const textOverlay = `
    <svg width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&amp;family=Source+Sans+3:wght@400;500;600&amp;display=swap');
          .title {
            font-family: 'Playfair Display', serif;
            font-size: 56px;
            font-weight: 400;
            fill: white;
            letter-spacing: -0.02em;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.8)) drop-shadow(0 0 24px rgba(0,0,0,0.6));
          }
          .subtitle {
            font-family: 'Source Sans 3', sans-serif;
            font-size: 22px;
            font-weight: 400;
            fill: rgba(255,255,255,0.95);
            letter-spacing: 0;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.9)) drop-shadow(0 0 16px rgba(0,0,0,0.7));
          }
        </style>
      </defs>

      <!-- Vertically centered text (630/2 = 315, adjusted for text baseline) -->
      <text x="600" y="285" text-anchor="middle" class="title">Morperhaus Concert Archives</text>
      <text x="600" y="325" text-anchor="middle" class="subtitle">${decades}+ decades. ${stats.concerts} shows. ${stats.artists} artists. ${stats.venues} venues. ${stats.scenes} interactive stories.</text>
    </svg>
  `

  console.log('\nCreating composite...')

  // Resize screenshot with zoom to fill frame and crop out edges
  // Scale up to 1.4x and crop from slightly lower to eliminate top UI text
  await sharp(screenshotBuffer)
    .resize(Math.round(OUTPUT_WIDTH * 1.4), Math.round(OUTPUT_HEIGHT * 1.4), {
      fit: 'cover',
      position: 'center'
    })
    .extract({
      left: Math.round((OUTPUT_WIDTH * 1.4 - OUTPUT_WIDTH) / 2),
      top: Math.round((OUTPUT_HEIGHT * 1.4 - OUTPUT_HEIGHT) / 2) + 40, // Shift down to crop out top text
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT
    })
    .composite([
      {
        input: Buffer.from(textOverlay),
        top: 0,
        left: 0
      }
    ])
    .jpeg({ quality: 90 })
    .toFile(OUTPUT_PATH)

  // Save stats cache for next run
  saveCachedStats(stats)

  console.log(`✓ OG image created: ${OUTPUT_PATH}`)
  console.log(`  Dimensions: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}px`)
  console.log(`  Subtitle: "${decades}+ decades. ${stats.concerts} shows. ${stats.artists} artists. ${stats.venues} venues. ${stats.scenes} interactive stories."`)
}

main().catch(console.error)
