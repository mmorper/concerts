/**
 * Map Scene (Scene 3) Visual Tests
 *
 * Tests the Leaflet map showing concert venues geographically.
 * Validates rendering, markers, popups, and map interactions.
 */

import {
  setupBrowser,
  navigateToScene,
  elementExists,
  delay,
  CONFIG
} from '../utils/helpers.mjs'
import { MAP } from '../utils/selectors.mjs'

/**
 * Main test suite
 */
async function runMapTests() {
  console.log('🧪 Starting Map Scene Tests...\n')

  const { browser, page } = await setupBrowser({ headless: true })

  try {
    // Test 1: Scene navigation
    await testSceneNavigation(page)

    // Test 2: Leaflet map loads
    await testMapLoads(page)

    // Test 3: Venue markers render
    await testVenueMarkers(page)

    // Test 4: Marker click shows popup
    await testMarkerPopup(page)

    // Test 5: Popup contains venue data
    await testPopupContent(page)

    // Test 7: Deep linking to specific venue
    await testDeepLinking(page)

    // Test 8: Responsive layout (mobile)
    await testResponsiveLayout(browser)

    console.log('\n✅ All Map Scene tests passed!')
  } catch (error) {
    console.error('\n❌ Map Scene tests failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Test 1: Scene navigation
 * Navigates to the map scene via URL parameter
 */
async function testSceneNavigation(page) {
  console.log('Test 1: Scene navigation')

  await navigateToScene(page, 'geography')
  await delay(2000) // Extra time for Leaflet to initialize

  // Verify map scene exists
  const sceneExists = await elementExists(page, MAP.scene)

  if (!sceneExists) {
    throw new Error('Map scene not found')
  }

  // Verify map container exists
  const containerExists = await elementExists(page, MAP.container)

  if (!containerExists) {
    throw new Error('Map container not found')
  }

  console.log('  ✓ Navigated to map scene successfully')

}

/**
 * Test 2: Leaflet map loads
 * Verifies the Leaflet map initializes and renders
 */
async function testMapLoads(page) {
  console.log('Test 2: Leaflet map loads')

  await navigateToScene(page, 'geography')
  await delay(2000)

  // Check if Leaflet tiles loaded
  const leafletExists = await page.evaluate(() => {
    const mapContainer = document.querySelector('[data-testid="map-container"]')
    if (!mapContainer) return false

    // Check for Leaflet's internal map object
    return mapContainer.querySelector('.leaflet-container') !== null
  })

  if (!leafletExists) {
    throw new Error('Leaflet map did not initialize')
  }

  console.log('  ✓ Leaflet map loaded successfully')

}

/**
 * Test 3: Venue markers render
 * Verifies that venue markers are displayed on the map
 */
async function testVenueMarkers(page) {
  console.log('Test 3: Venue markers')

  await navigateToScene(page, 'geography')
  await delay(4000) // Wait for markers to load (Leaflet can be slow)

  // Leaflet uses circle markers (SVG paths) in this implementation
  // Check for both standard Leaflet markers and custom circle markers
  const markerInfo = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="map-container"]')
    if (!container) return { leafletMarkers: 0, svgCircles: 0, paths: 0 }

    const leafletMarkers = container.querySelectorAll('.leaflet-marker-icon').length
    const svgCircles = container.querySelectorAll('svg circle').length
    const paths = container.querySelectorAll('svg path.leaflet-interactive').length

    return { leafletMarkers, svgCircles, paths }
  })

  const totalMarkers = markerInfo.leafletMarkers + markerInfo.svgCircles + markerInfo.paths

  if (totalMarkers === 0) {
    throw new Error('No venue markers rendered on the map')
    console.log(`    Leaflet markers: ${markerInfo.leafletMarkers}, SVG circles: ${markerInfo.svgCircles}, Paths: ${markerInfo.paths}`)
    // Don't fail the test - map might be loading async
  } else {
    console.log(`  ✓ Found ${totalMarkers} venue markers (${markerInfo.leafletMarkers} standard, ${markerInfo.svgCircles} circles, ${markerInfo.paths} paths)`)
  }

}

/**
 * Test 4: Marker click shows popup
 * Tests clicking a marker to display the venue popup
 */
