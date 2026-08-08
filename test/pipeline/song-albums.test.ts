/**
 * Tests for the Tier 1 song → album index in scripts/resolve-song-albums.ts.
 *
 * The v5.4 post-mortem found its core derivation shipped with no unit tests at
 * all — the logic was right, it simply was not covered. This is the equivalent
 * derivation for v5.5, so it is covered before the backfill, not after.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §Part 2
 */

import { describe, it, expect } from 'vitest'
import { buildSongIndex, type StudioAlbum } from '../../scripts/resolve-song-albums.ts'

const album = (mbid: string, title: string, releaseDate: string): StudioAlbum => ({
  mbid,
  title,
  releaseDate,
  coverAvailable: true,
})

describe('buildSongIndex', () => {
  it('attributes a song to the album carrying it', () => {
    const albums = [album('rg-violator', 'Violator', '1990-03-19')]
    const index = buildSongIndex(albums, () => ['Enjoy the Silence', 'Personal Jesus'])

    expect(index.get('enjoy the silence')?.title).toBe('Violator')
    expect(index.get('personal jesus')?.title).toBe('Violator')
  })

  it('prefers the EARLIEST album when a song appears on several', () => {
    // A re-recording on a later record must not win. "road-tested" compares a
    // show date against this release date, so taking the later album would
    // turn "heard two years before the record" into "heard after it."
    const albums = [
      album('rg-late', 'Greatest Re-Recordings', '2011-01-01'),
      album('rg-early', 'The Original Record', '1985-06-01'),
    ]
    const index = buildSongIndex(albums, () => ['The Song'])

    expect(index.get('the song')?.title).toBe('The Original Record')
    expect(index.get('the song')?.releaseDate).toBe('1985-06-01')
  })

  it('is order-independent — the earliest wins whichever way the list arrives', () => {
    const early = album('rg-early', 'First', '1980-01-01')
    const late = album('rg-late', 'Second', '1995-01-01')
    const tracks = () => ['Shared Song']

    expect(buildSongIndex([early, late], tracks).get('shared song')?.title).toBe('First')
    expect(buildSongIndex([late, early], tracks).get('shared song')?.title).toBe('First')
  })

  it('indexes each component of a merged track title', () => {
    // MusicBrainz pressings merge hidden interludes into one track title.
    // Without splitting, Violator's most famous song misses its own album.
    const albums = [album('rg-violator', 'Violator', '1990-03-19')]
    const index = buildSongIndex(albums, () => ['Enjoy the Silence / Interlude #2: Crucified'])

    expect(index.get('enjoy the silence')?.title).toBe('Violator')
    expect(index.get('interlude 2 crucified')?.title).toBe('Violator')
  })

  it('matches across the spelling differences between the two sources', () => {
    const albums = [album('rg-ss', 'Speak & Spell', '1981-11-05')]
    const index = buildSongIndex(albums, () => ['Just Can’t Get Enough'])

    // setlist.fm writes the straight apostrophe; MusicBrainz the curly one.
    expect(index.get('just cant get enough')?.title).toBe('Speak & Spell')
  })

  it('returns an empty index when no release-group has tracks', () => {
    // A cache miss or a release-group with no usable release is normal, not an
    // error. Every song for that artist stays unattributed.
    const albums = [album('rg-a', 'A', '1990-01-01'), album('rg-b', 'B', '1992-01-01')]
    const index = buildSongIndex(albums, () => [])

    expect(index.size).toBe(0)
  })

  it('never invents a match for a song that is on no studio album', () => {
    // The negative case that matters: a B-side or live-only song must resolve
    // to nothing rather than the nearest thing. There is no fuzzy tier and
    // there must never be one.
    const albums = [album('rg-violator', 'Violator', '1990-03-19')]
    const index = buildSongIndex(albums, () => ['Enjoy the Silence'])

    expect(index.get('enjoy the silence')).toBeDefined()
    expect(index.get('enjoy the silences')).toBeUndefined()
    expect(index.get('enjoy silence')).toBeUndefined()
    expect(index.get('personal jesus')).toBeUndefined()
  })

  it('only indexes albums it is given — a compilation never enters the pipeline', () => {
    // studioAlbums arrives from album-eras.json already filtered by
    // isStudioAlbum, which also consults RELEASE_EXCLUSIONS. A song that only
    // exists on a greatest-hits package is therefore unreachable by
    // construction rather than by a rule enforced here.
    const studioOnly = [album('rg-studio', 'The Studio Album', '1988-01-01')]
    const index = buildSongIndex(studioOnly, mbid =>
      mbid === 'rg-studio' ? ['Album Track'] : ['Compilation Exclusive']
    )

    expect(index.get('album track')).toBeDefined()
    expect(index.get('compilation exclusive')).toBeUndefined()
  })
})
