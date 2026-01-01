#!/usr/bin/env tsx
/**
 * Simplified OG Image Generator
 *
 * Takes a screenshot of the Venues scene and overlays title + dynamic stats
 */

import puppeteer from 'puppeteer'
import sharp from 'sharp'
import fs from 'fs'

const SITE_URL = process.env.OG_SITE_URL || 'http://localhost:5173'
const OUTPUT_PATH = 'public/og-image.jpg'
const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = 630

async function main() {
  console.log('🎨 Generating simplified OG image\n')

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  })

  const page = await browser.newPage()

  console.log(`Loading ${SITE_URL}...`)
  await page.goto(SITE_URL, { waitUntil: 'networkidle0' })
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Extract stats from live page
  const stats = await page.evaluate(() => {
    const concerts = document.querySelectorAll('[data-concert-id]').length || 175
    const scenes = 5
    const artistElements = document.querySelectorAll('[data-artist-name]')
    const artists = artistElements.length || 248

    // Try to count venues from the data
    const venueElements = document.querySelectorAll('[data-venue-name]')
    const venues = venueElements.length || 77

    return { concerts, scenes, artists, venues }
  })

  console.log(`Stats: ${stats.concerts} shows, ${stats.artists} artists, ${stats.venues} venues, ${stats.scenes} scenes`)

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
    const title = document.querySelector('h1')
    if (title) title.style.display = 'none'

    const subtitle = document.querySelector('p.text-lg, p.text-xl')
    if (subtitle) subtitle.style.display = 'none'

    // Hide buttons
    const buttons = document.querySelectorAll('button')
    buttons.forEach(btn => btn.style.display = 'none')

    // Hide footer text (but keep venue node labels in SVG)
    const footerTexts = document.querySelectorAll('p')
    footerTexts.forEach(p => {
      const text = p.textContent?.toLowerCase() || ''
      if (text.includes('click') || text.includes('drag') || text.includes('explore')) {
        p.style.display = 'none'
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
          }
          .subtitle {
            font-family: 'Source Sans 3', sans-serif;
            font-size: 18px;
            font-weight: 400;
            fill: rgba(255,255,255,0.9);
            letter-spacing: 0;
          }
        </style>
      </defs>

      <!-- Semi-transparent background for better contrast -->
      <rect x="0" y="0" width="${OUTPUT_WIDTH}" height="160" fill="rgba(0, 0, 0, 0.4)" />

      <text x="600" y="70" text-anchor="middle" class="title">Morperhaus Concert Archives</text>
      <text x="600" y="110" text-anchor="middle" class="subtitle">${decades}+ decades. ${stats.concerts} shows. ${stats.artists} artists. ${stats.venues} venues. ${stats.scenes} interactive stories.</text>
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

  console.log(`✓ OG image created: ${OUTPUT_PATH}`)
  console.log(`  Dimensions: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}px`)
  console.log(`  Subtitle: "${decades}+ decades. ${stats.concerts} shows. ${stats.artists} artists. ${stats.venues} venues. ${stats.scenes} interactive stories."`)
}

main().catch(console.error)
