/**
 * City, region — `Silver Spring, MD`, `Glasgow, UK`.
 *
 * `venuesMetadata.state` is already "state OR country": across all 79 venues it holds eight
 * US states plus `District of Columbia`, and then `Mexico` and `UK` in the same field. So
 * this is one lookup with two outcomes rather than two code paths.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { cityRegion, regionLabel, KNOWN_COUNTRIES } from '../../scripts/syndication/region'

describe('regionLabel', () => {
  it('abbreviates a US state', () => {
    expect(regionLabel('Maryland').label).toBe('MD')
    expect(regionLabel('California').label).toBe('CA')
  })

  it('maps District of Columbia to DC', () => {
    // 15 of 79 venues — the second most common value in the archive, and the one every
    // naive first-two-letters rule renders as "DI".
    expect(regionLabel('District of Columbia').label).toBe('DC')
  })

  it('leaves a country spelled as it is stored', () => {
    // The owner asked for a two-letter code either way. US postal abbreviations are a
    // reading convention people parse without thinking; ISO country codes are not —
    // "Tijuana, MX" reads as a form field. UK needs no mapping because it is already the
    // common short form, and is also not the ISO code, which is GB.
    expect(regionLabel('UK').label).toBe('UK')
    expect(regionLabel('Mexico').label).toBe('Mexico')
  })

  it('flags an unrecognised value rather than guessing', () => {
    // #232 is the precedent: regionOf was keyed on postal codes while the data held full
    // names, and every concert resolved to "International" for six months because an
    // unmapped US state and a genuinely foreign one produce the same answer. Here an
    // unmapped state would render "Portland, Oregon" beside "Silver Spring, MD" — which
    // looks deliberate. Only the flag separates a country from a miss.
    expect(regionLabel('Freedonia').unmapped).toBe(true)
    expect(regionLabel('Mexico').unmapped).toBe(false)
    expect(regionLabel('Oregon').unmapped).toBe(false)
  })

  it('is empty and not flagged when there is no state at all', () => {
    expect(regionLabel(undefined)).toEqual({ label: '', unmapped: false })
  })
})

describe('cityRegion', () => {
  it('joins city and region', () => {
    expect(cityRegion('Silver Spring', 'Maryland')).toBe('Silver Spring, MD')
    expect(cityRegion('Washington', 'District of Columbia')).toBe('Washington, DC')
    expect(cityRegion('Glasgow', 'UK')).toBe('Glasgow, UK')
  })

  it('warns out loud on an unmapped value, then prints it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(cityRegion('Somewhere', 'Freedonia')).toBe('Somewhere, Freedonia')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('falls back to the bare city when nothing is stored', () => {
    expect(cityRegion('Irvine', undefined)).toBe('Irvine')
  })
})

describe('against the real venue corpus', () => {
  it('resolves every venue in the archive without a warning', () => {
    // Run against real data, not a fixture. A fixture written alongside a broken map would
    // encode the same mistake — that is the lesson #232's own test file records.
    const venues: Record<string, { state?: string; city?: string }> =
      JSON.parse(readFileSync('public/data/venues-metadata.json', 'utf8'))
    const unmapped = Object.values(venues)
      .map((v) => v.state)
      .filter((s) => regionLabel(s).unmapped)
    expect(unmapped).toEqual([])
  })

  it('covers the two non-US venues the archive actually holds', () => {
    expect(KNOWN_COUNTRIES.has('uk')).toBe(true)
    expect(KNOWN_COUNTRIES.has('mexico')).toBe(true)
  })
})
