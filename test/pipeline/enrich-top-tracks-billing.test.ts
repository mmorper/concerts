/**
 * Tests for the artist-billing filter in scripts/enrich-top-tracks.ts (#275).
 *
 * Every case here is a real result the iTunes API returned for a real artist in
 * this archive. The bug they cover is silent: a wrong-artist track is
 * well-formed, has a working preview, and clears the quality bar. Its only
 * symptom is an album name that will not match the artist's discography, which
 * reads downstream as missing data rather than wrong data.
 */

import { describe, it, expect } from 'vitest'
import { keepTracksBilledTo } from '../../scripts/enrich-top-tracks.ts'
import type { NormalizedTrack } from '../../scripts/utils/itunes-client.ts'

/** A track carrying only the fields the filter reads. */
const track = (name: string, artistName: string, albumName = 'Album'): NormalizedTrack => ({
  name,
  artistName,
  artistId: 1,
  albumName,
  previewUrl: 'https://example.test/preview.m4a',
  durationMs: 180_000,
  albumArt: 'https://example.test/art.jpg',
  streamingUrl: 'https://example.test/track',
})

describe('keepTracksBilledTo', () => {
  it('drops one impostor without discarding the genuine tracks', () => {
    // Bad Religion's real result: four of theirs, plus Frank Ocean's channel
    // ORANGE. A majority rule keeps the bad track; unanimity throws away four
    // good ones. Neither is right.
    const { kept, dropped, sawInstead } = keepTracksBilledTo('Bad Religion', [
      track('Infected', 'Bad Religion', 'Stranger Than Fiction'),
      track('Sorrow', 'Bad Religion', 'The Process of Belief'),
      track('Thinkin Bout You', 'Frank Ocean', 'channel ORANGE'),
      track('American Jesus', 'Bad Religion', 'Recipe for Hate'),
      track('You', 'Bad Religion', 'No Control'),
    ])

    expect(kept).toHaveLength(4)
    expect(kept.map(t => t.albumName)).not.toContain('channel ORANGE')
    expect(dropped).toHaveLength(1)
    expect(sawInstead).toBe('Frank Ocean')
  })

  it('drops a guest credit even when the artist ID is pinned', () => {
    // The Lookup API is exact about the artist and still returns compilations
    // they appear on. A record he plays on is not a record he made.
    const { kept, dropped } = keepTracksBilledTo('Chris Shiflett', [
      track('This Ol’ World', 'Chris Shiflett', 'Hard Lessons'),
      track('Goin’ Nowhere (feat. Chris Shiflett)', 'HIXTAPE, HARDY & Morgan Wallen', 'HIXTAPE: Vol. 2'),
    ])

    expect(kept).toHaveLength(1)
    expect(dropped[0].albumName).toBe('HIXTAPE: Vol. 2')
  })

  it('reports the most common impostor when the whole artist is wrong', () => {
    // "ABC" matched children's alphabet songs; "The Reflex" matched Duran
    // Duran's song of that name. Short, common names lose to the catalogue.
    const { kept, sawInstead } = keepTracksBilledTo('The Reflex', [
      track('The Reflex', 'Duran Duran', 'Seven and the Ragged Tiger'),
      track('The Reflex (Dance Mix)', 'Duran Duran', 'Seven and the Ragged Tiger'),
      track('The Reflex (Single Mix)', 'Duran Duran', 'Greatest'),
    ])

    expect(kept).toHaveLength(0)
    expect(sawInstead).toBe('Duran Duran')
  })

  it('keeps a track where the artist is one of several credited', () => {
    // "Get Lucky" is Nile Rodgers' most-played track and iTunes bills it to all
    // three credited artists. Exact-billing matching left him with nothing.
    const { kept } = keepTracksBilledTo('Nile Rodgers', [
      track('Get Lucky', 'Daft Punk, Pharrell Williams & Nile Rodgers', 'Random Access Memories'),
      track('Le Freak', 'Kid Congo Powers & Sally Norvell', 'Fever'),
    ])

    expect(kept).toHaveLength(1)
    expect(kept[0].name).toBe('Get Lucky')
  })

  it('matches whole tokens, so a shorter name does not match a longer one', () => {
    // "Common" and "Common Sense" are different artists — both in this archive's
    // orbit, and substring matching would collapse them.
    expect(keepTracksBilledTo('Common', [track('Summertime', 'Common Sense')]).kept).toHaveLength(0)
    expect(keepTracksBilledTo('Berlin', [track('Berlin', 'RY X')]).kept).toHaveLength(0)
  })

  it('accepts any known billing of the same act', () => {
    // iTunes files OMD under the full name — exactly the case the
    // discographyKeys relation in artist-aliases.json exists to record.
    const { kept } = keepTracksBilledTo(['OMD', 'orchestral-manoeuvres-in-the-dark'], [
      track('Enola Gay', 'Orchestral Manoeuvres In the Dark', 'Organisation'),
    ])

    expect(kept).toHaveLength(1)
  })

  it('matches through the same folding the rest of the pipeline uses', () => {
    // foldArtistName handles diacritics, ampersands and leading articles, so
    // the filter must not reject a legitimate spelling difference.
    expect(keepTracksBilledTo('Hüsker Dü', [track('Celebrated Summer', 'Husker Du')]).kept).toHaveLength(1)
    expect(keepTracksBilledTo('Simon & Garfunkel', [track('America', 'Simon and Garfunkel')]).kept).toHaveLength(1)
    expect(keepTracksBilledTo('The Go-Go’s', [track('Vacation', 'The Go-Go’s')]).kept).toHaveLength(1)
  })

  it('resolves against the search name, so an alias is not treated as drift', () => {
    // SEARCH_ALIASES redirects "Brian Setzer '68 Comeback Special" to "Brian
    // Setzer" on purpose. The filter compares against the name actually
    // searched, or every aliased artist would be rejected.
    const { kept } = keepTracksBilledTo('Brian Setzer', [
      track('Rock This Town', 'Brian Setzer', 'The Dirty Boogie'),
    ])

    expect(kept).toHaveLength(1)
  })

  it('returns nothing and blames nobody for an empty response', () => {
    const { kept, dropped, sawInstead } = keepTracksBilledTo('Nobody', [])

    expect(kept).toHaveLength(0)
    expect(dropped).toHaveLength(0)
    expect(sawInstead).toBeNull()
  })
})
