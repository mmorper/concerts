#!/usr/bin/env tsx
/**
 * OG Image Crop Preview Tool
 *
 * Generates full-scene screenshots with red rectangles showing where crops will be taken.
 * Use this to fine-tune crop coordinates before running the actual OG generation.
 *
 * Output: public/preview-scene-{N}-{name}.png with crop guides
 */

import puppeteer from 'puppeteer'
import path from 'path'

const SITE_URL = process.env.OG_SITE_URL || 'http://localhost:5173'
const OUTPUT_DIR = 'public'

interface SceneCrop {
  x: number
  y: number
  width: number
  height: number
}

const SCENE_CROPS = [
  {
    num: 1,
    name: 'timeline',
    crop: { x: 400, y: 380, width: 1120, height: 630 }
  },
  {
    num: 2,
    name: 'venues',
    crop: { x: 560, y: 290, width: 800, height: 500 }
  },
  {
    num: 3,
    name: 'map',
    crop: { x: 300, y: 300, width: 900, height: 600 }
  },
  {
    num: 4,
    name: 'genres',
    crop: { x: 660, y: 340, width: 600, height: 400 }
  },
  {
    num: 5,
    name: 'artists',
    crop: { x: 480, y: 380, width: 960, height: 600 }
  }
]

async function captureSceneWithGuide(page: any, scene: typeof SCENE_CROPS[0]) {
  console.log(`Capturing scene ${scene.num} (${scene.name})...`)

  // Scroll to the scene
  await page.evaluate((sceneNum: number) => {
    const scrollContainer = document.querySelector('.snap-y')
    if (scrollContainer) {
      const windowHeight = window.innerHeight
      scrollContainer.scrollTo({
        top: (sceneNum - 1) * windowHeight,
        behavior: 'instant' as ScrollBehavior
      })
    }
  }, scene.num)

  // Wait for scene to render
  await new Promise(resolve => setTimeout(resolve, 6000))

  // Wait for specific elements
  if (scene.num === 3) {
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10000 }).catch(() => {})
  } else if (scene.num === 4) {
    await page.waitForSelector('svg path', { timeout: 10000 }).catch(() => {})
  } else if (scene.num === 5) {
    await page.waitForSelector('[data-artist-name]', { timeout: 10000 }).catch(() => {})
  }

  await new Promise(resolve => setTimeout(resolve, 2000))

  // Draw crop guide on page
  await page.evaluate((crop: SceneCrop) => {
    const guide = document.createElement('div')
    guide.style.position = 'fixed'
    guide.style.left = `${crop.x}px`
    guide.style.top = `${crop.y}px`
    guide.style.width = `${crop.width}px`
    guide.style.height = `${crop.height}px`
    guide.style.border = '4px solid red'
    guide.style.boxShadow = '0 0 0 2px yellow, 0 0 0 4px red'
    guide.style.zIndex = '999999'
    guide.style.pointerEvents = 'none'

    // Add label
    const label = document.createElement('div')
    label.textContent = `Crop: ${crop.x}, ${crop.y}, ${crop.width}×${crop.height}`
    label.style.position = 'absolute'
    label.style.top = '-30px'
    label.style.left = '0'
    label.style.background = 'red'
    label.style.color = 'white'
    label.style.padding = '4px 8px'
    label.style.fontSize = '14px'
    label.style.fontWeight = 'bold'
    guide.appendChild(label)

    document.body.appendChild(guide)
  }, scene.crop)

  // Take full screenshot
  const outputPath = path.join(OUTPUT_DIR, `preview-scene-${scene.num}-${scene.name}.png`)
  await page.screenshot({
    path: outputPath,
    type: 'png',
    fullPage: false
  })

  console.log(`✓ Preview saved: ${outputPath}`)
}

async function main() {
  console.log('🎨 OG Crop Preview Generator\n')
  console.log('Launching browser...')

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  })

  const page = await browser.newPage()

  console.log(`Loading ${SITE_URL}...\n`)
  await page.goto(SITE_URL, { waitUntil: 'networkidle0' })
  await new Promise(resolve => setTimeout(resolve, 3000))

  for (const scene of SCENE_CROPS) {
    await captureSceneWithGuide(page, scene)
  }

  await browser.close()

  console.log('\n✅ Preview generation complete!')
  console.log('\nReview the preview-scene-*.png files in public/')
  console.log('Red boxes show where crops will be taken.')
  console.log('\nTo adjust crops, edit SCENE_CROPS in this file or scripts/generate-og-image.ts')
}

main().catch(console.error)
