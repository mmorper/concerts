// What the Ask box finds as you type: bands, venues, years, clips and setlist songs, with counts.
// It runs on the site from data already loaded, so a match costs no model call. Each one links to
// where that thing lives. A question goes to the model only when the visitor asks it.

import type { Concert } from '@/types/concert'
import type { AlbumIdentity, SongExhibit } from '@/types/exhibit'
import { artistDeepLink, setlistDeepLink, timelineYearDeepLink, venueDeepLink } from '@/utils/deepLinks'
import { normalizeArtistName } from '@/utils/normalize'
import { actClips, fmtDate, frameLink, leadPhoto, venueSourcedPhoto, type MediaIndex, type Photo, type VenuePhotoMeta } from './media'

export type SearchKind = 'band' | 'venue' | 'year' | 'clip' | 'song'

/** One song by one act, from public/data/song-index.json, with its record looked up. */
export interface SongRow {
  name: string
  act: string
  slug: string
  /** Every night it was heard, newest first. */
  dates: string[]
  album?: AlbumIdentity
}

/** The file as written: a song names its record by position, so each long id is stored once. */
export interface SongIndexFile {
  songs?: Array<Omit<SongRow, 'album'> & { album?: number }>
  albums?: AlbumIdentity[]
}

export function readSongIndex(file: SongIndexFile): SongRow[] {
  const albums = file.albums ?? []
  return (file.songs ?? []).map(({ album, ...song }) => (album === undefined ? song : { ...song, album: albums[album] }))
}

export interface SearchEntry {
  kind: SearchKind
  name: string
  sub: string
  href: string
  /** My photo for the thumbnail, then a sourced image. With neither, the row shows a letter. */
  photo?: Photo | null
  image?: string | null
  /** A song row opens a card in Ask rather than leaving it. */
  song?: SongRow
  /** Photos and clips, then shows, order the matches within a tier. */
  media: number
  shows: number
  fold: string
  squashed: string
  /** A venue's city and state or country, folded, so "Glasgow" or "UK" finds the room. */
  placeFold?: string
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

function entry({ place, ...fields }: Omit<SearchEntry, 'fold' | 'squashed' | 'placeFold'> & { place?: string }): SearchEntry {
  const folded = fold(fields.name)
  return { ...fields, fold: folded, squashed: folded.replace(/ /g, ''), ...(place ? { placeFold: fold(place) } : {}) }
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
      place: shows[0].cityState,
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
        sub: s.dates.length === 1 ? `${s.act}, heard in ${s.dates[0].slice(0, 4)}` : `${s.act}, heard ${s.dates.length} times`,
        // Where a new tab goes. A plain click opens the song's card in Ask instead.
        href: setlistDeepLink(s.slug, s.dates[0]),
        song: s,
        media: 0,
        shows: s.dates.length,
      }),
    )

  return [...bands, ...rooms, ...years, ...clips, ...heard]
}

/**
 * A song picked from the matches, as a finished turn: the song as the question, a line of prose,
 * and its card. The prose is what a follow-up question sees as the answer.
 */
export function songAnswer(song: SongRow): { question: string; prose: string; exhibit: SongExhibit } {
  const n = song.dates.length
  const last = song.dates[0].slice(0, 4)
  const first = song.dates[n - 1].slice(0, 4)
  const when =
    n === 1 ? `once, on ${fmtDate(song.dates[0])}` : first === last ? `${n} times, all in ${last}` : `${n} times, first in ${first} and last in ${last}`
  return {
    question: song.name,
    prose: `I heard ${song.act} play “${song.name}” ${when}.`,
    exhibit: {
      kind: 'song',
      title: song.name,
      artist: { entity: 'artist', slug: song.slug, name: song.act, deepLink: artistDeepLink(song.slug) },
      dates: song.dates,
      album: song.album ?? null,
    },
  }
}

// 0: the name starts with it, 1: a word in it does, 2: it's in there somewhere, 3: a venue's
// place does, null: no match.
function tier(e: SearchEntry, q: string, squashed: string): number | null {
  if (e.fold.startsWith(q) || e.fold.startsWith(`the ${q}`)) return 0
  if (e.fold.includes(` ${q}`)) return 1
  if (e.squashed.includes(squashed)) return 2
  // 3: a venue's town or country, at the start of a word, after every name match.
  if (e.placeFold && (e.placeFold.startsWith(q) || e.placeFold.includes(` ${q}`))) return 3
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
