// What the Ask box finds as you type: bands, venues, years, clips and setlist songs, with counts.
// It runs on the site from data already loaded, so a match costs no model call. Each one links to
// where that thing lives. A question goes to the model only when the visitor asks it.

import type { Concert } from '@/types/concert'
import { artistDeepLink, setlistDeepLink, timelineYearDeepLink, venueDeepLink } from '@/utils/deepLinks'
import { normalizeArtistName } from '@/utils/normalize'
import { actClips, frameLink, leadPhoto, venueSourcedPhoto, type MediaIndex, type Photo, type VenuePhotoMeta } from './media'

export type SearchKind = 'band' | 'venue' | 'year' | 'clip' | 'song'

/** One row of public/data/song-index.json. */
export interface SongRow {
  name: string
  act: string
  slug: string
  count: number
  lastDate: string
}

export interface SearchEntry {
  kind: SearchKind
  name: string
  sub: string
  href: string
  /** My photo for the thumbnail, then a sourced image. With neither, the row shows a letter. */
  photo?: Photo | null
  image?: string | null
  /** Photos and clips, then shows, order the matches within a tier. */
  media: number
  shows: number
  fold: string
  squashed: string
}

export interface SearchSources {
  byArtist: Map<string, Concert[]>
  byVenue: Map<string, Concert[]>
  artists: Record<string, { name: string; image?: string }>
  venues: Record<string, VenuePhotoMeta>
  media: MediaIndex
  songs: SongRow[]
}

/** Six in the list, and songs can't crowd out everything else: there are 1,600 of them. */
export const MATCH_LIMIT = 6
const SONG_LIMIT = 3

/** Below this the box is still just a letter, and every row would match. */
export const MIN_QUERY = 2

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Accents, case and punctuation don't count, so "motorhead" finds Motörhead. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function entry(fields: Omit<SearchEntry, 'fold' | 'squashed'>): SearchEntry {
  const folded = fold(fields.name)
  return { ...fields, fold: folded, squashed: folded.replace(/ /g, '') }
}

// Openers have no metadata row of their own, so the name comes from a bill they were on.
function actName(slug: string, shows: Concert[], artists: SearchSources['artists']): string {
  const known = artists[slug]?.name
  if (known) return known
  for (const c of shows) {
    if (c.headlinerNormalized === slug) return c.headliner
    const opener = c.openers?.find((name) => normalizeArtistName(name.trim()) === slug)
    if (opener) return opener.trim()
  }
  return slug
}

export function buildSearchEntries({ byArtist, byVenue, artists, venues, media, songs }: SearchSources): SearchEntry[] {
  const bands = [...byArtist].map(([slug, shows]) => {
    const photos = media.byArtist.get(slug)?.length ?? 0
    const clips = actClips(media, slug).length
    const counts = [plural(shows.length, 'show')]
    if (photos) counts.push(plural(photos, 'photo'))
    if (clips) counts.push(plural(clips, 'clip'))
    return entry({
      kind: 'band',
      name: actName(slug, shows, artists),
      sub: counts.join(' · '),
      href: artistDeepLink(slug),
      photo: leadPhoto(media, slug),
      image: artists[slug]?.image,
      media: photos + clips,
      shows: shows.length,
    })
  })

  const rooms = [...byVenue].map(([slug, shows]) =>
    entry({
      kind: 'venue',
      name: shows[0].venue,
      sub: `${shows[0].cityState} · ${plural(shows.length, 'show')}`,
      href: venueDeepLink(slug),
      image: venueSourcedPhoto(venues[slug]),
      media: 0,
      shows: shows.length,
    }),
  )

  const showsByYear = new Map<number, number>()
  for (const shows of byVenue.values()) {
    for (const c of shows) showsByYear.set(c.year, (showsByYear.get(c.year) ?? 0) + 1)
  }
  const years = [...showsByYear].map(([year, count]) =>
    entry({
      kind: 'year',
      name: String(year),
      sub: plural(count, 'show'),
      href: timelineYearDeepLink(year),
      media: 0,
      shows: count,
    }),
  )

  const filmed = new Set<string>()
  const clips = [...media.clipsByDate.values()].flat().flatMap((clip) => {
    if (!clip.song) return []
    filmed.add(`${clip.artistNormalized}|${fold(clip.song)}`)
    return [
      entry({
        kind: 'clip',
        name: clip.song,
        sub: `${clip.artist ?? 'Clip'}, ${clip.date.slice(0, 4)}`,
        href: frameLink(clip, clip.artistNormalized ?? ''),
        image: clip.poster,
        media: 1,
        shows: 0,
      }),
    ]
  })

  // A song I filmed is already a clip above, and the clip is the better place to land.
  const heard = songs
    .filter((s) => !filmed.has(`${s.slug}|${fold(s.name)}`))
    .map((s) =>
      entry({
        kind: 'song',
        name: s.name,
        sub: s.count === 1 ? `${s.act}, heard in ${s.lastDate.slice(0, 4)}` : `${s.act}, heard ${s.count} times`,
        href: setlistDeepLink(s.slug, s.lastDate),
        media: 0,
        shows: s.count,
      }),
    )

  return [...bands, ...rooms, ...years, ...clips, ...heard]
}

// 0: the name starts with it, 1: a word in it does, 2: it's in there somewhere, null: no match.
function tier(e: SearchEntry, q: string, squashed: string): number | null {
  if (e.fold.startsWith(q) || e.fold.startsWith(`the ${q}`)) return 0
  if (e.fold.includes(` ${q}`)) return 1
  if (e.squashed.includes(squashed)) return 2
  return null
}

export function searchArchive(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = fold(query)
  if (q.length < MIN_QUERY) return []
  const squashed = q.replace(/ /g, '')
  const hits = entries.flatMap((e) => {
    const t = tier(e, q, squashed)
    return t === null ? [] : [{ e, t }]
  })
  // A song's count is plays, not shows, so it only competes with other songs.
  const isSong = (e: SearchEntry) => Number(e.kind === 'song')
  hits.sort((a, b) => a.t - b.t || isSong(a.e) - isSong(b.e) || b.e.media - a.e.media || b.e.shows - a.e.shows)

  const out: SearchEntry[] = []
  let songs = 0
  for (const { e } of hits) {
    if (out.length === MATCH_LIMIT) break
    if (e.kind === 'song' && ++songs > SONG_LIMIT) continue
    out.push(e)
  }
  return out
}
