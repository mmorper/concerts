/**
 * Resolve setlist songs to the studio albums they came from.
 *
 * The archive holds ~2,700 song performances and a discography of 11,382
 * releases. Nothing joined them, so "did I hear that song before its record
 * existed?" was unanswerable. This builds that join.
 *
 * Usage:
 *   npm run resolve:song-albums                  # New/stale artists only
 *   npm run resolve:song-albums -- --dry-run     # Preview without writing
 *   npm run resolve:song-albums -- --force       # Ignore the track cache TTL
 *   npm run resolve:song-albums -- --artist depeche-mode
 *
 * Tier 0 — reuse album names already in artists-top-tracks.json (0 API calls)
 * Tier 1 — index MusicBrainz track listings for studio release-groups
 * Tier 2 — iTunes fallback (Window 2, not implemented here)
 *
 * INDEX PER ALBUM, NOT PER SONG. Searching MusicBrainz for a single well-known
 * track returns 165 compilation-dominated recordings; picking the studio album
 * out of that needs disambiguation logic that will be wrong in ways nobody
 * notices. Fetching the track listings of release-groups we already hold means
 * compilation noise never enters the pipeline.
 *
 * Output: public/data/song-albums.json
 * Cache:  data/cache/musicbrainz-tracks.json (versioned, NOT served)
 * Spec:   docs/specs/future/global-setlist-album-attribution.md
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { MusicBrainzClient } from './utils/musicbrainz-client.js'
import { matchAlbumTitle, isSingleOrEp } from './utils/album-title.js'
import { foldSongTitle, songIndexKeys } from './utils/song-title.js'
import { buildArtistKeyIndex, resolveArtistKey } from './utils/artist-key.js'
import { isStudioAlbum, type RawAlbum } from './derive-album-eras.js'

const DATA = 'public/data'
const CACHE_PATH = 'data/cache/musicbrainz-tracks.json'
const OUTPUT_PATH = `${DATA}/song-albums.json`

/** Track listings change only when MusicBrainz is edited. Same TTL as discography. */
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

// ── Types ────────────────────────────────────────────────────────────────────

/** An entry from `album-eras.json`'s `artists[key].studioAlbums` — already filtered and sorted. */
export interface StudioAlbum {
  mbid: string
  title: string
  releaseDate: string
  coverAvailable: boolean
}

/**
 * One attributed song. Store nothing derivable — v5.4's budget lesson, applied
 * before the file ships rather than after it was measured too big:
 *
 *   artistKey         the entry KEY already starts with it
 *   albumSlug         normalizeAlbumName(albumTitle), a pure function
 *   source            implied by matchTier (0 = top-tracks, 1 = musicbrainz)
 *   isCover           always false until Window 2 routes covers
 *   originalArtistKey always null until Window 2
 *
 * Carrying those five cost 217 KB across 1,629 entries — more than half the
 * size budget — to store values a consumer can compute or already knows.
 */
interface SongAlbum {
  songTitle: string
  albumTitle: string
  mbid: string
  releaseDate: string
  coverAvailable: boolean
  matchTier: 0 | 1
}

interface TrackCache {
  version: string
  entries: Record<string, { tracks: string[]; cachedAt: string }>
}

/** One setlist song to attribute. */
interface Pair {
  artistKey: string
  artistSlug: string
  songTitle: string
  key: string
}

// ── Core derivation (pure, exported for tests) ───────────────────────────────

/**
 * The lookup key for one artist's performance of one song.
 *
 * Hyphenated lowercase, matching the project's normalized-name convention:
 * `depeche-mode::never-let-me-down-again`.
 *
 * EXPORTED so no consumer hand-builds it. Every reader — the MCP, the v5.5
 * detectors — must derive the key through this function, or a caller that
 * folds differently will miss every entry while looking like it simply found
 * nothing. Same discipline as deepLinks.ts.
 */
export function songAlbumKey(artistKey: string, songTitle: string): string {
  return `${artistKey}::${foldSongTitle(songTitle).replace(/ /g, '-')}`
}

