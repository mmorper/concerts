/**
 * Tests for `media:ingest` (#379).
 *
 * The two failures this command exists to prevent are both silent, and both are pinned
 * here rather than left to a code reading:
 *
 *   1. A WRONG CREDIT. 89 of 184 shows (48%) have openers — 187 credits. A folder that
 *      quietly resolved to the headliner would mis-credit photographs on half the archive,
 *      and the post would state it as fact.
 *   2. A METADATA LEAK. Personal media must never reach the repo carrying GPS, capture
 *      time or a device id. That is asserted on real bytes below, not taken on trust from
 *      the same library that did the stripping.
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  matchFolder,
  explainMatchFailure,
  parseDerivedFrom,
  isHeroName,
  type AmbiguousMatch,
  type UnknownMatch,
} from '../../scripts/media/match'
import { folderPlan, lineupFor, type Concert } from '../../scripts/media/show'
import { readExifSummary, exifDateToIso, findMetadataLeaks, EMPTY_EXIF } from '../../scripts/media/exif'
import {
  alreadyIngested,
  assetFilename,
  nextOrder,
  sortAssets,
  type MediaAsset,
  type MediaIndex,
} from '../../scripts/media/media-index'

const HOWARD: Concert = {
  date: '2024-08-20',
  headliner: 'Howard Jones',
  openers: ['ABC', 'Haircut 100'],
  venue: 'YouTube Theatre',
  city: 'Inglewood',
  state: 'California',
}

const HUMAN_LEAGUE: Concert = {
  date: '2026-06-04',
  headliner: 'The Human League',
  openers: ['Alison Moyet', 'Soft Cell'],
  venue: 'The Anthem',
  city: 'Washington',
  state: 'District of Columbia',
}

const GOGOS: Concert = {
  date: '2011-06-10',
  headliner: "The Go-Go's",
  openers: ['The Dollyrots'],
  venue: 'Wolftrap',
  city: 'Vienna',
  state: 'Virginia',
}

describe('matching a folder to one act on the bill', () => {
  const lineup = lineupFor(HUMAN_LEAGUE)

  it('resolves the spellings the owner will actually type', () => {
    // The owner names these by hand after a show, not by filling in a form.
    for (const folder of ['the-human-league', 'human league', 'Human League', 'THE HUMAN LEAGUE', 'the human league']) {
      const m = matchFolder(folder, lineup)
      expect(m.kind, folder).toBe('act')
      expect((m as { act: { name: string } }).act.name, folder).toBe('The Human League')
    }
  })

  it('ignores punctuation entirely when it has to', () => {
    // "The Go-Go's" normalises to `the-go-go-s`, which nobody types.
    const gogos = lineupFor(GOGOS)
    for (const folder of ['go-gos', 'gogos', 'The Go-Gos', "the go-go's"]) {
      const m = matchFolder(folder, gogos)
      expect(m.kind, folder).toBe('act')
      expect((m as { act: { name: string } }).act.name, folder).toBe("The Go-Go's")
    }
  })

  it('matches the headliner like any other act — there is no default', () => {
    const m = matchFolder('howard-jones', lineupFor(HOWARD))
    expect(m.kind).toBe('act')
    expect((m as { act: { role: string } }).act.role).toBe('headliner')
  })

  it('resolves _venue and the bare venue', () => {
    expect(matchFolder('_venue', lineup).kind).toBe('venue')
    expect(matchFolder('venue', lineup).kind).toBe('venue')
  })

  it('FAILS on a folder that matches nobody, and prints the bill', () => {
    // A guess here is a fabricated credit. Failing is the feature.
    const m = matchFolder('the-smiths', lineup)
    expect(m.kind).toBe('unknown')
    const msg = explainMatchFailure(m as UnknownMatch, '2026-06-04', lineup)
    expect(msg).toContain('The Human League')
    expect(msg).toContain('Alison Moyet')
    expect(msg).toContain('Soft Cell')
    expect(msg).toContain('_venue/')
  })

  it('FAILS on a genuinely ambiguous folder rather than picking one', () => {
    const twins = folderPlan({ ...HOWARD, headliner: 'The Band', openers: ['The Band!'] }).acts
    const m = matchFolder('band', twins)
    expect(m.kind).toBe('ambiguous')
    expect(explainMatchFailure(m as AmbiguousMatch, '2024-08-20', twins)).toContain('more than one act')
  })

  it('does not call it ambiguous when one act is named exactly', () => {
    // Exact spelling is tried before the loose comparison, so two acts whose loose forms
    // collide still resolve when the folder names one of them precisely.
    const twins = folderPlan({ ...HOWARD, headliner: 'The Band', openers: ['The Band!'] }).acts
    const m = matchFolder('the-band', twins)
    expect(m.kind).toBe('act')
    expect((m as { act: { slug: string } }).act.slug).toBe('the-band')
  })

  it('resolves a collision-suffixed folder to the act it was created for', () => {
    const twins = folderPlan({ ...HOWARD, headliner: 'The Band', openers: ['The Band!'] }).acts
    const m = matchFolder('the-band-2', twins)
    expect(m.kind).toBe('act')
    expect((m as { act: { name: string } }).act.name).toBe('The Band!')
  })

  it('matches only against THAT night, so another night`s act is unknown', () => {
    expect(matchFolder('soft-cell', lineupFor(HOWARD)).kind).toBe('unknown')
  })
})

describe('provenance and hero naming', () => {
  it('recognises a frame extracted by extract_frames.sh', () => {
    // Knowing a still came from a clip is what lets a different-night disclosure be
    // written accurately — it is provenance, not bookkeeping.
    expect(parseDerivedFrom('IMG_3081__f0042__lap31.77.jpg')).toEqual({ original: 'IMG_3081', frame: 42 })
    expect(parseDerivedFrom('IMG_3081.jpg')).toBeNull()
    expect(parseDerivedFrom('hero.jpg')).toBeNull()
  })

  it('recognises hero.* and 01.*', () => {
    expect(isHeroName('hero.jpg')).toBe(true)
    expect(isHeroName('HERO.JPEG')).toBe(true)
    expect(isHeroName('01.png')).toBe(true)
    expect(isHeroName('02.jpg')).toBe(false)
    expect(isHeroName('IMG_3099.jpg')).toBe(false)
  })
})

describe('EXIF is a cross-check, never the source of truth', () => {
  /** A JPEG carrying exactly what a phone photo carries. */
  async function withExif(date?: string): Promise<Buffer> {
    const exif: Record<string, Record<string, string>> = {
      IFD0: { Make: 'Apple', Model: 'iPhone 14 Pro' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '33/1 57/1 5/1' },
    }
    if (date) exif.IFD2 = { DateTimeOriginal: date }
    return sharp({ create: { width: 24, height: 18, channels: 3, background: '#456' } })
      .jpeg()
      .withExif(exif)
      .toBuffer()
  }

  it('reads capture time, device and GPS presence off a real file', async () => {
    const meta = await sharp(await withExif('2018:04:27 20:15:33')).metadata()
    const summary = readExifSummary(meta.exif)
    expect(summary.dateTimeOriginal).toBe('2018:04:27 20:15:33')
    expect(summary.make).toBe('Apple')
    expect(summary.model).toBe('iPhone 14 Pro')
    expect(summary.hasGps).toBe(true)
  })

  it('treats a missing capture time as normal, not as suspicious', async () => {
    // ffmpeg strips DateTimeOriginal outright, so every extracted frame arrives this way.
    const meta = await sharp(await withExif()).metadata()
    expect(readExifSummary(meta.exif).dateTimeOriginal).toBeNull()
  })

  it('never throws on rubbish — a malformed header must not reject a photograph', () => {
    expect(readExifSummary(Buffer.from('not exif at all'))).toEqual(EMPTY_EXIF)
    expect(readExifSummary(Buffer.alloc(0))).toEqual(EMPTY_EXIF)
    expect(readExifSummary(null)).toEqual(EMPTY_EXIF)
    expect(readExifSummary(Buffer.from('Exif\0\0II*\0\xff\xff\xff\xff', 'latin1'))).toEqual(EMPTY_EXIF)
  })

  it('converts an EXIF datetime to an archive date', () => {
    expect(exifDateToIso('2018:04:27 20:15:33')).toBe('2018-04-27')
    expect(exifDateToIso(null)).toBeNull()
    expect(exifDateToIso('garbage')).toBeNull()
  })
})

