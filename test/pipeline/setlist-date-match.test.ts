/**
 * #440 — the setlist matcher accepted a different night.
 *
 * `calculateMatchScore` weighs venue, city and artist. It does not look at the date at all,
 * so every night of a residency scores identically and whichever sorted first won. On 293
 * cached setlists that produced 52 date mismatches, 23 of them more than a day out and one
 * of them 259 days.
 *
 * Setlists feed prose: the notes name songs and count sets. A setlist from another night is
 * a post describing a concert that did not happen, arriving through the data rather than
 * the writing.
 */

import { describe, it, expect } from 'vitest'
import { findBestSetlistMatch, setlistDateGap } from '../../scripts/prefetch-setlists.ts'

/** The real case: Social Distortion played The Belasco on 6, 7 and 8 December 2024. */
const belascoRun = [
  { eventDate: '08-12-2024', songs: 18 },
  { eventDate: '07-12-2024', songs: 19 },
  { eventDate: '06-12-2024', songs: 18 },
].map(({ eventDate, songs }) => ({
  id: `sl-${eventDate}`,
  eventDate,
  artist: { name: 'Social Distortion', mbid: 'x' },
  venue: { name: 'The Belasco', city: { name: 'Los Angeles' } },
  sets: { set: [{ song: Array.from({ length: songs }, (_, i) => ({ name: `song-${i}` })) }] },
})) as never[]

const params = {
  artistName: 'Social Distortion',
  venueName: 'The Belasco',
  city: 'Los Angeles',
  concertDate: '2024-12-06',
}

describe('setlistDateGap', () => {
  it('reads setlist.fm DD-MM-YYYY against the archive YYYY-MM-DD', () => {
    expect(setlistDateGap('06-12-2024', '2024-12-06')).toBe(0)
    expect(setlistDateGap('08-12-2024', '2024-12-06')).toBe(2)
    // Order does not matter — a setlist dated before the concert is just as wrong.
    expect(setlistDateGap('04-12-2024', '2024-12-06')).toBe(2)
  })

  it('returns null rather than a number it cannot justify', () => {
    expect(setlistDateGap('not-a-date', '2024-12-06')).toBeNull()
    expect(setlistDateGap('06-12-2024', 'sometime')).toBeNull()
  })
})

describe('findBestSetlistMatch', () => {
  it('picks the RIGHT night of a residency, not the first one sorted', () => {
    // Every candidate has the same venue, city and artist, so the old scoring could not
    // separate them. This is the exact match that went wrong.
    const match = findBestSetlistMatch(belascoRun, params)
    expect(match?.eventDate).toBe('06-12-2024')
  })

  it('refuses a different night outright, even at a perfect venue match', () => {
    // Two nights away, same venue, same city, same artist — a perfect score under the old
    // rule, and the exact setlist this concert was carrying. A different night is not a
    // worse match; it is a different show, and no venue similarity makes it the right one.
    const twoNightsOut = belascoRun.filter(
      (s: never) => (s as { eventDate: string }).eventDate === '08-12-2024'
    )
    expect(findBestSetlistMatch(twoNightsOut, params)).toBeNull()
  })

  it('allows one day, because that gap is genuinely ambiguous', () => {
    // A show crossing midnight, a timezone, or our own date being off by one — which it
    // was for this very concert until the photographs settled it.
    const nextDay = belascoRun.filter((s: never) => (s as { eventDate: string }).eventDate === '07-12-2024')
    expect(findBestSetlistMatch(nextDay, params)?.eventDate).toBe('07-12-2024')
  })

  it('prefers the exact night over the adjacent one', () => {
    const both = belascoRun.filter((s: never) =>
      ['06-12-2024', '07-12-2024'].includes((s as { eventDate: string }).eventDate)
    )
    expect(findBestSetlistMatch(both, params)?.eventDate).toBe('06-12-2024')
  })

  it('still rejects a same-night setlist from the wrong venue', () => {
    // The date gate replaces nothing — the venue threshold still has to be cleared.
    const elsewhere = [{
      ...(belascoRun[2] as object),
      venue: { name: 'Madison Square Garden', city: { name: 'New York' } },
    }] as never[]
    expect(findBestSetlistMatch(elsewhere, params)).toBeNull()
  })

  it('returns null on no results rather than throwing', () => {
    expect(findBestSetlistMatch([], params)).toBeNull()
  })
})

describe('the shipped cache', () => {
  it('holds no setlist more than a day from its concert', async () => {
    // The corpus invariant. 23 entries violated it when #440 was filed; they are re-fetched
    // by a run with the gate in place, and this stops them coming back.
    const { readFileSync } = await import('fs')
    const cache = JSON.parse(readFileSync('public/data/setlists-cache.json', 'utf8'))

    const bad: string[] = []
    for (const entry of cache.entries) {
      if (!entry.setlist?.eventDate || !entry.date) continue
      const gap = setlistDateGap(entry.setlist.eventDate, entry.date)
      if (gap === null || gap > 1) {
        bad.push(`${entry.artistName} ${entry.date}: setlist is ${entry.setlist.eventDate} (${gap ?? '?'} days)`)
      }
    }
    expect(bad).toEqual([])
  })
})
