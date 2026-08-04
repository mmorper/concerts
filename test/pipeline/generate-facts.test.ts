/**
 * Tests for scripts/generate-facts.ts
 *
 * Covers:
 * - Fact generation from actual concert data
 * - Priority ordering
 * - Deep link URL generation
 * - Natural language headline formatting
 * - Category assignment
 * - All required fact types exist
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateFactsData } from '../../scripts/generate-facts'

describe('generate-facts.ts', () => {
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn

  beforeEach(() => {
    // Save originals
    originalLog = console.log
    originalWarn = console.warn

    // Mock console to keep test output clean
    console.log = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    // Restore originals
    console.log = originalLog
    console.warn = originalWarn
  })

  describe('generateFactsData', () => {
    it('should generate facts from concert data', async () => {
      const result = await generateFactsData()

      expect(result).toHaveProperty('computedAt')
      expect(result).toHaveProperty('facts')
      expect(Array.isArray(result.facts)).toBe(true)
      expect(result.facts.length).toBeGreaterThanOrEqual(15)
    })

    it('should include computedAt timestamp in ISO format', async () => {
      const result = await generateFactsData()

      expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should generate facts sorted by priority', async () => {
      const result = await generateFactsData()

      for (let i = 1; i < result.facts.length; i++) {
        expect(result.facts[i].priority).toBeGreaterThanOrEqual(result.facts[i - 1].priority)
      }
    })

    it('should include top-artist fact with correct structure', async () => {
      const result = await generateFactsData()

      const topArtistFact = result.facts.find((f) => f.id === 'top-artist')
      expect(topArtistFact).toBeDefined()
      expect(topArtistFact?.headline).toMatch(/\d+ concerts?/)
      expect(topArtistFact?.category).toBe('artist')
      expect(topArtistFact?.priority).toBe(1)
      expect(topArtistFact?.route).toMatch(/\?scene=artists&artist=/)
    })

    it('should include top-venue fact with correct structure', async () => {
      const result = await generateFactsData()

      const topVenueFact = result.facts.find((f) => f.id === 'top-venue')
      expect(topVenueFact).toBeDefined()
      expect(topVenueFact?.headline).toMatch(/\d+ shows?/)
      expect(topVenueFact?.category).toBe('venue')
      expect(topVenueFact?.route).toMatch(/\?scene=venues&venue=/)
    })

    it('should include total-concerts fact with correct structure', async () => {
      const result = await generateFactsData()

      const totalFact = result.facts.find((f) => f.id === 'total-concerts')
      expect(totalFact).toBeDefined()
      expect(totalFact?.headline).toMatch(/\d+ concerts? since \d{4}/)
      expect(totalFact?.category).toBe('timeline')
      expect(totalFact?.route).toBe('/?scene=timeline')
    })

    it('should include top-genre fact with correct structure', async () => {
      const result = await generateFactsData()

      const topGenreFact = result.facts.find((f) => f.id === 'top-genre')
      expect(topGenreFact).toBeDefined()
      expect(topGenreFact?.headline).toMatch(/\d+ shows?/)
      expect(topGenreFact?.category).toBe('genre')
      expect(topGenreFact?.route).toBe('/?scene=genres')
    })

    it('should include first-concert fact with correct structure', async () => {
      const result = await generateFactsData()

      const firstFact = result.facts.find((f) => f.id === 'first-concert')
      expect(firstFact).toBeDefined()
      expect(firstFact?.headline).toMatch(/First show:.*\(\d{4}\)/)
      expect(firstFact?.detail).toBeTruthy() // Contains venue info
      expect(firstFact?.category).toBe('timeline')
    })

    it('should include latest-concert fact with correct structure', async () => {
      const result = await generateFactsData()

      const latestFact = result.facts.find((f) => f.id === 'latest-concert')
      expect(latestFact).toBeDefined()
      expect(latestFact?.headline).toMatch(/Latest:.*\(\d{4}\)/)
      expect(latestFact?.category).toBe('timeline')
    })

    it('should include top-state fact with correct structure', async () => {
      const result = await generateFactsData()

      const topStateFact = result.facts.find((f) => f.id === 'top-state')
      expect(topStateFact).toBeDefined()
      expect(topStateFact?.headline).toMatch(/\d+ concerts?/)
      expect(topStateFact?.category).toBe('geography')
      expect(topStateFact?.route).toBe('/?scene=geography')
    })

    it('should include unique-cities fact with correct structure', async () => {
      const result = await generateFactsData()

      const citiesFact = result.facts.find((f) => f.id === 'unique-cities')
      expect(citiesFact).toBeDefined()
      expect(citiesFact?.headline).toMatch(/\d+ cities/)
      expect(citiesFact?.category).toBe('geography')
    })

    it('should include unique-venues fact with correct structure', async () => {
      const result = await generateFactsData()

      const venuesFact = result.facts.find((f) => f.id === 'unique-venues')
      expect(venuesFact).toBeDefined()
      expect(venuesFact?.headline).toMatch(/\d+ unique venues/)
      expect(venuesFact?.category).toBe('venue')
    })

    it('should include busiest-year fact with correct structure', async () => {
      const result = await generateFactsData()

      const busiestFact = result.facts.find((f) => f.id === 'busiest-year')
      expect(busiestFact).toBeDefined()
      expect(busiestFact?.headline).toMatch(/\d{4}: \d+ shows?/)
      expect(busiestFact?.category).toBe('timeline')
    })

    it('should include top-decade fact with correct structure', async () => {
      const result = await generateFactsData()

      const decadeFact = result.facts.find((f) => f.id === 'top-decade')
      expect(decadeFact).toBeDefined()
      expect(decadeFact?.headline).toMatch(/\d{4}s: \d+ shows?/)
      expect(decadeFact?.category).toBe('timeline')
    })

    it('should generate valid deep link routes', async () => {
      const result = await generateFactsData()

      for (const fact of result.facts) {
        // Routes should start with /? and contain scene=
        expect(fact.route).toMatch(/^\/\?scene=/)
        // Should not contain spaces
        expect(fact.route).not.toMatch(/\s/)
      }
    })

    it('should include CTA text for all facts', async () => {
      const result = await generateFactsData()

      for (const fact of result.facts) {
        expect(fact.cta).toBeTruthy()
        expect(fact.cta.length).toBeGreaterThan(5)
      }
    })

    it('should assign valid categories to all facts', async () => {
      const result = await generateFactsData()
      const validCategories = ['artist', 'venue', 'genre', 'timeline', 'geography']

      for (const fact of result.facts) {
        expect(validCategories).toContain(fact.category)
      }
    })

    it('should have unique IDs for all facts', async () => {
      const result = await generateFactsData()
      const ids = result.facts.map((f) => f.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should include all required fact types', async () => {
      const result = await generateFactsData()

      const requiredIds = [
        'top-artist',
        'top-venue',
        'total-concerts',
        'top-genre',
        'first-concert',
        'top-state',
        'latest-concert',
        'busiest-year',
        'unique-cities',
        'unique-venues',
        'top-decade',
      ]

      for (const id of requiredIds) {
        const fact = result.facts.find((f) => f.id === id)
        expect(fact, `Missing fact: ${id}`).toBeDefined()
      }
    })

    it('should generate facts with natural language headlines', async () => {
      const result = await generateFactsData()

      // Top facts should have readable headlines ending with numeric info
      const topArtist = result.facts.find((f) => f.id === 'top-artist')
      expect(topArtist?.headline).toMatch(/^[A-Z].*: \d+ concerts?$/)

      const topVenue = result.facts.find((f) => f.id === 'top-venue')
      expect(topVenue?.headline).toMatch(/^[A-Z].*: \d+ shows?$/)
    })
  })
})

// #197 — night-scoped facts (first/latest concert) link to that night's setlist
// when one exists, and keep routing to the artist when it doesn't. Exercised
// against the real archive: whether either currently qualifies depends on
// setlist coverage, so assert the invariant rather than a fixed route.
describe('night-scoped fact routes (#197)', () => {
  it('only ever emits a show param alongside an artist param', async () => {
    const result = await generateFactsData()
    for (const fact of result.facts) {
      if (fact.route.includes('show=')) {
        expect(fact.route).toMatch(/\?scene=artists&artist=[^&]+&show=\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('never keys a show param on a concert id', async () => {
    const result = await generateFactsData()
    for (const fact of result.facts) {
      expect(fact.route).not.toMatch(/show=concert-/)
    }
  })

  it('pairs the setlist CTA with a show route and never with an artist route', async () => {
    const result = await generateFactsData()
    for (const fact of result.facts) {
      if (fact.cta === 'See the setlist') {
        expect(fact.route).toContain('&show=')
      }
      if (fact.route.includes('&show=')) {
        expect(fact.cta).toBe('See the setlist')
      }
    }
  })
})
