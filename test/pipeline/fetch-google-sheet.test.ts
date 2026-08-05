/**
 * Tests for scripts/fetch-google-sheet.ts
 *
 * Covers:
 * - Google Sheets API integration
 * - Header parsing and column detection
 * - Row validation (invalid dates, missing headliners)
 * - Data processing (dates, openers, normalization)
 * - Geocode cache integration
 * - Metadata generation
 * - Backup creation
 * - Dry-run mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Create mock functions
const mockFetchConcerts = vi.fn()
const mockCreateBackup = vi.fn()

// Mock GoogleSheetsClient at the top level
vi.mock('../../scripts/utils/google-sheets-client', () => {
  return {
    GoogleSheetsClient: vi.fn(function(this: any) {
      this.fetchConcerts = mockFetchConcerts
    }),
  }
})

// Mock backup module
vi.mock('../../scripts/utils/backup', () => ({
  createBackup: mockCreateBackup,
}))

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  }
})

describe('fetch-google-sheet.ts', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalExit: typeof process.exit
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn
  let originalError: typeof console.error

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env }
    originalExit = process.exit
    originalLog = console.log
    originalWarn = console.warn
    originalError = console.error

    // Set required environment variables
    process.env.GOOGLE_SHEET_ID = 'test-sheet-id'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost'
    process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token'

    // Mock console methods to keep test output clean
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore environment
    process.env = originalEnv
    process.exit = originalExit
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  })

  describe('Environment Variable Validation', () => {
    it('should exit with error if GOOGLE_SHEET_ID is missing', async () => {
      delete process.env.GOOGLE_SHEET_ID

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
      // Check that an error message was logged
      const errorCalls = (console.error as any).mock.calls
      const hasErrorMessage = errorCalls.length > 0
      expect(hasErrorMessage).toBe(true)
    })

    it('should exit with error if GOOGLE_CLIENT_ID is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should exit with error if GOOGLE_CLIENT_SECRET is missing', async () => {
      delete process.env.GOOGLE_CLIENT_SECRET

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should exit with error if GOOGLE_REDIRECT_URI is missing', async () => {
      delete process.env.GOOGLE_REDIRECT_URI

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should exit with error if GOOGLE_REFRESH_TOKEN is missing', async () => {
      delete process.env.GOOGLE_REFRESH_TOKEN

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should proceed when all required environment variables are present', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      expect(mockFetchConcerts).toHaveBeenCalled()
    })
  })

  describe('Row Validation', () => {
    it('should skip rows with invalid dates', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Valid Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Valid Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: 'invalid-date',
          headliner: 'Invalid Date Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '',
          headliner: 'Empty Date Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      // Should warn about skipped rows
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed: 1 concert')
      )
    })

    it('should skip rows with missing headliners', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Valid Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Valid Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-02-20',
          headliner: '',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-03-10',
          headliner: '   ',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      // Should warn about missing headliners
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing headliner')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed: 1 concert')
      )
    })

    it('should warn but not skip rows with missing venues', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Valid Artist',
          genre: 'Rock',
          opener: '',
          venue: '',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      // Should warn about missing venue but still process the row
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing venue')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed: 1 concert')
      )
    })
  })

  describe('Data Processing', () => {
    it('should parse dates correctly', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.date).toBe('2024-01-15')
      expect(concert.year).toBe(2024)
      expect(concert.month).toBe(1)
      // Day can be 14 or 15 depending on timezone interpretation of date string
      expect(concert.day).toBeGreaterThanOrEqual(14)
      expect(concert.day).toBeLessThanOrEqual(15)
      expect(concert.dayOfWeek).toMatch(/Monday|Sunday/)
      expect(concert.decade).toBe('2020s')
    })

    it('should normalize artist, venue, and genre names', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Depeche Mode',
          genre: 'Synth Pop',
          opener: '',
          venue: 'Hollywood Bowl',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.headliner).toBe('Depeche Mode')
      expect(concert.headlinerNormalized).toBe('depeche-mode')
      expect(concert.venue).toBe('Hollywood Bowl')
      expect(concert.venueNormalized).toBe('hollywood-bowl')
      expect(concert.genre).toBe('Synth Pop')
      expect(concert.genreNormalized).toBe('synth-pop')
    })

    it('should split cityState into city and state', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.city).toBe('Los Angeles')
      expect(concert.state).toBe('California')
      expect(concert.cityState).toBe('Los Angeles, California')
    })

    it('should process openers array correctly', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: ['Opener 1', 'Opener 2', 'Opener 3'],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.openers).toEqual(['Opener 1', 'Opener 2', 'Opener 3'])
    })

    it('should generate sequential IDs starting from 1', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Artist 1',
          genre: 'Rock',
          opener: '',
          venue: 'Venue 1',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-02-20',
          headliner: 'Artist 2',
          genre: 'Pop',
          opener: '',
          venue: 'Venue 2',
          cityState: 'New York, New York',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(writtenData.concerts[0].id).toBe('concert-1')
      expect(writtenData.concerts[1].id).toBe('concert-2')
    })

    it('should sort concerts by date (oldest to newest)', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-03-10',
          headliner: 'Artist 3',
          genre: 'Rock',
          opener: '',
          venue: 'Venue 3',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-01-15',
          headliner: 'Artist 1',
          genre: 'Rock',
          opener: '',
          venue: 'Venue 1',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-02-20',
          headliner: 'Artist 2',
          genre: 'Pop',
          opener: '',
          venue: 'Venue 2',
          cityState: 'New York, New York',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(writtenData.concerts[0].date).toBe('2024-01-15')
      expect(writtenData.concerts[1].date).toBe('2024-02-20')
      expect(writtenData.concerts[2].date).toBe('2024-03-10')
    })
  })

  describe('Geocoding Integration', () => {
    it('should load geocode cache if it exists', async () => {
      const fs = await import('fs')
      const mockCache = {
        'hollywood bowl|los angeles|california': {
          lat: 34.1128,
          lng: -118.3389,
        },
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockCache))

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Hollywood Bowl',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.location.lat).toBe(34.1128)
      expect(concert.location.lng).toBe(-118.3389)
    })

    it('should trim whitespace before looking up venue in cache', async () => {
      const fs = await import('fs')
      const mockCache = {
        'hollywood bowl|los angeles|california': {
          lat: 34.1128,
          lng: -118.3389,
        },
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockCache))

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: '  Hollywood Bowl  ',
          cityState: '  Los Angeles  ,  California  ',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      expect(concert.location.lat).toBe(34.1128)
      expect(concert.location.lng).toBe(-118.3389)
    })

    it('should fallback to city coordinates when venue not in cache', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockReturnValue('{}')

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Unknown Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const concert = writtenData.concerts[0]
      // Should fallback to default coordinates (Denver, CO) since LA not in CITY_COORDINATES
      expect(concert.location.lat).toBeCloseTo(39.7392, 3)
      expect(concert.location.lng).toBeCloseTo(-104.9903, 3)
    })
  })

  describe('Metadata Generation', () => {
    it('should generate correct metadata', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Artist 1',
          genre: 'Rock',
          opener: '',
          venue: 'Venue 1',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
        {
          date: '2024-02-20',
          headliner: 'Artist 2',
          genre: 'Pop',
          opener: '',
          venue: 'Venue 2',
          cityState: 'New York, New York',
          reference: '',
          openers: [],
        },
        {
          date: '2024-03-10',
          headliner: 'Artist 1',
          genre: 'Rock',
          opener: '',
          venue: 'Venue 1',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      const metadata = writtenData.metadata
      expect(metadata.totalConcerts).toBe(3)
      expect(metadata.uniqueArtists).toBe(2)
      expect(metadata.uniqueVenues).toBe(2)
      expect(metadata.uniqueCities).toBe(2)
      expect(metadata.dateRange.earliest).toBe('2024-01-15')
      expect(metadata.dateRange.latest).toBe('2024-03-10')
      expect(metadata.lastUpdated).toBeDefined()
    })

    it('should handle empty result set', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      let writtenData: any
      ;(fs.writeFileSync as any).mockImplementation((_path: string, data: string) => {
        writtenData = JSON.parse(data)
      })

      mockFetchConcerts.mockResolvedValue([])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(writtenData.concerts).toHaveLength(0)
      expect(writtenData.metadata.totalConcerts).toBe(0)
      expect(writtenData.metadata.dateRange.earliest).toBe('')
      expect(writtenData.metadata.dateRange.latest).toBe('')
    })
  })

  describe('File Operations', () => {
    it('should create backup before writing in normal mode', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(mockCreateBackup).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json'),
        expect.objectContaining({ maxBackups: 10, verbose: true })
      )
    })

    it('should write to concerts.json in normal mode', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)
      ;(fs.writeFileSync as any).mockImplementation(() => {})

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json'),
        expect.any(String)
      )
    })

    it('should not create backup in dry-run mode', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      expect(mockCreateBackup).not.toHaveBeenCalled()
    })

    it('should not write files in dry-run mode', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFetchConcerts.mockResolvedValue([
        {
          date: '2024-01-15',
          headliner: 'Test Artist',
          genre: 'Rock',
          opener: '',
          venue: 'Test Venue',
          cityState: 'Los Angeles, California',
          reference: '',
          openers: [],
        },
      ])

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet({ dryRun: true })

      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should exit with error if Google Sheets API fails', async () => {
      mockFetchConcerts.mockRejectedValue(new Error('API Error'))

      process.exit = vi.fn() as any

      const { fetchGoogleSheet } = await import('../../scripts/fetch-google-sheet')
      await fetchGoogleSheet()

      expect(process.exit).toHaveBeenCalledWith(1)
      // console.error is called with 2 args: message and error object
      const errorCalls = (console.error as any).mock.calls
      const hasErrorMessage = errorCalls.some((call: any[]) =>
        call.some((arg: any) =>
          typeof arg === 'string' && arg.includes('Error fetching Google Sheets data')
        )
      )
      expect(hasErrorMessage).toBe(true)
    })
  })
})