/**
 * song key → the EARLIEST studio album carrying it.
 *
 * "When did this song first exist?" is the question every downstream detector
 * asks — `road-tested` compares a show date against it. So when a song appears
 * on more than one studio album (a re-recording, a track reused on a later
 * record), the original must win. Taking the last one seen would quietly
 * convert "I heard it two years before the record" into "I heard it after."
 *
 * Pure by construction: pass a lookup for track titles rather than reading the
 * cache, so the rule can be tested without a network or a fixture file.
 */
export function buildSongIndex(
  albums: readonly StudioAlbum[],
  tracksFor: (mbid: string) => readonly string[]
): Map<string, StudioAlbum> {
  const index = new Map<string, StudioAlbum>()

  for (const album of albums) {
    for (const title of tracksFor(album.mbid)) {
      for (const key of songIndexKeys(title)) {
        const held = index.get(key)
        if (!held || album.releaseDate.localeCompare(held.releaseDate) < 0) {
          index.set(key, album)
        }
      }
    }
  }

  return index
}

// ── IO ───────────────────────────────────────────────────────────────────────

const readData = (file: string) => JSON.parse(readFileSync(resolve(DATA, file), 'utf-8'))

function loadCache(): TrackCache {
  try {
    return JSON.parse(readFileSync(resolve(CACHE_PATH), 'utf-8'))
  } catch {
    return { version: '1.0.0', entries: {} }
  }
}

