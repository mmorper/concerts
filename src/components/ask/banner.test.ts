import { describe, it, expect } from 'vitest'
import { bannerDeck, localDay, FAMILIAR_SHOWS, type BannerSources } from './banner'
import { buildMediaIndex, type MediaAsset } from './media'
import type { SearchEntry } from './search'

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

function sources(assets: MediaAsset[], entries: SearchEntry[], counts: Record<string, number> = {}): BannerSources {
  const media = buildMediaIndex(assets)
  return {
    media,
    searchEntries: entries,
    concertByDate: (d) => (nights[d] ? { ...nights[d], headlinerNormalized: '' } : null),
    artistFacts: (slug) => ({ count: counts[slug] ?? 0, firstYear: 1990, lastYear: 2024 }),
  }
}

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

describe('localDay', () => {
  it("formats the reader's calendar date", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
