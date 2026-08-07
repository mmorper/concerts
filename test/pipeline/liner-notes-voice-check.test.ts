/**
 * Voice checks (#272).
 *
 * The voice skill's validation checklist existed as prose for four minor
 * versions and nothing ran it. These tests exist so it stays executable.
 */

import { describe, it, expect } from 'vitest'
import { checkVoice } from '../../scripts/liner-notes/voice-check.ts'
import type { ScoredFinding } from '../../scripts/liner-notes/types.ts'

const base = (prose: string, dataPoints: Record<string, unknown> = {}): ScoredFinding =>
  ({
    id: 'x', detector: 'album-trajectory', category: 'cultural', temporality: 'evergreen',
    headline: 'H', dataPoints, artists: ['a'], venues: ['v'], years: [1988], tags: [],
    score: 30, scoreBreakdown: {} as never, prose,
  }) as unknown as ScoredFinding

const rules = (f: ScoredFinding) => checkVoice(f).map((i) => i.rule)

describe('errors — never publish', () => {
  it('catches perishable claims', () => {
    expect(rules(base('I saw them in 1988. They never made another record after that night.')))
      .toContain('perishable-claim')
    expect(rules(base('I saw them once. Nothing since, which still surprises me.')))
      .toContain('perishable-claim')
  })

  it('catches critical verdicts the corpus cannot support', () => {
    expect(rules(base('I was there in 1988. Violator was their masterpiece, plainly.')))
      .toContain('critical-verdict')
    expect(rules(base('I saw them twice. It is their best album by a distance.')))
      .toContain('critical-verdict')
  })

  it('catches Tier 3 chart and sales claims', () => {
    expect(rules(base('I saw them in 1988. The record debuted at #4 that spring.'))).toContain('tier-3')
    expect(rules(base('I saw them in 1988. It sold 15 million copies worldwide.'))).toContain('tier-3')
  })

  it('catches banned phrases', () => {
    expect(rules(base('I saw them in 1988. It was a legendary night at the Bowl.')))
      .toContain('banned-phrase')
  })

  it('requires first person', () => {
    expect(rules(base('The band played the Rose Bowl in 1988. It was loud that night.')))
      .toContain('person')
  })
})

describe('warnings — flag, do not block', () => {
  it('flags a distinctive number with no data source', () => {
    const issues = checkVoice(
      base('I saw them in 1988. Their fingerprints stretch back to 1980, which I only later understood.', {
        year: 1988,
      })
    )
    expect(issues.find((i) => i.rule === 'unsourced-number')?.detail).toContain('1980')
    expect(issues.every((i) => i.severity !== 'error')).toBe(true)
  })

  it('allows a number that is a unit conversion of a stored value', () => {
    // monthsAway: 209 legitimately becomes "17 years" in prose.
    const issues = checkVoice(
      base('I saw them in 1988. The record was 17 years away, which I could not have guessed.', {
        monthsAway: 209,
      })
    )
    expect(issues.map((i) => i.rule)).not.toContain('unsourced-number')
  })

  it('ignores small ambient integers', () => {
    const issues = checkVoice(
      base('I saw them in 1988. Three of the five songs I reach for came later, somehow.', {})
    )
    expect(issues.map((i) => i.rule)).not.toContain('unsourced-number')
  })
})

describe('clean prose passes', () => {
  it('accepts a real generated post', () => {
    const prose =
      'I saw them at the Rose Bowl in June 1988, twenty months before Violator would arrive. ' +
      'Three of the five songs I still reach for from that record did not exist yet. ' +
      'Nine more albums were still to come, and I had no idea.'
    expect(
      checkVoice(base(prose, { monthsAway: 20, albumsAfter: 9, topTrackCount: 3, topTrackTotal: 5, year: 1988 }))
    ).toEqual([])
  })
})
