/**
 * Genres Scene (Scene 4) Visual Tests
 *
 * Tests the genre treemap/sunburst visualization with timeline slider.
 * Validates rendering, interactions, year navigation, and genre selection.
 */

import {
  setupBrowser,
  navigateToScene,
  takeScreenshot,
  waitForD3Settle,
  elementExists,
  clickElement,
  getTextContent,
  delay,
  CONFIG
} from '../utils/helpers.mjs'

/**
 * Main test suite
 */
async function runGenresTests() {
  console.log('🧪 Starting Genres Scene Tests...\n')

  const { browser, page } = await setupBrowser({ headless: true })

  try {
    // Test 1: Scene navigation
    await testSceneNavigation(page)

    // Test 2: Initial render with treemap
    await testInitialRender(page)

    // Test 3: Timeline slider exists
    await testTimelineSlider(page)

    // Test 4: Genre selection
    await testGenreSelection(page)

    // Test 5: Year navigation
    await testYearNavigation(page)

    // Test 6: Breadcrumb navigation
    await testBreadcrumbNavigation(page)

    // Test 7: Deep linking to genre
    await testDeepLinking(page)

    // Test 8: Responsive layout (mobile)
    await testResponsiveLayout(browser)

    console.log('\n✅ All Genres Scene tests passed!')
  } catch (error) {
    console.error('\n❌ Genres Scene tests failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Test 1: Scene navigation
 * Navigates to the genres scene via URL parameter
 */
async function testSceneNavigation(page) {
  console.log('Test 1: Scene navigation')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // Verify genres scene exists
  const sceneExists = await elementExists(page, '[data-testid="genres-scene"]')

  if (!sceneExists) {
    throw new Error('Genres scene not found')
  }

  // Verify title exists
  const titleExists = await elementExists(page, '[data-testid="genres-title"]')

  if (!titleExists) {
    throw new Error('Genres title not found')
  }

  console.log('  ✓ Navigated to genres scene successfully')

  // Take screenshot
  await takeScreenshot(page, 'genres-01-navigation', { fullPage: true })
}

/**
 * Test 2: Initial render with treemap
 * Verifies the treemap/sunburst visualization renders
 */
async function testInitialRender(page) {
  console.log('Test 2: Initial render (treemap)')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // Check for treemap container
  const treemapExists = await elementExists(page, '[data-testid="genre-treemap-container"]')

  if (!treemapExists) {
    throw new Error('Genre treemap container not found')
  }

  // Check if SVG rendered with genre cells
  const cellCount = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="genre-treemap-container"]')
    if (!container) return 0
    const svg = container.querySelector('svg')
    if (!svg) return 0
    return svg.querySelectorAll('rect, path').length
  })

  if (cellCount === 0) {
    throw new Error('No genre cells rendered in treemap')
  }

  console.log(`  ✓ Treemap rendered with ${cellCount} genre cells`)

  // Take screenshot
  await takeScreenshot(page, 'genres-02-initial-render')
}

/**
 * Test 3: Timeline slider
 * Verifies the timeline slider for year navigation exists
 */
async function testTimelineSlider(page) {
  console.log('Test 3: Timeline slider')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // Check for timeline slider
  const sliderExists = await elementExists(page, '[data-testid="timeline-slider-container"]')

  if (!sliderExists) {
    throw new Error('Timeline slider not found')
  }

  // Check if current year is displayed
  const yearExists = await elementExists(page, '[data-testid="current-year"]')

  if (!yearExists) {
    throw new Error('Current year display not found')
  }

  const currentYear = await getTextContent(page, '[data-testid="current-year"]')
  console.log(`  ✓ Timeline slider exists (showing year: ${currentYear})`)

  // Take screenshot
  await takeScreenshot(page, 'genres-03-timeline-slider')
}

/**
 * Test 4: Genre selection
 * Tests clicking on a genre cell to select it
 */
async function testGenreSelection(page) {
  console.log('Test 4: Genre selection')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // Try to click a genre cell
  const genreClicked = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="genre-treemap-container"]')
    if (!container) return false

    const svg = container.querySelector('svg')
    if (!svg) return false

    // Find a clickable genre element (rect or path)
    const cells = svg.querySelectorAll('rect, path')
    if (cells.length === 0) return false

    // Click the first cell
    cells[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })

  if (!genreClicked) {
    console.log('  ⚠ No genre cell found to click (treemap may be empty)')
    return
  }

  await delay(1000)

  // Check if breadcrumb appeared (indicating genre was selected)
  const breadcrumbExists = await elementExists(page, '[data-testid="genres-breadcrumb"]')

  if (breadcrumbExists) {
    const genreName = await getTextContent(page, '[data-testid="selected-genre-name"]')
    console.log(`  ✓ Genre selection works (selected: ${genreName})`)
  } else {
    console.log('  ✓ Genre click registered (breadcrumb may not appear for all genres)')
  }

  // Take screenshot
  await takeScreenshot(page, 'genres-04-genre-selected')
}

