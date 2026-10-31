/**
 * Why four Mondays published nothing (2026-09-14 → 2026-10-26), pinned.
 *
 *   1. Failed findings were re-selected every week — held.ts remembers them.
 *   2. A claim-check failure after generation did not fall through to the
 *      reserve — every gate now runs inside generateUpTo's loop.
 *   3. The fact sheet could not see shows a post names but is not about, so the
 *      verifier called the 1988 Phoenix and 1999 Boston bookends "contradicted".
 *   4. spanYears/gapYears subtract calendar years ("30 years" for 29y 7m), and
 *      the writer repeated them — the prompt now carries the exact span.
 */

import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { select } from '../../scripts/liner-notes/curate'
import { activeHeldIds, loadHeld, recordHeld, HOLD_WEEKS } from '../../scripts/liner-notes/held'
import { exactSpan, exactSpanLines } from '../../scripts/liner-notes/generate'
import { buildFactSheet, factSheetSubjectsFor, referencedConcerts } from '../../scripts/liner-notes/fact-sheet'
import { generateUpTo } from '../../scripts/liner-notes/pipeline'
import type { ScoredFinding } from '../../scripts/liner-notes/types'
import type { Concert } from '../../src/types/concert'

const TODAY = new Date('2026-11-02T00:00:00Z')

function finding(detector: string, score: number, id = `${detector}-${score}`): ScoredFinding {
  return {
    id,
    detector,
    category: 'personal',
    temporality: 'evergreen',
    headline: `${detector} @ ${score}`,
    dataPoints: {},
    artists: [`artist-${id}`],
    venues: [`venue-${id}`],
    years: [2000],
    tags: [],
    score,
    scoreBreakdown: {},
  } as unknown as ScoredFinding
}

describe('held findings', () => {
  it('reads an absent or malformed file as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-'))
    try {
      expect(loadHeld(join(dir, 'missing.json')).held).toEqual([])
      writeFileSync(join(dir, 'bad.json'), '{not json')
      expect(loadHeld(join(dir, 'bad.json')).held).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('holds a failure for HOLD_WEEKS, then lets it back', () => {
    const file = recordHeld({ version: 1, held: [] }, [
      { id: 'geo-1989', headline: 'x', detector: 'geographic-chapter', reason: 'claim check' },
    ], TODAY)
    expect(activeHeldIds(file, TODAY).has('geo-1989')).toBe(true)
    const later = new Date(TODAY.getTime() + HOLD_WEEKS * 7 * 86_400_000)
    expect(activeHeldIds(file, later).has('geo-1989')).toBe(false)
  })

  it('restarts the window when the same finding fails again, and prunes expired entries', () => {
    const old = { id: 'stale', headline: '', detector: 'd', reason: '', heldAt: '2026-01-01' }
    const again = { id: 'again', headline: '', detector: 'd', reason: '', heldAt: '2026-10-26' }
    const next = recordHeld({ version: 1, held: [old, again] }, [
      { id: 'again', headline: '', detector: 'd', reason: 'second failure' },
    ], TODAY)
    expect(next.held.map((h) => h.id)).toEqual(['again'])
    expect(next.held[0]).toMatchObject({ heldAt: '2026-11-02', reason: 'second failure' })
  })

  it('select() skips a held finding and lets its detector nominate the next best', () => {
    const best = finding('geographic-chapter', 40, 'geo-best')
    const next = finding('geographic-chapter', 35, 'geo-next')
    const chosen = select([best, next], [], { today: TODAY, held: new Set(['geo-best']) })
    expect(chosen.map((f) => f.id)).toEqual(['geo-next'])
  })

  it('--force ignores the hold, so a repair run can retry one on purpose', () => {
    const best = finding('geographic-chapter', 40, 'geo-best')
    const chosen = select([best], [], { today: TODAY, force: true, held: new Set(['geo-best']) })
    expect(chosen.map((f) => f.id)).toEqual(['geo-best'])
  })
})

describe('every gate falls through to the reserve', () => {
  it('keeps walking the list when a candidate fails after prose was written', async () => {
    const candidates = [finding('a', 40), finding('b', 39), finding('c', 38)]
    const tried: string[] = []
    const { withProse, attempted } = await generateUpTo(candidates, 1, async (c) => {
      tried.push(c.id)
      // a: prose written, then rejected by a later gate → undefined
      return c.id === 'a-40' ? undefined : { ...c, prose: 'ok' }
    })
    expect(tried).toEqual(['a-40', 'b-39'])
    expect(attempted).toBe(2)
    expect(withProse.map((f) => f.id)).toEqual(['b-39'])
  })
})

describe('exact spans for the writer', () => {
  it('counts completed years and months, never rounding up', () => {
    expect(exactSpan('1993-09-18', '2023-05-09')).toBe('29 years, 7 months')
    expect(exactSpan('1989-07-05', '1999-04-02')).toBe('9 years, 8 months')
    expect(exactSpan('2000-01-01', '2010-01-01')).toBe('10 years')
    expect(exactSpan('1986-07-16', '1986-07-31')).toBe('15 days')
  })

  it('lists pairs of dated data points and the no-rounding rule', () => {
    const lines = exactSpanLines({
      openerShow: { date: '1993-09-18' },
      headlinerShow: { date: '2023-05-09' },
      gapYears: 30,
    })
    expect(lines.join('\n')).toContain('openerShow (1993-09-18) → headlinerShow (2023-05-09): 29 years, 7 months')
    expect(lines.join('\n')).toMatch(/never round up/)
  })

  it('says nothing when fewer than two dates are present', () => {
    expect(exactSpanLines({ only: { date: '2000-01-01' } })).toEqual([])
    expect(exactSpanLines(undefined)).toEqual([])
  })
})

describe('the fact sheet sees every show a post names', () => {
  const concert = (id: string, date: string, headliner: string, venue: string, city: string, state: string): Concert =>
    ({
      id,
      date,
      year: Number(date.slice(0, 4)),
      headliner,
      headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      venue,
      venueNormalized: venue.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      city,
      state,
      cityState: `${city}, ${state}`,
      openers: [],
    }) as unknown as Concert

  const concerts = [
    concert('c15', '1986-07-16', 'Beach Boys', 'Pacific Amphitheatre', 'Costa Mesa', 'California'),
    concert('c25', '1988-11-06', 'Beach Boys', 'Arizona Veterans Memorial Coliseum', 'Phoenix', 'Arizona'),
    concert('c27', '1989-07-05', 'Howard Jones', 'Universal Amphitheater', 'Los Angeles', 'California'),
  ]

  it('resolves dated objects in data points to concerts', () => {
    const found = referencedConcerts(
      { showBefore: { date: '1988-11-06', artist: 'Beach Boys' }, nested: [{ date: '1999-01-01' }] },
      concerts
    )
    expect(found.map((c) => c.id)).toEqual(['c25'])
  })

  it('lists the bookend show the 2026-10-26 verifier could not see', () => {
    const geo = {
      artists: ['howard-jones'],
      venues: ['universal-amphitheater'],
      dataPoints: { firstShow: { date: '1989-07-05', artist: 'Howard Jones' }, showBefore: { date: '1988-11-06', artist: 'Beach Boys' } },
    }
    const subjects = factSheetSubjectsFor(geo, concerts)
    expect(subjects.contextArtists).toContain('beach-boys')
    const sheet = buildFactSheet(subjects, { concerts, venuesMetadata: {}, artistsMetadata: {}, today: '2026-11-02' } as never)
    expect(sheet).toContain('1988-11-06')
    expect(sheet).toContain('Phoenix')
  })
})
