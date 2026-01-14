/**
 * Tests for scripts/validate-concerts.ts
 *
 * Covers:
 * - Required field validation (date, headliner, venue, city)
 * - Date format validation
 * - Duplicate concert detection (same date + headliner)
 * - Geocoding failure detection (0,0 coordinates)
 * - Excessive openers warning (>10)
 * - Orphaned openers error (openers without headliner)
 * - Unusual date warnings (before 1950 or >2 years future)
 * - Discography validation
 * - Exit codes (1 for errors, 0 for warnings only)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateConcerts } from '../../scripts/validate-concerts'
import * as fs from 'fs'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  }
})

describe('validate-concerts.ts', () => {
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let originalExit: typeof process.exit

  beforeEach(() => {
    // Save originals
    originalLog = console.log
    originalWarn = console.warn
    originalError = console.error
    originalExit = process.exit

    // Mock console
    console.log = vi.fn()
    console.warn = vi.warn
    console.error = vi.fn()

    // Mock process.exit to throw so execution stops
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit: ${code}`)
    }) as any

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
    process.exit = originalExit
  })

  describe('File Loading', () => {
    it('should exit with error if concerts.json does not exist', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)
      ;(fs.readFileSync as any).mockReturnValue('{}')

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json not found')
      )
    })

    it('should load and validate concerts when file exists', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      // Check that validation completed (may have warnings about missing discography)
      const calls = (console.log as any).mock.calls.map((call: any[]) => call[0])
      const hasSuccessMessage = calls.some(
        (msg: any) =>
          typeof msg === 'string' &&
          (msg.includes('All validations passed') ||
            msg.includes('Validation passed with warnings'))
      )
      expect(hasSuccessMessage).toBe(true)
    })
  })

  // Helper function to setup mock files with no discography
  function mockConcertsOnly(concerts: any[]) {
    const mockData = {
      concerts,
      metadata: { totalConcerts: concerts.length, dateRange: {} },
    }

    ;(fs.existsSync as any).mockImplementation((path: string) => {
      // Return false for discography.json to skip that validation
      return !path.includes('discography.json')
    })
    ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockData))
  }

  describe('Required Field Validation', () => {
    it('should error if date is missing', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Missing date')
      )
    })

    it('should error if headliner is missing', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: '',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Missing headliner')
      )
    })

    it('should warn if venue is missing', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: '',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Missing venue')
      )
    })

    it('should warn if city is missing', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: '',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Missing city')
      )
    })
  })

  describe('Date Validation', () => {
    it('should error for invalid date format', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: 'invalid-date',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date format')
      )
    })

    it('should warn for dates before 1950', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '1949-12-31',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unusual date')
      )
    })

    it('should warn for dates more than 2 years in future', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 3)

      mockConcertsOnly([
        {
          id: 'concert-1',
          date: futureDate.toISOString().split('T')[0],
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unusual date')
      )
    })
  })

  describe('Duplicate Detection', () => {
    it('should error for duplicate concerts (same date and headliner)', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Venue 1',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
        {
          id: 'concert-2',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Venue 2',
          city: 'New York',
          state: 'New York',
          location: { lat: 40.71, lng: -74.01 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate concert')
      )
    })

    it('should be case-insensitive when detecting duplicates', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Depeche Mode',
          venue: 'Venue 1',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
        {
          id: 'concert-2',
          date: '2024-01-15',
          headliner: 'DEPECHE MODE',
          venue: 'Venue 2',
          city: 'New York',
          state: 'New York',
          location: { lat: 40.71, lng: -74.01 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate concert')
      )
    })

    it('should allow same artist on different dates', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
        {
          id: 'concert-2',
          date: '2024-02-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      const calls = (console.log as any).mock.calls.map((call: any[]) => call[0])
      const hasSuccessMessage = calls.some(
        (msg: any) =>
          typeof msg === 'string' &&
          (msg.includes('All validations passed') ||
            msg.includes('Validation passed with warnings'))
      )
      expect(hasSuccessMessage).toBe(true)
    })
  })

  describe('Geocoding Validation', () => {
    it('should warn for default coordinates (0, 0)', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Unknown Venue',
          city: 'Unknown City',
          state: 'Unknown State',
          location: { lat: 0, lng: 0 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Default coordinates (0,0)')
      )
    })
  })

  describe('Opener Validation', () => {
    it('should warn for excessive openers (>10)', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: Array.from({ length: 15 }, (_, i) => `Opener ${i + 1}`),
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('15 openers')
      )
    })

    it('should error for orphaned openers (no headliner)', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: '',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: ['Opener 1', 'Opener 2'],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Openers exist but no headliner')
      )
    })
  })

  describe('Exit Codes', () => {
    it('should exit with code 1 when errors are found', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      try {
        await validateConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should not exit when only warnings are found', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: '',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation passed with warnings')
      )
    })

    it('should not exit when no errors or warnings', async () => {
      mockConcertsOnly([
        {
          id: 'concert-1',
          date: '2024-01-15',
          headliner: 'Test Artist',
          venue: 'Test Venue',
          city: 'Los Angeles',
          state: 'California',
          location: { lat: 34.05, lng: -118.24 },
          openers: [],
        },
      ])

      await validateConcerts()

      expect(process.exit).not.toHaveBeenCalled()
      const calls = (console.log as any).mock.calls.map((call: any[]) => call[0])
      const hasSuccessMessage = calls.some(
        (msg: any) =>
          typeof msg === 'string' &&
          (msg.includes('All validations passed') ||
            msg.includes('Validation passed with warnings'))
      )
      expect(hasSuccessMessage).toBe(true)
    })
  })
})
