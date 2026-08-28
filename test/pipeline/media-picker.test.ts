/**
 * The show picker (`npm run media`).
 *
 * WHY THIS EXISTS. The picker was a worklist that dropped finished shows, so once a show
 * reached `done` it was unreachable from this command or any other. The owner asked the
 * obvious question — "how do I get back to a show I've already done?" — and the answer was
 * that you could not. These pin both halves of the fix: `done` now accounts for the
 * judgements made after publication, and the picker can list everything.
 */
import { describe, it, expect } from 'vitest'
import { buildRows, framingGaps } from '../../scripts/media/index'
import { phaseOf, type Snapshot } from '../../scripts/media/phase'
import type { Concert } from '../../src/types/concert'

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  hasRun: true, onPage: 29, judged: 29, framesOnPage: 0, framesJudged: 0,
  hasSelects: true, selectsStale: false, clipsKept: 0, clipsUnmarked: 0,
  publishable: 25, indexedCount: 25, indexedVideos: 0,
  actsMissingHero: 0, stillsUncropped: 0,
  ...over,
})

const concerts = [
  { date: '2026-06-04', headliner: 'The Human League', venue: 'Pacific Amphitheatre' },
  { date: '2024-08-20', headliner: 'Howard Jones', venue: 'YouTube Theatre' },
  { date: '2012-06-12', headliner: 'The Cult', venue: 'The Fillmore Silver Spring' },
] as unknown as Concert[]

describe('framingGaps', () => {
  const a = (o: Record<string, unknown>) => ({ kind: 'image', url: '/images/shows/x.jpg', ...o })

  it('counts a missing hero PER ACT, because that is how the rule is written', () => {
    // A bill runs to six acts. Counting per show would call a five-act night finished the
    // moment any one frame was starred.
    expect(framingGaps([
      a({ artistNormalized: 'soft-cell' }),
      a({ artistNormalized: 'alison-moyet' }),
      a({ artistNormalized: 'the-human-league', hero: true }),
    ]).actsMissingHero).toBe(2)
  })

  it('counts an act once however many stills it has', () => {
    // The Human League has 17. One missing hero, not seventeen.
    const many = Array.from({ length: 17 }, () => a({ artistNormalized: 'the-human-league' }))
    expect(framingGaps(many).actsMissingHero).toBe(1)
  })

  it('exempts a venue or crowd frame, which has no act to lead', () => {
    // Demanding a hero for `2026-06-04-venue-01.jpg` would leave the show permanently
    // unfinished with nothing the owner could do about it.
    expect(framingGaps([
      a({ artistNormalized: null, subject: 'venue' }),
      a({ artistNormalized: null, subject: 'venue' }),
    ]).actsMissingHero).toBe(0)
  })

  it('ignores video, which has no box to draw and no post will reach for', () => {
    expect(framingGaps([{ kind: 'video', url: null, artistNormalized: 'abc' }]))
      .toEqual({ actsMissingHero: 0, stillsUncropped: 0 })
  })

  it('counts uncropped stills individually', () => {
    expect(framingGaps([
      a({ artistNormalized: 'x', crop: { x: 0, y: 0, w: 1, h: 1 }, hero: true }),
      a({ artistNormalized: 'x' }),
      a({ artistNormalized: 'x' }),
    ]).stillsUncropped).toBe(2)
  })
})

describe('buildRows', () => {
  const rows = (all: boolean, over: Record<string, Partial<Snapshot>> = {}) =>
    buildRows(concerts, new Map(), (d) => snap(over[d] ?? {}), all)

  it('hides a finished show from the work list', () => {
    // Unchanged behaviour, and correct: the default is a worklist.
    expect(rows(false)).toEqual([])
  })

  it('shows every published show in browse mode — the thing that was impossible', () => {
    expect(rows(true).map((r) => r.concert.date)).toHaveLength(3)
  })

  it('surfaces an unheroed show as WORK, without browse mode', () => {
    // The Human League: published, 17 stills, no hero. It has to appear in the default list
    // or the owner has no way to know the decision is outstanding.
    const r = rows(false, { '2026-06-04': { actsMissingHero: 3 } })
    expect(r.map((x) => x.concert.date)).toEqual(['2026-06-04'])
    expect(r[0].phase.id).toBe('frame')
  })

  it('sorts finished shows last, below anything still carrying a decision', () => {
    const r = rows(true, { '2024-08-20': { actsMissingHero: 1 } })
    expect(r[0].concert.date).toBe('2024-08-20')
    expect(r[r.length - 1].phase.id).toBe('done')
  })

  it('offers a show that is published even with no review run on disk', () => {
    // `concert-photos-audit/` is gitignored evaluation space and can be cleared. A show
    // whose run directory is gone is still published and still reachable.
    const r = buildRows(concerts, new Map(),
      () => snap({ hasRun: false, judged: 0, onPage: 0, hasSelects: false, publishable: 0, indexedCount: 5 }), true)
    expect(r).toHaveLength(3)
  })

  it('still refuses a show with nothing at all', () => {
    const r = buildRows(concerts, new Map(),
      () => snap({ hasRun: false, judged: 0, onPage: 0, hasSelects: false, publishable: 0, indexedCount: 0 }), true)
    expect(r).toEqual([])
  })

  it('agrees with phaseOf about what done means', () => {
    // One thing decides what comes next. If the picker and the phase model can disagree,
    // the picker is back to lying about the state of a show.
    const s = snap({ actsMissingHero: 2 })
    expect(phaseOf(s, '2026-06-04').id).toBe('frame')
    expect(buildRows(concerts, new Map(), () => s, false)).toHaveLength(3)
  })
})
