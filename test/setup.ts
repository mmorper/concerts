/**
 * Global test setup for Vitest
 *
 * This file runs before all tests and sets up:
 * - Environment variables
 * - Global mocks
 * - Test utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import dotenv from 'dotenv'

// Load environment variables from .env.test if it exists, otherwise .env
dotenv.config({ path: '.env.test' })
dotenv.config({ path: '.env' })

// Mock environment variables for tests (prevent real API calls)
const originalEnv = process.env

beforeAll(() => {
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test'

  // Mock API keys to prevent accidental real API calls
  // Tests that need real API calls should explicitly override these
  if (!process.env.GOOGLE_SHEET_ID) {
    process.env.GOOGLE_SHEET_ID = 'mock-sheet-id'
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    process.env.GOOGLE_CLIENT_ID = 'mock-client-id'
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret'
  }
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    process.env.GOOGLE_REFRESH_TOKEN = 'mock-refresh-token'
  }
})

afterAll(() => {
  // Restore original environment
  process.env = originalEnv
})

// Clean up between tests
beforeEach(() => {
  // Reset any global state here
})

afterEach(() => {
  // Clean up after each test
})

// Increase timeout for slower CI environments
if (process.env.CI) {
  beforeAll(() => {
    // Double timeouts in CI
  })
}

// Console error/warning detection
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // Optionally make tests fail on console.error
  // console.error = (...args: any[]) => {
  //   originalConsoleError(...args)
  //   throw new Error('Console error detected')
  // }
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})
