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
 * Run: npm run generate:most-played-songs (or as part of build-data)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  id: string
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
function resolveSongs(entries: SetlistEntry[], headlinerNormalized: string): string[] {
  const withSongs = entries.map((e) => ({ e, songs: songsOf(e) })).filter((x) => x.songs.length)
  if (!withSongs.length) return []
  const headliner = withSongs.find((x) => normalizeName(x.e.artistName) === headlinerNormalized)
  const chosen = headliner ?? [...withSongs].sort((a, b) => b.songs.length - a.songs.length)[0]
  return chosen.songs
}

export async function generateMostPlayedSongs(): Promise<MostPlayedSongs> {
  const concertsData: ConcertsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'concerts.json'), 'utf-8'),
  )
  const setlists: SetlistsCache = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'setlists-cache.json'), 'utf-8'),
  )

  const byConcert = new Map<string, SetlistEntry[]>()
  for (const e of setlists.entries) {
    const arr = byConcert.get(e.concertId) ?? []
    arr.push(e)
    byConcert.set(e.concertId, arr)
  }

  const agg = new Map<
    string,
    { displayCounts: Map<string, number>; count: number; artists: Set<string> }
  >()
  let concertsWithSetlist = 0

  for (const c of concertsData.concerts) {
    const songs = resolveSongs(byConcert.get(c.id) ?? [], c.headlinerNormalized)
    if (!songs.length) continue
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