function saveCache(cache: TrackCache) {
  const path = resolve(CACHE_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function resolveSongAlbums(
  options: { dryRun?: boolean; force?: boolean; artist?: string } = {}
) {
  const artistFlagIndex = process.argv.indexOf('--artist')
  const {
    dryRun = process.argv.includes('--dry-run'),
    force = process.argv.includes('--force'),
    artist = artistFlagIndex >= 0 ? process.argv[artistFlagIndex + 1] : undefined
  } = options

  console.log(`🎼 Resolving setlist songs to albums...${dryRun ? ' (DRY RUN)' : ''}\n`)

  const setlists = readData('setlists-cache.json')
  const topTracks = readData('artists-top-tracks.json')
  const eras = readData('album-eras.json')
  const discography = readData('discography.json')
  const aliases = readData('artist-aliases.json')

  // Same alias wiring as derive-album-eras.ts — BOTH relations. sameAct gives
  // marquees this act played under; discographyKeys gives the name their
  // catalogue is filed under. Using only the first drops yaz/the-english-beat.
  const aliasesOfSlug = new Map<string, string[]>()
  const addAlias = (slug: string, alias: string) => {
    const list = aliasesOfSlug.get(slug) ?? []
    if (!list.includes(alias)) list.push(alias)
    aliasesOfSlug.set(slug, list)
  }
  for (const entry of aliases.sameAct ?? []) {
    for (const b of entry.billings ?? []) for (const o of entry.billings ?? []) addAlias(b, o)
  }
  for (const entry of aliases.discographyKeys ?? []) {
    if (entry.act && entry.discographyKey) addAlias(entry.act, entry.discographyKey)
  }

  const keyIndex = buildArtistKeyIndex(discography)
  const resolveOptions = {
    aliasesOf: (slug: string) => aliasesOfSlug.get(slug) ?? [],
    isUsable: (record: { albums?: unknown[] }) => (record?.albums?.length ?? 0) > 0,
  }

  const slugOf = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // ── Collect the pairs to attribute ────────────────────────────────────────
  //
  // Covers are collected but NOT attributed here: routing them against the
  // ORIGINAL artist's discography is Window 2 (§Part 3). Attributing them
  // against the performing artist would be actively wrong — Dropkick Murphys
  // playing "No Surrender" did not put it on a Dropkick Murphys album.

  const pairs = new Map<string, Pair>()
  let performances = 0
  let tapeSkipped = 0
  let coversDeferred = 0
  const unresolvedArtists = new Set<string>()

  for (const entry of Object.values<any>(setlists.entries ?? {})) {
    const sets = entry?.setlist?.sets?.set ?? []
    for (const song of sets.flatMap((s: any) => s.song ?? [])) {
      if (!song?.name?.trim()) continue
      performances++
      if (song.tape) { tapeSkipped++; continue }
      if (song.cover) { coversDeferred++; continue }

      const slug = slugOf(entry.artistName ?? '')
      if (!slug) continue

      const resolved = resolveArtistKey(slug, entry.artistName, keyIndex, discography, resolveOptions)
      if (!resolved.key) { unresolvedArtists.add(slug); continue }

      const key = songAlbumKey(resolved.key, song.name)
      if (!pairs.has(key)) {
        pairs.set(key, {
          artistKey: resolved.key,
          artistSlug: slug,
          songTitle: song.name.trim(),
          key,
        })
      }
    }
  }

  const allPairs = [...pairs.values()].filter(p => !artist || p.artistKey === artist)
  const artistKeys = [...new Set(allPairs.map(p => p.artistKey))]

  console.log(`   ${performances} performances · ${tapeSkipped} tape · ${coversDeferred} covers deferred to Window 2`)
  console.log(`   ${allPairs.length} unique non-cover pairs across ${artistKeys.length} artists`)
  if (unresolvedArtists.size) {
    console.log(`   ${unresolvedArtists.size} artist(s) have setlists but no usable discography — left unattributed`)
  }
  console.log()

  /**
   * The artist's studio albums, oldest first.
   *
   * `album-eras.json` is the source of truth — pre-filtered, pre-sorted, and
   * since #281 it covers openers as well as headliners (101 -> 238 artists).
   * Before that it held headliners only, which silently denied 412 of 1,846
   * pairs (22.3%) any chance of attribution: ABC, Pet Shop Boys, Public Enemy,
   * OMD and 48 others reached this function with nothing to match against.
   *
   * The discography fallback is kept as a guard, not a second path. It filters
   * through the SAME exported predicate, so it cannot disagree with the era
   * join about what a studio album is — the divergence §Part 2 warns about is
   * a second *implementation*, and there is still exactly one. It should now
   * be unreachable for anyone on a bill; if it starts firing, album-eras has
   * lost coverage and that is worth knowing rather than papering over.
   */
  const studioAlbumsFor = (artistKey: string): StudioAlbum[] => {
    const fromEras = eras.artists?.[artistKey]?.studioAlbums
    if (fromEras?.length) return fromEras

    return (discography[artistKey]?.albums ?? [])
      .filter(isStudioAlbum)
      .map((a: RawAlbum): StudioAlbum => ({
        mbid: a.id,
        title: a.title,
        releaseDate: a.releaseDate,
        coverAvailable: a.coverAvailable ?? false,
      }))
      .sort((a: StudioAlbum, b: StudioAlbum) => a.releaseDate.localeCompare(b.releaseDate))
  }

  const results: Record<string, SongAlbum> = {}
  const attribute = (pair: Pair, album: StudioAlbum, tier: 0 | 1) => {
    results[pair.key] = {
      songTitle: pair.songTitle,
      albumTitle: album.title,
      mbid: album.mbid,
      releaseDate: album.releaseDate,
      coverAvailable: album.coverAvailable,
      matchTier: tier,
    }
  }

  // ── Tier 0 — reuse what is already on disk ────────────────────────────────

  console.log('📀 Tier 0 — reusing artists-top-tracks.json (0 API calls)')
  let tier0 = 0

  for (const pair of allPairs) {
    const albums = studioAlbumsFor(pair.artistKey)
    if (!albums.length) continue

    // Top tracks are keyed by CONCERT slug; the era join by discography key.
    // Try both, since the two disagree for exactly the drift cases artist-key
    // exists to fix.
    const tracks =
      topTracks[pair.artistSlug]?.tracks ?? topTracks[pair.artistKey]?.tracks ?? []

    const wanted = foldSongTitle(pair.songTitle)
    const hit = tracks.find((t: any) => foldSongTitle(t.name) === wanted)
    if (!hit?.albumName || isSingleOrEp(hit.albumName)) continue

    const match = matchAlbumTitle(hit.albumName, albums)
    if (!match) continue

    attribute(pair, match.album, 0)
    tier0++
  }

  console.log(`   ${tier0} attributed\n`)

  // ── Tier 1 — MusicBrainz track-listing index ──────────────────────────────

  const remaining = allPairs.filter(p => !results[p.key])
  const artistsNeedingTier1 = [...new Set(remaining.map(p => p.artistKey))]
    .filter(k => studioAlbumsFor(k).length > 0)

  const cache = loadCache()
  const client = new MusicBrainzClient()

  const toFetch = artistsNeedingTier1.flatMap(k =>
    studioAlbumsFor(k)
      .filter(a => {
        if (force) return true
        const cached = cache.entries[a.mbid]
        if (!cached) return true
        return Date.now() - new Date(cached.cachedAt).getTime() > NINETY_DAYS
      })
      .map(a => a.mbid)
  )
  const uniqueToFetch = [...new Set(toFetch)]

  console.log(`📡 Tier 1 — MusicBrainz track listings`)
  console.log(`   ${artistsNeedingTier1.length} artists with residual misses`)
  console.log(`   ${uniqueToFetch.length} release-groups to fetch (${Object.keys(cache.entries).length} cached)`)
  if (uniqueToFetch.length) {
    const mins = Math.ceil(uniqueToFetch.length / 60)
    console.log(`   ~${mins} minute(s) at MusicBrainz's 1 req/sec limit\n`)
  } else {
    console.log()
  }

  let fetched = 0
  for (const mbid of uniqueToFetch) {
    const tracks = await client.getReleaseGroupTracks(mbid)
    cache.entries[mbid] = { tracks, cachedAt: new Date().toISOString() }
    fetched++
    if (fetched % 25 === 0) {
      console.log(`   ${fetched}/${uniqueToFetch.length} fetched`)
      saveCache(cache) // checkpoint — a 15-minute run must survive a crash
    }
  }
  // The cache is saved even under --dry-run, deliberately. It holds upstream
  // MusicBrainz data, not a deliverable: --dry-run means "do not change
  // song-albums.json", not "throw away 15 minutes of rate-limited fetching and
  // make someone do it twice."
  if (fetched) saveCache(cache)
  if (fetched) console.log(`   ${fetched} fetched\n`)

  let tier1 = 0
  for (const artistKey of artistsNeedingTier1) {
    const albums = studioAlbumsFor(artistKey)

    const index = buildSongIndex(albums, mbid => cache.entries[mbid]?.tracks ?? [])

    for (const pair of remaining.filter(p => p.artistKey === artistKey)) {
      const album = index.get(foldSongTitle(pair.songTitle))
      if (!album) continue
      attribute(pair, album, 1)
      tier1++
    }
  }

  console.log(`   ${tier1} attributed\n`)

  // ── Output ────────────────────────────────────────────────────────────────

  const attributed = Object.keys(results).length
  const rate = allPairs.length ? (attributed / allPairs.length) * 100 : 0

  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    songs: results,
    stats: {
      uniquePairs: allPairs.length,
      attributed,
      byTier: { '0': tier0, '1': tier1 },
      unattributed: allPairs.length - attributed,
      coversDeferred,
      artistsWithoutDiscography: unresolvedArtists.size,
    },
  }

  // Minified, matching album-eras.json. This file is fetched over the network
  // by the MCP; indentation is 157 KB of whitespace nobody reads.
  const serialized = JSON.stringify(output)
  if (!dryRun) {
    writeFileSync(resolve(OUTPUT_PATH), serialized, 'utf-8')
  }

  // Measure what is actually WRITTEN. Reporting the minified size of a
  // pretty-printed file understated this by 157 KB on the first run.
  const bytes = Buffer.byteLength(serialized)
  console.log('📊 Attribution Summary')
  console.log(`   Tier 0 (top-tracks): ${tier0}`)
  console.log(`   Tier 1 (musicbrainz): ${tier1}`)
  console.log(`   Attributed: ${attributed} / ${allPairs.length}  (${rate.toFixed(1)}%)`)
  console.log(`   Unattributed: ${allPairs.length - attributed}`)
  console.log(`   Size: ${(bytes / 1024).toFixed(0)} KB (budget 400 KB)`)
  console.log(dryRun ? `\n🌵 DRY RUN — nothing written` : `\n🎉 Saved to ${OUTPUT_PATH}`)

  return output
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resolveSongAlbums().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
