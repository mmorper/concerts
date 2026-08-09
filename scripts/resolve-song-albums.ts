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
 * Tier 2 — iTunes fallback, gated on release-groups we already hold
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
import { iTunesClient } from './utils/itunes-client.js'
import { matchAlbumTitle, isSingleOrEp } from './utils/album-title.js'
import { foldSongTitle, songIndexKeys, songAlbumKey } from './utils/song-title.js'
import { buildArtistKeyIndex, resolveArtistKey } from './utils/artist-key.js'
import { buildAliasMap, canonicalOf, type AliasMap } from './liner-notes/artist-aliases.ts'
import { isStudioAlbum, type RawAlbum } from './derive-album-eras.js'

const DATA = 'public/data'
const CACHE_PATH = 'data/cache/musicbrainz-tracks.json'
const OUTPUT_PATH = `${DATA}/song-albums.json`

/** Track listings change only when MusicBrainz is edited. Same TTL as discography. */
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

/**
 * ~20 requests/minute at iTunes, deliberately conservative.
 *
 * enrich-top-tracks.ts runs at 600ms and a 257-artist sweep earned an HTTP 403
 * block on the whole client (#275). Tier 2 is a lower-value tier than audio
 * previews and has no business spending that budget faster.
 */
const ITUNES_DELAY_MS = 3000

/** Minimal rate limiter — mirrors the one in enrich-top-tracks.ts. */
class RateLimiter {
  private last = 0
  constructor(private delayMs: number) {}
  async wait(): Promise<void> {
    const waitFor = Math.max(0, this.delayMs - (Date.now() - this.last))
    if (waitFor > 0) await new Promise(r => setTimeout(r, waitFor))
    this.last = Date.now()
  }
}

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
 *   source            implied by matchTier (0 = top-tracks, 1 = musicbrainz, 2 = itunes)
 *
 * Carrying those three cost 217 KB across 1,629 entries — more than half the
 * size budget — to store values a consumer can compute or already knows.
 *
 * `isCover` and `originalArtistKey` are OPTIONAL and written only for covers.
 * Emitting `false`/`null` on the ~90% of entries that are not covers is the
 * same waste in a different shape.
 */
interface SongAlbum {
  songTitle: string
  albumTitle: string
  mbid: string
  releaseDate: string
  coverAvailable: boolean
  matchTier: 0 | 1 | 2
  isCover?: true
  originalArtistKey?: string
}

interface TrackCache {
  version: string
  /** release-group MBID → its canonical track titles. */
  entries: Record<string, { tracks: string[]; cachedAt: string }>
  /** Tier 2: entry key → the album iTunes named, or null for a miss worth remembering. */
  itunes?: Record<string, { albumName: string | null; cachedAt: string }>
}

/**
 * One setlist song to attribute.
 *
 * `artistKey` is whose DISCOGRAPHY the song is looked up in. For a cover that
 * is the original artist, not whoever was on stage — Dropkick Murphys playing
 * "No Surrender" did not put it on a Dropkick Murphys album.
 *
 * The entry KEY stays under the performing artist, because that is what a
 * consumer holds: the MCP reading a setlist knows who was billed, not who
 * wrote the song.
 */
interface Pair {
  artistKey: string
  artistSlug: string
  songTitle: string
  key: string
  isCover: boolean
  originalArtistKey: string | null
}

// ── Core derivation (pure, exported for tests) ───────────────────────────────

/**
 * Re-exported from `utils/song-title.ts`, where it now lives so the MCP Worker
 * can import it without pulling `fs` and the API clients into a Workers bundle.
 * Importing it from here still works and still resolves to the one implementation.
 */
export { songAlbumKey }

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

