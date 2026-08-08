/**
 * Tests for scripts/utils/itunes-client.ts
 *
 * Covers:
 * - Successful track fetching with normalization
 * - Empty results when no tracks found
 * - Error handling (404, 429, 500, network errors)
 * - URL encoding of special characters
 * - Limit parameter
 * - Missing preview URLs (should convert to null)
 * - Response data normalization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { iTunesClient, ITunesBlockedError } from '../../scripts/utils/itunes-client'

describe('iTunesClient', () => {
  let client: iTunesClient
  let originalFetch: typeof global.fetch
  let originalConsoleError: typeof console.error

  beforeEach(() => {
    client = new iTunesClient()
    originalFetch = global.fetch
    originalConsoleError = console.error

    // Mock console to keep test output clean
    console.error = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  describe('getTopTracks', () => {
    it('should return normalized tracks on successful search', async () => {
      const mockResponse = {
        resultCount: 2,
        results: [
          {
            trackName: 'Hold On',
            previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
            trackTimeMillis: 232000,
            collectionName: 'Love It to Death',
            artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/album.jpg',
            trackViewUrl: 'https://music.apple.com/us/album/hold-on/123456789?i=123456790',
          },
          {
            trackName: 'If You Were Here',
            previewUrl: 'https://audio-ssl.itunes.apple.com/preview2.m4a',
            trackTimeMillis: 245000,
            collectionName: 'Into the Gap',
            artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/album2.jpg',
            trackViewUrl: 'https://music.apple.com/us/album/if-you-were-here/123456789?i=123456791',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response)

      const result = await client.getTopTracks('Thompson Twins', 5)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'Hold On',
        previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
        durationMs: 232000,
        albumName: 'Love It to Death',
        albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music/album.jpg',
        streamingUrl: 'https://music.apple.com/us/album/hold-on/123456789?i=123456790',
      })
      expect(global.fetch).toHaveBeenCalledWith(
        'https://itunes.apple.com/search?term=Thompson%20Twins&entity=song&limit=5&country=US'
      )
    })

    it('should return empty array when no tracks found', async () => {
      const mockResponse = {
        resultCount: 0,
        results: [],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getTopTracks('NonexistentArtist12345', 5)

      expect(result).toEqual([])
    })

    it('should handle tracks with missing preview URLs', async () => {
      const mockResponse = {
        resultCount: 2,
        results: [
          {
            trackName: 'Track With Preview',
            previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
            trackTimeMillis: 200000,
            collectionName: 'Album 1',
            artworkUrl100: 'https://example.com/art1.jpg',
            trackViewUrl: 'https://music.apple.com/track1',
          },
          {
            trackName: 'Track Without Preview',
            previewUrl: null,
            trackTimeMillis: 180000,
            collectionName: 'Album 2',
            artworkUrl100: 'https://example.com/art2.jpg',
            trackViewUrl: 'https://music.apple.com/track2',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toHaveLength(2)
      expect(result[0].previewUrl).toBe('https://audio-ssl.itunes.apple.com/preview.m4a')
      expect(result[1].previewUrl).toBeNull()
    })

    it('should respect the limit parameter', async () => {
      const mockResponse = {
        resultCount: 3,
        results: [
          {
            trackName: 'Track 1',
            previewUrl: 'https://preview1.m4a',
            trackTimeMillis: 200000,
            collectionName: 'Album',
            artworkUrl100: 'https://art.jpg',
            trackViewUrl: 'https://track1',
          },
          {
            trackName: 'Track 2',
            previewUrl: 'https://preview2.m4a',
            trackTimeMillis: 210000,
            collectionName: 'Album',
            artworkUrl100: 'https://art.jpg',
            trackViewUrl: 'https://track2',
          },
          {
            trackName: 'Track 3',
            previewUrl: 'https://preview3.m4a',
            trackTimeMillis: 220000,
            collectionName: 'Album',
            artworkUrl100: 'https://art.jpg',
            trackViewUrl: 'https://track3',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await client.getTopTracks('Test Artist', 3)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://itunes.apple.com/search?term=Test%20Artist&entity=song&limit=3&country=US'
      )
    })

    it('should encode special characters in artist name', async () => {
      const mockResponse = { resultCount: 0, results: [] }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await client.getTopTracks('AC/DC & Friends', 5)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://itunes.apple.com/search?term=AC%2FDC%20%26%20Friends&entity=song&limit=5&country=US'
      )
    })

    it('should handle 404 errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch tracks from iTunes: Test Artist',
        expect.any(Error)
      )
    })

    it('should handle 429 rate limit errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch tracks from iTunes: Test Artist',
        expect.any(Error)
      )
    })

    it('should throw on 403 rather than returning an empty result', async () => {
      // A 403 is a block on the whole client, not a miss on one artist. Every
      // subsequent request fails identically, and it is sustained retrying
      // that earns the block in the first place — so the caller has to be able
      // to tell this apart from "this artist has no tracks" and stop.
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      } as Response)

      await expect(client.getTopTracks('Test Artist', 5)).rejects.toThrow(ITunesBlockedError)
    })

    it('should not retry a 403', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
      global.fetch = fetchMock

      await expect(client.getTopTracks('Test Artist', 5)).rejects.toThrow(ITunesBlockedError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should handle 500 server errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch tracks from iTunes: Test Artist',
        expect.any(Error)
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch tracks from iTunes: Test Artist',
        expect.any(Error)
      )
    })

    it('should handle malformed JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as unknown as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch tracks from iTunes: Test Artist',
        expect.any(Error)
      )
    })

    it('should handle response with missing results array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ resultCount: 0 }),
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toEqual([])
    })

    it('should use default limit of 5 when not specified', async () => {
      const mockResponse = { resultCount: 0, results: [] }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await client.getTopTracks('Test Artist')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://itunes.apple.com/search?term=Test%20Artist&entity=song&limit=5&country=US'
      )
    })

    it('should normalize all track properties correctly', async () => {
      const mockResponse = {
        resultCount: 1,
        results: [
          {
            trackName: 'Test Track Name',
            previewUrl: 'https://audio.itunes.com/preview.m4a',
            trackTimeMillis: 195500,
            collectionName: 'Test Album Name',
            artworkUrl100: 'https://artwork.itunes.com/image.jpg',
            trackViewUrl: 'https://music.apple.com/track/12345',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getTopTracks('Test Artist', 5)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'Test Track Name',
        previewUrl: 'https://audio.itunes.com/preview.m4a',
        durationMs: 195500,
        albumName: 'Test Album Name',
        albumArt: 'https://artwork.itunes.com/image.jpg',
        streamingUrl: 'https://music.apple.com/track/12345',
      })
    })
  })
})
