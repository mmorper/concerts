/**
 * Phase detection — the one thing that decides what comes next.
 *
 * This exists because the pipeline told the owner to skip three steps. `media:review
 * --finish` printed "Next: npm run media:ingest" while seven unmined clips sat there; the
 * owner followed it, `media:ingest` published the show's ONE still, exited 0, and left all
 * the video behind. Every test here pins a rule that failure broke.
 */
import { describe, it, expect } from 'vitest'
import { phaseOf, minedAlready, unmarkedClipWarning, type Snapshot } from '../../scripts/media/phase'

const DATE = '2024-08-20'
const base: Snapshot = {
  hasRun: true, onPage: 29, judged: 29, framesOnPage: 0, framesJudged: 0,
  hasSelects: true, selectsStale: false, clipsKept: 0, clipsUnmarked: 0,
  publishable: 1, indexedCount: 1, indexedVideos: 0,
}
const at = (over: Partial<Snapshot>) => phaseOf({ ...base, ...over }, DATE)

describe('the order of the workflow', () => {
  it('starts at judging when nothing has been opened', () => {
    expect(at({ hasRun: false, judged: 0, onPage: 0, hasSelects: false }).id).toBe('not-started')
  })

  it('finishes before mining, because media:frames reads selects.json', () => {
    // That file is the gate keeping 22.5GB of unwanted video off the disk.
    expect(at({ hasSelects: false, clipsKept: 7 }).id).toBe('finish')
  })

  it('mines before ingesting, even when something is already indexed', () => {
    // THE REGRESSION. media:ingest publishes what it can and exits 0, so a show with one
    // still and seven clips looked "ingested" while all its video was untouched.
    expect(at({ clipsKept: 7, publishable: 3, indexedCount: 1 }).id).toBe('mine')
  })

  it('does not call a show done while clips are still unmined', () => {
    // The same bug wearing a different hat: indexedCount happening to equal publishable
    // must not outrank unmined clips.
    expect(at({ clipsKept: 7, publishable: 1, indexedCount: 1 }).id).toBe('mine')
  })

  it('judges the extracted frames before finishing again', () => {
    expect(at({ framesOnPage: 3, framesJudged: 0, onPage: 32, judged: 32 }).id).toBe('judge-frames')
  })

  it('asks for a SECOND finish once frames are judged', () => {
    // Mining creates stills that did not exist when the first pass was judged.
    const p = at({ framesOnPage: 3, framesJudged: 3, onPage: 32, judged: 32, selectsStale: true, clipsKept: 7 })
    expect(p.id).toBe('finish-again')
    expect(p.command).toContain('--finish')
  })

  it('treats a stale selects.json as unfinished', () => {
    // The page saves on every keystroke, so a verdict recorded after selects.json was
    // written means selects.json no longer says what the owner decided.
    expect(at({ selectsStale: true }).id).toBe('finish')
  })

  it('reaches done only when every publishable asset is indexed', () => {
    expect(at({ clipsKept: 6, indexedVideos: 2, publishable: 25, indexedCount: 25 }).id).toBe('done')
    expect(at({ clipsKept: 6, indexedVideos: 2, publishable: 25, indexedCount: 24 }).id).toBe('ingest')
  })

  it('never emits a command for done, and always emits one otherwise', () => {
    expect(at({ clipsKept: 6, indexedVideos: 2, publishable: 1, indexedCount: 1 }).command).toBeNull()
    for (const over of [{ hasRun: false }, { judged: 0 }, { hasSelects: false }, { clipsKept: 7 }, { indexedCount: 0 }]) {
      expect(at(over as Partial<Snapshot>).command).toBeTruthy()
    }
  })
})

describe('minedAlready', () => {
  it('counts an indexed render, not just page frames', () => {
    // A clip marked with only a trim produces a render and NO page frame. Checking frames
    // alone would send a trim-only show back to mine forever.
    expect(minedAlready({ ...base, framesOnPage: 0, indexedVideos: 1 })).toBe(true)
    expect(minedAlready({ ...base, framesOnPage: 3, indexedVideos: 0 })).toBe(true)
    expect(minedAlready({ ...base, framesOnPage: 0, indexedVideos: 0 })).toBe(false)
  })
})

describe('unmarkedClipWarning', () => {
  it('warns before the download, naming the cost of not marking', () => {
    const w = unmarkedClipWarning({ ...base, clipsKept: 7, clipsUnmarked: 3 })
    expect(w).toMatch(/3 kept clip/)
    expect(w).toMatch(/0-for-7/)
  })

  it('says nothing when every kept clip is marked', () => {
    expect(unmarkedClipWarning({ ...base, clipsKept: 7, clipsUnmarked: 0 })).toBeNull()
  })
})
