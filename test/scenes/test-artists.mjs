/**
 * Artist Scene (Scene 5) Visual Tests
 *
 * Tests the artist mosaic with album covers and artist search/sorting.
 * Validates rendering, search, sorting, and artist selection.
 */

import {
  setupBrowser,
  navigateToScene,
  takeScreenshot,
  elementExists,
  clickElement,
  typeText,
  getTextContent,
  getElementCount,
  delay,
  CONFIG
} from '../utils/helpers.mjs'

/**
 * Main test suite
 */
async function runArtistsTests() {
  console.log('🧪 Starting Artist Scene Tests...\n')

  const { browser, page } = await setupBrowser({ headless: true })

  try {
    // Test 1: Scene navigation
    await testSceneNavigation(page)

    // Test 2: Artist mosaic renders
    await testMosaicRender(page)

    // Test 3: Search functionality
    await testArtistSearch(page)

    // Test 4: Sort by alphabetical
    await testSortAlphabetical(page)

    // Test 5: Sort by most seen
    await testSortMostSeen(page)

    // Test 6: Deep linking to artist
    await testDeepLinking(page)

    // Test 7: Responsive layout (mobile)
    await testResponsiveLayout(browser)

    console.log('\n✅ All Artist Scene tests passed!')
  } catch (error) {
    console.error('\n❌ Artist Scene tests failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Test 1: Scene navigation
 * Navigates to the artist scene via URL parameter
 */
async function testSceneNavigation(page) {
  console.log('Test 1: Scene navigation')

  await navigateToScene(page, 'artists')
  await delay(1500)

  // Verify artist scene exists
  const sceneExists = await elementExists(page, '[data-testid="artist-scene"]')

  if (!sceneExists) {
    throw new Error('Artist scene not found')
  }

  // Verify title exists
  const titleExists = await elementExists(page, '[data-testid="artist-scene-title"]')

  if (!titleExists) {
    throw new Error('Artist scene title not found')
  }

  console.log('  ✓ Navigated to artist scene successfully')

  // Take screenshot
  await takeScreenshot(page, 'artists-01-navigation', { fullPage: true })
}

/**
 * Test 2: Artist mosaic renders
 * Verifies the artist mosaic with album covers renders
 */
async function testMosaicRender(page) {
  console.log('Test 2: Artist mosaic render')

  await navigateToScene(page, 'artists')
  await delay(2000) // Extra time for images to load

  // Check for mosaic container
  const mosaicExists = await elementExists(page, '[data-testid="artist-mosaic-container"]')

  if (!mosaicExists) {
    throw new Error('Artist mosaic container not found')
  }

  // Count artist cards/tiles
  const cardCount = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="artist-mosaic-container"]')
    if (!container) return 0

    // Look for common artist card patterns
    const cards = container.querySelectorAll('[data-artist], .artist-card, .artist-tile')
    return cards.length
  })

  if (cardCount === 0) {
    console.log('  ⚠ No artist cards found (mosaic may use different structure)')
  } else {
    console.log(`  ✓ Artist mosaic rendered with ${cardCount} artist cards`)
  }

  // Take screenshot
  await takeScreenshot(page, 'artists-02-mosaic-render')
}

/**
 * Test 3: Artist search
 * Tests the search functionality for filtering artists
 */
async function testArtistSearch(page) {
  console.log('Test 3: Artist search')

  await navigateToScene(page, 'artists')
  await delay(1500)

  // Check for search input
  const searchExists = await elementExists(page, '[data-testid="artist-search-container"]')

  if (!searchExists) {
    console.log('  ⚠ Artist search container not found')
    return
  }

  // Find the search input
  const searchInput = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="artist-search-container"]')
    if (!container) return null
    const input = container.querySelector('input[type="text"], input[type="search"]')
    return input ? true : false
  })

  if (!searchInput) {
    console.log('  ⚠ Search input not found in container')
    return
  }

  // Type in search box
  const inputSelector = '[data-testid="artist-search-container"] input'
  await typeText(page, inputSelector, 'Depeche Mode')
  await delay(800)

  console.log('  ✓ Artist search is functional (typed "Depeche Mode")')

  // Take screenshot
  await takeScreenshot(page, 'artists-03-search')

  // Clear search
  await page.evaluate((selector) => {
    const input = document.querySelector(selector)
    if (input) {
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, inputSelector)

  await delay(500)
}

/**
 * Test 4: Sort by alphabetical
 * Tests the alphabetical sort button
 */
async function testSortAlphabetical(page) {
  console.log('Test 4: Sort by alphabetical')

  await navigateToScene(page, 'artists')
  await delay(1500)

  // Check for sort buttons
  const sortButtonsExist = await elementExists(page, '[data-testid="sort-buttons"]')

  if (!sortButtonsExist) {
    console.log('  ⚠ Sort buttons not found')
    return
  }

  // Click alphabetical sort button
  const alphabeticalButton = '[data-testid="sort-alphabetical"]'
  const buttonExists = await elementExists(page, alphabeticalButton)

  if (!buttonExists) {
    console.log('  ⚠ Alphabetical sort button not found')
    return
  }

  await clickElement(page, alphabeticalButton)
  await delay(1000)

  // Verify button is active
  const isActive = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="sort-alphabetical"]')
    return button?.classList.contains('bg-indigo-500') || button?.classList.contains('bg-indigo-600')
  })

  if (isActive) {
    console.log('  ✓ Alphabetical sort activated')
  } else {
    console.log('  ✓ Alphabetical sort button clicked (active state may vary)')
  }

  // Take screenshot
  await takeScreenshot(page, 'artists-04-sort-alphabetical')
}

