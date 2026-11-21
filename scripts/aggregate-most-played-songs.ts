#!/usr/bin/env tsx
/**
 * Aggregate Most-Played Songs
 *
 * Computes song frequency across all cached setlists and writes
 * public/data/most-played-songs.json for the MCP `get_archive_top_songs` tool.
 *
 * Coverage is partial — only ~64% of concerts have a setlist on record — so the
 * output carries an explicit `coverage` block the tool narrates up front. Numbers
 * here describe "songs I actually witnessed," NOT a play-count of the band's catalog.
 *
 * Counting rules:
 *   - Every act's setlist counts, openers included: a song an opening act played was
 *     heard that night as surely as the headliner's (#690). Until 2026-11 only one
 *     setlist per concert counted, the headliner's, so 547 songs openers played were
 *     missing — and Now Spinning, which counts every setlist, would have disagreed.
 *   - A song counts once per act per concert (deduped within one act's set).
 *   - Tape entries (`tape: true`: intro music, a recording played to the room) are
 *     skipped. They were not performed.
 *   - Titles are grouped case/space/trailing-punctuation-insensitively; the most
 *     common original casing wins as the display name.
 *   - A song played by different artists merges into one row, but every artist that
 *     played it is listed — so "songs I saw most" and "covers/standards" are both
 *     legible.
 *
 * Also writes public/data/song-index.json for Ask's type-ahead: every song, not only those seen
 * twice, per act, with every night it was heard and the record it came off (from
 * song-albums.json, which build-data writes first) so a match can open a card about it.
 *
 * Run: npm run generate:most-played-songs (or as part of build-data)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { songAlbumKey } from './utils/song-title.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  openers?: string[]
}
interface ConcertsData {
  concerts: Concert[]
}
interface SetlistSong {
  name?: string
  /** setlist.fm marks recorded music played to the room, rather than performed. */
  tape?: boolean
}
interface SetlistSet {
  song?: SetlistSong[]
}
interface Setlist {
  sets?: { set?: SetlistSet[] }
}
interface SetlistEntry {
  concertId: string
  artistName: string
  setlist: Setlist | null
}
interface SetlistsCache {
  entries: SetlistEntry[]
}

export interface SongStat {
  name: string
  count: number
  artists: string[]
}
export interface MostPlayedSongs {
  version: string
  generatedAt: string
  coverage: {
    concertsWithSetlist: number
    totalConcerts: number
    distinctSongs: number
  }
  songs: SongStat[]
}

/** One song by one act. A cover is its own row, because it was heard on different nights. */
export interface SongIndexEntry {
  name: string
  act: string
  slug: string
  /** Every night it was heard, newest first. */
  dates: string[]
  /** The record it came off: a position in `albums`, which keeps each long id once. */
  album?: number
}
export interface SongIndexAlbum {
  mbid: string
  title: string
  releaseDate: string
  coverAvailable: boolean
}
export interface SongIndex {
  songs: SongIndexEntry[]
  albums: SongIndexAlbum[]
}
/** The fields of a song-albums.json row this file reads. */
export interface SongAlbumRow {
  albumTitle: string
  mbid: string
  releaseDate: string
  coverAvailable: boolean
}

// Mirrors src/utils/normalize.ts — used to match an entry's artistName to a headliner.
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Grouping key for song titles: case-, whitespace-, and trailing-punctuation-insensitive.
function songKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/g, '')
}

function songsOf(entry: SetlistEntry): string[] {
  const sets = entry.setlist?.sets?.set ?? []
  const songs: string[] = []
  for (const s of sets) for (const sg of s.song ?? []) if (sg.name && sg.name.trim() && !sg.tape) songs.push(sg.name.trim())
  return songs
}

// Every act's set on the night, headliner and openers alike, each with the songs performed.
// One entry per act: a duplicate entry for the same act keeps the fuller set.
function setsOf(entries: SetlistEntry[]): { e: SetlistEntry; slug: string; songs: string[] }[] {
  const byAct = new Map<string, { e: SetlistEntry; slug: string; songs: string[] }>()
  for (const e of entries) {
    const songs = songsOf(e)
    if (!songs.length) continue
    const slug = normalizeName(e.artistName)
    const prev = byAct.get(slug)
    if (!prev || songs.length > prev.songs.length) byAct.set(slug, { e, slug, songs })
  }
  return [...byAct.values()]
}

// The act's name as the archive bills it on that night (headliner or opener), so a listed
// artist reads as it does everywhere else on the site, not as setlist.fm spells it.
function billingName(c: Concert, slug: string): string | undefined {
  if (c.headlinerNormalized === slug) return c.headliner
  return (c.openers ?? []).find((o) => normalizeName(o) === slug)
}

function entriesByConcert(entries: SetlistEntry[]): Map<string, SetlistEntry[]> {
  const byConcert = new Map<string, SetlistEntry[]>()
  for (const e of entries) {
    const arr = byConcert.get(e.concertId) ?? []
    arr.push(e)
    byConcert.set(e.concertId, arr)
  }
  return byConcert
}

