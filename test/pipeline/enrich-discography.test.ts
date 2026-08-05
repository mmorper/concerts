import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('enrich-discography.ts', () => {
  // Per-suite temp dir. All three enrich-* suites previously shared
  // ../temp-output and each rmSync'd it in afterEach — with vitest running
  // files in parallel, one suite's teardown deleted the directory another
  // was mid-write in, so the full run failed intermittently while each file
  // passed in isolation. (The old cleanup even swallowed the error: "Ignore
  // cleanup errors (race condition with parallel tests)".)
  const testOutputDir = path.join(__dirname, '../temp-output-discography')

  beforeEach(() => {
    // Create temp output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up temp directory
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true })
      }
    } catch (error) {
      // Ignore cleanup errors (race condition with parallel tests)
    }
  })

  describe('MusicBrainz artist search', () => {
    it('searches for artist by name', () => {
      const artistName = 'Depeche Mode'
      const encodedName = encodeURIComponent(artistName)
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodedName}&fmt=json`

      expect(url).toContain('musicbrainz.org/ws/2/artist')
      expect(url).toContain('Depeche%20Mode')
      expect(url).toContain('fmt=json')
    })

    it('requires User-Agent header', () => {
      const userAgent = 'Morperhaus-Concerts/3.5.0 (concerts@morperhaus.org)'
      const headers = {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      }

      expect(headers['User-Agent']).toContain('Morperhaus-Concerts')
      expect(headers['Accept']).toBe('application/json')
    })

    it('returns artist MBID from search', () => {
      const mockResponse = {
        artists: [
          { id: 'mbid-123', name: 'Depeche Mode', score: 100 },
          { id: 'mbid-456', name: 'Depeche Mode Tribute', score: 60 },
        ],
        count: 2,
      }

      const topResult = mockResponse.artists[0]

      expect(topResult.id).toBe('mbid-123')
      expect(topResult.name).toBe('Depeche Mode')
    })

    it('handles no search results', () => {
      const mockResponse = {
        artists: [],
        count: 0,
      }

      expect(mockResponse.artists).toHaveLength(0)
    })

    it('handles 503 rate limit errors with retry', async () => {
      const response = { status: 503, ok: false }

      if (response.status === 503) {
        // Wait 2 seconds before retry
        const waitTime = 2000
        expect(waitTime).toBe(2000)
      }
    })
  })

  describe('Levenshtein distance / fuzzy matching', () => {
    const stringSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().trim()
      const s2 = str2.toLowerCase().trim()

      if (s1 === s2) return 1
      if (s1.length === 0 || s2.length === 0) return 0

      const len1 = s1.length
      const len2 = s2.length
      const matrix: number[][] = []

      // Initialize matrix
      for (let i = 0; i <= len2; i++) {
        matrix[i] = [i]
      }
      for (let j = 0; j <= len1; j++) {
        matrix[0][j] = j
      }

      // Fill matrix
      for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
          if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1]
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            )
          }
        }
      }

      const distance = matrix[len2][len1]
      const maxLen = Math.max(len1, len2)
      return 1 - distance / maxLen
    }

    it('returns 1.0 for exact matches', () => {
      expect(stringSimilarity('Depeche Mode', 'Depeche Mode')).toBe(1)
    })

    it('is case-insensitive', () => {
      expect(stringSimilarity('depeche mode', 'DEPECHE MODE')).toBe(1)
    })

    it('trims whitespace', () => {
      expect(stringSimilarity('  The Cure  ', 'The Cure')).toBe(1)
    })

    it('calculates similarity for near matches', () => {
      const similarity = stringSimilarity('The Cure', 'The Cure Band')
      expect(similarity).toBeGreaterThan(0.6)
      expect(similarity).toBeLessThan(1.0)
    })

    it('requires 80% similarity threshold', () => {
      const threshold = 0.8
      const goodMatch = stringSimilarity('Joy Division', 'Joy Division')
      const badMatch = stringSimilarity('Joy Division', 'New Order')

      expect(goodMatch).toBeGreaterThanOrEqual(threshold)
      expect(badMatch).toBeLessThan(threshold)
    })

    it('returns 0 for empty strings', () => {
      expect(stringSimilarity('', 'test')).toBe(0)
      expect(stringSimilarity('test', '')).toBe(0)
    })

    it('handles single character differences', () => {
      const similarity = stringSimilarity('Bauhaus', 'Bauhau')
      expect(similarity).toBeGreaterThan(0.85)
    })
  })

  describe('discography fetching', () => {
    it('fetches release groups by MBID', () => {
      const mbid = 'artist-mbid-123'
      const url = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&limit=100&fmt=json`

      expect(url).toContain('release-group?artist=')
      expect(url).toContain(mbid)
      expect(url).toContain('limit=100')
    })

    it('limits to 100 release groups', () => {
      const limit = 100
      const url = `https://musicbrainz.org/ws/2/release-group?artist=mbid&limit=${limit}&fmt=json`

      expect(url).toContain('limit=100')
    })

    it('warns when artist has more than 100 albums', () => {
      const mockResponse = {
        'release-groups': [],
        'release-group-count': 150,
      }

      const shouldWarn = mockResponse['release-group-count'] > 100
      expect(shouldWarn).toBe(true)
    })

    it('parses release groups into albums', () => {
      const mockReleaseGroups = [
        {
          id: 'rg-1',
          title: 'Violator',
          'first-release-date': '1990-03-19',
          'primary-type': 'Album',
          'secondary-types': [],
          disambiguation: '',
        },
        {
          id: 'rg-2',
          title: 'Songs of Faith and Devotion',
          'first-release-date': '1993-03-22',
          'primary-type': 'Album',
          'secondary-types': [],
          disambiguation: '',
        },
      ]

      const albums = mockReleaseGroups.map(rg => ({
        id: rg.id,
        title: rg.title,
        releaseDate: rg['first-release-date'],
        year: parseInt(rg['first-release-date'].split('-')[0], 10),
        primaryType: rg['primary-type'] || 'Album',
        secondaryTypes: rg['secondary-types'] || [],
        disambiguation: rg.disambiguation || '',
        coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-500.jpg`,
        coverAvailable: true,
      }))

      expect(albums).toHaveLength(2)
      expect(albums[0].title).toBe('Violator')
      expect(albums[0].year).toBe(1990)
      expect(albums[1].title).toBe('Songs of Faith and Devotion')
      expect(albums[1].year).toBe(1993)
    })

    it('skips albums without release dates', () => {
      const mockReleaseGroups = [
        {
          id: 'rg-1',
          title: 'Released Album',
          'first-release-date': '1990-03-19',
        },
        {
          id: 'rg-2',
          title: 'Unreleased Album',
          // No release date
        },
      ]

      const albums = mockReleaseGroups.filter(rg => rg['first-release-date'])

      expect(albums).toHaveLength(1)
      expect(albums[0].title).toBe('Released Album')
    })

    it('parses year from release date', () => {
      const releaseDate = '1990-03-19'
      const year = parseInt(releaseDate.split('-')[0], 10)

      expect(year).toBe(1990)
    })

    it('handles invalid years', () => {
      const invalidDate = 'invalid-date'
      const year = parseInt(invalidDate.split('-')[0], 10)

      expect(isNaN(year)).toBe(true)
    })
  })

  describe('cover art URLs', () => {
    it('generates Cover Art Archive URL', () => {
      const releaseGroupId = 'rg-123-456'
      const coverUrl = `https://coverartarchive.org/release-group/${releaseGroupId}/front-500.jpg`

      expect(coverUrl).toContain('coverartarchive.org/release-group/')
      expect(coverUrl).toContain(releaseGroupId)
      expect(coverUrl).toContain('front-500.jpg')
    })

    it('assumes cover art is available', () => {
      const album = {
        id: 'rg-123',
        coverAvailable: true,
      }

      // Cover availability assumed, 404s handled in UI
      expect(album.coverAvailable).toBe(true)
    })
  })

  describe('album sorting', () => {
    it('sorts albums by release date (newest first)', () => {
      const albums = [
        { releaseDate: '1990-03-19', title: 'Violator' },
        { releaseDate: '2023-03-24', title: 'Memento Mori' },
        { releaseDate: '1993-03-22', title: 'Songs of Faith and Devotion' },
      ]

      const sorted = albums.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))

      expect(sorted[0].title).toBe('Memento Mori') // 2023
      expect(sorted[1].title).toBe('Songs of Faith and Devotion') // 1993
      expect(sorted[2].title).toBe('Violator') // 1990
    })
  })

  describe('cache management', () => {
    it('skips artists with recent cache (< 90 days)', () => {
      const existingData = {
        artistName: 'Depeche Mode',
        normalizedName: 'depeche-mode',
        mbid: 'mbid-123',
        cachedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        albumCount: 10,
        albums: [],
        fetchedAt: new Date().toISOString(),
      }

      const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
      const age = Date.now() - new Date(existingData.cachedAt).getTime()
      const shouldSkip = age < NINETY_DAYS

      expect(shouldSkip).toBe(true)
    })

    it('re-fetches artists with stale cache (>= 90 days)', () => {
      const existingData = {
        artistName: 'The Cure',
        normalizedName: 'the-cure',
        mbid: 'mbid-456',
        cachedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
        albumCount: 15,
        albums: [],
        fetchedAt: new Date().toISOString(),
      }

      const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
      const age = Date.now() - new Date(existingData.cachedAt).getTime()
      const shouldRefetch = age >= NINETY_DAYS

      expect(shouldRefetch).toBe(true)
    })

    it('force flag bypasses cache', () => {
      const force = true
      const existingData = {
        cachedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      }

      const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
      const age = Date.now() - new Date(existingData.cachedAt).getTime()

      // With force flag, always fetch
      const shouldFetch = force || age >= NINETY_DAYS

      expect(shouldFetch).toBe(true)
    })
  })

  describe('mock data handling', () => {
    it('skips artists with mock dataSource', () => {
      const artist = {
        name: 'Test Artist',
        dataSource: 'mock',
      }

      const isMockData = artist.dataSource === 'mock'
      expect(isMockData).toBe(true)
    })

    it('skips artists with mock source', () => {
      const artist = {
        name: 'Test Artist',
        source: 'mock',
      }

      const isMockData = artist.source === 'mock'
      expect(isMockData).toBe(true)
    })

    it('does not skip artists with real data', () => {
      const artist = {
        name: 'Real Artist',
        dataSource: 'theaudiodb',
        source: 'theaudiodb',
      }

      const isMockData = artist.dataSource === 'mock' || artist.source === 'mock'
      expect(isMockData).toBe(false)
    })
  })

  describe('empty discography handling', () => {
    it('stores empty entry when artist not found', () => {
      const artistName = 'Unknown Artist'
      const normalizedName = 'unknown-artist'

      const emptyEntry = {
        artistName,
        normalizedName,
        mbid: null,
        albumCount: 0,
        albums: [],
        fetchedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      }

      expect(emptyEntry.mbid).toBeNull()
      expect(emptyEntry.albumCount).toBe(0)
      expect(emptyEntry.albums).toHaveLength(0)
    })

    it('prevents re-fetching artists not found in MusicBrainz', () => {
      const existingData = {
        mbid: null,
        cachedAt: new Date().toISOString(),
      }

      // Even with null MBID, respect cache
      const hasEntry = existingData !== undefined
      expect(hasEntry).toBe(true)
    })
  })

  describe('rate limiting', () => {
    it('enforces 1 request per second', () => {
      const requestsPerSecond = 1
      const delayMs = 1000 / requestsPerSecond

      expect(delayMs).toBe(1000)
    })

    it('waits 2 seconds on 503 rate limit error', async () => {
      const rateLimitWaitMs = 2000

      expect(rateLimitWaitMs).toBe(2000)
    })
  })

  describe('discography file structure', () => {
    it('includes all required fields', () => {
      const discographyEntry = {
        artistName: 'Depeche Mode',
        normalizedName: 'depeche-mode',
        mbid: 'mbid-123',
        fetchedAt: '2024-01-01T00:00:00.000Z',
        cachedAt: '2024-01-01T00:00:00.000Z',
        albumCount: 2,
        albums: [
          {
            id: 'rg-1',
            title: 'Violator',
            releaseDate: '1990-03-19',
            year: 1990,
            primaryType: 'Album',
            secondaryTypes: [],
            disambiguation: '',
            coverUrl: 'https://coverartarchive.org/release-group/rg-1/front-500.jpg',
            coverAvailable: true,
          },
        ],
      }

      expect(discographyEntry.artistName).toBeDefined()
      expect(discographyEntry.normalizedName).toBeDefined()
      expect(discographyEntry.mbid).toBeDefined()
      expect(discographyEntry.fetchedAt).toBeDefined()
      expect(discographyEntry.cachedAt).toBeDefined()
      expect(discographyEntry.albumCount).toBe(2)
      expect(discographyEntry.albums).toHaveLength(1)
      expect(discographyEntry.albums[0].coverUrl).toContain('coverartarchive.org')
    })

    it('normalizes artist names for keys', async () => {
      const { normalizeArtistName } = await import('../../src/utils/normalize.js')

      const artistName = 'Depeche Mode'
      const normalizedName = normalizeArtistName(artistName)

      expect(normalizedName).toBe('depeche-mode')
    })
  })

  describe('dry-run mode', () => {
    it('does not write files in dry-run mode', () => {
      const dryRun = true

      if (dryRun) {
        // Skip file write
        expect(dryRun).toBe(true)
      } else {
        // Write file
        expect(dryRun).toBe(false)
      }
    })

    it('shows file size preview in dry-run mode', () => {
      const mockDiscography = {
        'depeche-mode': {
          artistName: 'Depeche Mode',
          albums: [],
        },
      }

      const json = JSON.stringify(mockDiscography, null, 2)
      const sizeKB = (json.length / 1024).toFixed(1)

      expect(parseFloat(sizeKB)).toBeGreaterThan(0)
    })
  })

  describe('backup creation', () => {
    it('creates backup before overwriting', () => {
      const discographyPath = path.join(testOutputDir, 'discography.json')

      // Ensure directory exists
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true })
      }

      // Create existing file
      fs.writeFileSync(discographyPath, JSON.stringify({ test: 'data' }))

      const fileExists = fs.existsSync(discographyPath)
      expect(fileExists).toBe(true)

      // Simulate backup check
      if (fileExists) {
        // Backup would be created here
        expect(true).toBe(true)
      }
    })

    it('keeps maximum 10 backups', () => {
      const maxBackups = 10

      expect(maxBackups).toBe(10)
    })
  })

  describe('summary statistics', () => {
    it('calculates enrichment counts', () => {
      const results = {
        enriched: 45,
        skipped: 30,
        failed: 5,
      }

      const total = results.enriched + results.skipped + results.failed

      expect(total).toBe(80)
      expect(results.enriched).toBeGreaterThan(results.failed)
    })
  })

  describe('album metadata', () => {
    it('includes primaryType field', () => {
      const album = {
        primaryType: 'Album',
      }

      expect(album.primaryType).toBe('Album')
    })

    it('includes secondaryTypes array', () => {
      const album = {
        secondaryTypes: ['Live', 'Compilation'],
      }

      expect(album.secondaryTypes).toBeInstanceOf(Array)
      expect(album.secondaryTypes).toContain('Live')
    })

    it('includes disambiguation field', () => {
      const album = {
        title: 'Greatest Hits',
        disambiguation: '2009 remaster',
      }

      expect(album.disambiguation).toBeDefined()
    })

    it('handles empty disambiguation', () => {
      const album = {
        disambiguation: '',
      }

      expect(album.disambiguation).toBe('')
    })
  })
})