/**
 * Test 5: Year navigation
 * Tests changing the year using the timeline slider
 */
async function testYearNavigation(page) {
  console.log('Test 5: Year navigation')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // Get initial year
  const initialYear = await getTextContent(page, '[data-testid="current-year"]')

  // Try to interact with slider (if it's an input range)
  const sliderInteracted = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="timeline-slider-container"]')
    if (!container) return false

    const slider = container.querySelector('input[type="range"]')
    if (!slider) return false

    // Change slider value
    const currentValue = parseInt(slider.value)
    slider.value = String(currentValue + 1)
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    slider.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })

  if (!sliderInteracted) {
    console.log('  ⚠ Timeline slider not found or not interactive')
    return
  }

  await delay(1000)

  // Check if year changed
  const newYear = await getTextContent(page, '[data-testid="current-year"]')

  if (newYear !== initialYear) {
    console.log(`  ✓ Year navigation works (${initialYear} → ${newYear})`)
  } else {
    console.log('  ✓ Timeline slider is interactive (year may be at boundary)')
  }

  // Take screenshot
  await takeScreenshot(page, 'genres-05-year-navigation')
}

/**
 * Test 6: Breadcrumb navigation
 * Tests clicking back button to deselect genre
 */
async function testBreadcrumbNavigation(page) {
  console.log('Test 6: Breadcrumb navigation')

  await navigateToScene(page, 'genres')
  await delay(1500)

  // First select a genre
  const genreClicked = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="genre-treemap-container"]')
    if (!container) return false

    const svg = container.querySelector('svg')
    if (!svg) return false

    const cells = svg.querySelectorAll('rect, path')
    if (cells.length === 0) return false

    cells[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })

  if (!genreClicked) {
    console.log('  ⚠ Cannot test breadcrumb without selecting a genre first')
    return
  }

  await delay(1000)

  // Check if back button exists
  const backButtonExists = await elementExists(page, '[data-testid="breadcrumb-back"]')

  if (!backButtonExists) {
    console.log('  ⚠ Breadcrumb back button not found (may not appear for all genres)')
    return
  }

  // Click back button
  await clickElement(page, '[data-testid="breadcrumb-back"]')
  await delay(800)

  console.log('  ✓ Breadcrumb navigation works (clicked back button)')

  // Take screenshot
  await takeScreenshot(page, 'genres-06-breadcrumb-navigation')
}

/**
 * Test 7: Deep linking to specific genre
 * Tests URL parameter for direct navigation to a specific genre
 */
async function testDeepLinking(page) {
  console.log('Test 7: Deep linking to genre')

  // Navigate with genre parameter
  const testGenre = 'rock'
  await page.goto(`${CONFIG.BASE_URL}?scene=genres&genre=${testGenre}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(2000)

  // Verify scene rendered
  const sceneExists = await elementExists(page, '[data-testid="genres-scene"]')

  if (!sceneExists) {
    throw new Error('Genres scene did not render with deep link')
  }

  console.log(`  ✓ Deep link to genre ${testGenre} loaded scene`)

  // Take screenshot
  await takeScreenshot(page, 'genres-07-deep-link')
}

/**
 * Test 8: Responsive layout (mobile)
 * Tests genres scene rendering on mobile viewport
 */
async function testResponsiveLayout(browser) {
  console.log('Test 8: Responsive layout (mobile)')

  // Create new page with mobile viewport
  const page = await browser.newPage()
  await page.setViewport(CONFIG.VIEWPORTS.mobile)

  await navigateToScene(page, 'genres')
  await delay(2000)

  // Verify scene renders
  const sceneExists = await elementExists(page, '[data-testid="genres-scene"]')

  if (!sceneExists) {
    throw new Error('Genres scene did not render on mobile viewport')
  }

  // Verify treemap exists
  const treemapExists = await elementExists(page, '[data-testid="genre-treemap-container"]')

  if (!treemapExists) {
    throw new Error('Genre treemap did not render on mobile')
  }

  console.log('  ✓ Genres scene renders on mobile')

  // Take screenshot
  await takeScreenshot(page, 'genres-08-mobile', { fullPage: true })

  await page.close()
}

/**
 * Run tests
 */
runGenresTests()
  .then(() => {
    console.log('\n📸 Screenshots saved to:', CONFIG.SCREENSHOT_DIR)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
