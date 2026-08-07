/**
 * album-eras derivation (#270).
 *
 * The core join of v5.4 shipped with no unit tests — the size budget was
 * enforced by the script and headliner reachability by validate-concerts, but
 * the derivation logic itself was only ever checked by reading output. Caught
 * during the spec-completeness audit.
 *
 * The cases here are the ones where getting it wrong produces a *plausible*
 * number rather than a crash: pre-debut shows, compilation filtering, and the
 * slice contract between a concert and its artist's album spine.
 */

import { describe, it, expect } from 'vitest'
import { deriveAlbumEras } from '../../scripts/derive-album-eras.ts'

const concert = (id: string, date: string, headliner = 'Depeche Mode') => ({
  id,
  date,
  headliner,
  headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
})

const album = (
  id: string,
  title: string,
  releaseDate: string,
  extra: Record<string, unknown> = {}
) => ({
  id,
  title,
  releaseDate,
  primaryType: 'Album',
  secondaryTypes: [],
  coverAvailable: true,
  ...extra,
})

const discography = {
  'depeche-mode': {
    artistName: 'Depeche Mode',
    mbid: 'dm',
    albums: [
      album('a1', 'Speak & Spell', '1981-10-05'),
      album('a2', 'Music for the Masses', '1987-09-28'),
      album('a3', 'Violator', '1990-02-05'),
      album('a4', 'Memento Mori', '2023-03-24'),
      // Must be excluded from the spine — a 2011 compilation would otherwise
      // make a 1985 show look like it sat inside a 2011 album cycle.
      album('c1', 'The Best Of', '2011-01-01', { secondaryTypes: ['Compilation'] }),
      album('l1', 'One Night in Paris', '2002-01-01', { secondaryTypes: ['Live'] }),
      album('s1', 'Enjoy the Silence', '1990-01-15', { primaryType: 'Single' }),
    ],
  },
}

const topTracks = {
  'depeche-mode': {
    tracks: [
      { albumName: 'Violator (Deluxe)' },
      { albumName: 'Violator' },
      { albumName: 'Speak and Spell (Deluxe)' },
    ],
  },
}

const derive = (concerts: ReturnType<typeof concert>[], today = '2026-08-07') =>
  deriveAlbumEras({ concerts, discography, topTracks, aliases: {}, today } as never)

describe('studio album filtering', () => {
  it('excludes compilations, live albums and singles from the spine', () => {
    const out = derive([concert('c1', '1988-06-18')])
    const titles = out.artists['depeche-mode'].studioAlbums.map((a) => a.title)
    expect(titles).toEqual(['Speak & Spell', 'Music for the Masses', 'Violator', 'Memento Mori'])
  })

  it('sorts the spine by release date regardless of source order', () => {
    const out = derive([concert('c1', '1988-06-18')])
    const dates = out.artists['depeche-mode'].studioAlbums.map((a) => a.releaseDate)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('the slice contract', () => {
  it('albumsBefore indexes the spine so albumsAhead is a slice, not a copy', () => {
    const out = derive([concert('c1', '1988-06-18')])
    const era = out.concerts.c1
    const spine = out.artists['depeche-mode'].studioAlbums

    expect(era.albumsBefore).toBe(2)
    expect(era.albumsAfter).toBe(2)
    expect(spine.slice(era.albumsBefore).map((a) => a.title)).toEqual(['Violator', 'Memento Mori'])
    expect(era.albumsBefore + era.albumsAfter).toBe(spine.length)
  })

  it('names the record actually being toured', () => {
    const era = derive([concert('c1', '1988-06-18')]).concerts.c1
    expect(era.currentAlbum?.title).toBe('Music for the Masses')
    expect(era.daysSinceRelease).toBe(264)
    expect(era.cycleBucket).toBe('current')
  })
})

describe('pre-debut shows', () => {
  // The case that produced a published falsehood: careerYear went negative and
  // a generated post rendered -4 as "four years into their existence".
  const era = derive([concert('c1', '1979-05-01')]).concerts.c1

  it('emits no currentAlbum rather than reaching backwards', () => {
    expect(era.currentAlbum).toBeNull()
    expect(era.daysSinceRelease).toBeNull()
    expect(era.cycleBucket).toBeNull()
    expect(era.albumsBefore).toBe(0)
  })

  it('never reports a negative careerYear', () => {
    expect(era.careerYear).toBeNull()
    expect(era.yearsBeforeDebut).toBeGreaterThan(0)
  })

  it('still counts everything that was still to come', () => {
    expect(era.albumsAfter).toBe(4)
  })
})

describe('defining album', () => {
  it('picks the plurality album and carries the evidence with it', () => {
    const out = derive([concert('c1', '1988-06-18')])
    const defining = out.concerts.c1.definingAlbum
    // Two of three top tracks are Violator, once "(Deluxe)" is normalized away.
    expect(defining?.title).toBe('Violator')
    expect(defining?.topTrackCount).toBe(2)
    expect(defining?.topTrackTotal).toBe(3)
  })

  it('flags it as still ahead, with the gap in months', () => {
    const era = derive([concert('c1', '1988-06-18')]).concerts.c1
    expect(era.definingAlbumAhead).toBe(true)
    expect(era.definingAlbumMonthsAway).toBe(20)
  })

  it('is null when no album reaches a plurality of 2', () => {
    const out = deriveAlbumEras({
      concerts: [concert('c1', '1988-06-18')],
      discography,
      topTracks: { 'depeche-mode': { tracks: [{ albumName: 'Violator' }] } },
      aliases: {},
      today: '2026-08-07',
    } as never)
    expect(out.concerts.c1.definingAlbum).toBeNull()
    expect(out.concerts.c1.definingAlbumAhead).toBe(false)
  })
})

describe('eras seen', () => {
  it('groups repeat shows by the cycle they fell in', () => {
    const out = derive([
      concert('c1', '1988-06-18'),
      concert('c2', '1988-09-01'),
      concert('c3', '2023-03-28'),
    ])
    const eras = out.artists['depeche-mode'].erasSeen
    expect(eras.map((e) => e.title)).toEqual(['Music for the Masses', 'Memento Mori'])
    expect(eras[0].showCount).toBe(2)
  })
})

describe('future concerts', () => {
  it('ignores shows that have not happened yet', () => {
    const out = derive([concert('c1', '1988-06-18'), concert('c2', '2030-01-01')], '2026-08-07')
    expect(out.concerts.c1).toBeDefined()
    expect(out.concerts.c2).toBeUndefined()
  })
})

describe('stores nothing derivable', () => {
  it('omits cover URLs and album slugs from album refs', () => {
    // Both are pure functions of fields already present, and together they cost
    // ~180 KB. coverArtUrl(mbid) and normalizeAlbumName(title) replace them.
    const ref = derive([concert('c1', '1988-06-18')]).artists['depeche-mode'].studioAlbums[0]
    expect(ref).not.toHaveProperty('coverUrl')
    expect(ref).not.toHaveProperty('albumSlug')
    expect(Object.keys(ref).sort()).toEqual(['coverAvailable', 'mbid', 'releaseDate', 'title'])
  })
})
