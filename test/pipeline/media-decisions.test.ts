/**
 * `data/media-decisions.json` — the durable half of the review (#381 groundwork).
 *
 * The point of this file is that rejections survive. `media-index.json` already records
 * every keeper well enough to rebuild it — uuid, sourceSha256, `derivedFrom`, `render` —
 * but nothing recorded the 37 "no"s on 2026-06-04, and saying no is most of the work of
 * culling. These tests pin the properties that make the record trustworthy: that an
 * unjudged asset is never silently turned into a rejection, that re-finishing a show
 * reflects a changed mind rather than accumulating both answers, and that the file carries
 * no personal data beyond a UUID and a verdict.
 */
import { describe, it, expect } from 'vitest'
import {
  loadDecisions,
  recordShow,
  saveDecisions,
  toDecision,
  decidedUuids,
  type DecisionsFile,
} from '../../scripts/media/decisions'
import type { Verdict } from '../../scripts/media/selects'
import { mkdtempSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const EMPTY: DecisionsFile = { version: 1, shows: {} }
const AT = '2026-08-25T00:00:00.000Z'

describe('toDecision', () => {
  it('keeps attribution and clip marks on a keeper', () => {
    const v: Verdict = {
      verdict: 'keep',
      artist: 'Alison Moyet',
      subject: 'performer',
      frames: [1],
      trim: { in: 2, out: 38 },
    }
    expect(toDecision(v)).toEqual({
      verdict: 'keep',
      artist: 'Alison Moyet',
      subject: 'performer',
      frames: [1],
      trim: { in: 2, out: 38 },
    })
  })

  it('reduces a rejection to the verdict alone', () => {
    // A reject needs no attribution, and carrying one would imply a judgement
    // about an asset the owner declined to publish.
    const v: Verdict = { verdict: 'reject', artist: 'Soft Cell', subject: 'performer' }
    expect(toDecision(v)).toEqual({ verdict: 'reject' })
  })

  it('returns null for an unjudged asset rather than defaulting it', () => {
    // The review page saves on every keystroke, so a half-finished record is normal.
    // Treating absence as rejection would bury assets nobody has looked at.
    expect(toDecision({})).toBeNull()
    expect(toDecision({ verdict: null })).toBeNull()
    expect(toDecision({ artist: 'The Human League' })).toBeNull()
  })
})

describe('recordShow', () => {
  const verdicts: Record<string, Verdict> = {
    'B-uuid': { verdict: 'reject' },
    'A-uuid': { verdict: 'keep', artist: 'The Human League', subject: 'performer' },
    'C-uuid': {},
  }

  it('counts keeps and rejects, and reports what it declined to record', () => {
    const r = recordShow(EMPTY, '2026-06-04', verdicts, AT)
    expect(r.kept).toBe(1)
    expect(r.rejected).toBe(1)
    expect(r.skipped).toBe(1)
    expect(r.file.shows['2026-06-04'].reviewed).toBe(2)
    expect(Object.keys(r.file.shows['2026-06-04'].decisions)).toEqual(['A-uuid', 'B-uuid'])
  })

  it('replaces a show wholesale so a changed mind is expressible', () => {
    const first = recordShow(EMPTY, '2026-06-04', verdicts, AT).file
    expect(first.shows['2026-06-04'].decisions['A-uuid'].verdict).toBe('keep')

    // The owner re-opens the page and changes A from keep to reject.
    const second = recordShow(
      first,
      '2026-06-04',
      { 'A-uuid': { verdict: 'reject' }, 'B-uuid': { verdict: 'reject' } },
      AT
    ).file
    expect(second.shows['2026-06-04'].decisions['A-uuid']).toEqual({ verdict: 'reject' })
    expect(second.shows['2026-06-04'].reviewed).toBe(2)
  })

  it('leaves other shows untouched', () => {
    const one = recordShow(EMPTY, '2026-06-04', verdicts, AT).file
    const two = recordShow(one, '2018-04-27', { 'Z-uuid': { verdict: 'reject' } }, AT).file
    expect(Object.keys(two.shows).sort()).toEqual(['2018-04-27', '2026-06-04'])
    expect(two.shows['2026-06-04'].decisions['A-uuid'].verdict).toBe('keep')
  })
})

describe('decidedUuids', () => {
  it('spans every show, so an audit can skip what is already judged', () => {
    let f = recordShow(EMPTY, '2026-06-04', { a: { verdict: 'keep' } }, AT).file
    f = recordShow(f, '2018-04-27', { b: { verdict: 'reject' } }, AT).file
    expect(decidedUuids(f)).toEqual(new Set(['a', 'b']))
  })
})

describe('saveDecisions', () => {
  it('sorts shows by date so adding one is an insertion, not a reshuffle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'decisions-'))
    const path = join(dir, 'media-decisions.json')
    let f = recordShow(EMPTY, '2026-06-04', { a: { verdict: 'keep' } }, AT).file
    f = recordShow(f, '2018-04-27', { b: { verdict: 'reject' } }, AT).file
    saveDecisions(f, path)
    const written = readFileSync(path, 'utf-8')
    expect(written.indexOf('2018-04-27')).toBeLessThan(written.indexOf('2026-06-04'))
    expect(written.endsWith('\n')).toBe(true)
    expect(loadDecisions(path).shows['2026-06-04'].decisions.a.verdict).toBe('keep')
  })

  it('round-trips through an absent file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'decisions-'))
    const path = join(dir, 'media-decisions.json')
    expect(existsSync(path)).toBe(false)
    expect(loadDecisions(path)).toEqual({ version: 1, shows: {} })
  })

  it('refuses a version it does not understand rather than guessing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'decisions-'))
    const path = join(dir, 'media-decisions.json')
    saveDecisions({ version: 9 as 1, shows: {} }, path)
    expect(() => loadDecisions(path)).toThrow(/unsupported version 9/)
  })
})

