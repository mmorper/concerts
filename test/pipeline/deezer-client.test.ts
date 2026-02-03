/**
 * Tests for scripts/utils/deezer-client.ts
 *
 * Covers:
 * - Successful artist search
 * - Artist metadata fetching
 * - Image selection (picture_big preferred over picture_medium)
 * - Error handling (404, network errors, malformed responses)
 * - Rate limit retry logic (HTTP 429)
 * - Null returns when no data found
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DeezerClient } from '../../scripts/utils/deezer-client'

describe('DeezerClient', () => {
  let client: DeezerClient
  let originalFetch: typeof global.fetch
  let originalConsoleError: typeof console.error
  let originalConsoleWarn: typeof console.warn

  beforeEach(() => {
    client = new DeezerClient()
    originalFetch = global.fetch
    originalConsoleError = console.error
    originalConsoleWarn = console.warn

    // Mock console to keep test output clean
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  describe('searchArtist', () => {
    it('should return artists array on successful search', async () => {
      const mockResponse = {
        data: [
          {
            id: 4695969,
            name: 'Against Me!',
            picture: 'https://api.deezer.com/artist/4695969/image',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            nb_album: 25,
            nb_fan: 12345,
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.searchArtist('Against Me!')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Against Me!')
      expect(result[0].id).toBe(4695969)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.deezer.com/search/artist?q=Against%20Me!'
      )
    })

    it('should return empty array when no artists found', async () => {
      const mockResponse = {
        data: [],
        total: 0,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.searchArtist('NonexistentArtist')

      expect(result).toEqual([])
    })

    it('should handle 404 errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      const result = await client.searchArtist('Test Artist')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch artist from Deezer: Test Artist',
        expect.any(Error)
      )
    })

    it('should retry once on 429 rate limit', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            name: 'Test Artist',
            picture: 'https://example.com/image.jpg',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 1,
      }

      // First call returns 429, second call succeeds
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

      const result = await client.searchArtist('Test Artist')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Artist')
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(console.warn).toHaveBeenCalledWith(
        '  ⚠️  Rate limit hit, waiting 2 seconds...'
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await client.searchArtist('Test Artist')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch artist from Deezer: Test Artist',
        expect.any(Error)
      )
    })

    it('should encode special characters in artist name', async () => {
      const mockResponse = { data: [], total: 0 }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await client.searchArtist('AC/DC & Friends')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.deezer.com/search/artist?q=AC%2FDC%20%26%20Friends'
      )
    })
  })

  describe('getArtistInfo', () => {
    it('should return artist metadata with picture_big', async () => {
      const mockResponse = {
        data: [
          {
            id: 4695969,
            name: 'Molchat Doma',
            picture: 'https://api.deezer.com/artist/4695969/image',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Molchat Doma')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Molchat Doma')
      expect(result?.image).toBe('https://example.com/500x500.jpg')
      expect(result?.source).toBe('deezer')
      expect(result?.genres).toEqual([])
      expect(result?.fetchedAt).toBeDefined()
    })

    it('should fallback to picture_medium if picture_big missing', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            name: 'Test Artist',
            picture: 'https://api.deezer.com/artist/123/image',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: '',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).not.toBeNull()
      expect(result?.image).toBe('https://example.com/250x250.jpg')
    })

    it('should return null when no artists found', async () => {
      const mockResponse = {
        data: [],
        total: 0,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Nonexistent Artist')

      expect(result).toBeNull()
    })

    it('should return null when no image available', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            name: 'Test Artist',
            picture: '',
            picture_small: '',
            picture_medium: '',
            picture_big: '',
            picture_xl: '',
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).toBeNull()
    })

    it('should return null when Deezer returns placeholder image', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            name: 'Test Artist',
            picture: 'https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://cdn-images.dzcdn.net/images/artist//250x250-000000-80-0-0.jpg',
            picture_big: 'https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).toBeNull()
    })

    it('should return null on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).toBeNull()
    })

    it('should take first result when multiple artists returned', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            name: 'First Artist',
            picture: 'https://example.com/image.jpg',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500-first.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
          {
            id: 2,
            name: 'Second Artist',
            picture: 'https://example.com/image.jpg',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500-second.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 2,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('First Artist')
      expect(result?.image).toBe('https://example.com/500x500-first.jpg')
    })

    it('should return valid ISO timestamp', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            name: 'Test Artist',
            picture: 'https://api.deezer.com/artist/123/image',
            picture_small: 'https://example.com/56x56.jpg',
            picture_medium: 'https://example.com/250x250.jpg',
            picture_big: 'https://example.com/500x500.jpg',
            picture_xl: 'https://example.com/1000x1000.jpg',
            type: 'artist',
          },
        ],
        total: 1,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.getArtistInfo('Test Artist')

      expect(result).not.toBeNull()
      expect(result?.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(new Date(result!.fetchedAt).toISOString()).toBe(result?.fetchedAt)
    })
  })
})
