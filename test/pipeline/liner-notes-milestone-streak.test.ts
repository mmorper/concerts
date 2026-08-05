/**
 * milestone-marker scoring + concert-streak windowing (#233)
 *
 * Two defects that both let a detector ship output nobody had checked:
 *
 *  - `milestone-marker` fell through to `default: 0` in computeSpan, capping
 *    every finding at 19 — one point under MIN_SCORE — so it had never
 *    published in 56 posts.
 *  - `concert-streak` measured each gap against the *previous* show rather than
 *    the window start, so a run chained transitively and produced
 *    "14 Concerts in 215 Days".
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { analyze } from '../../scripts/liner-notes/analyze'
import { score, MIN_SCORE } from '../../scripts/liner-notes/score'
import type { Concert } from '../../src/types/concert'

const DATA = join(__dirname, '..', '..', 'public', 'data')
const readData = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'))

const concerts: Concert[] = readData('concerts.json').concerts
const artistsMetadata = readData('artists-metadata.json')
const artistsTopTracks = readData('artists-top-tracks.json')
const venuesMetadata = readData('venues-metadata.json')

const TODAY = new Date('2026-08-04T00:00:00Z')

function scoreAll(cs: Concert[] = concerts) {
  const { findings } = analyze(cs, TODAY, { venuesMetadata, artistsMetadata })
  const concertCountByArtist: Record<string, number> = {}
  for (const c of cs) {
    concertCountByArtist[c.headlinerNormalized] =
      (concertCountByArtist[c.headlinerNormalized] ?? 0) + 1
  }
  const scored = score(
    findings,
    { artistsMetadata, artistsTopTracks, concertCountByArtist },
    TODAY
  )
  return { findings, scored }
}

/** Minimal but complete-enough Concert for driving analyze() directly. */
function concert(date: string, headliner: string, venue: string): Concert {
  const [y, m, d] = date.split('-').map(Number)
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    id: `c-${date}`,
    date,
    year: y,
    month: m,
    day: d,
    dayOfWeek: 'Monday',
    decade: `${Math.floor(y / 10) * 10}s`,
    headliner,
    headlinerNormalized: slug(headliner),
    openers: [],
    genre: 'Rock',
    genreNormalized: 'rock',
    venue,
    venueNormalized: slug(venue),
    city: 'Los Angeles',
    state: 'California',
    cityState: 'Los Angeles, California',
    reference: '',
    location: '',
  } as unknown as Concert
}

describe('milestone-marker scoring (#233)', () => {
  const { findings, scored } = scoreAll()
  const milestones = findings.filter((f) => f.detector === 'milestone-marker')

  it('produces findings at all', () => {
    expect(milestones.length).toBeGreaterThan(0)
  })

  it('carries spanYears measured back to the first concert', () => {
    const first = [...concerts].sort((a, b) => a.date.localeCompare(b.date))[0]
    for (const f of milestones) {
      const dp = f.dataPoints as Record<string, unknown>
      expect(dp.spanYears, `${f.headline} has no spanYears`).toBeTypeOf('number')
      expect(dp.spanYears).toBe((dp.year as number) - first.year)
    }
  })

  it('clears MIN_SCORE for milestones more than a decade in', () => {
    // The regression: every milestone used to cap at 19 against a floor of 20.
    const deep = milestones.filter(
      (f) => ((f.dataPoints as Record<string, unknown>).spanYears as number) > 10
    )
    expect(deep.length).toBeGreaterThan(0)

    for (const f of deep) {
      const s = scored.find((x) => x.id === f.id)
      expect(s, `${f.headline} was dropped below MIN_SCORE (${MIN_SCORE})`).toBeDefined()
    }
  })

  it('leaves early milestones below the floor — four years in is not a story', () => {
    const shallow = milestones.filter(
      (f) => ((f.dataPoints as Record<string, unknown>).spanYears as number) <= 10
    )
    for (const f of shallow) {
      expect(scored.find((x) => x.id === f.id)).toBeUndefined()
    }
  })

  it('sets concertDate so the post gets a setlist deep link', () => {
    for (const f of milestones) {
      expect(f.concertDate).toBe((f.dataPoints as Record<string, unknown>).date)
    }
  })
})

describe('concert-streak windowing (#233)', () => {
  it('never reports a streak longer than the 30-day window', () => {
    const { findings } = scoreAll()
    for (const f of findings.filter((x) => x.detector === 'concert-streak')) {
      const days = (f.dataPoints as Record<string, unknown>).totalDays as number
      expect(days, `"${f.headline}" exceeds the window`).toBeLessThanOrEqual(30)
    }
  })

  it('does not chain transitively across a long run', () => {
    // Three tight shows, then a chain spaced 25 days apart. Measuring each gap
    // against the previous show swallows the whole run into one 90-day
    // "streak"; anchoring to the window start stops at the tight cluster.
    const cs = [
      concert('2000-01-01', 'Alpha', 'Venue A'),
      concert('2000-01-06', 'Beta', 'Venue B'),
      concert('2000-01-11', 'Gamma', 'Venue C'),
      concert('2000-02-10', 'Delta', 'Venue D'),
      concert('2000-03-06', 'Epsilon', 'Venue E'),
      concert('2000-03-31', 'Zeta', 'Venue F'),
    ]
    const { findings } = analyze(cs, TODAY, { venuesMetadata: {}, artistsMetadata: {} })
    const streaks = findings.filter((f) => f.detector === 'concert-streak')

    expect(streaks).toHaveLength(1)
    const dp = streaks[0].dataPoints as Record<string, unknown>
    expect(dp.showCount).toBe(3)
    expect(dp.totalDays).toBe(10)
  })

  it('ranks denser streaks first instead of falling back on array order', () => {
    const { findings } = scoreAll()
    const streaks = findings.filter((f) => f.detector === 'concert-streak')
    const days = streaks.map((f) => (f.dataPoints as Record<string, unknown>).totalDays as number)
    const counts = streaks.map((f) => (f.dataPoints as Record<string, unknown>).showCount as number)

    // Every qualifying streak currently has 3 shows, so without a density
    // tie-break the three chronologically earliest won regardless of quality.
    for (let i = 1; i < streaks.length; i++) {
      if (counts[i] === counts[i - 1]) {
        expect(days[i]).toBeGreaterThanOrEqual(days[i - 1])
      }
    }
  })
})
