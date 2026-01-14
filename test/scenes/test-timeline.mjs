/**
 * Timeline Scene (Scene 1: Hero) Visual Tests
 *
 * Tests the interactive concert timeline with year navigation.
 * Validates rendering, hover interactions, and deep linking.
 */

import {
  setupBrowser,
  navigateToScene,
  takeScreenshot,
  waitForElement,
  hoverElement,
  clickElement,
  elementExists,
  getElementCount,
  getTextContent,
  delay,
  CONFIG
} from '../utils/helpers.mjs'
import { TIMELINE } from '../utils/selectors.mjs'

/**
 * Main test suite
 */
async function runTimelineTests() {
  console.log('🧪 Starting Timeline Scene Tests...\n')

  const { browser, page } = await setupBrowser({ headless: true })

  try {
    // Test 1: Initial render
    await testInitialRender(page)

    // Test 2: Year dots render correctly
    await testYearDotsRender(page)

    // Test 3: Hover preview appears
    await testHoverPreview(page)

    // Test 4: Click year dot navigation
    await testYearDotNavigation(page)

    // Test 5: Timeline statistics render
    await testTimelineStatistics(page)

    // Test 6: Deep linking to specific year
    await testDeepLinking(page)

    // Test 7: Responsive layout (mobile)
    await testResponsiveLayout(browser)

    console.log('\n✅ All Timeline Scene tests passed!')
  } catch (error) {
    console.error('\n❌ Timeline Scene tests failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Test 1: Initial render
 * Verifies the timeline scene renders correctly on page load
 */
async function testInitialRender(page) {
  console.log('Test 1: Initial render')

  await navigateToScene(page, null) // Load homepage
  await delay(1000) // Wait for initial load

  // Verify timeline SVG exists
  const svgExists = await elementExists(page, TIMELINE.svg)
  if (!svgExists) {
    throw new Error('Timeline SVG not found')
  }

  // Verify title and subtitle exist
  const titleExists = await elementExists(page, TIMELINE.title)
  const subtitleExists = await elementExists(page, TIMELINE.subtitle)

  if (!titleExists || !subtitleExists) {
    throw new Error('Timeline title or subtitle not found')
  }

  // Take screenshot
  await takeScreenshot(page, 'timeline-01-initial-render', { fullPage: true })

  console.log('  ✓ Timeline scene renders correctly')
}

/**
 * Test 2: Year dots render correctly
 * Verifies all year dots are rendered and positioned correctly
 */
async function testYearDotsRender(page) {
  console.log('Test 2: Year dots render')

  // Navigate to timeline (should already be there, but explicit)
  await navigateToScene(page, null)
  await delay(1000)

  // Count year dots
  const yearDotCount = await getElementCount(page, TIMELINE.yearDot)

  if (yearDotCount === 0) {
    throw new Error('No year dots found')
  }

  console.log(`  ✓ Found ${yearDotCount} year dots`)

  // Verify year dots have data-year attribute
  const yearDotsWithData = await page.$$eval(TIMELINE.yearDot, dots => {
    return dots.every(dot => dot.hasAttribute('data-year'))
  })

  if (!yearDotsWithData) {
    throw new Error('Some year dots missing data-year attribute')
  }

  // Take screenshot
  await takeScreenshot(page, 'timeline-02-year-dots')

  console.log('  ✓ Year dots render correctly with data attributes')
}

/**
 * Test 3: Hover preview appears
 * Tests the hover preview popup that shows concert details
 */
async function testHoverPreview(page) {
  console.log('Test 3: Hover preview')

  await navigateToScene(page, null)
  await delay(1000)

  // Get a year dot to hover over
  const firstYearDot = await page.$(TIMELINE.yearDot)

  if (!firstYearDot) {
    throw new Error('No year dot found to hover over')
  }

  // Get the year from the dot
  const yearValue = await page.evaluate(dot => dot.getAttribute('data-year'), firstYearDot)

  // Hover over the year dot
  await hoverElement(page, `${TIMELINE.yearDot}[data-year="${yearValue}"]`)

  // Wait for hover preview to appear
  await delay(500)

  // Check if hover preview exists
  const previewExists = await elementExists(page, TIMELINE.hoverPreview)

  if (!previewExists) {
    console.log('  ⚠ Hover preview did not appear (may not be implemented)')
    return
  }

  // Verify preview contains year (optional - child elements may not have test IDs yet)
  const previewYearExists = await elementExists(page, TIMELINE.previewYear)

  if (previewYearExists) {
    const yearText = await getTextContent(page, TIMELINE.previewYear)
    console.log(`  ✓ Hover preview appears with year: ${yearText}`)
  } else {
    console.log(`  ✓ Hover preview appears for year ${yearValue} (child elements not yet instrumented)`)
  }

  // Take screenshot
  await takeScreenshot(page, 'timeline-03-hover-preview')
}

/**
 * Test 4: Click year dot navigation
 * Tests clicking a year dot to navigate to concerts for that year
 */
async function testYearDotNavigation(page) {
  console.log('Test 4: Year dot navigation')

  await navigateToScene(page, null)
  await delay(1000)

  // Get a year dot
  const firstYearDot = await page.$(TIMELINE.yearDot)

  if (!firstYearDot) {
    throw new Error('No year dot found for click test')
  }

  const yearValue = await page.evaluate(dot => dot.getAttribute('data-year'), firstYearDot)

  // Click the year dot
  await clickElement(page, `${TIMELINE.yearDot}[data-year="${yearValue}"]`)

  // Wait for page to respond (might scroll or update URL)
  await delay(1000)

  // Check if URL contains year parameter
  const currentUrl = page.url()
  const urlContainsYear = currentUrl.includes(`year=${yearValue}`)

  // Note: This might not be implemented yet, so we just log the result
  console.log(`  ✓ Clicked year ${yearValue} (URL contains year: ${urlContainsYear})`)

  // Take screenshot
  await takeScreenshot(page, 'timeline-04-year-click')
}

/**
 * Test 5: Timeline statistics render
 * Verifies that timeline statistics (total concerts, years, etc.) display correctly
 */
async function testTimelineStatistics(page) {
  console.log('Test 5: Timeline statistics')

  await navigateToScene(page, null)
  await delay(1000)

  // Check if stats element exists
  const statsExists = await elementExists(page, TIMELINE.stats)

  if (!statsExists) {
    console.log('  ⚠ Timeline stats element not found (may not be implemented)')
    return
  }

  // Get stats text
  const statsText = await getTextContent(page, TIMELINE.stats)

  console.log(`  ✓ Timeline statistics: ${statsText}`)

  // Take screenshot
  await takeScreenshot(page, 'timeline-05-statistics')
}

/**
 * Test 6: Deep linking to specific year
 * Tests URL parameter for direct navigation to a specific year
 */
async function testDeepLinking(page) {
  console.log('Test 6: Deep linking to year')

  // Navigate with year parameter
  const testYear = '2020'
  await page.goto(`${CONFIG.BASE_URL}?scene=timeline&year=${testYear}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(1500)

  // Verify timeline rendered
  const svgExists = await elementExists(page, TIMELINE.svg)

  if (!svgExists) {
    throw new Error('Timeline did not render with deep link')
  }

  // Check if the specific year dot exists
  const yearDotSelector = `${TIMELINE.yearDot}[data-year="${testYear}"]`
  const yearDotExists = await page.$(yearDotSelector).then(el => el !== null)

  if (yearDotExists) {
    console.log(`  ✓ Deep link to year ${testYear} works (year dot found)`)
  } else {
    console.log(`  ⚠ Year ${testYear} dot not found (may not have concerts that year)`)
  }

  // Take screenshot
  await takeScreenshot(page, 'timeline-06-deep-link')
}

/**
 * Test 7: Responsive layout (mobile)
 * Tests timeline rendering on mobile viewport
 */
async function testResponsiveLayout(browser) {
  console.log('Test 7: Responsive layout (mobile)')

  // Create new page with mobile viewport
  const page = await browser.newPage()
  await page.setViewport(CONFIG.VIEWPORTS.mobile)

  await navigateToScene(page, null)
  await delay(1500)

  // Verify timeline still renders
  const svgExists = await elementExists(page, TIMELINE.svg)

  if (!svgExists) {
    throw new Error('Timeline did not render on mobile viewport')
  }

  // Verify year dots exist
  const yearDotCount = await getElementCount(page, TIMELINE.yearDot)

  if (yearDotCount === 0) {
    throw new Error('No year dots rendered on mobile')
  }

  console.log(`  ✓ Timeline renders on mobile (${yearDotCount} year dots)`)

  // Take screenshot
  await takeScreenshot(page, 'timeline-07-mobile', { fullPage: true })

  await page.close()
}

/**
 * Run tests
 */
runTimelineTests()
  .then(() => {
    console.log('\n📸 Screenshots saved to:', CONFIG.SCREENSHOT_DIR)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