/**
 * Which discography answers for a cover — the ORIGINAL artist's.
 *
 * TWO HOPS, and conflating them is the trap (§Part 3):
 *
 *   1. billing → act, via `canonicalOf`, collapsing marquees into one act
 *   2. act → discography key, via `resolveArtistKey` with BOTH alias relations
 *
 * Hop 1 alone returns the concert-side slug, which is deliberately NOT the
 * discography key for the three cases the `discographyKeys` relation exists to
 * fix — `yaz`→`yazoo`, `the-english-beat`→`the-beat`, `omd`→
 * `orchestral-manoeuvres-in-the-dark`. `buildAliasMap` reads only `sameAct`
 * and `sharesMember`, so hop 1 cannot know about them.
 *
 * Skipping hop 2 drops those artists silently, and silently is the problem: it
 * is indistinguishable from the common, correct outcome of "we hold no
 * discography for whoever wrote this song."
 *
 * Exported so the trap has a test rather than a comment.
 */
export function resolveOriginalArtistKey(
  coverArtistName: string,
  deps: {
    aliasMap: AliasMap
    keyIndex: ReadonlyMap<string, string>
    discography: Record<string, { albums?: unknown[] }>
    aliasesOf: (slug: string) => readonly string[]
  }
): string | null {
  if (!coverArtistName?.trim()) return null

  const slug = coverArtistName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const act = canonicalOf(deps.aliasMap, slug)

  const resolved = resolveArtistKey(act, coverArtistName, deps.keyIndex, deps.discography, {
    aliasesOf: (s: string) => deps.aliasesOf(s),
    // A record with zero albums is a worse answer than no record: `omd` exists
    // and is empty while the real catalogue sits elsewhere.
    isUsable: (record: { albums?: unknown[] }) => (record?.albums?.length ?? 0) > 0,
  })

  return resolved.key
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

  const linerAliases = buildAliasMap(aliases)

  const originalArtistKeyFor = (coverName: string): string | null =>
    resolveOriginalArtistKey(coverName, {
      aliasMap: linerAliases,
      keyIndex,
      discography,
      aliasesOf: (slug: string) => aliasesOfSlug.get(slug) ?? [],
    })

  const pairs = new Map<string, Pair>()
  let performances = 0
  let tapeSkipped = 0
  let coverPerformances = 0
  let coversUnroutable = 0
  const unresolvedArtists = new Set<string>()

  for (const entry of Object.values<any>(setlists.entries ?? {})) {
    const sets = entry?.setlist?.sets?.set ?? []
    for (const song of sets.flatMap((s: any) => s.song ?? [])) {
      if (!song?.name?.trim()) continue
      performances++

      // tape wins wherever it overlaps with cover — walk-on music is not a
      // performance at all, so it never reaches attribution.
      if (song.tape) { tapeSkipped++; continue }

      const slug = slugOf(entry.artistName ?? '')
      if (!slug) continue

      const performer = resolveArtistKey(slug, entry.artistName, keyIndex, discography, resolveOptions)

      let lookupKey: string | null
      let originalArtistKey: string | null = null
      const isCover = Boolean(song.cover)

      if (isCover) {
        coverPerformances++
        originalArtistKey = song.cover?.name ? originalArtistKeyFor(song.cover.name) : null
        lookupKey = originalArtistKey
        // Most covered artists were never seen live, so we hold no discography
        // for them. That is the expected outcome, not a failure.
        if (!lookupKey) { coversUnroutable++; continue }
      } else {
        lookupKey = performer.key
        if (!lookupKey) { unresolvedArtists.add(slug); continue }
      }

      // Keyed by the PERFORMING artist even for covers: a consumer reading a
      // setlist knows who was billed, not who wrote the song. Falls back to
      // the slug when the performer has no discography of their own — a cover
      // is still attributable in that case, since the album is the original's.
      const entryKey = songAlbumKey(performer.key ?? slug, song.name)
      if (!pairs.has(entryKey)) {
        pairs.set(entryKey, {
          artistKey: lookupKey,
          artistSlug: slug,
          songTitle: song.name.trim(),
          key: entryKey,
          isCover,
          originalArtistKey,
        })
      }
    }
  }

  const allPairs = [...pairs.values()].filter(p => !artist || p.artistKey === artist)
  const artistKeys = [...new Set(allPairs.map(p => p.artistKey))]

  const coverPairs = allPairs.filter(p => p.isCover).length
  console.log(`   ${performances} performances · ${tapeSkipped} tape (incl. tape+cover)`)
  console.log(`   ${coverPerformances} cover performances · ${coversUnroutable} unroutable (no discography for the original artist)`)
  console.log(`   ${allPairs.length} unique pairs across ${artistKeys.length} artists — ${coverPairs} of them covers`)
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
  const attribute = (pair: Pair, album: StudioAlbum, tier: 0 | 1 | 2) => {
    results[pair.key] = {
      songTitle: pair.songTitle,
      albumTitle: album.title,
      mbid: album.mbid,
      releaseDate: album.releaseDate,
      coverAvailable: album.coverAvailable,
      matchTier: tier,
      ...(pair.isCover
        ? { isCover: true as const, originalArtistKey: pair.originalArtistKey ?? undefined }
        : {}),
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

  // ── Tier 2 — iTunes fallback, gated on our own discography ────────────────
  //
  // The gate is the whole design. iTunes is asked what album a song is on, and
  // its answer is accepted ONLY when the normalized title matches a studio
  // release-group we already hold. Without that, a search for an obscure song
  // returns a compilation or a tribute record and the pipeline cheerfully
  // attributes a first-person memory to an album that has nothing to do with
  // the night in question.
  //
  // So Tier 2 never introduces an album. It only re-labels a song onto a
  // record the archive already knows about — the same fail-closed contract as
  // every other tier, with a different lookup in front of it.

  const stillMissing = allPairs.filter(p => !results[p.key])
  cache.itunes ??= {}

  console.log(`🍎 Tier 2 — iTunes fallback (${stillMissing.length} residual misses)`)

  const itunes = new iTunesClient()
  const itunesLimiter = new RateLimiter(ITUNES_DELAY_MS)
  let tier2 = 0
  let itunesCalls = 0
  let itunesRejected = 0

  for (const pair of stillMissing) {
    const albums = studioAlbumsFor(pair.artistKey)
    if (!albums.length) continue

    const displayName = discography[pair.artistKey]?.artistName ?? pair.artistKey

    let albumName = cache.itunes[pair.key]?.albumName ?? null
    const cached = pair.key in cache.itunes

    if (!cached) {
      await itunesLimiter.wait()
      const candidates = await itunes.searchSong(displayName, pair.songTitle, 5)
      itunesCalls++

      // Believe a candidate only if iTunes also agrees on WHO recorded it.
      // #275 is the standing proof that a name search returns whoever the
      // term matched, not who was asked for.
      const wanted = foldSongTitle(pair.songTitle)
      const hit = candidates.find(c => foldSongTitle(c.name) === wanted)
      albumName = hit?.albumName ?? null

      cache.itunes[pair.key] = { albumName, cachedAt: new Date().toISOString() }
      if (itunesCalls % 25 === 0) {
        console.log(`   ${itunesCalls} queried`)
        saveCache(cache)
      }
    }

    if (!albumName || isSingleOrEp(albumName)) continue

    const match = matchAlbumTitle(albumName, albums)
    if (!match) { itunesRejected++; continue }

    attribute(pair, match.album, 2)
    tier2++
  }

  if (itunesCalls) saveCache(cache)
  console.log(`   ${itunesCalls} queried · ${itunesRejected} rejected (album not in our discography) · ${tier2} attributed\n`)

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
      byTier: { '0': tier0, '1': tier1, '2': tier2 },
      unattributed: allPairs.length - attributed,
      coverPairs,
      coversUnroutable,
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
  console.log(`   Tier 0 (top-tracks):  ${tier0}`)
  console.log(`   Tier 1 (musicbrainz): ${tier1}`)
  console.log(`   Tier 2 (itunes):      ${tier2}`)
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
