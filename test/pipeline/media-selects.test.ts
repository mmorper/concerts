/**
 * Tests for `selects.json` (#380) — the record of what the owner decided, and the check
 * on what they then filed.
 *
 * This is the only place in the pipeline that can catch a mis-credit. Ingest sees a folder
 * and nothing else; the review page is where the owner said who is in the frame. If these
 * ever stop agreeing, a photograph gets published under the wrong act's name.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSelects,
  crossCheckSelects,
  folderFor,
  type SelectsFile,
  type Verdict,
} from '../../scripts/media/selects'
import { folderPlan, type Concert } from '../../scripts/media/show'

const SHOW: Concert = {
  date: '2026-06-04',
  headliner: 'The Human League',
  openers: ['Alison Moyet', 'Soft Cell'],
  venue: 'Hollywood Bowl',
  city: 'Hollywood',
  state: 'California',
}
const ACTS = folderPlan(SHOW).acts

const asset = (uuid: string, name: string, time = '21:00', missing = false) => ({
  uuid,
  original_filename: name,
  local_time: `2026-06-04T${time}:00`,
  is_missing: missing,
})

const build = (verdicts: Record<string, Verdict>, assets = [
  asset('u1', 'IMG_5696.DNG'),
  asset('u2', 'IMG_5713.HEIC'),
  asset('u3', 'IMG_5692.HEIC', '18:27'),
  asset('u4', 'IMG_5752.DNG', '22:41', true),
]) =>
  buildSelects({
    date: SHOW.date,
    headliner: SHOW.headliner,
    venue: SHOW.venue,
    acts: ACTS,
    assets,
    verdicts,
    generated: '2026-06-04T00:00:00Z',
  })

describe('turning verdicts into selects', () => {
  it('resolves a keeper to the act named in the review', () => {
    const f = build({ u1: { verdict: 'keep', subject: 'performer', artist: 'Alison Moyet' } })
    expect(f.selects).toHaveLength(1)
    expect(f.selects[0]).toMatchObject({
      artist: 'Alison Moyet',
      artistNormalized: 'alison-moyet',
      folder: 'alison-moyet',
      originalFilename: 'IMG_5696.DNG',
    })
  })

  it('sends venue, crowd and stub frames to _venue, with no artist', () => {
    // These belong to the night, not to a performer. Null artist must never quietly
    // become the headliner.
    for (const subject of ['venue', 'crowd', 'stub'] as const) {
      const f = build({ u3: { verdict: 'keep', subject } })
      expect(f.selects[0].folder, subject).toBe('_venue')
      expect(f.selects[0].artist, subject).toBeNull()
    }
  })

  it('drops rejects entirely', () => {
    const f = build({ u1: { verdict: 'reject' }, u2: { verdict: 'keep', subject: 'performer', artist: 'Soft Cell' } })
    expect(f.selects.map((s) => s.uuid)).toEqual(['u2'])
  })

  it('REFUSES to place a keeper with no act named', () => {
    // 89 of 184 shows have openers. Defaulting an unattributed frame to the headliner is
    // fabricated attribution on half the archive, so it waits for a person instead.
    const f = build({ u1: { verdict: 'keep', subject: 'performer' } })
    expect(f.selects).toHaveLength(0)
    expect(f.unattributed).toEqual([
      { uuid: 'u1', originalFilename: 'IMG_5696.DNG', time: '2026-06-04T21:00:00' },
    ])
  })

  it('treats the review page`s __unknown__ as unattributed, not as an act', () => {
    const f = build({ u1: { verdict: 'keep', subject: 'performer', artist: '__unknown__' } })
    expect(f.selects).toHaveLength(0)
    expect(f.unattributed).toHaveLength(1)
  })

  it('matches an act tolerantly, so a hand-edited verdicts file still resolves', () => {
    const f = build({ u2: { verdict: 'keep', subject: 'performer', artist: 'soft cell' } })
    expect(f.selects[0].artist).toBe('Soft Cell')
  })

  it('ignores a verdict for an asset that is not in this show', () => {
    const f = build({ 'from-another-run': { verdict: 'keep', subject: 'performer', artist: 'Soft Cell' } })
    expect(f.selects).toHaveLength(0)
    expect(f.unattributed).toHaveLength(0)
  })

  it('flags which originals still need downloading from iCloud', () => {
    const f = build({ u4: { verdict: 'keep', subject: 'performer', artist: 'The Human League' } })
    expect(f.selects[0].needsDownload).toBe(true)
  })

  it('counts everything judged, not just the keepers', () => {
    const f = build({ u1: { verdict: 'reject' }, u2: { verdict: 'reject' }, u3: { verdict: 'keep', subject: 'venue' } })
    expect(f.reviewed).toBe(3)
    expect(f.selects).toHaveLength(1)
  })

  it('places a performer frame only when an act is known', () => {
    expect(folderFor('performer', ACTS[1])).toBe('alison-moyet')
    expect(folderFor('performer', null)).toBeNull()
    expect(folderFor('venue', null)).toBe('_venue')
  })
})

describe('cross-checking what was filed against what was decided', () => {
  const selects = (rows: Array<Partial<SelectsFile['selects'][0]>>): SelectsFile => ({
    version: 1,
    date: '2026-06-04',
    headliner: SHOW.headliner,
    venue: SHOW.venue,
    generated: '',
    reviewed: rows.length,
    unattributed: [],
    selects: rows.map((r) => ({
      uuid: 'u',
      originalFilename: 'IMG_1.HEIC',
      artist: 'Alison Moyet',
      artistNormalized: 'alison-moyet',
      subject: 'performer',
      folder: 'alison-moyet',
      needsDownload: false,
      time: '2026-06-04T21:00:00',
      ...r,
    })),
  })
  const report = () => ({ errors: [] as string[], warnings: [] as string[] })

  it('passes silently when the filing matches the decision', () => {
    const r = report()
    const refuse = crossCheckSelects(selects([{}]), [{ folder: 'alison-moyet', filename: 'IMG_1.HEIC' }], r)
    expect(r.errors).toEqual([])
    expect(refuse.size).toBe(0)
  })

  it('REFUSES a file dropped into a different act`s folder', () => {
    // The failure the whole pipeline is shaped around: ingest sees only the folder, so
    // without this the frame publishes under the wrong name.
    const r = report()
    const refuse = crossCheckSelects(selects([{}]), [{ folder: 'soft-cell', filename: 'IMG_1.HEIC' }], r)
    expect(refuse.has('soft-cell/IMG_1.HEIC')).toBe(true)
    expect(r.errors.join(' ')).toContain('Alison Moyet')
    expect(r.errors.join(' ')).toContain('NOT ingested')
  })

  it('matches on the stem, because Photos rewrites the extension on export', () => {
    // HEIC in, JPEG out. Comparing whole filenames would flag every single file.
    const r = report()
    const refuse = crossCheckSelects(
      selects([{ originalFilename: 'IMG_5696.DNG' }]),
      [{ folder: 'alison-moyet', filename: 'img_5696.jpg' }],
      r
    )
    expect(r.errors).toEqual([])
    expect(refuse.size).toBe(0)
  })

  it('warns about selects that have not arrived, without refusing anything', () => {
    const r = report()
    const refuse = crossCheckSelects(selects([{ needsDownload: true }]), [], r)
    expect(refuse.size).toBe(0)
    expect(r.warnings.join(' ')).toContain('have not arrived')
    expect(r.warnings.join(' ')).toContain('iCloud')
  })

  it('says when keepers are still unattributed', () => {
    const r = report()
    const f = selects([])
    f.unattributed = [{ uuid: 'x', originalFilename: 'IMG_9.HEIC', time: '2026-06-04T21:51:00' }]
    crossCheckSelects(f, [], r)
    expect(r.warnings.join(' ')).toContain('no act named')
  })

  it('leaves files with no matching select alone', () => {
    // A frame extracted from a clip has no UUID in the library and can only arrive as a
    // file. That is the inbox's job, and it is not a mis-file.
    const r = report()
    const refuse = crossCheckSelects(
      selects([{}]),
      [
        { folder: 'alison-moyet', filename: 'IMG_1.HEIC' },
        { folder: 'the-human-league', filename: 'IMG_5744__f0012__lap31.7.jpg' },
      ],
      r
    )
    expect(refuse.size).toBe(0)
    expect(r.errors).toEqual([])
  })
})
