/**
 * Counting facts: how a few typed values become dozens. The running tally, the receipts at the
 * end of each step, "Where it all lands" and the archive-wide count all use these functions, so
 * every number on the page is counted the same way, from the same published files.
 *
 * What counts as one fact:
 * - each value typed in the sheet (date, headliner, genre, each opener, venue, city/state);
 * - each value the update works out from the row (year, decade, weekday, city, state);
 * - each act linked to its one band page (Step 2);
 * - the venue's street address, its latitude, its longitude, and a venue photo (Step 3);
 * - each act's photo (Step 4), and each song preview (Step 5);
 * - each song in a setlist, each song matched to its album, and each cover credit (Step 6).
 */
import { lookupSongAlbum } from '../../../../scripts/utils/song-album-lookup.js'
import { normalizeArtistName } from '../../../utils/normalize'
import type { ArtistMeta, ConcertRow, TopTracks, VenueMeta } from './data'

export interface SetlistSong {
  name: string
  tape?: boolean
  cover?: { name?: string }
}
export interface SetlistEntry {
  date: string
  artistName: string
  setlist?: { sets?: { set?: { song?: SetlistSong[] }[] } }
}

export interface FactData {
  concerts: ConcertRow[]
  venues: Record<string, VenueMeta>
  meta: Record<string, ArtistMeta>
  tops: Record<string, TopTracks>
  sets: SetlistEntry[]
  albums: Record<string, unknown>
}

export type Step = 'typed' | 'row' | 'names' | 'map' | 'face' | 'sound' | 'setlists'
export const STEPS: Step[] = ['typed', 'row', 'names', 'map', 'face', 'sound', 'setlists']

export interface Item {
  n: number
  label: string
}
export interface Line {
  step: Step
  n: number
  /** One short line for the tally. */
  label: string
  /** The same facts, itemised, for a step's receipt. */
  items: Item[]
  /** Where on the site these facts show up. */
  where: string[]
}

export interface Ledger {
  concert: ConcertRow
  lines: Line[]
  typed: number
  found: number
  total: number
  /** The same total, grouped as "Where it all lands" shows it. */
  groups: { timeline: number; map: number; band: number; setlist: number }
  songs: number
  firstSong?: string
  /** Nights with the headliner, as headliner or opener, up to today. */
  seen: number
}

