/**
 * Puppeteer Test Utilities
 *
 * Shared helper functions for visual scene testing with Puppeteer.
 * Provides browser setup, navigation, screenshot capture, and timing utilities.
 */

import puppeteer from 'puppeteer'

/**
 * Configuration constants for test environment
 */
export const CONFIG = {
  // Dev server URL. Defaults to the Vite default, but must stay overridable:
  // this repo is routinely checked out into several worktrees at once, so 5173
  // is often already taken by another session's server, and CI picks its own port.
  BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:5173',

  // Default viewport sizes
  VIEWPORTS: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  },

  // Timing constants (in milliseconds)
  TIMEOUTS: {
    navigation: 30000,        // Max time to wait for page load
    d3Animation: 2000,        // Time for D3 animations to settle
    scrollAnimation: 500,     // Time for scroll animations
    interaction: 1000,        // Time for user interactions to complete
    networkIdle: 2000         // Time to wait for network requests
  }
}

/**
 * Delay helper (replacement for deprecated page.waitForTimeout)
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 *
 * @example
 * await delay(1000) // Wait 1 second
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Setup a Puppeteer browser instance
 *
 * @param {Object} options - Browser configuration options
 * @param {boolean} options.headless - Run browser in headless mode (default: true)
 * @param {string} options.viewport - Viewport preset: 'desktop', 'tablet', or 'mobile' (default: 'desktop')
 * @param {boolean} options.devtools - Open browser DevTools (default: false)
 * @returns {Promise<{browser: Browser, page: Page}>} Browser and page instances
 *
 * @example
 * const { browser, page } = await setupBrowser({ headless: false })
 * // ... run tests ...
 * await browser.close()
 */
export async function setupBrowser(options = {}) {
  const {
    headless = true,
    viewport = 'desktop',
    devtools = false
  } = options

  const viewportConfig = CONFIG.VIEWPORTS[viewport] || CONFIG.VIEWPORTS.desktop

  const browser = await puppeteer.launch({
    headless,
    devtools,
    defaultViewport: viewportConfig,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security', // Allow CORS for local development
    ]
  })

  const page = await browser.newPage()

  // Set console logging from page
  page.on('console', msg => {
    const type = msg.type()
    if (type === 'error') {
      console.error(`[Browser Error] ${msg.text()}`)
    }
  })

  // Set page error handling
  page.on('pageerror', error => {
    console.error(`[Page Error] ${error.message}`)
  })

  return { browser, page }
}

/**
 * Navigate to a specific scene
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} scene - Scene name (e.g., 'timeline', 'venues', 'map', 'genres', 'artists')
 * @param {Object} params - Additional URL parameters (e.g., { artist: 'depeche-mode' })
 * @returns {Promise<void>}
 *
 * @example
 * await navigateToScene(page, 'artists', { artist: 'depeche-mode' })
 */
export async function navigateToScene(page, scene, params = {}) {
  const url = new URL(CONFIG.BASE_URL)

  if (scene) {
    url.searchParams.set('scene', scene)
  }

  // Add additional query parameters
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  await page.goto(url.toString(), {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUTS.navigation
  })
}

/**
 * Wait for D3 force simulation to settle
 *
 * D3 force simulations (used in Venues, Bands, Genres scenes) need time
 * to complete their physics calculations. This waits for:
 * 1. Initial render
 * 2. Force simulation iterations
 * 3. Animation transitions
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} extraDelay - Additional delay in ms (default: 0)
 * @returns {Promise<void>}
 *
 * @example
 * await waitForD3Settle(page)
 * await waitForD3Settle(page, 1000) // Wait extra second
 */
export async function waitForD3Settle(page, extraDelay = 0) {
  // Wait for D3 to complete animations
  await delay(CONFIG.TIMEOUTS.d3Animation + extraDelay)

  // Wait for any pending requestAnimationFrame callbacks
  await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })
  })
}

/**
 * Wait for CSS animation or transition to complete
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of animated element
 * @returns {Promise<void>}
 *
 * @example
 * await waitForAnimation(page, '.artist-card')
 */
export async function waitForAnimation(page, selector) {
  await page.waitForSelector(selector, { visible: true })

  await page.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (!element) return Promise.resolve()

    return Promise.all([
      // Wait for CSS transitions
      new Promise(resolve => {
        const onTransitionEnd = () => {
          element.removeEventListener('transitionend', onTransitionEnd)
          resolve()
        }
        element.addEventListener('transitionend', onTransitionEnd)
        // Fallback timeout
        setTimeout(resolve, 1000)
      }),
      // Wait for CSS animations
      new Promise(resolve => {
        const onAnimationEnd = () => {
          element.removeEventListener('animationend', onAnimationEnd)
          resolve()
        }
        element.addEventListener('animationend', onAnimationEnd)
        // Fallback timeout
        setTimeout(resolve, 1000)
      })
    ])
  }, selector)
}

