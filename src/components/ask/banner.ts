// The ⌘K banner (global-ask-media Phase 6): one large picture under the box, and "Pull another".
// Each idea is a clip, a year or a familiar face. A clip opens in its gatefold. The others ask a
// question a tool is known to answer, so a banner never offers what Ask can't give back.
//
// The order is shuffled once a day, the same for everyone, and "Pull another" goes through every
// idea before it repeats one. Nothing rotates on a timer.

import type { Concert } from '@/types/concert'
import { frameLink, joinNames, type Clip, type MediaIndex, type Photo } from './media'
import type { SearchEntry } from './search'

export type BannerKind = 'clip' | 'year' | 'act'

export interface BannerIdea {
  kind: BannerKind
  key: string
  kicker: string
  title: string
  sub: string
  /** My photo, bylined. A clip has its poster instead. */
  photo?: Photo
  poster?: string
  /** A clip opens in its gatefold. */
  href?: string
  /** Everything else asks this. */
  question?: string
  /** The act in the picture, for the byline. */
  act?: string
}

/** Width ÷ height of the banner on desktop. On a phone it is taller, which any frame survives. */
export const BANNER_BOX = 2.2
/** An act needs this many nights to be a familiar face. */
export const FAMILIAR_SHOWS = 3

export interface BannerSources {
  media: MediaIndex
  searchEntries: SearchEntry[]
  concertByDate: (date: string) => Pick<Concert, 'venue' | 'headliner' | 'headlinerNormalized'> | null
  artistFacts: (slug: string) => { count: number; firstYear?: number; lastYear?: number }
}

/**
 * A frame the wide banner can hold. Every published crop is 4:5, so no crop fits a 2.2 box whole:
 * the box shows the top of the crop, where the face is (`focalPosition`). A landscape frame gives
 * it room. A portrait one would leave a thin slice, so it stays out of the banner.
 */
const fitsBanner = (p: Photo) => p.width / p.height >= 1.3

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function clipIdeas({ media, concertByDate }: BannerSources): BannerIdea[] {
  return [...media.clipsByDate.values()].flat().flatMap((clip: Clip) => {
    if (!clip.song || !clip.poster || !clip.artistNormalized) return []
    const venue = concertByDate(clip.date)?.venue
    const who = clip.artist ?? 'A clip'
    return [
      {
        kind: 'clip' as const,
        key: `clip:${clip.url}`,
        kicker: clip.duration ? `A clip · ${Math.round(clip.duration)} sec` : 'A clip',
        title: clip.song,
        sub: `${venue ? `${who} at ${venue}` : who}, ${clip.date.slice(0, 4)}`,
        poster: clip.poster,
        href: frameLink(clip, clip.artistNormalized),
      },
    ]
  })
}

function yearIdeas({ media, searchEntries, concertByDate }: BannerSources): BannerIdea[] {
  return searchEntries.flatMap((e) => {
    if (e.kind !== 'year') return []
    const year = e.name
    const nights = [...media.byDate.keys()].filter((d) => d.startsWith(`${year}-`)).sort()
    const frames = nights.flatMap((d) => media.byDate.get(d) ?? []).filter((p) => p.subject === 'artist' && fitsBanner(p))
    const photo = frames.find((p) => p.hero) ?? frames[0]
    if (!photo) return []
    // The act in the picture first, then the year's other photographed headliners.
    const names = [photo.date, ...nights]
      .map((d) => concertByDate(d)?.headliner)
      .filter((n, i, all): n is string => !!n && all.indexOf(n) === i)
    const sub =
      e.shows === 1
        ? [names[0], concertByDate(photo.date)?.venue].filter(Boolean).join(' at ')
        : `${plural(e.shows, 'show')}, including ${joinNames(names.slice(0, 2))}`
    return [
      {
        kind: 'year' as const,
        key: `year:${year}`,
        kicker: 'A year in the archive',
        title: year,
        sub,
        photo,
        question: `What did you see in ${year}?`,
      },
    ]
  })
}

function actIdeas({ media, searchEntries, artistFacts }: BannerSources): BannerIdea[] {
  return searchEntries.flatMap((e) => {
    const slug = e.kind === 'band' ? e.photo?.artistNormalized : null
    if (!slug) return []
    const facts = artistFacts(slug)
    if (facts.count < FAMILIAR_SHOWS || !facts.firstYear || !facts.lastYear) return []
    const frames = (media.byArtist.get(slug) ?? []).filter(fitsBanner)
    const photo = frames.find((p) => p.signature) ?? frames[0]
    if (!photo) return []
    const span = facts.firstYear === facts.lastYear ? `in ${facts.firstYear}` : `from ${facts.firstYear} to ${facts.lastYear}`
    return [
      {
        kind: 'act' as const,
        key: `act:${slug}`,
        kicker: 'A familiar face',
        title: e.name,
        sub: `${plural(facts.count, 'show')}, ${span}`,
        photo,
        question: `How many times have you seen ${e.name}?`,
        act: slug,
      },
    ]
  })
}

/** A small seeded generator, so a day's order is the same in every browser. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = (h << 13) | (h >>> 19)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Every idea, in the day's order. The kinds take turns (a clip, a year, a face), so two pulls in
 * a row are never the same kind while more than one kind is left.
 */
export function bannerDeck(sources: BannerSources, day: string): BannerIdea[] {
  const rand = seeded(day)
  const piles = [clipIdeas(sources), yearIdeas(sources), actIdeas(sources)].map((p) => shuffle(p, rand))
  const deck: BannerIdea[] = []
  for (let i = 0; piles.some((p) => i < p.length); i++) {
    for (const pile of piles) if (i < pile.length) deck.push(pile[i])
  }
  return deck
}

/** Today's calendar date where the reader is, as YYYY-MM-DD. */
export function localDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
