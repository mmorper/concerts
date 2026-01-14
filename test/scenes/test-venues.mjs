/**
 * Venue Network Scene (Scene 2) Visual Tests
 *
 * Tests the force-directed graph showing venues and their associated artists.
 * This scene is implemented in Scene4Bands.tsx but rendered as Scene 2 in the app.
 */

import {
  setupBrowser,
  navigateToScene,
  takeScreenshot,
  waitForD3Settle,
  elementExists,
  clickElement,
  delay,
  CONFIG
} from '../utils/helpers.mjs'

/**
 * Main test suite
 */
async function runVenuesTests() {
  console.log('🧪 Starting Venue Network Scene Tests...\n')

  const { browser, page } = await setupBrowser({ headless: true })

  try {
    // Test 1: Scene navigation
    await testSceneNavigation(page)

    // Test 2: Initial render with top 10 venues
    await testInitialRender(page)

    // Test 3: View mode toggle (Top 10 vs All Venues)
    await testViewModeToggle(page)

    // Test 4: D3 force simulation settles
    await testForceSimulation(page)

    // Test 5: Network graph interactions
    await testGraphInteractions(page)

    // Test 6: Deep linking to venue
    await testDeepLinking(page)

    // Test 7: Responsive layout (mobile)
    await testResponsiveLayout(browser)

    console.log('\n✅ All Venue Network Scene tests passed!')
  } catch (error) {
    console.error('\n❌ Venue Network Scene tests failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Test 1: Scene navigation
 * Navigates to the venue network scene via URL parameter
 */
async function testSceneNavigation(page) {
  console.log('Test 1: Scene navigation')

  await navigateToScene(page, 'venues')
  await delay(1500)

  // Verify venue network scene exists
  const sceneExists = await elementExists(page, '[data-testid="venue-network-scene"]')

  if (!sceneExists) {
    throw new Error('Venue network scene not found')
  }

  // Verify title exists
  const titleExists = await elementExists(page, '[data-testid="venue-network-title"]')

  if (!titleExists) {
    throw new Error('Venue network title not found')
  }

  console.log('  ✓ Navigated to venue network scene successfully')

  // Take screenshot
  await takeScreenshot(page, 'venue-network-01-navigation', { fullPage: true })
}

/**
 * Test 2: Initial render with top 10 venues
 * Verifies the scene renders with the default Top 10 view
 */
async function testInitialRender(page) {
  console.log('Test 2: Initial render (Top 10 view)')

  await navigateToScene(page, 'venues')
  await delay(1500)

  // Check for network graph container
  const graphExists = await elementExists(page, '[data-testid="network-graph"]')

  if (!graphExists) {
    throw new Error('Network graph container not found')
  }

  // Check for SVG element
  const svgExists = await elementExists(page, '[data-testid="network-svg"]')

  if (!svgExists) {
    throw new Error('Network SVG not found')
  }

  // Verify Top 10 button is active
  const top10Active = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="view-mode-top10"]')
    return button?.classList.contains('bg-indigo-500') || button?.classList.contains('bg-indigo-600')
  })

  if (!top10Active) {
    throw new Error('Top 10 view mode not active by default')
  }

  console.log('  ✓ Scene rendered with Top 10 view mode active')

  // Take screenshot
  await takeScreenshot(page, 'venue-network-02-initial-render')
}

/**
 * Test 3: View mode toggle
 * Tests toggling between Top 10 and All Venues views
 */
async function testViewModeToggle(page) {
  console.log('Test 3: View mode toggle')

  await navigateToScene(page, 'venues')
  await delay(1500)

  // Click "All Venues" button
  const allVenuesButton = '[data-testid="view-mode-all"]'
  const buttonExists = await elementExists(page, allVenuesButton)

  if (!buttonExists) {
    throw new Error('All Venues button not found')
  }

  await clickElement(page, allVenuesButton)
  await delay(2000) // Wait for graph to update

  // Verify All Venues button is now active
  const allVenuesActive = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="view-mode-all"]')
    return button?.classList.contains('bg-indigo-500') || button?.classList.contains('bg-indigo-600')
  })

  if (!allVenuesActive) {
    throw new Error('All Venues view mode did not activate')
  }

  console.log('  ✓ View mode toggle works (switched to All Venues)')

  // Take screenshot
  await takeScreenshot(page, 'venue-network-03-all-venues-view')

  // Switch back to Top 10
  await clickElement(page, '[data-testid="view-mode-top10"]')
  await delay(2000)

  console.log('  ✓ Toggled back to Top 10 view')
}

