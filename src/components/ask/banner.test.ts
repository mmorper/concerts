import { describe, it, expect } from 'vitest'
import { bannerDeck, localDay, FAMILIAR_SHOWS, type BannerSources } from './banner'
import { buildMediaIndex, type MediaAsset } from './media'
import type { SearchEntry } from './search'
import type { Concert } from '@/types/concert'

const wide = { width: 3000, height: 2000 }
const photo = (date: string, act: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({
  kind: 'image',
  url: `/p/${date}-${act}-${extra.order ?? 0}.jpg`,
  date,
  artist: act,
  artistNormalized: act,
  subject: 'artist',
  ...wide,
  ...extra,
})
const clip = (date: string, act: string, song: string | null, poster: string | null = '/poster.jpg'): MediaAsset => ({
  kind: 'video',
  url: `/v/${date}-${act}.mp4`,
  date,
  artist: act,
  artistNormalized: act,
  subject: 'artist',
  song,
  poster,
  duration: 29.6,
})
const entry = (kind: SearchEntry['kind'], name: string, shows: number, extra: Partial<SearchEntry> = {}): SearchEntry =>
  ({ kind, name, sub: '', href: '', media: 0, shows, fold: '', squashed: '', ...extra }) as SearchEntry

const nights: Record<string, { venue: string; headliner: string }> = {
  '2017-10-12': { venue: 'The Forum', headliner: 'Foo Fighters' },
  '2017-06-01': { venue: 'Hollywood Bowl', headliner: 'Duran Duran' },
  '2023-06-04': { venue: 'Hollywood Bowl', headliner: 'The Cure' },
  '1999-01-01': { venue: 'The Roxy', headliner: 'Solo' },
}

function sources(assets: MediaAsset[], entries: SearchEntry[], counts: Record<string, number> = {}, concerts: Concert[] = []): BannerSources {
  const media = buildMediaIndex(assets)
  return {
    concerts,
    media,
    searchEntries: entries,
    concertByDate: (d) => (nights[d] ? { ...nights[d], headlinerNormalized: '' } : null),
    artistFacts: (slug) => ({ count: counts[slug] ?? 0, firstYear: 1990, lastYear: 2024, meta: { image: `/img/${slug}.jpg` } }),
  }
}

const show = (date: string, headliner: string, venue = 'The Forum', openers: string[] = []): Concert =>
  ({
    id: `${date}-${headliner}`,
    date,
    year: Number(date.slice(0, 4)),
    headliner,
    headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    venue,
    venueNormalized: venue.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    cityState: 'Inglewood, California',
    genre: 'Rock',
    openers,
  }) as unknown as Concert

describe('bannerDeck — the ⌘K banner ideas', () => {
  it('makes a clip idea that opens the clip, named for the song, act, room and year', () => {
    const deck = bannerDeck(sources([clip('2023-06-04', 'the-cure', 'A Forest')], []), '2026-11-02')
    expect(deck).toHaveLength(1)
    expect(deck[0]).toMatchObject({ kind: 'clip', kicker: 'A clip · 30 sec', title: 'A Forest', sub: 'the-cure at Hollywood Bowl, 2023' })
    expect(deck[0].href).toContain('artist=the-cure')
    expect(deck[0].question).toBeUndefined()
  })

  it('leaves out a clip with no song or no poster', () => {
    const deck = bannerDeck(sources([clip('2023-06-04', 'the-cure', null), clip('2017-06-01', 'duran-duran', 'Rio', null)], []), '2026-11-02')
    expect(deck).toEqual([])
  })

  it('makes a year idea from a photographed year, asking what I saw', () => {
    const assets = [photo('2017-06-01', 'duran-duran'), photo('2017-10-12', 'foo-fighters', { hero: true })]
    const deck = bannerDeck(sources(assets, [entry('year', '2017', 12)]), '2026-11-02')
    expect(deck[0]).toMatchObject({
      kind: 'year',
      title: '2017',
      sub: '12 shows, including Foo Fighters and Duran Duran',
      question: 'What did you see in 2017?',
    })
    expect(deck[0].photo?.date).toBe('2017-10-12') // the hero leads
  })

  it('names the one show of a one-show year', () => {
    const deck = bannerDeck(sources([photo('1999-01-01', 'solo')], [entry('year', '1999', 1)]), '2026-11-02')
    expect(deck[0].sub).toBe('Solo at The Roxy')
  })

  it('skips a year with no photo, and a portrait frame the wide banner would slice', () => {
    const tall = photo('2017-06-01', 'duran-duran', { width: 2000, height: 3000 })
    const deck = bannerDeck(sources([tall], [entry('year', '2017', 12), entry('year', '1984', 3)]), '2026-11-02')
    expect(deck).toEqual([])
  })

  it('makes a familiar face only for an act seen enough times, preferring the signature frame', () => {
    const cure = [photo('2023-06-04', 'the-cure', { order: 0 }), photo('2023-06-04', 'the-cure', { order: 1, signature: true })]
    const one = [photo('2017-06-01', 'duran-duran')]
    const entries = [
      entry('band', 'The Cure', 6, { photo: buildMediaIndex(cure).byArtist.get('the-cure')![0] }),
      entry('band', 'Duran Duran', 1, { photo: buildMediaIndex(one).byArtist.get('duran-duran')![0] }),
    ]
    const deck = bannerDeck(sources([...cure, ...one], entries, { 'the-cure': 6, 'duran-duran': FAMILIAR_SHOWS - 1 }), '2026-11-02')
    expect(deck).toHaveLength(1)
    expect(deck[0]).toMatchObject({ kind: 'act', title: 'The Cure', sub: '6 shows, from 1990 to 2024', question: 'How many times have you seen The Cure?', act: 'the-cure' })
    expect(deck[0].photo?.signature).toBe(true)
  })

  it('takes turns between kinds, holds every idea once, and is the same all day', () => {
    const assets = [
      clip('2023-06-04', 'the-cure', 'A Forest'),
      clip('2017-06-01', 'duran-duran', 'Rio'),
      photo('2017-06-01', 'duran-duran'),
      photo('1999-01-01', 'solo'),
    ]
    const entries = [entry('year', '2017', 12), entry('year', '1999', 1)]
    const deck = bannerDeck(sources(assets, entries), '2026-11-02')
    expect(deck.map((i) => i.kind)).toEqual(['clip', 'year', 'clip', 'year'])
    expect(new Set(deck.map((i) => i.key)).size).toBe(4)
    expect(bannerDeck(sources(assets, entries), '2026-11-02').map((i) => i.key)).toEqual(deck.map((i) => i.key))
  })
})

describe('bannerDeck — a show on this date leads', () => {
  const day = '2026-11-02'

  it('leads with a show from this date, asking what I saw on this day', () => {
    const concerts = [show('1988-11-02', 'Depeche Mode', 'The Rose Bowl')]
    const deck = bannerDeck(sources([clip('2023-06-04', 'the-cure', 'A Forest')], [], {}, concerts), day)
    expect(deck.map((i) => i.kind)).toEqual(['today', 'clip'])
    expect(deck[0]).toMatchObject({
      kicker: '38 years ago tonight',
      title: 'Depeche Mode',
      sub: 'The Rose Bowl · Inglewood, California',
      question: 'What did you see on this day?',
      aboutDate: '1988-11-02',
    })
  })

  it('says one year, and leaves out a show from this year or a later one', () => {
    const concerts = [show('2025-11-02', 'David Byrne'), show('2026-11-02', 'Tonight'), show('2027-11-02', 'Next Year')]
    const deck = bannerDeck(sources([], [], {}, concerts), day)
    expect(deck.map((i) => [i.title, i.kicker])).toEqual([['David Byrne', 'One year ago tonight']])
  })

  it('prefers a photographed night over a higher-scoring one', () => {
    // 1986 is a 40th, which scores far higher. The 2019 night has my photo.
    const concerts = [show('1986-11-02', 'Big Anniversary'), show('2019-11-02', 'Photographed')]
    const deck = bannerDeck(sources([photo('2019-11-02', 'photographed')], [], {}, concerts), day)
    expect(deck.map((i) => i.title)).toEqual(['Photographed', 'Big Anniversary'])
  })

  it('ranks unphotographed nights by the On This Day score', () => {
    const concerts = [show('2019-11-02', 'Seven Years'), show('1986-11-02', 'Forty Years')]
    const deck = bannerDeck(sources([], [], {}, concerts), day)
    expect(deck.map((i) => i.title)).toEqual(['Forty Years', 'Seven Years'])
  })

  it('walks the ladder: that night, then the act on another night, then the sourced image', () => {
    const concerts = [show('2019-11-02', 'Thisnight'), show('2018-11-02', 'Othernight'), show('2017-11-02', 'Nophoto')]
    const assets = [photo('2019-11-02', 'thisnight'), photo('2023-06-04', 'othernight')]
    const deck = bannerDeck(sources(assets, [], {}, concerts), day)
    const [a, b, c] = ['Thisnight', 'Othernight', 'Nophoto'].map((t) => deck.find((i) => i.title === t)!)
    expect(a.photo?.date).toBe('2019-11-02')
    expect(b.photo?.date).toBe('2023-06-04')
    expect(b.sourced).toBeUndefined()
    expect(c.photo).toBeUndefined()
    expect(c.sourced).toBe('/img/nophoto.jpg')
  })

  it("uses an opener's photo from that night before the headliner's from another", () => {
    const concerts = [show('2019-11-02', 'Headliner', 'The Forum', ['Opener'])]
    const assets = [photo('2019-11-02', 'opener'), photo('2023-06-04', 'headliner')]
    const deck = bannerDeck(sources(assets, [], {}, concerts), day)
    expect(deck[0].photo?.artistNormalized).toBe('opener')
  })
})

describe('localDay', () => {
  it("formats the reader's calendar date", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
