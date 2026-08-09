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

// ---------- v6.0 §5e — the fabrications attribution makes available ----------

const rt = (prose: string, dataPoints: Record<string, unknown> = { albumTitle: 'Violator' }): ScoredFinding =>
  ({
    id: 'x', detector: 'road-tested', category: 'cultural', temporality: 'evergreen',
    headline: 'H', dataPoints, artists: ['a'], venues: ['v'], years: [1988], tags: [],
    score: 30, scoreBreakdown: {} as never, prose,
  }) as unknown as ScoredFinding

describe('v6.0 §5e — claim the album, never the song', () => {
  it('rejects "before the song existed"', () => {
    expect(rules(rt('I heard it live before the song existed. That still gets me.')))
      .toContain('song-existence')
  })

  it('rejects claiming the song was unwritten or unreleased', () => {
    expect(rules(rt('They played four unreleased songs that night. I had no idea.')))
      .toContain('song-existence')
    expect(rules(rt("The song hadn't been written yet when I heard it. Strange to think.")))
      .toContain('song-existence')
  })

  it('allows the claim the data DOES support', () => {
    // Garbage's "No Horses" was a 2017 single that reached an album in 2021 —
    // the song existed; only the album was ahead.
    expect(rules(rt("I'd heard four of these a year before the record came out. My copy came later.")))
      .not.toContain('song-existence')
  })
})

describe('v6.0 §5e — retrospective, never foresight', () => {
  it('rejects foresight in the moment', () => {
    expect(rules(rt('I knew that one would be huge. It took a year to arrive.')))
      .toContain('foresight')
    expect(rules(rt('Little did I know I was hearing the record early. My ticket says 1988.')))
      .toContain('foresight')
  })

  it('allows retrospective framing', () => {
    expect(rules(rt("I'd heard it a year before the record came out. I only worked that out later.")))
      .not.toContain('foresight')
  })

  it('does not police foresight on detectors that are not road-tested', () => {
    // "I knew they would be back" is ordinary retrospective writing elsewhere.
    expect(rules(base('I knew they would be back. They were, eight years later.')))
      .not.toContain('foresight')
  })
})

describe('v6.0 §5e — no album without attribution', () => {
  it('errors when album prose carries no albumTitle', () => {
    expect(rules(rt('I heard three of them that night. The record came later.', {})))
      .toContain('album-without-attribution')
  })

  it('passes when the album is in the data points', () => {
    expect(rules(rt('I heard three of them that night. The record came later.', { albumTitle: 'Violator' })))
      .not.toContain('album-without-attribution')
  })
})