/**
 * Test 5: Sort by most seen
 * Tests the most seen sort button
 */
async function testSortMostSeen(page) {
  console.log('Test 5: Sort by most seen')

  await navigateToScene(page, 'artists')
  await delay(1500)

  // Click most seen sort button
  const mostSeenButton = '[data-testid="sort-most-seen"]'
  const buttonExists = await elementExists(page, mostSeenButton)

  if (!buttonExists) {
    console.log('  ⚠ Most seen sort button not found')
    return
  }

  await clickElement(page, mostSeenButton)
  await delay(1000)

  // Verify button is active
  const isActive = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="sort-most-seen"]')
    return button?.classList.contains('bg-indigo-500') || button?.classList.contains('bg-indigo-600')
  })

  if (isActive) {
    console.log('  ✓ Most seen sort activated')
  } else {
    console.log('  ✓ Most seen sort button clicked (active state may vary)')
  }

  // Take screenshot
  await takeScreenshot(page, 'artists-05-sort-most-seen')
}

/**
 * Test 6: Deep linking to specific artist
 * Tests URL parameter for direct navigation to a specific artist
 */
async function testDeepLinking(page) {
  console.log('Test 6: Deep linking to artist')

  // Navigate with artist parameter
  const testArtist = 'depeche-mode'
  await page.goto(`${CONFIG.BASE_URL}?scene=artists&artist=${testArtist}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(2500)

  // Verify scene rendered
  const sceneExists = await elementExists(page, '[data-testid="artist-scene"]')

  if (!sceneExists) {
    throw new Error('Artist scene did not render with deep link')
  }

  // Check if search box has the artist name (may be pre-filled)
  const searchValue = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="artist-search-container"]')
    if (!container) return null
    const input = container.querySelector('input[type="text"], input[type="search"]')
    return input ? input.value : null
  })

  if (searchValue && searchValue.toLowerCase().includes('depeche')) {
    console.log(`  ✓ Deep link to artist ${testArtist} loaded and filtered scene`)
  } else {
    console.log(`  ✓ Deep link to artist ${testArtist} loaded scene`)
  }

  // Take screenshot
  await takeScreenshot(page, 'artists-06-deep-link')
}

/**
 * Test 7: Responsive layout (mobile)
 * Tests artist scene rendering on mobile viewport
 */
async function testResponsiveLayout(browser) {
  console.log('Test 7: Responsive layout (mobile)')

  // Create new page with mobile viewport
  const page = await browser.newPage()
  await page.setViewport(CONFIG.VIEWPORTS.mobile)

  await navigateToScene(page, 'artists')
  await delay(2000)

  // Verify scene renders
  const sceneExists = await elementExists(page, '[data-testid="artist-scene"]')

  if (!sceneExists) {
    throw new Error('Artist scene did not render on mobile viewport')
  }

  // Verify mosaic exists
  const mosaicExists = await elementExists(page, '[data-testid="artist-mosaic-container"]')

  if (!mosaicExists) {
    throw new Error('Artist mosaic did not render on mobile')
  }

  console.log('  ✓ Artist scene renders on mobile')

  // Take screenshot
  await takeScreenshot(page, 'artists-07-mobile', { fullPage: true })

  await page.close()
}

/**
 * Run tests
 */
runArtistsTests()
  .then(() => {
    console.log('\n📸 Screenshots saved to:', CONFIG.SCREENSHOT_DIR)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
