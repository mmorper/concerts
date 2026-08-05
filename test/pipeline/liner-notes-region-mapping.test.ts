/**
 * Liner notes region mapping (#232)
 *
 * `STATE_REGION` was keyed on postal codes ("CA") while concerts.json stores
 * full state names ("California"), so `regionOf` matched nothing and every
 * concert in the archive resolved to "International". `geographic-chapter`
 * collapsed the whole archive into one meaningless finding, scored it 39 by
 * maxing specificity and span, and published it.
 *
 * The bug was invisible for six months because an unmapped US state and a
 * genuinely foreign one produce the same answer. The load-bearing test here is
 * the second one: it runs against real concert data, because a fixture written
 * alongside the broken map would have encoded the same mistake.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { regionOf, KNOWN_NON_US } from '../../scripts/liner-notes/analyze'

describe('regionOf', () => {
  it('maps full state names, the form concert data actually uses', () => {
    expect(regionOf('California')).toBe('West Coast')
    expect(regionOf('New York')).toBe('Northeast')
    expect(regionOf('District of Columbia')).toBe('Northeast')
    expect(regionOf('Texas')).toBe('South')
    expect(regionOf('Illinois')).toBe('Midwest')
    expect(regionOf('Hawaii')).toBe('Pacific')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(regionOf('  california ')).toBe('West Coast')
    expect(regionOf('CALIFORNIA')).toBe('West Coast')
  })

  it('returns International for genuinely foreign states', () => {
    expect(regionOf('Mexico')).toBe('International')
    expect(regionOf('UK')).toBe('International')
  })

  it('does not silently accept postal codes', () => {
    // The original bug. "CA" must not quietly resolve — if the sheet ever
    // switches to abbreviations we want a loud failure, not International.
    expect(regionOf('CA')).toBe('International')
  })
})

describe('regionOf vs. the real archive', () => {
  const concertsPath = join(__dirname, '..', '..', 'public', 'data', 'concerts.json')
  const concerts: Array<{ state: string }> = JSON.parse(
    readFileSync(concertsPath, 'utf8')
  ).concerts

  it('resolves every state in concerts.json', () => {
    const unmapped = [
      ...new Set(
        concerts
          .map((c) => c.state)
          .filter((s) => s && regionOf(s) === 'International')
          .filter((s) => !KNOWN_NON_US.has(s.trim().toLowerCase()))
      ),
    ]

    expect(
      unmapped,
      `These states fall through to "International". If they are US states, add them to ` +
        `STATE_REGION; if they are foreign, add them to KNOWN_NON_US. Never leave them ` +
        `unmapped — that is what shipped a wrong post in #232.`
    ).toEqual([])
  })

  it('produces more than one region, so chapters mean something', () => {
    // The whole archive resolving to a single region is the #232 signature:
    // geographic-chapter builds runs of consecutive same-region shows, so one
    // region means one archive-wide "chapter".
    const regions = new Set(concerts.map((c) => regionOf(c.state)))
    expect(regions.size).toBeGreaterThan(1)
  })
})
