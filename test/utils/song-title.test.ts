/**
 * Tests for scripts/utils/song-title.ts
 *
 * Every string here is real — taken from setlists-cache.json or from a
 * MusicBrainz track listing fetched during the v5.5 backfill. The negative
 * cases are the important ones: this module is specified to FAIL CLOSED, and a
 * wrongly attributed song becomes a first-person claim that the archive owner
 * heard something they did not.
 */

import { describe, it, expect } from 'vitest'
import { foldSongTitle, splitMedley, songIndexKeys, stripSongQualifiers } from '../../scripts/utils/song-title.ts'

describe('foldSongTitle', () => {
  it('folds typographic apostrophes so the two sources compare equal', () => {
    // setlist.fm writes a straight quote, MusicBrainz a curly one.
    expect(foldSongTitle("Just Can't Get Enough")).toBe('just cant get enough')
    expect(foldSongTitle('Just Can’t Get Enough')).toBe('just cant get enough')
  })

  it('folds diacritics without deleting the base letter', () => {
    expect(foldSongTitle('Café Bleu')).toBe('cafe bleu')
    expect(foldSongTitle('Björk Song')).toBe('bjork song')
  })

  it('normalizes ampersands to match either spelling', () => {
    expect(foldSongTitle('Salt & Pepper')).toBe('salt and pepper')
    expect(foldSongTitle('Salt and Pepper')).toBe('salt and pepper')
  })

  it('strips version qualifiers that describe a rendering, not a song', () => {
    expect(foldSongTitle('Behind the Wheel (Shave the Monkey remix)')).toBe('behind the wheel')
    expect(foldSongTitle('Highway to Hell (Live)')).toBe('highway to hell')
    expect(foldSongTitle('Blasphemous Rumours - 2006 Remaster')).toBe('blasphemous rumours')
    expect(foldSongTitle('Love Song (feat. Someone)')).toBe('love song')
  })

  it('KEEPS "with" when it is part of the title (#689)', () => {
    // A bare "with" is one of the commonest words in song titles. Treating it as
    // a featured-artist credit truncated 22 setlist titles, three to nothing.
    expect(foldSongTitle('Dancing With Myself')).toBe('dancing with myself')
    expect(foldSongTitle('She Blinded Me With Science')).toBe('she blinded me with science')
    expect(foldSongTitle('With or Without You')).toBe('with or without you')
    expect(foldSongTitle('With Any Sort of Certainty')).toBe('with any sort of certainty')
  })

  it('keeps two different "with" songs by one act apart (#689)', () => {
    // Under the old rule both folded to "dance".
    expect(foldSongTitle('Dance With Me')).not.toBe(foldSongTitle('Dance With the Lemurs'))
    expect(foldSongTitle('Dancing With Myself')).not.toBe(foldSongTitle('Dancing With Tears in My Eyes'))
  })

  it('still strips featured-artist credits in their three real shapes (#689)', () => {
    // bracketed
    expect(foldSongTitle('Song (with Someone)')).toBe('song')
    expect(foldSongTitle('Song [feat. Someone]')).toBe('song')
    // after a spaced dash
    expect(foldSongTitle('Song - with Someone')).toBe('song')
    expect(foldSongTitle('Song - feat. Someone')).toBe('song')
    // bare, but only feat. / ft. / featuring
    expect(foldSongTitle('Song feat. Someone')).toBe('song')
    expect(foldSongTitle('Song ft. Someone')).toBe('song')
    expect(foldSongTitle('Song featuring Someone')).toBe('song')
    // stacked with a version marker
    expect(foldSongTitle('Halo (feat. X) [2006 Remaster]')).toBe('halo')
  })

  it('never folds a real title to nothing (#689)', () => {
    for (const t of ['With or Without You', 'With a Little Help from My Friends', 'Featuring You']) {
      expect(foldSongTitle(t)).not.toBe('')
    }
  })

  it('strips stacked qualifiers in one pass', () => {
    expect(foldSongTitle('Halo (Goldfrapp remix) [2006 Remaster]')).toBe('halo')
  })

  it('KEEPS title-bearing leading parentheticals', () => {
    // Blanket-stripping parentheticals destroys these titles outright.
    expect(foldSongTitle("(Don't Fear) The Reaper")).toBe('dont fear the reaper')
    expect(foldSongTitle('(I Can’t Get No) Satisfaction')).toBe('i cant get no satisfaction')
  })

  it('KEEPS "reprise", which names a distinct track', () => {
    // A reprise can sit on the same record as the song it reprises. Folding
    // them together would attribute a performance to the wrong track.
    expect(foldSongTitle('Encore (Reprise)')).toBe('encore reprise')
    expect(foldSongTitle('Encore')).toBe('encore')
    expect(foldSongTitle('Encore (Reprise)')).not.toBe(foldSongTitle('Encore'))
  })

  it('returns empty for empty input rather than guessing', () => {
    expect(foldSongTitle('')).toBe('')
    expect(foldSongTitle('   ')).toBe('')
  })
})

describe('splitMedley', () => {
  it('splits a merged track title into its component songs', () => {
    // Violator's canonical nine tracks arrive from MusicBrainz with hidden
    // interludes merged in. Without splitting, "Enjoy the Silence" does not
    // match the album it is famously on.
    expect(splitMedley('Enjoy the Silence / Interlude #2: Crucified')).toEqual([
      'Enjoy the Silence',
      'Interlude #2: Crucified',
    ])
  })

  it('leaves an unslashed title alone', () => {
    expect(splitMedley('Personal Jesus')).toEqual(['Personal Jesus'])
  })

  it('does NOT split an unspaced slash', () => {
    // "AC/DC" and "24/7" are single tokens, not two songs.
    expect(splitMedley('AC/DC Tribute')).toEqual(['AC/DC Tribute'])
    expect(splitMedley('24/7')).toEqual(['24/7'])
  })
})

describe('songIndexKeys', () => {
  it('indexes every component of a merged title', () => {
    expect(songIndexKeys('Enjoy the Silence / Interlude #2: Crucified')).toEqual([
      'enjoy the silence',
      'interlude 2 crucified',
    ])
  })

  it('de-duplicates components that fold identically', () => {
    expect(songIndexKeys('Halo / Halo (Live)')).toEqual(['halo'])
  })

  it('drops components that fold to nothing', () => {
    expect(songIndexKeys('Personal Jesus / ---')).toEqual(['personal jesus'])
  })
})

describe('stripSongQualifiers', () => {
  it('is idempotent — folding an already-folded title changes nothing', () => {
    const once = stripSongQualifiers('Behind the Wheel (Remix)')
    expect(stripSongQualifiers(once)).toBe(once)
  })
})
