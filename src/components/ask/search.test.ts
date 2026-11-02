import { describe, it, expect } from 'vitest'
import type { Concert } from '@/types/concert'
import { indexConcerts } from '@/hooks/useArchiveData'
import { buildMediaIndex, EMPTY_MEDIA, type MediaAsset } from './media'
import { buildSearchEntries, fold, MATCH_LIMIT, readSongIndex, searchArchive, songAnswer, type SearchSources, type SongRow } from './search'

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
  dates: ['2023-05-24', '1989-08-03'],
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
    const songs = Array.from({ length: 12 }, (_, i) => song({ name: `Curious ${i}`, slug: 'x', dates: Array(12 - i).fill('2020-01-01') }))
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

  it('carries the song for its card, and links a new tab to the last night', () => {
    const lullaby = song({})
    const [hit] = searchArchive(entriesFor([concert({})], { songs: [lullaby] }), 'lullaby')
    expect(hit).toMatchObject({
      kind: 'song',
      sub: 'The Cure, heard 2 times',
      href: '/?scene=artists&artist=the-cure&show=2023-05-24',
      song: lullaby,
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

describe('readSongIndex', () => {
  it('looks up each song\'s record by its position', () => {
    const disintegration = { mbid: 'm1', title: 'Disintegration', releaseDate: '1989-05-02', coverAvailable: true }
    const rows = readSongIndex({
      songs: [
        { name: 'Lullaby', act: 'The Cure', slug: 'the-cure', dates: ['2023-05-24'], album: 0 },
        { name: 'Untitled', act: 'The Cure', slug: 'the-cure', dates: ['2023-05-24'] },
      ],
      albums: [disintegration],
    })
    expect(rows.map((r) => r.album)).toEqual([disintegration, undefined])
  })

  it('reads a missing file as no songs', () => {
    expect(readSongIndex({})).toEqual([])
  })
})

describe('songAnswer', () => {
  it('asks the song and answers with every night, newest first', () => {
    const { question, prose, exhibit } = songAnswer(song({}))
    expect(question).toBe('Lullaby')
    expect(prose).toBe('I heard The Cure play “Lullaby” 2 times, first in 1989 and last in 2023.')
    expect(exhibit).toEqual({
      kind: 'song',
      title: 'Lullaby',
      artist: { entity: 'artist', slug: 'the-cure', name: 'The Cure', deepLink: '/?scene=artists&artist=the-cure' },
      dates: ['2023-05-24', '1989-08-03'],
      album: null,
    })
  })

  it('says once, with the date, for a song heard one night', () => {
    expect(songAnswer(song({ dates: ['2023-05-24'] })).prose).toBe('I heard The Cure play “Lullaby” once, on May 24, 2023.')
  })

  it('says so when every night fell in one year', () => {
    expect(songAnswer(song({ dates: ['2023-05-25', '2023-05-24'] })).prose).toContain('2 times, all in 2023')
  })
})
