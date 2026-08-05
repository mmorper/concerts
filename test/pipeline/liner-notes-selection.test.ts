/**
 * Detector rotation in select() (#226 → #231)
 *
 * The old algorithm ranked ~196 scored findings by score and took the top few,
 * diversifying only on category. Because `surpriseFactor` is a hardcoded
 * constant per detector and `specificity` counts how many entities a detector
 * chose to put in its arrays, that ranked the *detectors* — in near-identical
 * order every week. Three detectors had never published across 56 posts.
 *
 * These tests pin the properties that fix is supposed to have, using synthetic
 * findings so each one isolates a single rule.
 */

import { describe, it, expect } from 'vitest'
import { select, POSTS_PER_RUN, CANDIDATE_RESERVE } from '../../scripts/liner-notes/curate'
import { MIN_SCORE } from '../../scripts/liner-notes/score'
import type { ScoredFinding } from '../../scripts/liner-notes/types'
import type { LinerNotesPost } from '../../src/types/liner-notes'

const TODAY = new Date('2026-08-05T00:00:00Z')

function finding(
  detector: string,
  score: number,
  overrides: Partial<ScoredFinding> = {}
): ScoredFinding {
  return {
    id: `${detector}-${score}-${overrides.artists?.[0] ?? 'x'}`,
    detector,
    category: 'personal',
    temporality: 'evergreen',
    headline: `${detector} @ ${score}`,
    dataPoints: {},
    artists: [`artist-${detector}`],
    venues: [`venue-${detector}`],
    years: [2000],
    tags: [],
    score,
    scoreBreakdown: {},
    ...overrides,
  } as unknown as ScoredFinding
}

/** `daysAgo` back from TODAY, so rerun cooldowns age realistically. */
function post(detector: string, daysAgo: number, overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    id: `post-${detector}-${daysAgo}`,
    slug: `post-${detector}-${daysAgo}`,
    detector,
    category: 'personal',
    temporality: 'evergreen',
    headline: `${detector} post`,
    prose: '',
    image: { url: '', alt: '', source: 'placeholder' },
    artists: [`published-${detector}`],
    venues: [`published-venue-${detector}`],
    years: [2000],
    tags: [],
    deepLinks: [],
    relatedSlugs: [],
    score: 30,
    publishedAt: new Date(TODAY.getTime() - daysAgo * 86_400_000).toISOString(),
    ...overrides,
  } as unknown as LinerNotesPost
}

const opts = { today: TODAY }

describe('detector rotation', () => {
  it('gives the turn to the stalest detector, not the highest scorer', () => {
    // `tall` outscores `short` by 15 points but published yesterday.
    const findings = [finding('tall', 45), finding('short', 30)]
    const history = [post('tall', 1), post('short', 200)]

    const [winner] = select(findings, history, opts)
    expect(winner.detector).toBe('short')
  })

  it('puts a never-published detector ahead of every detector that has published', () => {
    const findings = [finding('veteran', 45), finding('newcomer', 25)]
    const history = [post('veteran', 90)]

    const [winner] = select(findings, history, opts)
    expect(winner.detector).toBe('newcomer')
  })

  it('nominates only one finding per detector', () => {
    const findings = [
      finding('a', 40, { id: 'a-1', artists: ['a1'] }),
      finding('a', 38, { id: 'a-2', artists: ['a2'] }),
      finding('a', 36, { id: 'a-3', artists: ['a3'] }),
      finding('b', 25, { id: 'b-1', artists: ['b1'] }),
    ]
    const chosen = select(findings, [], { ...opts, maxPosts: 5 })
    const detectors = chosen.map((f) => f.detector)
    expect(new Set(detectors).size).toBe(detectors.length)
  })

  it("nominates a detector's best finding, not its first", () => {
    const findings = [
      finding('a', 22, { id: 'a-weak', artists: ['a1'] }),
      finding('a', 41, { id: 'a-strong', artists: ['a2'] }),
    ]
    const [winner] = select(findings, [], opts)
    expect(winner.id).toBe('a-strong')
  })

  it('breaks staleness ties on score, so equal-staleness detectors rank by quality', () => {
    const findings = [finding('a', 30), finding('b', 40)]
    const [winner] = select(findings, [], opts) // both never published
    expect(winner.detector).toBe('b')
  })
})

