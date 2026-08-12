/**
 * Artist Scene (Scene 5) Visual Tests
 *
 * Tests the artist mosaic with album covers and artist search/sorting.
 * Validates rendering, search, sorting, and artist selection.
 */

import {
  setupBrowser,
  navigateToScene,
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

  // An empty mosaic is the failure this test exists to catch, so it must not be
  // excused as "may use different structure" — if the structure changes, this
  // selector is what should be updated, and a failure here is how anyone finds out.
  if (cardCount === 0) {
    throw new Error('Artist mosaic rendered no artist cards')
  }

  console.log(`  ✓ Artist mosaic rendered with ${cardCount} artist cards`)
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
    throw new Error('Artist search container not found')
  }

  // Find the search input
  const searchInput = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="artist-search-container"]')
    if (!container) return null
    const input = container.querySelector('input[type="text"], input[type="search"]')
    return input ? true : false
  })

  if (!searchInput) {
    throw new Error('Search input not found inside the artist search container')
  }

  // Type in search box
  const inputSelector = '[data-testid="artist-search-container"] input'
  await typeText(page, inputSelector, 'Depeche Mode')
  await delay(800)

  console.log('  ✓ Artist search is functional (typed "Depeche Mode")')

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
/**
 * Read the current order of the mosaic, most-significant first.
 *
 * Both sort tests assert on this rather than on the sort button's styling. The
 * button check they used to do looked for `bg-indigo-500`, a class the component
 * stopped using — it is `bg-violet-600` now. Because the check was written to
 * shrug ("active state may vary") nothing ever reported the drift. Order is the
 * thing users actually care about and it does not rot when a colour changes.
 */
async function readMosaicOrder(page, limit = 24) {
  return page.evaluate(max => {
    const container = document.querySelector('[data-testid="artist-mosaic-container"]')
    if (!container) return []
    return [...container.querySelectorAll('[data-artist], .artist-card, .artist-tile')]
      .slice(0, max)
      .map(el => el.getAttribute('data-artist') || el.innerText.trim().split('\n')[0])
      .filter(Boolean)
  }, limit)
}

async function testSortAlphabetical(page) {
  console.log('Test 4: Sort by alphabetical')

  await navigateToScene(page, 'artists')
  await delay(1500)

  const sortButtonsExist = await elementExists(page, '[data-testid="sort-buttons"]')

  if (!sortButtonsExist) {
    throw new Error('Sort buttons not found')
  }

  const alphabeticalButton = '[data-testid="sort-alphabetical"]'

  if (!(await elementExists(page, alphabeticalButton))) {
    throw new Error('Alphabetical sort button not found')
  }

  await clickElement(page, alphabeticalButton)
  await delay(1500)

  const order = await readMosaicOrder(page)

  if (order.length < 2) {
    throw new Error(`Mosaic showed ${order.length} cards after sorting — too few to verify order`)
  }

  // Ascending across the whole visible run, not just "the first one starts with A".
  const outOfOrder = order.findIndex((name, i) => i > 0 && order[i - 1].localeCompare(name) > 0)

  if (outOfOrder > 0) {
    throw new Error(
      `Alphabetical sort is out of order at position ${outOfOrder}: ` +
      `"${order[outOfOrder - 1]}" precedes "${order[outOfOrder]}"`
    )
  }

  console.log(`  ✓ Alphabetical sort orders the mosaic (${order[0]} … ${order[order.length - 1]})`)
}

/**
 * Test 5: Sort by most seen
 * Tests the most seen sort button
 */
async function testSortMostSeen(page) {
  console.log('Test 5: Sort by most seen')

  await navigateToScene(page, 'artists')
  await delay(1500)

  const mostSeenButton = '[data-testid="sort-most-seen"]'

  if (!(await elementExists(page, mostSeenButton))) {
    throw new Error('Most seen sort button not found')
  }

  // Sort alphabetically first, so "most seen" has a known order to change. Landing
  // on the scene already shows most-seen order, so clicking it from the default
  // state proves nothing.
  await clickElement(page, '[data-testid="sort-alphabetical"]')
  await delay(1500)
  const alphabeticalOrder = await readMosaicOrder(page)

  await clickElement(page, mostSeenButton)
  await delay(1500)
  const mostSeenOrder = await readMosaicOrder(page)

  if (mostSeenOrder.length < 2) {
    throw new Error(`Mosaic showed ${mostSeenOrder.length} cards after sorting — too few to verify order`)
  }

  if (JSON.stringify(alphabeticalOrder) === JSON.stringify(mostSeenOrder)) {
    throw new Error('Most seen sort left the mosaic in alphabetical order — the sort did nothing')
  }

  console.log(`  ✓ Most seen sort reorders the mosaic (now leads with ${mostSeenOrder[0]})`)
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

  await page.close()
}

/**
 * Run tests
 */
runArtistsTests()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