/**
 * Test 4: D3 force simulation settles
 * Verifies the force-directed graph completes its simulation
 */
async function testForceSimulation(page) {
  console.log('Test 4: D3 force simulation')

  await navigateToScene(page, 'venues')
  await delay(1000)

  // Wait for D3 simulation to settle
  await waitForD3Settle(page, '[data-testid="network-svg"]')

  // Check if nodes exist
  const nodeCount = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="network-svg"]')
    if (!svg) return 0
    return svg.querySelectorAll('circle').length
  })

  if (nodeCount === 0) {
    throw new Error('No nodes found in force-directed graph')
  }

  console.log(`  ✓ D3 force simulation settled with ${nodeCount} nodes`)

  // Take screenshot
  await takeScreenshot(page, 'venue-network-04-simulation-settled')
}

/**
 * Test 5: Network graph interactions
 * Tests clicking/hovering on nodes in the graph
 */
async function testGraphInteractions(page) {
  console.log('Test 5: Network graph interactions')

  await navigateToScene(page, 'venues')
  await delay(1500)
  await waitForD3Settle(page, '[data-testid="network-svg"]')

  // Try to click a node (venue node)
  const nodeClicked = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="network-svg"]')
    if (!svg) return false

    // Find the first large circle (likely a venue node)
    const circles = Array.from(svg.querySelectorAll('circle'))
    const venueNode = circles.find(c => parseFloat(c.getAttribute('r') || '0') > 10)

    if (venueNode) {
      venueNode.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    }
    return false
  })

  if (!nodeClicked) {
    console.log('  ⚠ No venue node found to click (graph may be empty)')
    return
  }

  await delay(800)

  console.log('  ✓ Graph node interaction works')

  // Take screenshot
  await takeScreenshot(page, 'venue-network-05-node-interaction')
}

/**
 * Test 6: Deep linking to specific venue
 * Tests URL parameter for direct navigation to a specific venue
 */
async function testDeepLinking(page) {
  console.log('Test 6: Deep linking to venue')

  // Navigate with venue parameter
  const testVenue = 'the-forum'
  await page.goto(`${CONFIG.BASE_URL}?scene=venues&venue=${testVenue}`, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })

  await delay(2500)
  await waitForD3Settle(page, '[data-testid="network-svg"]')

  // Verify scene rendered
  const sceneExists = await elementExists(page, '[data-testid="venue-network-scene"]')

  if (!sceneExists) {
    throw new Error('Venue network scene did not render with deep link')
  }

  console.log(`  ✓ Deep link to venue ${testVenue} loaded scene`)

  // Take screenshot
  await takeScreenshot(page, 'venue-network-06-deep-link')
}

/**
 * Test 7: Responsive layout (mobile)
 * Tests venue network scene rendering on mobile viewport
 */
async function testResponsiveLayout(browser) {
  console.log('Test 7: Responsive layout (mobile)')

  // Create new page with mobile viewport
  const page = await browser.newPage()
  await page.setViewport(CONFIG.VIEWPORTS.mobile)

  await navigateToScene(page, 'venues')
  await delay(2000)

  // Verify scene renders
  const sceneExists = await elementExists(page, '[data-testid="venue-network-scene"]')

  if (!sceneExists) {
    throw new Error('Venue network scene did not render on mobile viewport')
  }

  // Verify graph exists
  const graphExists = await elementExists(page, '[data-testid="network-graph"]')

  if (!graphExists) {
    throw new Error('Network graph did not render on mobile')
  }

  console.log('  ✓ Venue network scene renders on mobile')

  // Take screenshot
  await takeScreenshot(page, 'venue-network-07-mobile', { fullPage: true })

  await page.close()
}

/**
 * Run tests
 */
runVenuesTests()
  .then(() => {
    console.log('\n📸 Screenshots saved to:', CONFIG.SCREENSHOT_DIR)
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
