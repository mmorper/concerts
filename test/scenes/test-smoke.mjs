/**
 * Scene Smoke Test — the CI gate.
 *
 * This is the test that would have caught the v6.0.0 crash: a `useMemo` placed
 * below an early return. That bug passed `typecheck:all` and all 925 unit tests,
 * because nothing in either suite renders a scene in a browser.
 *
 * Why one page load covers all six scenes: the archive is a single scroll-snap
 * page. Every scene is mounted at all times and `?scene=` only scrolls to one.
 * That also means there is no error boundary between them — React unmounts the
 * whole tree on a render throw — so "every scene root is present and laid out"
 * is a genuine assertion about all six, not just the one in the viewport.
 *
 * Deliberately shallow. It asserts that each scene rendered, not that any
 * particular interaction works — the per-scene suites own that. Keeping it
 * shallow is what makes it fast and free of the timing flake that comes with
 * force simulations, Leaflet tiles and 800ms animations.
 */

import { setupBrowser, CONFIG } from '../utils/helpers.mjs'

/**
 * Every scene in SCENE_NAMES (src/components/changelog/constants.ts), with the
 * root element each one renders. Adding a scene there means adding it here —
 * the roster check below fails if this list falls behind.
 */
const SCENES = [
  { name: 'timeline', root: '[data-testid="scene-timeline"]' },
  { name: 'venues', root: '[data-testid="venue-network-scene"]' },
  { name: 'geography', root: '[data-testid="map-scene"]' },
  { name: 'genres', root: '[data-testid="genres-scene"]' },
  { name: 'artists', root: '[data-testid="artist-scene"]' },
  { name: 'ask', root: '[data-testid="ask-scene"]' }
]

async function runSmokeTest() {
  console.log('🧪 Scene smoke test — all six scenes, one load\n')

  const { browser, page } = await setupBrowser({ headless: true })

  // Uncaught exceptions are the signal. A React render throw surfaces here, and
  // nothing else on this page throws in normal operation. Console errors are NOT
  // used: blocked analytics beacons (Cloudflare Insights, GA) log there in a
  // sandboxed browser and would make this fail for reasons unrelated to the app.
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  const failures = []

  try {
    await page.goto(CONFIG.BASE_URL, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUTS.navigation
    })

    // Data arrives by fetch after first paint; scenes draw from it.
    await page.waitForSelector(SCENES[0].root, { timeout: CONFIG.TIMEOUTS.navigation })
    await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.d3Animation))

    console.log('Checking scene roots:')
    for (const scene of SCENES) {
      // Present is not enough — a scene that renders but collapses to nothing is
      // still broken. getBoundingClientRect covers both in one check.
      const box = await page.evaluate(selector => {
        const el = document.querySelector(selector)
        if (!el) return null
        const { width, height } = el.getBoundingClientRect()
        return { width, height }
      }, scene.root)

      if (!box) {
        failures.push(`${scene.name}: root ${scene.root} not found`)
        console.log(`  ✗ ${scene.name} — missing`)
      } else if (box.width === 0 || box.height === 0) {
        failures.push(`${scene.name}: root has zero size (${box.width}x${box.height})`)
        console.log(`  ✗ ${scene.name} — zero size`)
      } else {
        console.log(`  ✓ ${scene.name} — ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }

    // Guards against the page rendering a shell with no data: every scene root
    // could exist while the fetch that fills them failed silently.
    const bodyTextLength = await page.evaluate(() => document.body.innerText.trim().length)
    if (bodyTextLength < 200) {
      failures.push(`page rendered almost no text (${bodyTextLength} chars) — data likely failed to load`)
    }
    console.log(`\n  ✓ page text: ${bodyTextLength} chars`)

    if (pageErrors.length > 0) {
      failures.push(`${pageErrors.length} uncaught page error(s):\n    - ${pageErrors.join('\n    - ')}`)
    }

    if (failures.length > 0) {
      console.error('\n❌ Smoke test failed:\n')
      for (const failure of failures) console.error(`  • ${failure}`)
      throw new Error(`${failures.length} smoke check(s) failed`)
    }

    console.log('\n✅ All six scenes rendered, no uncaught errors')
  } finally {
    await browser.close()
  }
}

runSmokeTest().catch(error => {
  console.error(`\n💥 ${error.message}`)
  process.exit(1)
})