describe('the comparator is total — no array-order dependence', () => {
  it('returns the same winner regardless of input order', () => {
    // The original defect: `sort((a, b) => b.score - a.score)` is stable, so two
    // detectors tied at 28 were separated by which detect*() call came first in
    // an array literal in analyze.ts.
    const build = () => [
      finding('alpha', 28, { id: 'alpha-1' }),
      finding('bravo', 28, { id: 'bravo-1' }),
      finding('charlie', 28, { id: 'charlie-1' }),
    ]
    const forward = select(build(), [], opts)[0]
    const reversed = select(build().reverse(), [], opts)[0]
    const rotated = select([build()[2], build()[0], build()[1]], [], opts)[0]

    expect(reversed.id).toBe(forward.id)
    expect(rotated.id).toBe(forward.id)
  })
})

describe('a detector may pass its turn', () => {
  it('skips a detector whose best available finding sits on the floor', () => {
    // venue-ghost's real case: stronger findings inside the dedup window leave
    // only "1 Show Before It Was Closed" at exactly MIN_SCORE.
    const findings = [finding('thin', MIN_SCORE), finding('solid', 26)]
    const history = [post('solid', 1)] // solid just published, thin never has

    const chosen = select(findings, history, opts)
    expect(chosen.map((f) => f.detector)).not.toContain('thin')
    expect(chosen[0].detector).toBe('solid')
  })

  it('lets the same detector back in as soon as it has something better', () => {
    const findings = [finding('thin', MIN_SCORE + 1), finding('solid', 26)]
    const history = [post('solid', 1)]

    const [winner] = select(findings, history, opts)
    expect(winner.detector).toBe('thin')
  })

  it('publishes nothing rather than something floor-level', () => {
    expect(select([finding('only', MIN_SCORE)], [], opts)).toHaveLength(0)
  })
})

describe('candidate reserve', () => {
  it('returns the target plus a reserve, in publish order', () => {
    const findings = ['a', 'b', 'c', 'd', 'e'].map((d, i) => finding(d, 40 - i))
    const chosen = select(findings, [], opts)
    expect(chosen).toHaveLength(POSTS_PER_RUN + CANDIDATE_RESERVE)
  })

  it('returns what it can when fewer detectors qualify than the reserve wants', () => {
    const chosen = select([finding('a', 30)], [], opts)
    expect(chosen).toHaveLength(1)
  })
})

describe('--force keeps publication history for rotation', () => {
  it('still rotates when deduplication is skipped', () => {
    // `--force` used to pass [] as the whole history, which would blank
    // staleness and collapse rotation back into score ranking.
    const findings = [finding('tall', 45), finding('short', 30)]
    const history = [post('tall', 1), post('short', 200)]

    const [winner] = select(findings, history, { ...opts, force: true })
    expect(winner.detector).toBe('short')
  })

  it('admits a finding the rerun cooldown would otherwise block', () => {
    const blocked = finding('a', 40, { artists: ['repeat-artist'] })
    const history = [post('a', 10, { artists: ['repeat-artist'] })]

    expect(select([blocked], history, opts)).toHaveLength(0)
    expect(select([blocked], history, { ...opts, force: true })).toHaveLength(1)
  })
})

describe('rerun cooldown ages against the pipeline date', () => {
  it('expires once the window has passed', () => {
    const f = finding('a', 40, { artists: ['repeat-artist'] })
    // Ten newer posts by other artists, so the aged post falls outside the
    // primary-artist cooldown window and only the rerun cooldown is under test.
    const filler = Array.from({ length: 10 }, (_, i) =>
      post(`filler-${i}`, i + 1, { artists: [`filler-artist-${i}`] })
    )
    const recent = [...filler, post('a', 30, { artists: ['repeat-artist'] })]
    const old = [...filler, post('a', 240, { artists: ['repeat-artist'] })]

    // Measuring against Date.now() instead of the pipeline date meant a
    // cooldown could never expire under --date or in a forward simulation.
    expect(select([f], recent, opts)).toHaveLength(0)
    expect(select([f], old, opts)).toHaveLength(1)
  })
})
