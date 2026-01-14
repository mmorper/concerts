/**
 * Tests for normalization utilities
 *
 * These utilities are critical for data consistency across the entire application.
 * They're used in:
 * - Data pipeline scripts (fetch, enrich, validate)
 * - Frontend components (URL routing, data lookups)
 * - Cache key generation
 */

import { describe, it, expect } from 'vitest'
import { normalizeArtistName, normalizeVenueName, normalizeGenreName } from '@/utils/normalize'

describe('normalizeArtistName', () => {
  it('converts to lowercase', () => {
    expect(normalizeArtistName('Depeche Mode')).toBe('depeche-mode')
  })

  it('replaces spaces with hyphens', () => {
    expect(normalizeArtistName('Echo and the Bunnymen')).toBe('echo-and-the-bunnymen')
  })

  it('converts periods to hyphens', () => {
    expect(normalizeArtistName('R.E.M.')).toBe('r-e-m')
  })

  it('converts slashes to hyphens', () => {
    expect(normalizeArtistName('AC/DC')).toBe('ac-dc')
  })

  it('converts apostrophes to hyphens', () => {
    expect(normalizeArtistName("Guns N' Roses")).toBe('guns-n-roses')
  })

  it('converts ampersands to hyphens', () => {
    expect(normalizeArtistName('Simon & Garfunkel')).toBe('simon-garfunkel')
  })

  it('collapses multiple hyphens', () => {
    expect(normalizeArtistName('The--Band')).toBe('the-band')
  })

  it('removes leading hyphens', () => {
    expect(normalizeArtistName('-The Band')).toBe('the-band')
  })

  it('removes trailing hyphens', () => {
    expect(normalizeArtistName('The Band-')).toBe('the-band')
  })

  it('handles special characters consistently', () => {
    expect(normalizeArtistName('Björk')).toBe('bj-rk')
  })

  it('handles numbers', () => {
    expect(normalizeArtistName('Blink-182')).toBe('blink-182')
  })

  it('is idempotent (normalizing twice produces same result)', () => {
    const name = 'Depeche Mode'
    const normalized = normalizeArtistName(name)
    expect(normalizeArtistName(normalized)).toBe(normalized)
  })

  it('handles empty string', () => {
    expect(normalizeArtistName('')).toBe('')
  })

  it('handles single character', () => {
    expect(normalizeArtistName('X')).toBe('x')
  })
})

describe('normalizeVenueName', () => {
  it('converts to lowercase', () => {
    expect(normalizeVenueName('Hollywood Bowl')).toBe('hollywood-bowl')
  })

  it('replaces spaces with hyphens', () => {
    expect(normalizeVenueName('The Coach House')).toBe('the-coach-house')
  })

  it('handles numbers and colons', () => {
    expect(normalizeVenueName('9:30 Club')).toBe('9-30-club')
  })

  it('converts periods to hyphens', () => {
    expect(normalizeVenueName('U.S. Bank Arena')).toBe('u-s-bank-arena')
  })

  it('converts apostrophes to hyphens', () => {
    expect(normalizeVenueName("The Cat's Cradle")).toBe('the-cat-s-cradle')
  })

  it('collapses multiple hyphens', () => {
    expect(normalizeVenueName('The--Forum')).toBe('the-forum')
  })

  it('removes leading and trailing hyphens', () => {
    expect(normalizeVenueName('-The Roxy-')).toBe('the-roxy')
  })

  it('is idempotent', () => {
    const name = 'Irvine Meadows Amphitheatre'
    const normalized = normalizeVenueName(name)
    expect(normalizeVenueName(normalized)).toBe(normalized)
  })

  it('handles empty string', () => {
    expect(normalizeVenueName('')).toBe('')
  })
})

describe('normalizeGenreName', () => {
  it('converts to lowercase', () => {
    expect(normalizeGenreName('Alternative Rock')).toBe('alternative-rock')
  })

  it('replaces spaces with hyphens', () => {
    expect(normalizeGenreName('Synth Pop')).toBe('synth-pop')
  })

  it('handles slashes', () => {
    expect(normalizeGenreName('New Wave/Synth-pop')).toBe('new-wave-synth-pop')
  })

  it('handles hyphens in genre names', () => {
    expect(normalizeGenreName('Hip-Hop')).toBe('hip-hop')
  })

  it('collapses multiple hyphens', () => {
    expect(normalizeGenreName('Post--Punk')).toBe('post-punk')
  })

  it('removes leading and trailing hyphens', () => {
    expect(normalizeGenreName('-Rock-')).toBe('rock')
  })

  it('is idempotent', () => {
    const name = 'Electronic Dance Music'
    const normalized = normalizeGenreName(name)
    expect(normalizeGenreName(normalized)).toBe(normalized)
  })

  it('handles empty string', () => {
    expect(normalizeGenreName('')).toBe('')
  })
})

describe('Normalization consistency', () => {
  it('artist, venue, and genre normalization produce consistent format', () => {
    const input = 'The Rock & Roll Hall'

    const artistNorm = normalizeArtistName(input)
    const venueNorm = normalizeVenueName(input)
    const genreNorm = normalizeGenreName(input)

    // All should use same normalization rules
    expect(artistNorm).toBe(venueNorm)
    expect(venueNorm).toBe(genreNorm)
    expect(artistNorm).toBe('the-rock-roll-hall')
  })

  it('handles whitespace consistently', () => {
    expect(normalizeArtistName('  Depeche Mode  ')).toBe('depeche-mode')
    expect(normalizeVenueName('  Hollywood Bowl  ')).toBe('hollywood-bowl')
    expect(normalizeGenreName('  Synth Pop  ')).toBe('synth-pop')
  })

  it('handles edge cases consistently across all functions', () => {
    const edgeCases = [
      '',
      ' ',
      '-',
      '--',
      'A',
      '123',
      '!@#$%',
    ]

    edgeCases.forEach(input => {
      const artistResult = normalizeArtistName(input)
      const venueResult = normalizeVenueName(input)
      const genreResult = normalizeGenreName(input)

      // All should produce same result for same input
      expect(artistResult).toBe(venueResult)
      expect(venueResult).toBe(genreResult)
    })
  })
})

describe('Cache key compatibility', () => {
  it('produces valid cache keys for geocoding', () => {
    const venue = 'Hollywood Bowl'
    const city = 'Los Angeles'
    const state = 'California'

    const cacheKey = `${normalizeVenueName(venue)}|${city.toLowerCase()}|${state.toLowerCase()}`

    expect(cacheKey).toBe('hollywood-bowl|los angeles|california')
  })

  it('produces valid cache keys for artist metadata', () => {
    const artist = 'Depeche Mode'
    const key = normalizeArtistName(artist)

    expect(key).toBe('depeche-mode')
    expect(key).toMatch(/^[a-z0-9-]+$/) // Only lowercase alphanumeric and hyphens
  })

  it('produces URL-safe strings', () => {
    const artist = "Guns N' Roses"
    const normalized = normalizeArtistName(artist)

    // Should not contain characters that need URL encoding
    expect(normalized).not.toMatch(/[^a-z0-9-]/)
  })
})