async function testMarkerPopup(page) {
  console.log('Test 4: Marker popup on click')

  await navigateToScene(page, 'geography')
  await delay(4000)

  // Try to click a circle marker (SVG path)
  const markerClicked = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="map-container"]')
    if (!container) return false

    // Try SVG circle markers first
    const circles = container.querySelectorAll('svg circle')
    if (circles.length > 0) {
      circles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    }

    // Try paths (Leaflet interactive elements)
    const paths = container.querySelectorAll('svg path.leaflet-interactive')
    if (paths.length > 0) {
      paths[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    }

    // Try standard Leaflet markers
    const marker = container.querySelector('.leaflet-marker-icon')
    if (marker) {
      marker.click()
      return true
    }

    return false
  })

  if (!markerClicked) {
    throw new Error('No markers available to click')
  }

  // Wait for popup to appear
  await delay(1000)

  // Check if Leaflet popup exists
  const popupExists = await page.evaluate(() => {
    return document.querySelector('.leaflet-popup') !== null
  })

  if (popupExists) {
    console.log('  ✓ Leaflet popup displayed on marker click')
  } else {
    throw new Error('Clicking a marker did not open a popup')
  }

}

/**
 * Test 5: Popup contains venue data
 * Verifies popup content has venue name and concert count
 */
async function testPopupContent(page) {
  console.log('Test 5: Popup content')

  await navigateToScene(page, 'geography')
  await delay(4000)

  // Click a marker to show popup
  const markerClicked = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="map-container"]')
    if (!container) return false

    const circles = container.querySelectorAll('svg circle')
    if (circles.length > 0) {
      circles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    }

    const paths = container.querySelectorAll('svg path.leaflet-interactive')
    if (paths.length > 0) {
      paths[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    }

    return false
  })

  if (!markerClicked) {
    throw new Error('No marker available to click for the popup content test')
  }

  await delay(1000)

  // `textContent` includes markup whitespace, so this used to "pass" on a popup
  // containing nothing but newlines and indentation — it reported
  // `Popup contains content:` followed by blank lines. innerText is what a person
  // would actually see.
  const popupContent = await page.evaluate(() => {
    const popup = document.querySelector('.leaflet-popup-content')
    return popup ? popup.innerText.trim() : null
  })

  if (!popupContent) {
    throw new Error('Clicking a marker produced no popup content')
  }

  // A real venue popup names the venue, its location and a concert count. Assert the
  // count, because it is the part derived from concert data rather than static copy —
  // an empty popup shell would otherwise still look fine.
  if (!/\d+\s+concerts?/i.test(popupContent)) {
    throw new Error(
      `Venue popup does not report a concert count (got: ${JSON.stringify(popupContent.slice(0, 120))})`
    )
  }

  console.log(`  ✓ Popup reports venue detail: ${popupContent.replace(/\n+/g, ' · ').slice(0, 60)}`)
}

/**
 * Test 7: Deep linking to specific venue
 * Tests URL parameter for direct navigation to a specific venue
 */
async function testDeepLinking(page) {
  console.log('Test 7: Deep linking to venue')

  // Navigate with venue parameter (use 'geography' not 'map')
  const testVenue = 'the-forum'
  await page.goto(`${CONFIG.BASE_URL}?scene=geography&venue=${testVenue}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(2500)

  // Verify map scene rendered
  const sceneExists = await elementExists(page, MAP.scene)

  if (!sceneExists) {
    throw new Error('Map scene did not render with deep link')
  }

  // Check if map centered on venue (hard to verify without knowing coords)
  console.log(`  ✓ Deep link to venue ${testVenue} loaded map scene`)

}

/**
 * Test 8: Responsive layout (mobile)
 * Tests map scene rendering on mobile viewport
 */
async function testResponsiveLayout(browser) {
  console.log('Test 8: Responsive layout (mobile)')

  // Create new page with mobile viewport
  const page = await browser.newPage()
  await page.setViewport(CONFIG.VIEWPORTS.mobile)

  await navigateToScene(page, 'geography')
  await delay(2500)

  // Verify map scene renders
  const sceneExists = await elementExists(page, MAP.scene)

  if (!sceneExists) {
    throw new Error('Map scene did not render on mobile viewport')
  }

  // Verify Leaflet loaded
  const leafletExists = await page.evaluate(() => {
    return document.querySelector('.leaflet-container') !== null
  })

  if (!leafletExists) {
    throw new Error('Leaflet map did not load on mobile')
  }

  console.log('  ✓ Map scene renders on mobile with Leaflet')

  await page.close()
}

/**
 * Run tests
 */
runMapTests()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
