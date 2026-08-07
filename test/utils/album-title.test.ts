/**
 * Album title normalizer contract tests.
 *
 * Every string here is real — taken from artists-top-tracks.json or
 * discography.json. The negative cases matter as much as the positive ones:
 * this matcher is specified to FAIL CLOSED, and a future change that "improves"
 * the match rate by guessing should break these.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §Part 1
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeAlbumTitle,
  stripQualifiers,
  dropLeadingArticle,
  isSingleOrEp,
  matchAlbumTitle,
} from '../../scripts/utils/album-title'

const album = (title: string) => ({ title })

describe('normalizeAlbumTitle — edition qualifiers', () => {
  it('strips a simple parenthetical edition marker', () => {
    expect(normalizeAlbumTitle('Violator (Deluxe)')).toBe('violator')
  })

  it('strips stacked qualifier groups', () => {
    expect(normalizeAlbumTitle('Garbage (20th Anniversary Edition) [2015 Remaster]')).toBe('garbage')
    expect(normalizeAlbumTitle('Hello Nasty (Deluxe Version) [Remastered]')).toBe('hello nasty')
  })

  it('strips the hyphen form', () => {
    expect(normalizeAlbumTitle('Rio - Deluxe Edition')).toBe('rio')
  })

  it('strips bonus-track and extended markers', () => {
    expect(normalizeAlbumTitle('Charmed Life (Bonus Track Version)')).toBe('charmed life')
    expect(normalizeAlbumTitle('Mange Tout (Extended Version)')).toBe('mange tout')
    expect(normalizeAlbumTitle('Songs From the Big Chair (Super Deluxe Edition)')).toBe(
      'songs from the big chair'
    )
  })

  it('strips feat. groups', () => {
    expect(normalizeAlbumTitle('Crowded House (feat. Lucie Silvas)')).toBe('crowded house')
  })
})

describe('normalizeAlbumTitle — character folding', () => {
  it('folds diacritics rather than deleting them', () => {
    expect(normalizeAlbumTitle('Honky Château (Bonus Track Version)')).toBe('honky chateau')
  })

  it('reconciles ampersand and the word "and" across sources', () => {
    // The iTunes/MusicBrainz disagreement that hid Depeche Mode's debut.
    expect(normalizeAlbumTitle('Speak and Spell (Deluxe)')).toBe(
      normalizeAlbumTitle('Speak & Spell')
    )
    expect(normalizeAlbumTitle('Echo & the Bunnymen (Bonus Tracks Edition) [2004 Remaster]')).toBe(
      'echo and the bunnymen'
    )
  })

  it('elides apostrophes instead of splitting the word', () => {
    expect(normalizeAlbumTitle("What's the Story")).toBe('whats the story')
  })
})

describe('normalizeAlbumTitle — title-bearing parentheticals survive', () => {
  it('keeps a leading parenthetical that is part of the title', () => {
    expect(normalizeAlbumTitle("(What's the Story) Morning Glory?")).toBe(
      'whats the story morning glory'
    )
  })

  it('keeps a trailing parenthetical that is an alternate title', () => {
    expect(normalizeAlbumTitle('Duran Duran (The Wedding Album)')).toBe(
      'duran duran the wedding album'
    )
  })

  it('keeps a soundtrack qualifier', () => {
    expect(stripQualifiers('Fifty Shades of Grey (Original Motion Picture Soundtrack)')).toContain(
      'Soundtrack'
    )
  })
})

describe('isSingleOrEp', () => {
  it('detects iTunes single and EP suffixes', () => {
    expect(isSingleOrEp('Abc (Alphabet Song) - Single')).toBe(true)
    expect(isSingleOrEp('Thoughtless (Remixes) - Single')).toBe(true)
  })

  it('does not flag an album whose title merely contains the word', () => {
    expect(isSingleOrEp('The Singles 86>98')).toBe(false)
    expect(isSingleOrEp('The Dirty Boogie')).toBe(false)
  })
})

describe('dropLeadingArticle', () => {
  it('removes a leading article', () => {
    expect(dropLeadingArticle('the dirty boogie')).toBe('dirty boogie')
    expect(dropLeadingArticle('a night at the opera')).toBe('night at the opera')
  })

  it('leaves a non-article first word alone', () => {
    expect(dropLeadingArticle('theatre of pain')).toBe('theatre of pain')
  })
})

describe('matchAlbumTitle — tiers', () => {
  const discography = [album('Violator'), album('Speak & Spell'), album('Music for the Masses')]

  it('matches exactly after normalization', () => {
    const hit = matchAlbumTitle('Violator (Deluxe)', discography)
    expect(hit?.album.title).toBe('Violator')
    expect(hit?.tier).toBe('exact')
  })

  it('matches across the ampersand/word boundary', () => {
    const hit = matchAlbumTitle('Speak and Spell (Deluxe)', discography)
    expect(hit?.album.title).toBe('Speak & Spell')
    expect(hit?.tier).toBe('exact')
  })

  it('matches article-insensitively', () => {
    const hit = matchAlbumTitle('Dirty Boogie', [album('The Dirty Boogie')])
    expect(hit?.album.title).toBe('The Dirty Boogie')
    expect(hit?.tier).toBe('article')
  })

  it('does not fall back to substring matching', () => {
    // A prefix tier was measured and removed — see the note in album-title.ts.
    expect(matchAlbumTitle('Memento Mori: Mexico City Edition', [album('Memento Mori')])).toBeNull()
  })
})

describe('matchAlbumTitle — FAIL CLOSED', () => {
  // Real contamination from artists-top-tracks.json (#275). A fuzzier matcher
  // would bind these to something and fabricate a claim in a liner note.
  it('returns null for a wrong-artist album, rather than guessing', () => {
    const badReligion = [
      album('Stranger Than Fiction'),
      album('Suffer'),
      album('No Control'),
      album('Against the Grain'),
    ]
    expect(matchAlbumTitle('channel ORANGE', badReligion)).toBeNull()
  })

  it('returns null for an unrelated album', () => {
    expect(matchAlbumTitle('Schmilco', [album('Violator')])).toBeNull()
    expect(matchAlbumTitle('Start Singing with Barney', [album('The Lexicon of Love')])).toBeNull()
  })

  it('never matches a studio album to a live album of the same name', () => {
    // Real case: prefix matching bound Gary Numan's "Replicas" to "Replicas Live".
    expect(matchAlbumTitle('Replicas (1998 Remaster)', [album('Replicas Live')])).toBeNull()
  })

  it('never collapses distinct self-titled or numbered releases', () => {
    // Real case: The Bronx titled four different albums "The Bronx"; Peter
    // Gabriel's first four are all self-titled. Substring similarity merges
    // records that are not the same record.
    const bronx = [album('The Bronx')]
    expect(matchAlbumTitle('The Bronx (I)', bronx)).toBeNull()
    expect(matchAlbumTitle('The Bronx (IV)', bronx)).toBeNull()
    expect(matchAlbumTitle('Peter Gabriel 1: Car (Remastered)', [album('Peter Gabriel')])).toBeNull()
  })

  it('returns null for an empty or whitespace title', () => {
    expect(matchAlbumTitle('', [album('Violator')])).toBeNull()
    expect(matchAlbumTitle('   ', [album('Violator')])).toBeNull()
  })

  it('returns null against an empty candidate list', () => {
    expect(matchAlbumTitle('Violator', [])).toBeNull()
  })
})