describe('the committed file', () => {
  const path = 'data/media-decisions.json'

  it('carries no filename, capture time, or coordinate', () => {
    // The evaluation workspace stays ignored; this extract is what leaves it. It may hold
    // a Photos UUID and a verdict and nothing else — owner-approved on the grounds that
    // neither discloses anything the published archive does not already say.
    const raw = readFileSync(path, 'utf-8')
    expect(raw).not.toMatch(/IMG_\d+/)
    expect(raw).not.toMatch(/\.(HEIC|DNG|MOV|JPG|JPEG)/i)
    // The only times present are `decidedAt` stamps, never a capture time.
    for (const m of raw.matchAll(/\d{2}:\d{2}:\d{2}[^"]*/g)) {
      expect(m[0]).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }

    /* STRUCTURAL, NOT TEXTUAL, for the numbers.
       This used to assert the raw text contained no `\d+\.\d{4,}` — meaning GPS precision.
       Crop boxes are stored to four decimal places, so `0.1181` tripped it the moment the
       owner cropped a photograph: a true privacy rule firing on data that carries no
       location at all. Checking the SHAPE says what was actually meant — these keys and no
       others — and cannot be fooled by a coordinate that happens to be short, nor fooled
       INTO failing by a legitimate number that happens to be long. */
    const allowed = new Set(['verdict', 'artist', 'subject', 'frames', 'trim', 'hero', 'crop'])
    const file = loadDecisions(path)
    for (const show of Object.values(file.shows)) {
      for (const [uuid, d] of Object.entries(show.decisions)) {
        for (const key of Object.keys(d)) {
          expect(allowed, `${uuid} carries an unexpected field "${key}"`).toContain(key)
        }
        // A crop is normalised, so every number in it is between 0 and 1 — which is what
        // makes it distinguishable from a coordinate regardless of how it is printed.
        for (const n of Object.values(d.crop ?? {})) {
          expect(n).toBeGreaterThanOrEqual(0)
          expect(n).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('still holds the marks that let a clip be re-derived without re-watching it', () => {
    const f = loadDecisions(path)
    const show = f.shows['2026-06-04']
    expect(show).toBeDefined()
    const marked = Object.values(show.decisions).filter((d) => d.frames || d.trim)
    expect(marked).toHaveLength(3)
    expect(marked.filter((d) => d.trim)).toHaveLength(2)
    expect(marked.find((d) => d.frames)?.frames).toEqual([1])
  })

  it('records the rejections, which is the whole point', () => {
    const show = loadDecisions(path).shows['2026-06-04']
    const rejected = Object.values(show.decisions).filter((d) => d.verdict === 'reject')
    expect(rejected.length).toBeGreaterThan(Object.values(show.decisions).length / 2)
  })
})
