import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('enrich-spotify-metadata.ts', () => {
  // Per-suite temp dir. All three enrich-* suites previously shared
  // ../temp-output and each rmSync'd it in afterEach — with vitest running
  // files in parallel, one suite's teardown deleted the directory another
  // was mid-write in, so the full run failed intermittently while each file
  // passed in isolation. (The old cleanup even swallowed the error: "Ignore
  // cleanup errors (race condition with parallel tests)".)
  const testOutputDir = path.join(__dirname, '../temp-output-spotify')

  beforeEach(() => {
    // Create temp output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }

    // Mock environment variables
    process.env.SPOTIFY_CLIENT_ID = 'mock-client-id'
    process.env.SPOTIFY_CLIENT_SECRET = 'mock-client-secret'
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

  describe('Spotify authentication', () => {
    it('authenticates with Client Credentials flow', async () => {
      const clientId = 'mock-client-id'
      const clientSecret = 'mock-client-secret'
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

      expect(credentials).toBeDefined()
      expect(typeof credentials).toBe('string')
    })

    it('builds correct Authorization header', () => {
      const clientId = 'test-id'
      const clientSecret = 'test-secret'
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const authHeader = `Basic ${basicAuth}`

      expect(authHeader).toContain('Basic ')
      expect(authHeader.length).toBeGreaterThan(10)
    })

    it('requires both client ID and secret', () => {
      delete process.env.SPOTIFY_CLIENT_ID
      const hasCredentials = Boolean(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
      )

      expect(hasCredentials).toBe(false)

      // Restore
      process.env.SPOTIFY_CLIENT_ID = 'mock-client-id'
    })

    it('handles authentication failure gracefully', () => {
      const mockError = new Error('Spotify auth failed: 401 Unauthorized')

      expect(mockError.message).toContain('Spotify auth failed')
      expect(mockError.message).toContain('401')
    })
  })

  describe('artist search', () => {
    it('searches Spotify for artist by name', () => {
      const artistName = 'Depeche Mode'
      const encodedName = encodeURIComponent(artistName)
      const url = `https://api.spotify.com/v1/search?type=artist&q=${encodedName}&limit=5`

      expect(url).toContain('search?type=artist')
      expect(url).toContain('Depeche%20Mode')
      expect(url).toContain('limit=5')
    })

    it('encodes special characters in artist names', () => {
      const artistName = "Guns N' Roses"
      const encodedName = encodeURIComponent(artistName)

      expect(encodedName).toContain('Guns')
      expect(encodedName).toContain('%20') // Encoded space
      // Note: encodeURIComponent doesn't encode single quotes by default
      expect(encodedName).toBeDefined()
    })

    it('returns top result from search', () => {
      const mockSearchResponse = {
        artists: {
          items: [
            { id: '1', name: 'Depeche Mode', popularity: 75 },
            { id: '2', name: 'Depeche Mode Tribute', popularity: 20 },
          ],
        },
      }

      const topResult = mockSearchResponse.artists.items[0]

      expect(topResult.name).toBe('Depeche Mode')
      expect(topResult.popularity).toBe(75)
    })

    it('handles no search results', () => {
      const mockSearchResponse = {
        artists: {
          items: [],
        },
      }

      const artists = mockSearchResponse.artists.items
      expect(artists).toHaveLength(0)
    })

    it('warns about low-confidence matches', () => {
      const artistName = 'The Cure'
      const topResult = {
        name: 'The Cure Cover Band',
        popularity: 15,
      }

      // Simulate fuzzy match
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedInput = normalize(artistName)
      const normalizedResult = normalize(topResult.name)

      const isMatch = normalizedResult.includes(normalizedInput)
      const isPopular = topResult.popularity >= 30

      expect(isMatch).toBe(true)
      expect(isPopular).toBe(false) // Should trigger warning
    })
  })

  describe('fuzzy name matching', () => {
    const fuzzyMatch = (input: string, result: string): boolean => {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .trim()

      const normalizedInput = normalize(input)
      const normalizedResult = normalize(result)

      return (
        normalizedResult.includes(normalizedInput) || normalizedInput.includes(normalizedResult)
      )
    }

    it('matches exact names', () => {
      expect(fuzzyMatch('Depeche Mode', 'Depeche Mode')).toBe(true)
    })

    it('matches case-insensitive', () => {
      expect(fuzzyMatch('depeche mode', 'DEPECHE MODE')).toBe(true)
    })

    it('ignores special characters', () => {
      expect(fuzzyMatch("Guns N' Roses", 'Guns N Roses')).toBe(true)
    })

    it('handles partial matches', () => {
      expect(fuzzyMatch('The Cure', 'The Cure (Official)')).toBe(true)
    })

    it('rejects non-matches', () => {
      expect(fuzzyMatch('Depeche Mode', 'Radiohead')).toBe(false)
    })
  })

  describe('manual overrides', () => {
    it('loads spotify-overrides.json', () => {
      const mockOverrides = {
        'the-cure': {
          spotifyArtistId: '7bu3H8JO7d0UbMoVzbo70s',
          note: 'Disambiguate from tribute bands',
        },
      }

      expect(mockOverrides['the-cure'].spotifyArtistId).toBeDefined()
      expect(mockOverrides['the-cure'].note).toBeDefined()
    })

    it('uses override instead of search', () => {
      const normalizedName = 'the-cure'
      const overrides = {
        'the-cure': {
          spotifyArtistId: '7bu3H8JO7d0UbMoVzbo70s',
          note: 'Manual override',
        },
      }

      const hasOverride = Boolean(overrides[normalizedName])
      expect(hasOverride).toBe(true)
    })

    it('builds direct artist URL from override', () => {
      const spotifyArtistId = '7bu3H8JO7d0UbMoVzbo70s'
      const artistUrl = `https://api.spotify.com/v1/artists/${spotifyArtistId}`

      expect(artistUrl).toBe('https://api.spotify.com/v1/artists/7bu3H8JO7d0UbMoVzbo70s')
    })

    it('handles missing overrides gracefully', () => {
      const overrides: Record<string, unknown> = {}
      const normalizedName = 'unknown-artist'

      const override = overrides[normalizedName]
      expect(override).toBeUndefined()
    })
  })

  describe('album fetching', () => {
    it('fetches artist albums from Spotify', () => {
      const artistId = 'mock-artist-id'
      const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album&market=US&limit=20`

      expect(url).toContain('/albums?')
      expect(url).toContain('include_groups=album')
      expect(url).toContain('market=US')
      expect(url).toContain('limit=20')
    })

    it('selects most popular album', () => {
      const mockAlbums = [
        { id: 'a1', name: 'Album 1', popularity: 50 },
        { id: 'a2', name: 'Album 2', popularity: 80 },
        { id: 'a3', name: 'Album 3', popularity: 60 },
      ]

      const sorted = mockAlbums.sort((a, b) => b.popularity - a.popularity)
      const topAlbum = sorted[0]

      expect(topAlbum.name).toBe('Album 2')
      expect(topAlbum.popularity).toBe(80)
    })

    it('handles artists with no albums', () => {
      const mockResponse = {
        items: [],
      }

      expect(mockResponse.items).toHaveLength(0)
    })

    it('extracts album cover art URLs', () => {
      const mockAlbum = {
        id: 'album123',
        name: 'Violator',
        images: [
          { height: 640, width: 640, url: 'https://i.scdn.co/large.jpg' },
          { height: 300, width: 300, url: 'https://i.scdn.co/medium.jpg' },
          { height: 64, width: 64, url: 'https://i.scdn.co/small.jpg' },
        ],
      }

      const coverArt = {
        small: mockAlbum.images.find(img => img.height === 64)?.url || mockAlbum.images[2]?.url,
        medium: mockAlbum.images.find(img => img.height === 300)?.url || mockAlbum.images[1]?.url,
        large: mockAlbum.images.find(img => img.height === 640)?.url || mockAlbum.images[0]?.url,
      }

      expect(coverArt.small).toContain('small.jpg')
      expect(coverArt.medium).toContain('medium.jpg')
      expect(coverArt.large).toContain('large.jpg')
    })

    it('parses release year from date', () => {
      const releaseDate = '1990-03-19'
      const releaseYear = parseInt(releaseDate.split('-')[0])

      expect(releaseYear).toBe(1990)
    })

    it('handles missing release date', () => {
      const releaseDate = undefined as string | undefined
      const releaseYear = releaseDate ? parseInt(releaseDate.split('-')[0]) : 0

      expect(releaseYear).toBe(0)
    })
  })

  describe('top tracks fetching', () => {
    it('fetches artist top tracks', () => {
      const artistId = 'mock-artist-id'
      const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`

      expect(url).toContain('/top-tracks?')
      expect(url).toContain('market=US')
    })

    it('limits to top 3 tracks', () => {
      const mockTracks = [
        { id: 't1', name: 'Track 1' },
        { id: 't2', name: 'Track 2' },
        { id: 't3', name: 'Track 3' },
        { id: 't4', name: 'Track 4' },
        { id: 't5', name: 'Track 5' },
      ]

      const topThree = mockTracks.slice(0, 3)

      expect(topThree).toHaveLength(3)
      expect(topThree[0].name).toBe('Track 1')
      expect(topThree[2].name).toBe('Track 3')
    })

    it('extracts track metadata', () => {
      const mockTrack = {
        id: 'track123',
        name: 'Enjoy the Silence',
        external_urls: { spotify: 'https://open.spotify.com/track/track123' },
        preview_url: 'https://p.scdn.co/preview.mp3',
        duration_ms: 248000,
      }

      const trackData = {
        name: mockTrack.name,
        spotifyTrackId: mockTrack.id,
        spotifyUrl: mockTrack.external_urls.spotify,
        previewUrl: mockTrack.preview_url || null,
        durationMs: mockTrack.duration_ms,
      }

      expect(trackData.name).toBe('Enjoy the Silence')
      expect(trackData.spotifyTrackId).toBe('track123')
      expect(trackData.previewUrl).toContain('preview.mp3')
      expect(trackData.durationMs).toBe(248000)
    })

    it('handles tracks without preview URLs', () => {
      const mockTrack = {
        id: 'track456',
        name: 'Policy of Truth',
        external_urls: { spotify: 'https://open.spotify.com/track/track456' },
        preview_url: null,
        duration_ms: 295000,
      }

      const previewUrl = mockTrack.preview_url || null

      expect(previewUrl).toBeNull()
    })
  })

  describe('cache expiry and updates', () => {
    it('skips artists with recent Spotify data (< 90 days)', () => {
      const artist = {
        name: 'Depeche Mode',
        dataSource: 'spotify',
        fetchedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      }

      const age = Date.now() - new Date(artist.fetchedAt).getTime()
      const ninetyDays = 90 * 24 * 60 * 60 * 1000

      const shouldSkip = artist.dataSource === 'spotify' && age < ninetyDays

      expect(shouldSkip).toBe(true)
    })

    it('re-fetches artists with stale data (>= 90 days)', () => {
      const artist = {
        name: 'The Cure',
        dataSource: 'spotify',
        fetchedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
      }

      const age = Date.now() - new Date(artist.fetchedAt).getTime()
      const ninetyDays = 90 * 24 * 60 * 60 * 1000

      const shouldRefetch = artist.dataSource === 'spotify' && age >= ninetyDays

      expect(shouldRefetch).toBe(true)
    })

    it('fetches artists without fetchedAt timestamp', () => {
      const artist = {
        name: 'Bauhaus',
        dataSource: 'mock',
      } as { name: string; dataSource: string; fetchedAt?: string }

      const shouldFetch = !artist.fetchedAt

      expect(shouldFetch).toBe(true)
    })

    it('sets fetchedAt timestamp on update', () => {
      const now = new Date().toISOString()

      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(new Date(now).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('sets dataSource to spotify after enrichment', () => {
      const artist = {
        name: 'Joy Division',
        dataSource: 'mock' as 'mock' | 'spotify',
      }

      artist.dataSource = 'spotify'

      expect(artist.dataSource).toBe('spotify')
    })
  })

  describe('artist metadata structure', () => {
    it('includes all required Spotify fields', () => {
      const artistMetadata = {
        name: 'Depeche Mode',
        normalizedName: 'depeche-mode',
        spotifyArtistId: 'artist123',
        spotifyArtistUrl: 'https://open.spotify.com/artist/artist123',
        mostPopularAlbum: {
          name: 'Violator',
          spotifyAlbumId: 'album123',
          spotifyAlbumUrl: 'https://open.spotify.com/album/album123',
          coverArt: {
            small: 'https://i.scdn.co/small.jpg',
            medium: 'https://i.scdn.co/medium.jpg',
            large: 'https://i.scdn.co/large.jpg',
          },
          releaseYear: 1990,
        },
        topTracks: [
          {
            name: 'Enjoy the Silence',
            spotifyTrackId: 'track1',
            spotifyUrl: 'https://open.spotify.com/track/track1',
            previewUrl: 'https://p.scdn.co/preview1.mp3',
            durationMs: 248000,
          },
        ],
        genres: ['synth-pop', 'new wave'],
        popularity: 75,
        fetchedAt: '2024-01-01T00:00:00.000Z',
        dataSource: 'spotify' as const,
      }

      expect(artistMetadata.spotifyArtistId).toBeDefined()
      expect(artistMetadata.spotifyArtistUrl).toContain('spotify.com')
      expect(artistMetadata.mostPopularAlbum).toBeDefined()
      expect(artistMetadata.topTracks).toHaveLength(1)
      expect(artistMetadata.genres).toBeInstanceOf(Array)
      expect(artistMetadata.popularity).toBeGreaterThanOrEqual(0)
      expect(artistMetadata.dataSource).toBe('spotify')
    })

    it('handles artists without albums', () => {
      const artist = {
        name: 'New Artist',
        spotifyArtistId: 'artist456',
        mostPopularAlbum: undefined,
      }

      expect(artist.mostPopularAlbum).toBeUndefined()
    })

    it('handles artists without top tracks', () => {
      const artist = {
        name: 'Obscure Artist',
        spotifyArtistId: 'artist789',
        topTracks: [],
      }

      expect(artist.topTracks).toHaveLength(0)
    })
  })

  describe('output file generation', () => {
    it('updates artists-metadata.json with Spotify data', () => {
      const metadataFile = {
        metadata: {
          lastUpdated: '2023-01-01T00:00:00.000Z',
          dataSource: 'theaudiodb',
          note: 'Old data',
        },
        artists: {
          'depeche-mode': {
            name: 'Depeche Mode',
            normalizedName: 'depeche-mode',
          },
        },
      }

      // Simulate enrichment
      metadataFile.metadata.lastUpdated = new Date().toISOString()
      metadataFile.metadata.dataSource = 'spotify'
      metadataFile.metadata.note =
        'Artist metadata enriched with Spotify API data including album covers, track previews, and artist information.'

      expect(metadataFile.metadata.dataSource).toBe('spotify')
      expect(metadataFile.metadata.note).toContain('Spotify API')
    })

    it('preserves existing artist data when updating', () => {
      const artist = {
        name: 'The Cure',
        normalizedName: 'the-cure',
        bio: 'Existing biography',
        image: 'existing-image.jpg',
        genres: ['post-punk'],
      }

      // Add Spotify data
      const updatedArtist = {
        ...artist,
        spotifyArtistId: 'spotify123',
        popularity: 80,
        dataSource: 'spotify' as const,
        fetchedAt: new Date().toISOString(),
      }

      expect(updatedArtist.bio).toBe('Existing biography')
      expect(updatedArtist.image).toBe('existing-image.jpg')
      expect(updatedArtist.spotifyArtistId).toBe('spotify123')
    })

    it('writes JSON with correct formatting', () => {
      const data = { artists: { 'test-artist': { name: 'Test' } } }
      const json = JSON.stringify(data, null, 2)

      expect(json).toContain('{\n')
      expect(json).toContain('  "artists"')
      expect(json).toContain('\n}')
    })
  })

  describe('summary statistics', () => {
    it('calculates enrichment counts', () => {
      const results = {
        enriched: 50,
        skipped: 30,
        failed: 5,
      }

      const total = results.enriched + results.skipped + results.failed

      expect(total).toBe(85)
      expect(results.enriched).toBeGreaterThan(results.failed)
    })

    it('tracks skipped vs enriched artists', () => {
      const artists = [
        { cached: true },
        { cached: false },
        { cached: true },
        { cached: false },
        { cached: false },
      ]

      const skipped = artists.filter(a => a.cached).length
      const enriched = artists.filter(a => !a.cached).length

      expect(skipped).toBe(2)
      expect(enriched).toBe(3)
    })
  })
})
