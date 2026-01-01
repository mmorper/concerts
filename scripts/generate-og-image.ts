import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'

const SITE_URL = 'https://concerts.morperhaus.org'
const OUTPUT_DIR = 'public'

async function captureScene(page: any, sceneNumber: number, outputPath: string) {
  console.log(`Capturing scene ${sceneNumber}...`)

  // Scroll to the scene
  await page.evaluate((scene: number) => {
    const scrollContainer = document.querySelector('.snap-y')
    if (scrollContainer) {
      const windowHeight = window.innerHeight
      scrollContainer.scrollTo({
        top: (scene - 1) * windowHeight,
        behavior: 'instant' as ScrollBehavior
      })
    }
  }, sceneNumber)

  // Wait for scene to render
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Take screenshot
  await page.screenshot({
    path: outputPath,
    type: 'png',
    fullPage: false
  })

  console.log(`✓ Scene ${sceneNumber} saved to ${outputPath}`)
}

async function main() {
  console.log('Launching browser...')
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

  // Wait for initial render
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Capture all 5 scenes
  const scenes = [
    { num: 1, name: 'timeline' },
    { num: 2, name: 'venues' },
    { num: 3, name: 'map' },
    { num: 4, name: 'genres' },
    { num: 5, name: 'artists' }
  ]

  for (const scene of scenes) {
    const outputPath = path.join(OUTPUT_DIR, `scene-${scene.num}-${scene.name}.png`)
    await captureScene(page, scene.num, outputPath)
  }

  await browser.close()
  console.log('\n✓ All screenshots captured!')
  console.log('\nNext: Use an image editor to create the composite OG image (1200x630px)')
  console.log('Suggested layout: Grid showing all 5 scenes with title overlay')
}

main().catch(console.error)
