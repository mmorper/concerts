import { describe, it, expect } from 'vitest'
import type { Concert } from '@/types/concert'
import mediaIndex from '../../../public/data/media-index.json'
import { indexConcerts } from '@/hooks/useArchiveData'
import { buildMediaIndex, EMPTY_MEDIA, type MediaAsset } from './media'
import { CLIP_PROMPT } from './prompts'
import { buildSearchEntries, fold, MATCH_LIMIT, searchArchive, type SearchSources, type SongRow } from './search'

const concert = (over: Partial<Concert>): Concert =>
  ({
    id: 'c',
    date: '2023-05-24',
    year: 2023,
    headliner: 'The Cure',
    headlinerNormalized: 'the-cure',
    venue: 'Hollywood Bowl',
    venueNormalized: 'hollywood-bowl',
    cityState: 'Los Angeles, California',
    openers: [],
    ...over,
  }) as Concert

const song = (over: Partial<SongRow>): SongRow => ({
  name: 'Lullaby',
  act: 'The Cure',
  slug: 'the-cure',
  count: 2,
  lastDate: '2023-05-24',
  ...over,
})

function entriesFor(concerts: Concert[], over: Partial<SearchSources> = {}) {
  const { byArtist, byVenue } = indexConcerts(concerts)
  return buildSearchEntries({ byArtist, byVenue, artists: {}, venues: {}, media: EMPTY_MEDIA, songs: [], ...over })
}

const clip: MediaAsset = {
  kind: 'video',
  url: 'https://media.example/videos/2023-05-24-the-cure-01.mp4',
  date: '2023-05-24',
  artist: 'The Cure',
  artistNormalized: 'the-cure',
  subject: 'artist',
  song: 'A Forest',
}

describe('fold', () => {
  it('ignores accents, case and punctuation', () => {
    expect(fold('Motörhead')).toBe('motorhead')
    expect(fold("Guns N' Roses")).toBe('guns n roses')
    expect(fold('9:30 Club')).toBe('9 30 club')
    expect(fold('Echo & the Bunnymen')).toBe('echo and the bunnymen')
  })
})

describe('searchArchive', () => {
  const entries = entriesFor([concert({})])

  it('waits for two characters', () => {
    expect(searchArchive(entries, 'c')).toEqual([])
    expect(searchArchive(entries, '  ')).toEqual([])
  })

  it('finds a band past its "The"', () => {
    expect(searchArchive(entries, 'cure')[0].name).toBe('The Cure')
    expect(searchArchive(entries, 'the cure')[0].name).toBe('The Cure')
  })

  it('finds a venue and a year, each with its own link', () => {
    expect(searchArchive(entries, 'bowl')[0]).toMatchObject({ kind: 'venue', href: '/?scene=venues&venue=hollywood-bowl' })
    expect(searchArchive(entries, '2023')[0]).toMatchObject({ kind: 'year', sub: '1 show' })
  })

  it('finds a name typed without its punctuation or spaces', () => {
    const club = entriesFor([concert({ venue: '9:30 Club', venueNormalized: '9-30-club' })])
    expect(searchArchive(club, '930')[0].name).toBe('9:30 Club')
  })

  it('finds an opener under their own name, not the headliner', () => {
    const bill = entriesFor([concert({ openers: ['Mogwai'] })])
    expect(searchArchive(bill, 'mogwai')[0]).toMatchObject({ kind: 'band', name: 'Mogwai', href: '/?scene=artists&artist=mogwai' })
  })

  it('puts a name that starts with the query above one that contains it', () => {
    const shows = [
      concert({ id: 'a', headliner: 'Secure', headlinerNormalized: 'secure', venueNormalized: 'x', venue: 'X' }),
      concert({ id: 'b' }),
    ]
    expect(searchArchive(entriesFor(shows), 'cure').map((e) => e.name)[0]).toBe('The Cure')
  })

  it('puts the act with media first among equals', () => {
    const shows = [
      concert({ id: 'a', headliner: 'Curve', headlinerNormalized: 'curve', venueNormalized: 'x', venue: 'X' }),
      concert({ id: 'b', date: '2023-05-25' }),
      concert({ id: 'c', date: '2023-05-26', headliner: 'Curve', headlinerNormalized: 'curve', venueNormalized: 'x', venue: 'X' }),
    ]
    const media = buildMediaIndex([clip])
    expect(searchArchive(entriesFor(shows, { media }), 'cu')[0].name).toBe('The Cure')
  })

  it('never lets songs fill the list', () => {
    const songs = Array.from({ length: 12 }, (_, i) => song({ name: `Curious ${i}`, slug: 'x', count: 12 - i }))
    const hits = searchArchive(entriesFor([concert({})], { songs }), 'cu')
    expect(hits.length).toBeLessThanOrEqual(MATCH_LIMIT)
    expect(hits.filter((e) => e.kind === 'song')).toHaveLength(3)
    expect(hits[0].name).toBe('The Cure')
  })
})

describe('buildSearchEntries', () => {
  it('counts an act\'s shows, photos and clips', () => {
    const media = buildMediaIndex([clip])
    const [band] = searchArchive(entriesFor([concert({})], { media }), 'cure')
    expect(band.sub).toBe('1 show · 1 clip')
  })

  it('sends a song I heard to the last night I heard it', () => {
    const [hit] = searchArchive(entriesFor([concert({})], { songs: [song({})] }), 'lullaby')
    expect(hit).toMatchObject({
      kind: 'song',
      sub: 'The Cure, heard 2 times',
      href: '/?scene=artists&artist=the-cure&show=2023-05-24',
    })
  })

  it('sends a filmed song to its clip, and lists it once', () => {
    const media = buildMediaIndex([clip])
    const songs = [song({ name: 'A Forest' })]
    const hits = searchArchive(entriesFor([concert({})], { media, songs }), 'forest')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ kind: 'clip', sub: 'The Cure, 2023' })
    expect(hits[0].href).toContain('photo=the-cure-01-video')
  })

  it('keeps a cover of a filmed song as its own row', () => {
    const media = buildMediaIndex([clip])
    const songs = [song({ name: 'A Forest', act: 'Tribute', slug: 'tribute' })]
    expect(searchArchive(entriesFor([concert({})], { media, songs }), 'forest')).toHaveLength(2)
  })
})

describe('the clip prompt', () => {
  it('names an act with a published clip', () => {
    const clips = (mediaIndex.assets as MediaAsset[]).filter((a) => a.kind === 'video' && a.artistNormalized === CLIP_PROMPT.act)
    expect(clips.length).toBeGreaterThan(0)
  })
})