const songsOf = (e: SetlistEntry) =>
  (e.setlist?.sets?.set ?? []).flatMap((s) => s.song ?? []).filter((s) => !s.tape && s.name)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function ledgerFor(c: ConcertRow, d: FactData): Ledger {
  const acts = [c.headliner, ...c.openers]
  const slugs = acts.map((a, i) => (i === 0 ? c.headlinerNormalized : normalizeArtistName(a)))

  // Typed in the sheet
  const typedItems: Item[] = [
    { n: 1, label: 'Date' },
    { n: 1, label: 'Headliner' },
    ...(c.genre ? [{ n: 1, label: 'Genre' }] : []),
    ...(c.openers.length ? [{ n: c.openers.length, label: c.openers.length === 1 ? 'Opener' : 'Openers' }] : []),
    { n: 1, label: 'Venue' },
    { n: 1, label: 'City and state' },
  ]
  const typed = typedItems.reduce((s, i) => s + i.n, 0)

  // Step 1: worked out from the row
  const rowItems: Item[] = [
    { n: 1, label: `The year, ${c.year}` },
    { n: 1, label: `The decade, the ${c.decade ?? `${Math.floor(c.year / 10) * 10}s`}` },
    { n: 1, label: `The day of the week, ${c.dayOfWeek ?? ''}`.replace(/, $/, '') },
    { n: 2, label: 'The city and the state, as separate values' },
  ]

  // Step 2: each act linked to its one band page
  const seen = d.concerts.filter((x) => x.date <= today() && (x.headlinerNormalized === c.headlinerNormalized || x.openers.some((o) => normalizeArtistName(o) === c.headlinerNormalized))).length
  const namesItems: Item[] = [
    { n: 1, label: seen > 1 ? `${c.headliner}, linked to ${plural(seen - 1, 'other night')}` : `${c.headliner}, linked to its band page` },
    ...(c.openers.length ? [{ n: c.openers.length, label: c.openers.length === 1 ? 'The opener, linked to its band page' : 'Each opener, linked to its band page' }] : []),
  ]

  // Step 3: the venue
  const v = c.venueNormalized ? d.venues[c.venueNormalized] : undefined
  const mapItems: Item[] = [
    ...(v?.places?.formattedAddress ? [{ n: 1, label: 'The street address' }] : []),
    ...(v?.location ? [{ n: 2, label: 'Latitude and longitude' }] : []),
    ...(v?.photoUrls?.medium || v?.photoUrls?.thumbnail ? [{ n: 1, label: 'A photo of the venue' }] : []),
  ]

  // Step 4: photos
  const photos = slugs.filter((s) => d.meta[s]?.image).length
  const faceItems: Item[] = photos ? [{ n: photos, label: photos === 1 ? 'A photo of the band' : 'A photo of each band' }] : []

  // Step 5: previews
  const previews = slugs.reduce((s, x) => s + (d.tops[x]?.tracks ?? []).filter((t) => t.previewUrl).length, 0)
  const soundItems: Item[] = previews ? [{ n: previews, label: 'Song previews' }] : []

  // Step 6: setlists, albums, covers
  const slugSet = new Set(slugs)
  const entries = d.sets.filter((e) => e.date === c.date && slugSet.has(normalizeArtistName(e.artistName)))
  let songs = 0
  let albums = 0
  let covers = 0
  let firstSong: string | undefined
  for (const e of entries) {
    const list = songsOf(e)
    if (normalizeArtistName(e.artistName) === c.headlinerNormalized && list[0]) firstSong = list[0].name
    songs += list.length
    covers += list.filter((s) => s.cover).length
    albums += list.filter((s) => lookupSongAlbum(d.albums, e.artistName, s.name, { artistsMetadata: d.meta })).length
  }
  const setItems: Item[] = songs
    ? [
        { n: songs, label: 'Songs in the setlist, in order' },
        ...(albums ? [{ n: albums, label: albums === songs ? 'The album for each song' : `The album for ${albums} of them` }] : []),
        ...(covers ? [{ n: covers, label: covers === 1 ? 'A cover credit' : 'Cover credits' }] : []),
      ]
    : []

  const sum = (items: Item[]) => items.reduce((s, i) => s + i.n, 0)
  const lines: Line[] = [
    { step: 'typed', n: typed, label: 'Typed in the sheet', items: typedItems, where: [] },
    { step: 'row', n: sum(rowItems), label: 'Year, decade, weekday, city, state', items: rowItems, where: ['Timeline', 'Genres'] },
    { step: 'names', n: sum(namesItems), label: namesItems[0].label, items: namesItems, where: ['Artists'] },
    { step: 'map', n: sum(mapItems), label: mapItems.length ? 'Address, latitude, longitude, photo' : 'No location found', items: mapItems, where: ['Map', 'Venues'] },
    { step: 'face', n: photos, label: photos ? (photos === 1 ? 'Band photo' : 'Band photos') : 'No photo: a tile with initials', items: faceItems, where: ['Artists'] },
    { step: 'sound', n: previews, label: previews ? 'Song previews' : 'No previews found', items: soundItems, where: ['Artists'] },
    {
      step: 'setlists',
      n: sum(setItems),
      label: songs ? `${songs}-song setlist, ${albums} albums${covers ? `, ${plural(covers, 'cover')}` : ''}` : 'No setlist exists for this night',
      items: setItems,
      where: ['Artists', 'Ask', 'Now Spinning'],
    },
  ]
  const total = lines.reduce((s, l) => s + l.n, 0)
  const by = (s: Step) => lines.find((l) => l.step === s)!.n

  return {
    concert: c,
    lines,
    typed,
    found: total - typed,
    total,
    groups: {
      timeline: 1 + (c.genre ? 1 : 0) + 3,
      map: 2 + 2 + by('map'),
      band: 1 + c.openers.length + by('names') + by('face') + by('sound'),
      setlist: by('setlists'),
    },
    songs,
    firstSong,
    seen,
  }
}

/**
 * The whole archive, each fact counted once: a venue's address counts once however many shows
 * were there, and a band's photo once however many times I saw them.
 */
export function archiveTotals(d: FactData) {
  const past = d.concerts.filter((c) => c.date <= today())
  let typed = 0
  for (const c of past) typed += 4 + (c.genre ? 1 : 0) + c.openers.length
  const derived = past.length * 5
  let venue = 0
  for (const v of Object.values(d.venues)) venue += (v.places?.formattedAddress ? 1 : 0) + (v.location ? 2 : 0) + (v.photoUrls ? 1 : 0)
  const photos = Object.values(d.meta).filter((m) => m.image).length
  let previews = 0
  for (const t of Object.values(d.tops)) previews += (t.tracks ?? []).filter((x) => x.previewUrl).length
  let setFacts = 0
  for (const e of d.sets) {
    const list = songsOf(e)
    setFacts += list.length + list.filter((s) => s.cover).length
    setFacts += list.filter((s) => lookupSongAlbum(d.albums, e.artistName, s.name, { artistsMetadata: d.meta })).length
  }
  return { shows: past.length, typed, total: typed + derived + venue + photos + previews + setFacts }
}

/** Today in the archive's own date format. Upcoming shows haven't happened, so they don't count. */
export const today = () => new Date().toISOString().slice(0, 10)

/** The row the chapter follows from top to bottom. */
export const FOLLOWED = '2024-12-06'