describe('metadata stripping is asserted, not trusted', () => {
  it('finds every marker on a file that still carries metadata', async () => {
    const dirty = await sharp({ create: { width: 24, height: 18, channels: 3, background: '#456' } })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Apple', Model: 'iPhone 14 Pro' },
        IFD2: { DateTimeOriginal: '2024:08:20 21:55:01' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '33/1 57/1 5/1' },
      })
      .toBuffer()
    const leaks = findMetadataLeaks(dirty, await sharp(dirty).metadata())
    expect(leaks.length).toBeGreaterThan(0)
    expect(leaks.join(' ')).toContain('EXIF')
  })

  it('reports clean after the pipeline ingest actually uses', async () => {
    const dirty = await sharp({ create: { width: 24, height: 18, channels: 3, background: '#456' } })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Apple', Model: 'iPhone 14 Pro' },
        IFD2: { DateTimeOriginal: '2024:08:20 21:55:01' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '33/1 57/1 5/1' },
      })
      .toBuffer()

    // Exactly what ingest does: rotate from the orientation flag, re-encode, keep nothing.
    const clean = await sharp(dirty, { failOn: 'none' }).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()

    expect(findMetadataLeaks(clean, await sharp(clean).metadata())).toEqual([])
    // Independently of any parser: the bytes themselves must not contain these.
    expect(clean.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(false)
    expect(clean.includes(Buffer.from('Apple'))).toBe(false)
    expect(clean.includes(Buffer.from('iPhone'))).toBe(false)
    expect(clean.includes(Buffer.from('2024:08:20'))).toBe(false)
    expect(clean.includes(Buffer.from('GPSLatitude'))).toBe(false)
  })

  it('catches a leak even when the metadata reader says nothing', () => {
    // The raw scan shares no parser with the encoder, which is the whole point of it.
    const smuggled = Buffer.concat([Buffer.from('\xff\xd8\xff', 'latin1'), Buffer.from('GPSLatitude'), Buffer.from('\xff\xd9', 'latin1')])
    expect(findMetadataLeaks(smuggled, {})).toContain('raw bytes contain a GPS tag name')
  })
})

