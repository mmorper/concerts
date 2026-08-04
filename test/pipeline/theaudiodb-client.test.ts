/**
 * Tests for scripts/utils/theaudiodb-client.ts
 *
 * Covers the sentinel values TheAudioDB returns for fields it doesn't have —
 * "0" for an unknown formed year, "" for a missing website — which must not
 * reach our data as literal values. A "0" that survives is truthy, so every
 * downstream `if (meta.formed)` guard passes and the artist gets narrated as
 * "Formed 0" (11 artists did).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TheAudioDBClient } from '../../scripts/utils/theaudiodb-client'

function mockArtist(overrides: Record<string, unknown> = {}) {
  return {
    idArtist: '111239',
    strArtist: 'Book of Love',
    strArtistThumb: 'https://example.test/thumb.jpg',
    strGenre: 'Electronic',
    strStyle: 'Synthpop',
    intFormedYear: '1983',
    strBiographyEN: 'A synthpop band.',
    strWebsite: 'bookoflove.test',
    ...overrides,
  }
}

describe('TheAudioDBClient.getArtistInfo', () => {
  let client: TheAudioDBClient
  let originalFetch: typeof global.fetch
  let originalConsoleError: typeof console.error

  beforeEach(() => {
    client = new TheAudioDBClient('2')
    originalFetch = global.fetch
    originalConsoleError = console.error
    console.error = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  const respondWith = (artist: Record<string, unknown> | null) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artists: artist ? [artist] : null }),
    }) as unknown as typeof global.fetch
  }

  it('keeps a real formed year', async () => {
    respondWith(mockArtist({ intFormedYear: '1983' }))
    const info = await client.getArtistInfo('Book of Love')
    expect(info?.formed).toBe('1983')
  })

  it('drops "0", the sentinel for an unknown formed year', async () => {
    respondWith(mockArtist({ intFormedYear: '0' }))
    const info = await client.getArtistInfo('Book of Love')
    expect(info?.formed).toBeUndefined()
  })

  it('drops other non-year junk in the formed field', async () => {
    for (const junk of ['', '  ', '0000', '00', 'unknown', '12', '99999']) {
      respondWith(mockArtist({ intFormedYear: junk }))
      const info = await client.getArtistInfo('Book of Love')
      expect(info?.formed, `expected ${JSON.stringify(junk)} to be dropped`).toBeUndefined()
    }
  })

  it('drops an empty website rather than storing an empty string', async () => {
    respondWith(mockArtist({ strWebsite: '' }))
    const info = await client.getArtistInfo('Book of Love')
    expect(info?.website).toBeUndefined()
  })

  it('keeps a real website', async () => {
    respondWith(mockArtist({ strWebsite: 'bookoflove.test' }))
    const info = await client.getArtistInfo('Book of Love')
    expect(info?.website).toBe('bookoflove.test')
  })

  it('drops a whitespace-only bio', async () => {
    respondWith(mockArtist({ strBiographyEN: '   ' }))
    const info = await client.getArtistInfo('Book of Love')
    expect(info?.bio).toBeUndefined()
  })

  it('returns null when the artist is not found', async () => {
    respondWith(null)
    expect(await client.getArtistInfo('Nobody At All')).toBeNull()
  })
})
