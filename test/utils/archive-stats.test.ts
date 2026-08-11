/**
 * The one archive-stats derivation (#295).
 *
 * These numbers are quoted on three scene footers, the OG card, the meta tags,
 * llm.txt, the README and the MCP. The failure this guards against is not a
 * stale number — that is easy to spot — but two surfaces answering different
 * questions while each stays internally correct.
 *
 * The live example, and the reason the definitions are asserted here rather
 * than merely written down: `concerts.json` carries its own `metadata` block
 * saying **107** artists, while every visible surface says **257**. The block
 * counts distinct headliners; the surfaces count everyone who played. Reading
 * that block as the source of truth is the obvious-looking fix and would have
 * silently rewritten the site's most quoted figure.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { deriveArchiveStats, countSetlistSongs } from '../../src/utils/archiveStats'

const DATA = join(__dirname, '..', '..', 'public', 'data')

function concert(overrides: Partial<Parameters<typeof deriveArchiveStats>[0][number]> = {}) {
  return {
    year: 2000,
    headliner: 'Depeche Mode',
    openers: [],
    venue: 'Irvine Meadows',
    venueNormalized: 'irvine-meadows',
    cityState: 'Irvine, California',
    ...overrides,
  }
}

describe('deriveArchiveStats — the definitions', () => {
  it('counts openers as artists', () => {
    // ~60% of the roster. Someone you watched play is an artist you saw,
    // whether or not they were the reason you bought the ticket.
    const stats = deriveArchiveStats([
      concert({ headliner: 'Streetlight Manifesto', openers: ['Rebuilder', 'Kill Lincoln'] }),
    ])

    expect(stats.artists).toBe(3)
  })

  it('counts one artist once across many shows', () => {
    const stats = deriveArchiveStats([concert(), concert({ year: 2005 }), concert({ year: 2010 })])

    expect(stats.concerts).toBe(3)
    expect(stats.artists).toBe(1)
  })

  it('collapses a renamed venue through the normalized key', () => {
    // The room did not become two rooms because the sponsor changed.
    const stats = deriveArchiveStats([
      concert({ venue: 'Irvine Meadows', venueNormalized: 'irvine-meadows' }),
      concert({ venue: 'Verizon Wireless Amphitheater', venueNormalized: 'irvine-meadows' }),
    ])

    expect(stats.venues).toBe(1)
  })

  it('falls back to the display name when a record has no normalized key', () => {
    // A pre-normalization record must still count as a venue, not vanish.
    const stats = deriveArchiveStats([concert({ venueNormalized: undefined, venue: 'The Roxy' })])

    expect(stats.venues).toBe(1)
  })

  it('reports the year span, not a count of years', () => {
    const stats = deriveArchiveStats([concert({ year: 1984 }), concert({ year: 2026 })])

    expect(stats.yearSpan).toBe('1984–2026') // en dash
    expect(stats.firstYear).toBe(1984)
    expect(stats.lastYear).toBe(2026)
  })

  it('survives an empty archive without inventing a span', () => {
    // Math.min() of nothing is Infinity, which is how "Infinity–-Infinity"
    // would have reached a footer.
    const stats = deriveArchiveStats([])

    expect(stats).toMatchObject({ concerts: 0, artists: 0, venues: 0, cities: 0, yearSpan: '' })
    expect(stats.firstYear).toBeNull()
  })

  it('ignores an empty opener slot rather than counting it as an artist', () => {
    const stats = deriveArchiveStats([concert({ openers: ['', 'Real Opener'] })])

    expect(stats.artists).toBe(2) // headliner + the real opener
  })
})

describe('deriveArchiveStats — against the real archive', () => {
  const data = JSON.parse(readFileSync(join(DATA, 'concerts.json'), 'utf8'))
  const stats = deriveArchiveStats(data.concerts)

  it('agrees with every published surface', () => {
    expect(stats.concerts).toBe(184)
    expect(stats.artists).toBe(257)
    expect(stats.venues).toBe(79)
  })

  it('does NOT agree with concerts.json metadata, and that is the point', () => {
    // metadata.uniqueArtists counts distinct headliners (107). Both numbers are
    // defensible; only one is what this archive means by "artists". If this
    // ever starts passing, someone has changed a definition — decide which one
    // is right before making them agree.
    expect(data.metadata.uniqueArtists).toBe(107)
    expect(stats.artists).not.toBe(data.metadata.uniqueArtists)

    // Venues and concerts DO agree, so the disagreement above is a real
    // definitional split rather than the metadata block simply being stale.
    expect(stats.venues).toBe(data.metadata.uniqueVenues)
    expect(stats.concerts).toBe(data.metadata.totalConcerts)
  })

  it('counts BILLINGS, while the Artists scene counts ACTS — both live (#295)', () => {
    // The Artists scene alias-collapses (#227), so Brian Setzer is one card
    // rather than four billings: 254 there against 257 everywhere else. Pinned
    // so the gap stays a recorded decision rather than a surprise, and so that
    // closing it is a deliberate edit to this test.
    const billings = new Set<string>()
    for (const c of data.concerts) {
      if (c.headliner) billings.add(c.headliner)
      for (const o of c.openers ?? []) if (o) billings.add(o)
    }

    expect(stats.artists).toBe(billings.size)
    expect(stats.artists).toBe(257)

    const setzer = [...billings].filter((b) => /setzer/i.test(b))
    expect(setzer.length).toBe(4) // 257 - 3 = the 254 the mosaic shows
  })

  it('includes dated-but-unplayed shows', () => {
    // Deliberately unlike the liner-notes pipeline, which filters to past
    // concerts. A post cannot describe a night that has not happened; the
    // archive is a diary that also looks forward.
    const upcoming = data.concerts.filter((c: { date: string }) => c.date > '2026-08-10')

    expect(upcoming.length).toBeGreaterThan(0)
    expect(stats.concerts).toBe(data.concerts.length)
  })
})

describe('countSetlistSongs', () => {
  it('excludes walk-on tape', () => {
    const songs = countSetlistSongs({
      entries: {
        a: { setlist: { sets: { set: [{ song: [{ name: 'Enjoy the Silence' }, { name: 'Intro', tape: true }] }] } } },
      },
    })

    expect(songs).toBe(1)
  })

  it('counts every performance, not distinct titles', () => {
    // The OG card's "songs" is songs watched being played, so the same song on
    // two nights is two.
    const set = { song: [{ name: 'Just Like Heaven' }] }
    const songs = countSetlistSongs({
      entries: { a: { setlist: { sets: { set: [set] } } }, b: { setlist: { sets: { set: [set] } } } },
    })

    expect(songs).toBe(2)
  })

  it('returns 0 rather than throwing when the cache is missing', () => {
    // The OG generator drops the tile instead of rendering a zero.
    expect(countSetlistSongs(null)).toBe(0)
    expect(countSetlistSongs({})).toBe(0)
  })
})
