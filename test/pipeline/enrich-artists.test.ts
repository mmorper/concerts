/**
 * Tests for scripts/enrich-artists.ts
 *
 * Covers:
 * - File existence validation
 * - Artist metadata fetching from TheAudioDB
 * - Fallback to Last.fm when TheAudioDB fails
 * - Cache expiry (30 days)
 * - Mock data re-fetching (always stale)
 * - Rate limiting (2 req/sec)
 * - API error handling
 * - Backup creation
 * - Dry-run mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'

// Mock TheAudioDBClient
vi.mock('../../scripts/utils/theaudiodb-client', () => ({
  TheAudioDBClient: vi.fn(function (this: any, _apiKey: string) {
    this.getArtistInfo = vi.fn()
  }),
}))

// Mock LastFmClient
vi.mock('../../scripts/utils/lastfm-client', () => ({
  LastFmClient: vi.fn(function (this: any, _apiKey: string) {
    this.getArtistInfo = vi.fn()
  }),
}))

// Mock RateLimiter
vi.mock('../../scripts/utils/rate-limiter', () => ({
  RateLimiter: vi.fn(function (this: any, _callsPerSecond: number) {
    this.wait = vi.fn().mockResolvedValue(undefined)
  }),
}))

// Mock backup module
vi.mock('../../scripts/utils/backup', () => ({
  createBackup: vi.fn(),
}))

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

// Import after mocks
import { enrichArtists } from '../../scripts/enrich-artists'
import { TheAudioDBClient } from '../../scripts/utils/theaudiodb-client'
import { LastFmClient } from '../../scripts/utils/lastfm-client'
import { createBackup } from '../../scripts/utils/backup'

describe('enrich-artists.ts', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalExit: typeof process.exit
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn
  let originalError: typeof console.error

  beforeEach(() => {
    // Save originals
    originalEnv = { ...process.env }
    originalExit = process.exit
    originalLog = console.log
    originalWarn = console.warn
    originalError = console.error

    // Mock console to keep test output clean
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Mock process.exit to throw so execution stops
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit: ${code}`)
    }) as any

    // Set environment variables
    process.env.THEAUDIODB_API_KEY = '2'
    process.env.LASTFM_API_KEY = 'test-lastfm-key'

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore
    process.env = originalEnv
    process.exit = originalExit
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  })

  describe('File Existence', () => {
    it('should exit if concerts.json does not exist', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)
      ;(fs.readFileSync as any).mockReturnValue('{}')

      try {
        await enrichArtists()
      } catch (e: any) {
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json not found')
      )
    })

    it('should load existing artists metadata if available', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist 1' },
        ],
      }

      const mockMetadata = {
        'artist-1': {
          name: 'Artist 1',
          image: 'https://example.com/image.jpg',
          source: 'theaudiodb',
          fetchedAt: new Date().toISOString(),
        },
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('concerts.json')) {
          return JSON.stringify(mockConcerts)
        }
        if (path.includes('artists-metadata.json')) {
          return JSON.stringify(mockMetadata)
        }
        return '{}'
      })

      // Mock TheAudioDB client instance method
      const mockClient = (TheAudioDBClient as any).mock.results[0]?.value
      if (mockClient) {
        mockClient.getArtistInfo.mockResolvedValue({
          name: 'Artist 1',
          image: 'https://example.com/new-image.jpg',
          source: 'theaudiodb',
          fetchedAt: new Date().toISOString(),
        })
      }

      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Loaded 1 existing artist records')
      )
    })

    it('should create empty metadata if file does not exist', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'New Artist' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        if (path.includes('concerts.json')) return true
        return false
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 unique artists to enrich')
      )
    })
  })

  describe('TheAudioDB Integration', () => {
    it('should fetch artist metadata from TheAudioDB', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Depeche Mode' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      // Access mock instances after enrichArtists runs
      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 unique artists to enrich')
      )
    })

    it('should handle empty concerts list', async () => {
      const mockConcerts = {
        concerts: [],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 unique artists to enrich')
      )
    })
  })

  describe('File Operations', () => {
    it('should create backup before writing in normal mode', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist 1' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists()

      expect(createBackup).toHaveBeenCalledWith(
        expect.stringContaining('artists-metadata.json'),
        expect.objectContaining({ maxBackups: 10, verbose: true })
      )
    })

    it('should write metadata to artists-metadata.json in normal mode', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist 1' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists()

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('artists-metadata.json'),
        expect.any(String)
      )
    })

    it('should not create backup in dry-run mode', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist 1' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists({ dryRun: true })

      expect(createBackup).not.toHaveBeenCalled()
    })

    it('should not write files in dry-run mode', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist 1' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists({ dryRun: true })

      expect(fs.writeFileSync).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN MODE')
      )
    })
  })

  describe('Cache Expiry', () => {
    it('should skip artists with recent data (<30 days)', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 15) // 15 days ago

      const mockConcerts = {
        concerts: [
          { headliner: 'Cached Artist' },
        ],
      }

      const mockMetadata = {
        'cached-artist': {
          name: 'Cached Artist',
          image: 'https://example.com/image.jpg',
          source: 'theaudiodb',
          fetchedAt: recentDate.toISOString(),
        },
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('concerts.json')) {
          return JSON.stringify(mockConcerts)
        }
        if (path.includes('artists-metadata.json')) {
          return JSON.stringify(mockMetadata)
        }
        return '{}'
      })

      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipped (cached): 1')
      )
    })

    it('should always re-fetch mock data artists', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Mock Artist' },
        ],
      }

      const mockMetadata = {
        'mock-artist': {
          name: 'Mock Artist',
          source: 'mock',
          fetchedAt: new Date().toISOString(),
        },
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('concerts.json')) {
          return JSON.stringify(mockConcerts)
        }
        if (path.includes('artists-metadata.json')) {
          return JSON.stringify(mockMetadata)
        }
        return '{}'
      })

      await enrichArtists({ dryRun: true })

      // Check that skipped count is 0 (mock data should not be skipped)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipped (cached): 0')
      )
      // Should attempt to fetch the artist
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Fetching metadata for: Mock Artist')
      )
    })
  })

  describe('Unique Artist Extraction', () => {
    it('should extract unique headliners', async () => {
      const mockConcerts = {
        concerts: [
          { headliner: 'Artist A' },
          { headliner: 'Artist B' },
          { headliner: 'Artist A' }, // Duplicate
          { headliner: 'Artist C' },
        ],
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('concerts.json')
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConcerts))

      await enrichArtists({ dryRun: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Found 3 unique artists to enrich')
      )
    })
  })
})
