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
 * Counting rules (mirror workers/mcp-server resolveSetlistEntry):
 *   - One setlist per concert: the headliner's, preferred over any opener's.
 *   - A song counts once per concert (deduped within a show).
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
}
interface ConcertsData {
  concerts: Concert[]
}
interface SetlistSong {
  name?: string
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
  for (const s of sets) for (const sg of s.song ?? []) if (sg.name && sg.name.trim()) songs.push(sg.name.trim())
  return songs
}

// Headliner-preferred resolution, identical in spirit to the MCP server's helper:
// a concert can carry several entries (headliner + each opener), prefer the headliner's,
// else fall back to the richest set so a covered night still contributes.
function resolveEntry(entries: SetlistEntry[], headlinerNormalized: string) {
  const withSongs = entries.map((e) => ({ e, songs: songsOf(e) })).filter((x) => x.songs.length)
  if (!withSongs.length) return null
  const headliner = withSongs.find((x) => normalizeName(x.e.artistName) === headlinerNormalized)
  return headliner ?? [...withSongs].sort((a, b) => b.songs.length - a.songs.length)[0]
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
    const chosen = resolveEntry(byConcert.get(c.id) ?? [], c.headlinerNormalized)
    if (!chosen) continue
    const slug = normalizeName(chosen.e.artistName)
    const seen = new Set<string>() // a song counts once per show
    for (const raw of chosen.songs) {
      const key = `${slug}|${songKey(raw)}`
      if (!songKey(raw) || seen.has(key)) continue
      seen.add(key)
      const rec = agg.get(key)
      if (rec) rec.dates.push(c.date)
      else agg.set(key, { name: raw, act: chosen.e.artistName, slug, dates: [c.date] })
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
    const songs = resolveEntry(byConcert.get(c.id) ?? [], c.headlinerNormalized)?.songs
    if (!songs) continue
    concertsWithSetlist++

    const seen = new Set<string>() // a song counts once per show
    for (const raw of songs) {
      const key = songKey(raw)
      if (!key || seen.has(key)) continue
      seen.add(key)
      let rec = agg.get(key)
      if (!rec) {
        rec = { displayCounts: new Map(), count: 0, artists: new Set() }
        agg.set(key, rec)
      }
      rec.count++
      rec.artists.add(c.headliner)
      rec.displayCounts.set(raw, (rec.displayCounts.get(raw) ?? 0) + 1)
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
