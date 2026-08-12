/**
 * Timeline Scene (Scene 1: Hero) Visual Tests
 *
 * Tests the interactive concert timeline with year navigation.
 * Validates rendering, hover interactions, and deep linking.
 */

import {
  setupBrowser,
  navigateToScene,
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

  // The hover preview is implemented and does appear — verified against the running
  // app. It previously logged "may not be implemented" and passed either way, which
  // meant a regression that stopped the preview rendering would have gone unnoticed.
  const previewExists = await elementExists(page, TIMELINE.hoverPreview)

  if (!previewExists) {
    throw new Error(`Hover preview did not appear after hovering year ${yearValue}`)
  }

  // The preview's child elements carry no test ids, so assert on its text: whatever
  // the markup underneath becomes, it has to still name the year being hovered.
  const previewText = await getTextContent(page, TIMELINE.hoverPreview)

  if (!previewText || !previewText.includes(yearValue)) {
    throw new Error(
      `Hover preview for ${yearValue} does not mention that year (text: ${JSON.stringify(previewText)})`
    )
  }

  console.log(`  ✓ Hover preview appears and names year ${yearValue}`)
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

  // Wait for the card stack's entry animation.
  await delay(1000)

  // This test used to assert nothing at all. It checked whether the URL gained a
  // `year=` param, logged the answer, and passed regardless — the answer has been
  // `false` the whole time, because clicking a dot opens the year card stack rather
  // than navigating. So assert the behaviour the scene actually has.
  const stackExists = await elementExists(page, TIMELINE.yearCardStack)

  if (!stackExists) {
    throw new Error(`Clicking year ${yearValue} did not open the year card stack`)
  }

  const stackText = await getTextContent(page, TIMELINE.yearCardStack)

  if (!stackText || stackText.trim().length === 0) {
    throw new Error(`Year card stack for ${yearValue} opened but rendered no content`)
  }

  console.log(`  ✓ Clicking year ${yearValue} opens the year card stack`)
}

/**
 * Test 5: Timeline statistics render
 * Verifies that timeline statistics (total concerts, years, etc.) display correctly
 */
async function testTimelineStatistics(page) {
  console.log('Test 5: Timeline statistics')

  await navigateToScene(page, null)
  await delay(1000)

  const statsExists = await elementExists(page, TIMELINE.stats)

  if (!statsExists) {
    throw new Error('Timeline stats element not found')
  }

  const statsText = await getTextContent(page, TIMELINE.stats)

  // Shape, not exact numbers — "184 shows across 1984–2026" grows with the archive,
  // so pinning the count would make this fail on every data refresh. What must not
  // regress is that real numbers render at all: the derivation behind this line
  // silently producing 0, NaN or an empty string is the failure worth catching.
  const statsPattern = /(\d+)\s+shows?\s+across\s+(\d{4})\D+(\d{4})/i
  const match = statsText && statsText.match(statsPattern)

  if (!match) {
    throw new Error(
      `Timeline stats do not read as "<n> shows across <year>–<year>" (got: ${JSON.stringify(statsText)})`
    )
  }

  const [, showCount, firstYear, lastYear] = match

  if (Number(showCount) === 0) {
    throw new Error(`Timeline stats report 0 shows (got: ${JSON.stringify(statsText)})`)
  }

  if (Number(firstYear) >= Number(lastYear)) {
    throw new Error(`Timeline stats year range is not ascending: ${firstYear}–${lastYear}`)
  }

  console.log(`  ✓ Timeline statistics: ${statsText.trim()}`)
}

/**
 * Test 6: Deep linking to specific year
 * Tests URL parameter for direct navigation to a specific year
 */
async function testDeepLinking(page) {
  console.log('Test 6: Deep linking to year')

  // This test used to hard-code 2020 — a year with no concerts in it, so the dot it
  // looked for could never exist. It logged "may not have concerts that year" and
  // passed, which made a deep-link regression indistinguishable from the fixture
  // being wrong. Take the year from the rendered timeline instead, so it is always
  // a year the archive actually contains.
  await navigateToScene(page, 'timeline')
  await delay(1500)

  const testYear = await page.$eval(TIMELINE.yearDot, dot => dot.getAttribute('data-year'))

  if (!testYear) {
    throw new Error('Could not read a year from the timeline to deep link to')
  }

  await page.goto(`${CONFIG.BASE_URL}?scene=timeline&year=${testYear}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(1500)

  const svgExists = await elementExists(page, TIMELINE.svg)

  if (!svgExists) {
    throw new Error('Timeline did not render with deep link')
  }

  const yearDotSelector = `${TIMELINE.yearDot}[data-year="${testYear}"]`
  const yearDotExists = await page.$(yearDotSelector).then(el => el !== null)

  if (!yearDotExists) {
    throw new Error(`Deep link to year ${testYear} rendered no dot for that year`)
  }

  console.log(`  ✓ Deep link to year ${testYear} works (year dot found)`)
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

  await page.close()
}

/**
 * Run tests
 */
runTimelineTests()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