/**
 * Scroll page by a specified amount
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} amount - Pixels to scroll (positive = down, negative = up)
 * @returns {Promise<void>}
 *
 * @example
 * await scrollPage(page, 1000) // Scroll down 1000px
 */
export async function scrollPage(page, amount) {
  await page.evaluate((scrollAmount) => {
    window.scrollBy(0, scrollAmount)
  }, amount)

  // Wait for scroll animation to complete
  await delay(CONFIG.TIMEOUTS.scrollAnimation)
}

/**
 * Scroll to a specific scene (by index or name)
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number|string} sceneIdentifier - Scene index (0-5) or name
 * @returns {Promise<void>}
 *
 * @example
 * await scrollToScene(page, 2) // Scroll to Scene 3 (Map)
 * await scrollToScene(page, 'venues') // Scroll to Venues scene
 */
export async function scrollToScene(page, sceneIdentifier) {
  const sceneMap = {
    'timeline': 0,
    'venues': 1,
    'map': 2,
    'bands': 3,
    'genres': 4,
    'artists': 5
  }

  const sceneIndex = typeof sceneIdentifier === 'string'
    ? sceneMap[sceneIdentifier.toLowerCase()]
    : sceneIdentifier

  if (sceneIndex === undefined) {
    throw new Error(`Invalid scene identifier: ${sceneIdentifier}`)
  }

  await page.evaluate((index) => {
    const scenes = document.querySelectorAll('[data-testid^="scene-"]')
    if (scenes[index]) {
      scenes[index].scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, sceneIndex)

  // Wait for scroll animation
  await delay(CONFIG.TIMEOUTS.scrollAnimation + 500)
}

/**
 * Wait for element to be visible
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @param {number} timeout - Max wait time in ms (default: 5000)
 * @returns {Promise<void>}
 *
 * @example
 * await waitForElement(page, '[data-testid="artist-card"]')
 */
export async function waitForElement(page, selector, timeout = 5000) {
  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  await page.waitForSelector(finalSelector, {
    visible: true,
    timeout
  })
}

/**
 * Click element with wait for navigation if needed
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @param {Object} options - Click options
 * @param {boolean} options.waitForNavigation - Wait for navigation after click (default: false)
 * @returns {Promise<void>}
 *
 * @example
 * await clickElement(page, '[data-testid="artist-card"]')
 */
export async function clickElement(page, selector, options = {}) {
  const { waitForNavigation = false } = options

  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  if (waitForNavigation) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click(finalSelector)
    ])
  } else {
    await page.click(finalSelector)
    await delay(CONFIG.TIMEOUTS.interaction)
  }
}

/**
 * Hover over element
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @returns {Promise<void>}
 *
 * @example
 * await hoverElement(page, '[data-testid="year-dot"]')
 */
export async function hoverElement(page, selector) {
  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  await page.hover(finalSelector)
  await delay(CONFIG.TIMEOUTS.interaction)
}

/**
 * Get text content of element
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @returns {Promise<string>} Text content
 *
 * @example
 * const title = await getTextContent(page, '[data-testid="artist-name"]')
 */
export async function getTextContent(page, selector) {
  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  return await page.$eval(finalSelector, el => el.textContent?.trim() || '')
}

/**
 * Check if element exists in DOM
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @returns {Promise<boolean>} True if element exists
 *
 * @example
 * const hasArtistCard = await elementExists(page, 'artist-card')
 */
export async function elementExists(page, selector) {
  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  const element = await page.$(finalSelector)
  return element !== null
}

/**
 * Get element count
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @returns {Promise<number>} Number of matching elements
 *
 * @example
 * const cardCount = await getElementCount(page, '[data-testid="artist-card"]')
 */
export async function getElementCount(page, selector) {
  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  return await page.$$eval(finalSelector, els => els.length)
}

/**
 * Type text into input field
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector or data-testid
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @param {boolean} options.clear - Clear field before typing (default: true)
 * @returns {Promise<void>}
 *
 * @example
 * await typeText(page, 'artist-search', 'Depeche Mode')
 */
export async function typeText(page, selector, text, options = {}) {
  const { clear = true } = options

  // Handle data-testid shorthand
  const finalSelector = selector.startsWith('[data-testid')
    ? selector
    : `[data-testid="${selector}"]`

  if (clear) {
    await page.click(finalSelector, { clickCount: 3 }) // Select all
  }

  await page.type(finalSelector, text)
  await delay(CONFIG.TIMEOUTS.interaction)
}

