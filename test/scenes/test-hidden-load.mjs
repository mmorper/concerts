/**
 * Hidden load test.
 *
 * Loads the app in frames that have no size, the way a hidden browser pane or
 * tab can. Leaflet's flyTo divides by the map's size, so on a 0x0 map it throws
 * `Invalid LatLng object: (NaN, NaN)` from inside a React effect. With nothing
 * to catch it, React unmounts the app and #root is left empty.
 *
 * The frame is then given a real size to prove the map comes back at the right
 * place: the guard must keep the final view, not just swallow the animation.
 */

import { setupBrowser, delay, CONFIG } from '../utils/helpers.mjs'

const CASES = [
  { name: 'display:none frame', style: 'display:none', path: '/' },
  { name: '0x0 frame', style: 'width:0;height:0;border:0', path: '/' },
  {
    name: '0x0 frame, venue deep link',
    style: 'width:0;height:0;border:0',
    path: '/?scene=geography&venue=9-30-club',
    venue: { popup: '9:30 Club', tileZoom: '13' }
  }
]

/** Load one path in a frame styled by `style`, and report what happened. */
async function loadHidden(browser, { style, path, venue }) {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.setContent(`<iframe id="app" style="${style}" src="${CONFIG.BASE_URL}${path}"></iframe>`)

  const appUrl = new URL(CONFIG.BASE_URL).origin
  const deadline = Date.now() + CONFIG.TIMEOUTS.navigation
  let frame
  let scenes = 0
  while (Date.now() < deadline) {
    frame = page.frames().find(f => f.url().startsWith(appUrl))
    scenes = frame ? await frame.evaluate(() => document.querySelectorAll('section').length).catch(() => 0) : 0
    if (scenes > 0 || pageErrors.length > 0) break
    await delay(100)
  }

  // Past the deep link's flight and popup delay, so a late failure still counts.
  await delay(CONFIG.TIMEOUTS.d3Animation)
  if (venue && frame) {
    await frame.waitForSelector('.leaflet-popup-content', { timeout: CONFIG.TIMEOUTS.navigation }).catch(() => {})
  }

  const rootChildren = frame
    ? await frame.evaluate(() => document.getElementById('root')?.childElementCount ?? 0).catch(() => 0)
    : 0
  const sceneErrors = frame
    ? await frame.evaluate(() => document.querySelectorAll('[data-testid="scene-error"]').length).catch(() => 0)
    : 0

  return { page, frame, pageErrors, rootChildren, sceneErrors }
}

/** Give the frame a real size, then measure the map. */
async function reveal(page, frame) {
  await page.evaluate(() => {
    const el = document.getElementById('app')
    el.style.cssText = 'display:block;width:1200px;height:800px;border:0'
  })
  await delay(CONFIG.TIMEOUTS.interaction)

  return frame.evaluate(() => {
    const map = document.querySelector('.leaflet-container')
    if (!map) return null
    const box = map.getBoundingClientRect()
    const onScreen = [...map.querySelectorAll('.leaflet-marker-pane *, path.leaflet-interactive')].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom
    })
    const tileZooms = [...map.querySelectorAll('img.leaflet-tile')].map(t => t.src.match(/\/(\d+)\/\d+\/\d+/)?.[1])
    return {
      width: box.width,
      height: box.height,
      markersOnScreen: onScreen.length,
      popup: map.querySelector('.leaflet-popup-content')?.innerText ?? '',
      tileZooms: [...new Set(tileZooms)]
    }
  })
}

async function runHiddenLoadTest() {
  console.log('🧪 Starting Hidden Load Test...\n')

  const { browser } = await setupBrowser({ headless: true })
  const failures = []

  try {
    for (const testCase of CASES) {
      const { page, frame, pageErrors, rootChildren, sceneErrors } = await loadHidden(browser, testCase)

      const problems = []
      if (rootChildren === 0) problems.push('#root is empty')
      if (sceneErrors > 0) problems.push(`${sceneErrors} scene(s) fell back to the error panel`)
      if (pageErrors.length > 0) problems.push(`uncaught: ${pageErrors.join('; ')}`)

      if (problems.length === 0) {
        const map = await reveal(page, frame)
        if (!map || map.width === 0 || map.height === 0) {
          problems.push(`map did not take a size once revealed (${JSON.stringify(map)})`)
        } else if (map.markersOnScreen === 0) {
          problems.push('no venue markers on screen once revealed, so the view is wrong')
        } else if (testCase.venue && !map.popup.includes(testCase.venue.popup)) {
          problems.push(`deep link did not open the ${testCase.venue.popup} popup`)
        } else if (testCase.venue && !map.tileZooms.includes(testCase.venue.tileZoom)) {
          problems.push(`deep link landed at tile zoom ${map.tileZooms}, not ${testCase.venue.tileZoom}`)
        } else {
          console.log(`  map once revealed: ${map.markersOnScreen} markers on screen, tile zoom ${map.tileZooms}`)
        }
      }

      if (problems.length > 0) {
        failures.push(`${testCase.name}: ${problems.join(', ')}`)
        console.log(`  ✗ ${testCase.name}\n      ${problems.join('\n      ')}`)
      } else {
        console.log(`  ✓ ${testCase.name}`)
      }

      await page.close()
    }

    if (failures.length > 0) {
      throw new Error(`${failures.length} hidden load check(s) failed`)
    }

    console.log('\n✅ The app survives a load with no size')
  } finally {
    await browser.close()
  }
}

runHiddenLoadTest().catch(error => {
  console.error(`\n💥 ${error.message}`)
  process.exit(1)
})