export function buildSongIndex(
  concerts: Concert[],
  entries: SetlistEntry[],
  songAlbums: Record<string, SongAlbumRow> = {},
): SongIndex {
  const byConcert = entriesByConcert(entries)
  const agg = new Map<string, SongIndexEntry>()
  for (const c of concerts) {
    for (const set of setsOf(byConcert.get(c.id) ?? [])) {
      const seen = new Set<string>() // a song counts once per act per show
      for (const raw of set.songs) {
        const key = `${set.slug}|${songKey(raw)}`
        if (!songKey(raw) || seen.has(key)) continue
        seen.add(key)
        const rec = agg.get(key)
        if (rec) rec.dates.push(c.date)
        else agg.set(key, { name: raw, act: set.e.artistName, slug: set.slug, dates: [c.date] })
      }
    }
  }

  const songs = [...agg.values()].sort((a, b) => b.dates.length - a.dates.length || a.name.localeCompare(b.name))
  const albums: SongIndexAlbum[] = []
  const position = new Map<string, number>()
  for (const rec of songs) {
    rec.dates.sort((a, b) => b.localeCompare(a))
    const hit = songAlbums[songAlbumKey(rec.slug, rec.name)]
    if (!hit?.mbid) continue
    if (!position.has(hit.mbid)) {
      position.set(hit.mbid, albums.length)
      albums.push({ mbid: hit.mbid, title: hit.albumTitle, releaseDate: hit.releaseDate, coverAvailable: hit.coverAvailable })
    }
    rec.album = position.get(hit.mbid)
  }
  return { songs, albums }
}

export async function generateMostPlayedSongs(): Promise<MostPlayedSongs> {
  const concertsData: ConcertsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'concerts.json'), 'utf-8'),
  )
  const setlists: SetlistsCache = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'setlists-cache.json'), 'utf-8'),
  )

  const byConcert = entriesByConcert(setlists.entries)

  const agg = new Map<
    string,
    { displayCounts: Map<string, number>; count: number; artists: Set<string> }
  >()
  let concertsWithSetlist = 0

  for (const c of concertsData.concerts) {
    const sets = setsOf(byConcert.get(c.id) ?? [])
    if (!sets.length) continue
    concertsWithSetlist++

    for (const set of sets) {
      const seen = new Set<string>() // a song counts once per act per show
      for (const raw of set.songs) {
        const key = songKey(raw)
        if (!key || seen.has(key)) continue
        seen.add(key)
        let rec = agg.get(key)
        if (!rec) {
          rec = { displayCounts: new Map(), count: 0, artists: new Set() }
          agg.set(key, rec)
        }
        rec.count++
        rec.artists.add(billingName(c, set.slug) ?? set.e.artistName) // the act that played it, as the archive spells it
        rec.displayCounts.set(raw, (rec.displayCounts.get(raw) ?? 0) + 1)
      }
    }
  }

  // Keep only songs seen at least twice — the artifact is "most played," not a full index.
  const songs: SongStat[] = [...agg.values()]
    .filter((rec) => rec.count >= 2)
    .map((rec) => {
      const name = [...rec.displayCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0][0]
      return { name, count: rec.count, artists: [...rec.artists].sort() }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    coverage: {
      concertsWithSetlist,
      totalConcerts: concertsData.concerts.length,
      distinctSongs: agg.size,
    },
    songs,
  }
}

function writeSongIndex(): void {
  const dataDir = path.join(__dirname, '..', 'public', 'data')
  const { concerts }: ConcertsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'concerts.json'), 'utf-8'))
  const { entries }: SetlistsCache = JSON.parse(fs.readFileSync(path.join(dataDir, 'setlists-cache.json'), 'utf-8'))
  // Without the record file a song card just has no sleeve.
  const albumsPath = path.join(dataDir, 'song-albums.json')
  const songAlbums: Record<string, SongAlbumRow> = fs.existsSync(albumsPath)
    ? JSON.parse(fs.readFileSync(albumsPath, 'utf-8')).songs
    : {}
  const index = buildSongIndex(concerts, entries, songAlbums)
  fs.writeFileSync(path.join(dataDir, 'song-index.json'), JSON.stringify(index) + '\n', 'utf-8')
  const onRecord = index.songs.filter((s) => s.album !== undefined).length
  console.log(`✓ ${index.songs.length} songs (${onRecord} matched to a record) written to public/data/song-index.json`)
}

export async function writeMostPlayedSongs(): Promise<void> {
  console.log('🎵 Aggregating most-played songs from setlists...\n')

  const data = await generateMostPlayedSongs()

  const outputPath = path.join(__dirname, '..', 'public', 'data', 'most-played-songs.json')
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')

  const { concertsWithSetlist, totalConcerts, distinctSongs } = data.coverage
  console.log(
    `✓ ${data.songs.length} songs seen 2+ times (of ${distinctSongs} distinct) across ${concertsWithSetlist}/${totalConcerts} concerts with setlists`,
  )
  console.log('✓ Written to public/data/most-played-songs.json')
  writeSongIndex()

  console.log('\nTop songs:')
  data.songs.slice(0, 8).forEach((s, i) => {
    const multi = s.artists.length > 1 ? ` — ${s.artists.length} artists` : ''
    console.log(`   ${i + 1}. ${s.name} (${s.count})${multi}`)
  })
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  writeMostPlayedSongs()
}
