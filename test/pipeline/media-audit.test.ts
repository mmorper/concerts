/**
 * `media:audit` — the corpus scan's bookkeeping (#381).
 *
 * The library pass itself needs a Mac, a Photos library and Full Disk Access, so it is not
 * testable here. What IS testable is everything that decides what the owner gets told: which
 * assets count as work still available, and how a night's standing is computed. Those are
 * the parts that can silently lie, and this corner of the project has already produced one
 * confident lie — the 17:00->04:00 window looked like a concert filter for a whole session.
 */
import { describe, it, expect } from 'vitest'
import { auditShow, publishedUuids } from '../../scripts/media/audit'
import type { Candidate } from '../../scripts/media/rank'
import type { Concert } from '../../scripts/media/show'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const SHOW: Concert = {
  date: '2026-06-04',
  headliner: 'The Human League',
  openers: ['Soft Cell'],
  venue: 'Greek Theatre',
  city: 'Los Angeles',
  state: 'California',
}

let n = 0
function candidate(over: Partial<Candidate> = {}): Candidate {
  n++
  return {
    uuid: `uuid-${n}`,
    original_filename: `IMG_${1000 + n}.HEIC`,
    local_time: `2026-06-04T21:${String(10 + n).padStart(2, '0')}:00`,
    hour: 21,
    is_movie: false,
    live_photo: false,
    duration: null,
    width: 3024,
    height: 4032,
    keywords: [],
    labels: ['Concert', 'Entertainer'],
    persons: [],
    place: null,
    latitude: null,
    longitude: null,
    contributors: [],
    favorite: false,
    in_cloud: false,
    is_missing: false,
    preview_file: null,
    scores: { overall: 0.5, curation: 0.5 },
    ...over,
  } as Candidate
}

describe('auditShow', () => {
  it('counts what is still open, not what is merely in the window', () => {
    const a = candidate()
    const b = candidate()
    const c = candidate()
    const audit = auditShow(SHOW, [a, b, c], new Set([b.uuid]), new Set([c.uuid]))
    expect(audit.inWindow).toBe(3)
    expect(audit.decided).toBe(1)
    expect(audit.published).toBe(1)
    expect(audit.unjudged).toBe(1)
  })

  it('never counts an unscored asset as available work', () => {
    // Photos scores ~89.5% of the library. The rest cannot be ranked without inventing a
    // number, so they are surfaced separately rather than sorted in on a fabricated zero.
    const scored = candidate()
    const unscored = candidate({ scores: null })
    const audit = auditShow(SHOW, [scored, unscored], new Set(), new Set())
    expect(audit.inWindow).toBe(2)
    expect(audit.unscored).toBe(1)
    expect(audit.unjudged).toBe(1)
  })

  it('treats an all-zero ScoreInfo as unscored', () => {
    // 10.5% of the library carries a ScoreInfo of every field zero. Ranking it puts junk
    // at the bottom of a real ranking instead of out of it.
    const audit = auditShow(
      SHOW,
      [candidate({ scores: { overall: 0, curation: 0, low_light: 0 } })],
      new Set(),
      new Set()
    )
    expect(audit.unscored).toBe(1)
    expect(audit.unjudged).toBe(0)
  })

  it('separates one great frame from a body of work', () => {
    // bestScore and opportunity answer different questions and a single number cannot
    // carry both — the same reason likelihood and quality are never multiplied into one
    // verdict at the asset level.
    const peak = auditShow(SHOW, [candidate({ scores: { overall: 0.95, curation: 0.95 } })], new Set(), new Set())
    const depth = auditShow(
      SHOW,
      Array.from({ length: 8 }, () => candidate({ scores: { overall: 0.4, curation: 0.4 } })),
      new Set(),
      new Set()
    )
    expect(peak.bestScore).toBeGreaterThan(depth.bestScore as number)
    expect(depth.opportunity).toBeGreaterThan(peak.opportunity)
  })

  it('reports a show with nothing in its window rather than omitting it', () => {
    const audit = auditShow(SHOW, [], new Set(), new Set())
    expect(audit.inWindow).toBe(0)
    expect(audit.unjudged).toBe(0)
    expect(audit.bestScore).toBeNull()
    expect(audit.opportunity).toBe(0)
    expect(audit.date).toBe('2026-06-04')
  })

  it('does not re-offer an asset that was judged on a different night', () => {
    // Decisions are keyed by UUID across the whole archive, not per show. An asset caught
    // by two adjacent windows must not come back a second time.
    const a = candidate()
    expect(auditShow(SHOW, [a], new Set([a.uuid]), new Set()).unjudged).toBe(0)
  })
})

describe('publishedUuids', () => {
  const write = (assets: unknown[]) => {
    const p = join(mkdtempSync(join(tmpdir(), 'idx-')), 'media-index.json')
    writeFileSync(p, JSON.stringify({ version: 1, assets }))
    return p
  }

  it('claims the source clip of a frame, not just the frame', () => {
    // A still cut from a clip means that CLIP is spent. Missing this would put the clip
    // back on the worklist to be mined a second time.
    const p = write([
      { uuid: 'still-1' },
      { uuid: null, derivedFrom: { original: 'clip-A', frame: 1 } },
      { uuid: null, render: { uuid: 'clip-B', in: 2, out: 38 } },
    ])
    expect(publishedUuids(p)).toEqual(new Set(['still-1', 'clip-A', 'clip-B']))
  })

  it('is empty rather than throwing when no index exists yet', () => {
    expect(publishedUuids(join(tmpdir(), 'definitely-absent-index.json'))).toEqual(new Set())
  })
})