describe('the media index', () => {
  const asset = (over: Partial<MediaAsset>): MediaAsset => ({
    url: '/images/shows/2024-08-20-howard-jones-01.jpg',
    date: '2024-08-20',
    artist: 'Howard Jones',
    artistNormalized: 'howard-jones',
    subject: 'artist',
    tier: 1,
    source: 'personal',
    hero: false,
    order: 1,
    width: 100,
    height: 100,
    bytes: 1000,
    sourceSha256: 'aaa',
    derivedFrom: null,
    notes: null,
    ...over,
  })

  const index = (assets: MediaAsset[]): MediaIndex => ({ version: 1, generated: '', assets })

  it('names files by date, act and ordinal', () => {
    expect(assetFilename('2024-08-20', 'howard-jones', 3)).toBe('2024-08-20-howard-jones-03.jpg')
    expect(assetFilename('2024-08-20', 'howard-jones', 12)).toBe('2024-08-20-howard-jones-12.jpg')
  })

  it('names venue material `venue`, never the headliner', () => {
    // Null artist means "the night", and must never quietly become the headliner.
    expect(assetFilename('2024-08-20', null, 1)).toBe('2024-08-20-venue-01.jpg')
  })

  it('continues numbering from what is already committed', () => {
    const i = index([asset({ order: 1 }), asset({ order: 2, url: '/x', sourceSha256: 'bbb' })])
    expect(nextOrder(i, '2024-08-20', 'howard-jones')).toBe(3)
    expect(nextOrder(i, '2024-08-20', 'abc')).toBe(1)
    expect(nextOrder(i, '2024-08-20', null)).toBe(1)
  })

  it('recognises an already-ingested file by CONTENT, not by name', () => {
    // The owner is free to rename anything in the inbox; the hash is what makes a re-run
    // idempotent regardless.
    const i = index([asset({ sourceSha256: 'abc123' })])
    expect(alreadyIngested(i, '2024-08-20', 'howard-jones', 'abc123')).toBeDefined()
    expect(alreadyIngested(i, '2024-08-20', 'howard-jones', 'different')).toBeUndefined()
    // Same bytes filed under a different act is a different asset — two acts really can
    // appear in one frame, and the owner may file it under both.
    expect(alreadyIngested(i, '2024-08-20', 'abc', 'abc123')).toBeUndefined()
  })

  it('sorts deterministically so a diff shows changes, not movement', () => {
    const a = asset({ url: '/b', date: '2024-08-20' })
    const b = asset({ url: '/a', date: '2018-04-27' })
    expect(sortAssets([a, b]).map((x) => x.url)).toEqual(['/a', '/b'])
    expect(sortAssets([b, a]).map((x) => x.url)).toEqual(['/a', '/b'])
  })
})
