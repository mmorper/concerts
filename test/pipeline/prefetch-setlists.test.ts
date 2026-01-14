import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock fetch globally before anything else
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock fs module
vi.mock('fs')

// Mock backup utility
vi.mock('../../scripts/utils/backup.js', () => ({
  createBackup: vi.fn()
}))

// Mock dotenv to prevent it from loading actual .env
vi.mock('dotenv', () => ({
  config: vi.fn()
}))

describe('prefetch-setlists.ts', () => {
  const MOCK_API_KEY = 'test-api-key-12345'
  const CACHE_PATH = path.resolve(__dirname, '../../public/data/setlists-cache.json')
  const CONCERTS_PATH = path.resolve(__dirname, '../../public/data/concerts.json')

  const mockConcertsData = {
    concerts: [
      {
        id: 'c1',
        date: '2024-01-15',
        headliner: 'Depeche Mode',
        openers: ['TR/ST'],
        venue: 'Hollywood Bowl',
        city: 'Los Angeles',
        state: 'California'
      },
      {
        id: 'c2',
        date: '2023-06-10',
        headliner: 'The Cure',
        venue: 'Greek Theatre',
        city: 'Berkeley',
        state: 'California'
      },
      {
        id: 'c3',
        date: '2022-03-20',
        headliner: 'Radiohead',
        venue: 'Hollywood Palladium',
        city: 'Hollywood',
        state: 'California'
      }
    ]
  }

  const mockSetlistResponse = {
    type: 'setlists',
    itemsPerPage: 20,
    page: 1,
    total: 1,
    setlist: [
      {
        id: '63d1e2f8',
        eventDate: '15-01-2024',
        artist: {
          mbid: 'mbid-123',
          name: 'Depeche Mode',
          sortName: 'Depeche Mode',
          disambiguation: '',
          url: 'https://www.setlist.fm/setlists/depeche-mode'
        },
        venue: {
          id: 'v-123',
          name: 'Hollywood Bowl',
          city: {
            id: 'city-123',
            name: 'Los Angeles',
            state: 'California',
            stateCode: 'CA',
            coords: {
              lat: 34.1128,
              long: -118.3389
            },
            country: {
              code: 'US',
              name: 'United States'
            }
          }
        },
        sets: {
          set: [
            {
              song: [
                { name: 'Walking in My Shoes' },
                { name: 'Personal Jesus' },
                { name: 'Enjoy the Silence' }
              ]
            }
          ]
        },
        url: 'https://www.setlist.fm/setlist/depeche-mode'
      }
    ]
  }

  const mockExistingCache = {
    version: '1.0.0',
    generatedAt: '2024-01-01T00:00:00.000Z',
    entries: [
      {
        concertId: 'c2',
        artistName: 'The Cure',
        date: '2023-06-10',
        venue: 'Greek Theatre',
        city: 'Berkeley',
        setlist: {
          id: 'existing-123',
          eventDate: '10-06-2023',
          artist: { name: 'The Cure' },
          venue: { name: 'Greek Theatre', city: { name: 'Berkeley' } },
          sets: { set: [{ song: [{ name: 'Friday I\'m in Love' }] }] }
        },
        fetchedAt: '2024-01-01T00:00:00.000Z'
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset process.env
    process.env.VITE_SETLISTFM_API_KEY = MOCK_API_KEY

    // Mock fs.readFileSync
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (filePath.toString().includes('concerts.json')) {
        return JSON.stringify(mockConcertsData)
      }
      if (filePath.toString().includes('setlists-cache.json')) {
        return JSON.stringify(mockExistingCache)
      }
      throw new Error(`File not found: ${filePath}`)
    })

    // Mock fs.existsSync
    vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
      return filePath.toString().includes('setlists-cache.json')
    })

    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    // Mock fs.mkdirSync
    vi.mocked(fs.mkdirSync).mockImplementation(() => '')

    // Mock fs.statSync
    vi.mocked(fs.statSync).mockReturnValue({ size: 5000 } as any)

    // Mock console methods to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSetlistResponse
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cache Management', () => {
    it('loads existing cache for incremental updates', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should have read the cache file
      expect(fs.readFileSync).toHaveBeenCalledWith(CACHE_PATH, 'utf-8')
    })

    it('reuses cached setlists without API calls', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should not fetch for cached artist "The Cure"
      const curceCalls = mockFetch.mock.calls.filter(call =>
        call[0].toString().includes('The%20Cure')
      )
      expect(curceCalls.length).toBe(0)
    })

    it('fetches new setlists via API', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should fetch for "Depeche Mode" (not in cache)
      expect(mockFetch).toHaveBeenCalled()

      // Check that at least one fetch call was made
      const fetchCalls = mockFetch.mock.calls
      expect(fetchCalls.length).toBeGreaterThan(0)
    })

    it('creates backup before force-refresh', async () => {
      const { createBackup } = await import('../../scripts/utils/backup.js')
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      expect(createBackup).toHaveBeenCalledWith(CACHE_PATH, {
        maxBackups: 10,
        verbose: true
      })
    })

    it('force-refresh re-fetches all setlists', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      // Should fetch all artists (3 headliners + 1 opener = 4 total)
      expect(mockFetch).toHaveBeenCalled()
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    it('handles missing cache file gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists()).resolves.not.toThrow()
    })

    it('uses composite cache key (concertId:artistName)', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Cache should contain entries with proper format
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      expect(writeCall).toBeDefined()

      const writtenCache = JSON.parse(writeCall![1] as string)
      expect(writtenCache.entries).toBeDefined()
      expect(writtenCache.entries.length).toBeGreaterThan(0)

      // Check that entries have concertId and artistName
      for (const entry of writtenCache.entries) {
        expect(entry.concertId).toBeDefined()
        expect(entry.artistName).toBeDefined()
      }
    })
  })

  describe('API Integration', () => {
    it('searches setlist.fm by artist + city + year', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Check that fetch was called with proper URL parameters
      expect(mockFetch).toHaveBeenCalled()

      // Find a call with query parameters
      const callWithParams = mockFetch.mock.calls.find(call => {
        const url = call[0]?.toString() || ''
        return url.includes('artistName') && url.includes('cityName')
      })

      expect(callWithParams).toBeDefined()

      if (callWithParams) {
        const url = new URL(callWithParams[0].toString())
        expect(url.searchParams.has('artistName')).toBe(true)
        expect(url.searchParams.has('cityName')).toBe(true)
        expect(url.searchParams.has('year')).toBe(true)
      }
    })

    it('includes API key in request headers', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Find any API call (not from cache)
      const apiCall = mockFetch.mock.calls.find(call => call[1]?.headers)

      expect(apiCall).toBeDefined()

      if (apiCall) {
        expect(apiCall[1].headers['x-api-key']).toBe(MOCK_API_KEY)
        expect(apiCall[1].headers['Accept']).toBe('application/json')
      }
    })

    it('handles setlist not found gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ setlist: [] })
      } as Response)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists()).resolves.not.toThrow()

      // Should write null setlist to cache
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const notFoundEntries = writtenCache.entries.filter(
        (e: any) => e.setlist === null && !e.error
      )
      expect(notFoundEntries.length).toBeGreaterThan(0)
    })

    it('handles API errors with error field', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists()).resolves.not.toThrow()

      // Should write error entry to cache
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const errorEntries = writtenCache.entries.filter(
        (e: any) => e.error !== undefined
      )
      expect(errorEntries.length).toBeGreaterThan(0)
    })

    it('handles 429 rate limit errors', async () => {
      vi.resetModules()

      // Mock setTimeout to execute immediately to avoid 60s wait
      const originalSetTimeout = global.setTimeout
      vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: any,
        _delay: number
      ) => {
        return originalSetTimeout(callback, 0)
      }) as any)

      // Mock one 429 error then successes
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        } as Response)
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ setlist: [] })
        } as Response)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists({ forceRefresh: true })).resolves.not.toThrow()

      // Should write error entry with rate limit message
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0].toString().includes('setlists-cache.json')
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const rateLimitEntries = writtenCache.entries.filter(
        (e: any) => e.error && e.error.includes('Rate limit')
      )
      expect(rateLimitEntries.length).toBeGreaterThan(0)
    }, 10000)

    it('exits with error when API key missing', async () => {
      vi.resetModules()
      delete process.env.VITE_SETLISTFM_API_KEY

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as any)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists()).rejects.toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
      // Restore for next tests
      process.env.VITE_SETLISTFM_API_KEY = MOCK_API_KEY
    })
  })

  describe('Fuzzy Venue Matching', () => {
    it('matches exact venue names', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should successfully match "Hollywood Bowl" exactly
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const depecheEntry = writtenCache.entries.find(
        (e: any) => e.artistName === 'Depeche Mode'
      )
      expect(depecheEntry.setlist).not.toBeNull()
      expect(depecheEntry.setlist.venue.name).toBe('Hollywood Bowl')
    })

    it('uses fuzzy matching for venue name variations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          setlist: [
            {
              ...mockSetlistResponse.setlist[0],
              venue: {
                ...mockSetlistResponse.setlist[0].venue,
                name: 'The Hollywood Bowl' // Slight variation
              }
            }
          ]
        })
      } as Response)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should still match with fuzzy logic
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const depecheEntry = writtenCache.entries.find(
        (e: any) => e.artistName === 'Depeche Mode'
      )
      expect(depecheEntry.setlist).not.toBeNull()
    })

    it('maps Hollywood to Los Angeles', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // For concert in "Hollywood", should search with "Los Angeles"
      const radioheadCall = mockFetch.mock.calls.find(call =>
        call[0].toString().includes('Radiohead')
      )
      expect(radioheadCall).toBeDefined()

      const url = new URL(radioheadCall![0].toString())
      expect(url.searchParams.get('cityName')).toBe('Los Angeles')
    })

    it('calculates match score using venue, city, and artist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          setlist: [
            // Good match
            {
              ...mockSetlistResponse.setlist[0],
              venue: { name: 'Hollywood Bowl', city: { name: 'Los Angeles' } }
            },
            // Poor match
            {
              ...mockSetlistResponse.setlist[0],
              id: 'different-id',
              venue: { name: 'Different Venue', city: { name: 'San Francisco' } }
            }
          ]
        })
      } as Response)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should pick the better match (Hollywood Bowl in LA)
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const depecheEntry = writtenCache.entries.find(
        (e: any) => e.artistName === 'Depeche Mode'
      )
      expect(depecheEntry.setlist.venue.name).toBe('Hollywood Bowl')
    })

    it('returns null when match score below threshold', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          setlist: [
            {
              ...mockSetlistResponse.setlist[0],
              venue: {
                name: 'Completely Different Venue',
                city: { name: 'New York' }
              },
              artist: { name: 'Different Artist' }
            }
          ]
        })
      } as Response)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should reject poor matches
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const depecheEntry = writtenCache.entries.find(
        (e: any) => e.artistName === 'Depeche Mode'
      )
      expect(depecheEntry.setlist).toBeNull()
    })
  })

  describe('Artist Processing', () => {
    it('fetches setlists for headliners', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should have entries for all headliners
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      expect(writtenCache.entries.some((e: any) => e.artistName === 'Depeche Mode')).toBe(true)
      expect(writtenCache.entries.some((e: any) => e.artistName === 'Radiohead')).toBe(true)
    })

    it('fetches setlists for openers', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      // Should have entry for opener "TR/ST"
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      expect(writtenCache.entries.some((e: any) => e.artistName === 'TR/ST')).toBe(true)
    })

    it('handles concerts with no openers', async () => {
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await expect(prefetchSetlists()).resolves.not.toThrow()

      // Concert c2 has no openers, should only have one entry for The Cure
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      const c2Entries = writtenCache.entries.filter((e: any) => e.concertId === 'c2')
      expect(c2Entries.length).toBe(1)
      expect(c2Entries[0].artistName).toBe('The Cure')
    })

    it('skips empty opener strings', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath === CONCERTS_PATH) {
          return JSON.stringify({
            concerts: [
              {
                id: 'c1',
                date: '2024-01-15',
                headliner: 'Test Band',
                openers: ['', '  ', 'Valid Opener'],
                venue: 'Test Venue',
                city: 'Test City',
                state: 'CA'
              }
            ]
          })
        }
        return JSON.stringify(mockExistingCache)
      })

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      // Should only process headliner and valid opener (not empty strings)
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0] === CACHE_PATH
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      expect(writtenCache.entries.length).toBe(2) // headliner + 1 valid opener
    })
  })

  describe('Rate Limiting', () => {
    it('rate limits to 1 req/sec (1500ms delay)', async () => {
      const delays: number[] = []
      const originalSetTimeout = global.setTimeout

      vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: any,
        delay: number
      ) => {
        delays.push(delay)
        return originalSetTimeout(callback, 0) // Execute immediately for test
      }) as any)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      // Should have 1500ms delays between requests
      expect(delays.some(d => d === 1500)).toBe(true)
    })

    it('waits 60 seconds after rate limit error', async () => {
      // Mock one 429 error then successes
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        } as Response)
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ setlist: [] })
        } as Response)

      const delays: number[] = []
      const originalSetTimeout = global.setTimeout

      vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: any,
        delay: number
      ) => {
        delays.push(delay)
        return originalSetTimeout(callback, 0)
      }) as any)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      // Should have 60000ms (60 second) delay after rate limit
      expect(delays.some(d => d === 60000)).toBe(true)
    }, 10000)

    it('waits 2 seconds after non-rate-limit errors', async () => {
      // Mock one error then successes
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ setlist: [] })
        } as Response)

      const delays: number[] = []
      const originalSetTimeout = global.setTimeout

      vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: any,
        delay: number
      ) => {
        delays.push(delay)
        return originalSetTimeout(callback, 0)
      }) as any)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      // Should have 2000ms (2 second) delay after error
      expect(delays.some(d => d === 2000)).toBe(true)
    }, 10000)
  })

  describe('Output Generation', () => {
    it('creates backup before writing cache', async () => {
      vi.resetModules()
      const { createBackup } = await import('../../scripts/utils/backup.js')
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: true })

      expect(createBackup).toHaveBeenCalled()
    })

    it('writes cache with correct structure', async () => {
      vi.resetModules()
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0].toString().includes('setlists-cache.json')
      )
      expect(writeCall).toBeDefined()

      const writtenCache = JSON.parse(writeCall![1] as string)
      expect(writtenCache.version).toBe('1.0.0')
      expect(writtenCache.generatedAt).toBeDefined()
      expect(writtenCache.entries).toBeInstanceOf(Array)
    })

    it('includes fetchedAt timestamp for each entry', async () => {
      vi.resetModules()
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0].toString().includes('setlists-cache.json')
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      for (const entry of writtenCache.entries) {
        expect(entry.fetchedAt).toBeDefined()
        expect(new Date(entry.fetchedAt).toString()).not.toBe('Invalid Date')
      }
    })

    it('creates output directory if missing', async () => {
      vi.resetModules()
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('public/data'),
        { recursive: true }
      )
    })

    it('preserves existing cache entries when not re-fetching', async () => {
      vi.resetModules()
      const prefetchSetlists = (await import('../../scripts/prefetch-setlists.ts')).default

      await prefetchSetlists({ forceRefresh: false })

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        call => call[0].toString().includes('setlists-cache.json')
      )
      const writtenCache = JSON.parse(writeCall![1] as string)

      // Should still have The Cure entry from existing cache
      const cureEntry = writtenCache.entries.find(
        (e: any) => e.artistName === 'The Cure'
      )
      expect(cureEntry).toBeDefined()
      expect(cureEntry.setlist).not.toBeNull()
      expect(cureEntry.setlist.id).toBe('existing-123')
    })
  })
})
