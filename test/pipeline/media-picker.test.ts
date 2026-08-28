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
import { actionsFor, buildRows, framingGaps, renderRow } from '../../scripts/media/index'
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

describe('actionsFor', () => {
  // Navigating to a show was only half of what the owner asked for. Selecting a finished one
  // used to print "Nothing left to run. Commit it." and exit — a destination you could reach
  // and then do nothing with. A show is a place you act on, not a single next step.
  const phase = (id: string, command: string | null) =>
    ({ id, step: 7, title: 'Done', why: 'why', command }) as never

  it('gives a FINISHED show somewhere to go', () => {
    const a = actionsFor('2024-08-20', snap(), phase('done', null))
    expect(a.map((x) => x.command)).toEqual([
      'npm run media:crop 2024-08-20',
      'npm run media:review 2024-08-20',
    ])
  })

  it('puts the phase recommendation first and marks it', () => {
    const a = actionsFor('2026-06-04', snap({ actsMissingHero: 3 }),
      phase('frame', 'npm run media:crop 2026-06-04'))
    expect(a[0].recommended).toBe(true)
    expect(a[0].command).toBe('npm run media:crop 2026-06-04')
  })

  it('never offers the same command twice', () => {
    // The frame step IS media:crop. Listing it again as "Crop & hero" would put the same
    // command on two lines and make the menu read as two different things.
    const a = actionsFor('2026-06-04', snap({ actsMissingHero: 3 }),
      phase('frame', 'npm run media:crop 2026-06-04'))
    expect(new Set(a.map((x) => x.command)).size).toBe(a.length)
  })

  it('does not offer crop for a show with nothing published', () => {
    // It would open an empty page, which is how the pipeline lost trust the first time.
    const a = actionsFor('2023-11-16', snap({ indexedCount: 0, publishable: 0 }),
      phase('judging', 'npm run media:review 2023-11-16'))
    expect(a.some((x) => x.command.includes('media:crop'))).toBe(false)
  })

  it('does not offer re-judge for a show that was never opened', () => {
    const a = actionsFor('2023-11-16', snap({ hasRun: false, indexedCount: 0 }),
      phase('not-started', 'npm run media:review 2023-11-16'))
    expect(a.map((x) => x.command)).toEqual(['npm run media:review 2023-11-16'])
  })

  it('names the outstanding gap on the crop action, so the menu is informative', () => {
    const a = actionsFor('2025-11-20', snap({ actsMissingHero: 1 }), phase('done', null))
    expect(a[0].detail).toContain('1 act(s) with no hero')
  })

  it('is empty only when there is genuinely nothing to do', () => {
    expect(actionsFor('2023-01-01', snap({ hasRun: false, indexedCount: 0, publishable: 0 }),
      phase('done', null))).toEqual([])
  })
})

describe('renderRow says what is OUTSTANDING', () => {
  // THE BUG THE OWNER HIT TWICE. The row read "2 assets published" for a Kasabian show with
  // four more waiting to ingest, and they reasonably concluded it was finished. Any count of
  // what has landed is a progress bar with the remainder cropped off.
  const strip = (t: string) => t.replace(/\x1b\[[0-9;]*m/g, '')
  const row = (over: Partial<Snapshot>, date = '2023-11-22') => strip(renderRow(
    { concert: { date, headliner: 'Kasabian', venue: 'The Belasco' } as never,
      phase: phaseOf(snap(over), date), snapshot: snap(over), unjudged: 0, opportunity: 0 },
    false, 30))

  it('names the assets still to ingest, not the ones already in', () => {
    const t = row({ publishable: 6, indexedCount: 2 })
    expect(t).toContain('4 to ingest')
    expect(t).not.toContain('2 assets published')
  })

  it('names every outstanding thing at once', () => {
    const t = row({ publishable: 6, indexedCount: 2, actsMissingHero: 1, stillsUncropped: 3 })
    expect(t).toContain('4 to ingest')
    expect(t).toContain('1 no hero')
    expect(t).toContain('3 uncropped')
  })

  it('only says published when nothing at all is outstanding', () => {
    expect(row({ publishable: 6, indexedCount: 6 })).toContain('6 assets published')
  })

  it('falls back to judged progress before anything is published', () => {
    expect(row({ publishable: 0, indexedCount: 0, judged: 8, onPage: 8 })).toContain('8/8 judged')
  })
})
