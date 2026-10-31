/**
 * Resolve every album the Ask cards draw to an iTunes cover, once, at build time.
 *
 * Why build time: the cards used to ask Cover Art Archive from the browser, and on
 * 2026-10-31 CAA 500'd on Dare, Hysteria, Secrets and Credo. A runtime iTunes lookup in
 * the ask-chat Worker was tried next (#596, #597) and iTunes answered HTTP 429 — Workers
 * share egress IPs, so the request budget is spent before we ask. Resolving here, from
 * one machine on a schedule, spends a few hundred requests once and nothing at view time.
 *
 * ONE REQUEST PER ARTIST, NOT PER ALBUM. 246 of the 249 artists with studio albums
 * already carry their exact iTunes artist ID (artists-top-tracks.json), and
 * /lookup?id=…&entity=album returns their whole catalogue. ~250 requests, not 2,400. The
 * three without an ID fall back to an album search filtered to that artist's name.
 *
 * MATCHING FAILS CLOSED, via the shared album-title matcher (edition markers like
 * "(Remastered)" stripped on both sides; no fuzzy tier). A wrong sleeve is worse than the
 * derived one, and Cover Art Archive still sits behind this in the card's ladder.
 *
 * iTunes allows a budget of roughly 45–90 requests before blocking the client for minutes
 * (itunes-client.ts). So requests go out every 3 s in chunks of 40 with a pause between,
 * and a 403 stops the run — what was fetched is kept, and the next run carries on.
 *
 * Usage:
 *   npm run resolve:album-covers                 # new/stale artists only
 *   npm run resolve:album-covers -- --dry-run    # preview, write nothing
 *   npm run resolve:album-covers -- --force      # ignore the 90-day cache
 *   npm run resolve:album-covers -- --artist the-human-league
 *   npm run resolve:album-covers -- --limit 40   # at most 40 artists fetched this run
 *   npm run resolve:album-covers -- --offline    # no requests: rebuild from cache + top-tracks
 *
 * Output: public/data/album-covers.json  { covers: { <release-group mbid>: <artworkUrl100> } }
 * Cache:  data/cache/itunes-album-covers.json (committed; per artist, append-only)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { iTunesClient, ITunesBlockedError, type ItunesAlbum } from './utils/itunes-client.js'
import { matchAlbumTitle, isSingleOrEp } from './utils/album-title.js'

const DATA = 'public/data'
const CACHE_PATH = 'data/cache/itunes-album-covers.json'
const OUTPUT_PATH = `${DATA}/album-covers.json`
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
const DELAY_MS = 3000
const CHUNK = 40
const CHUNK_PAUSE_MS = 4 * 60 * 1000

export interface Album {
  mbid: string
  title: string
}

/** Per artist: what was checked, what matched. Small on purpose — not iTunes' catalogue. */
export interface CacheEntry {
  fetchedAt: string
  via: 'id' | 'search'
  /** Every mbid this entry answered for — an album missing from it means "fetch again". */
  checked: string[]
  covers: Record<string, string>
}
export interface CoverCache {
  version: '1.0.0'
  artists: Record<string, CacheEntry>
}

export interface AlbumCovers {
  version: '1.0.0'
  generatedAt: string
  covers: Record<string, string>
  stats: { albums: number; covered: number; artists: number; artistsMissing: number }
}

const foldName = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')

/**
 * Pair each archive album with an iTunes collection. `artistName` set (the search path)
 * also requires iTunes' artist to be that artist; the ID path is exact already.
 * Shorter collection names go first, so the plain edition beats "(Deluxe Edition)".
 */
export function matchCovers(albums: Album[], itunes: ItunesAlbum[], artistName: string | null = null): Record<string, string> {
  const want = artistName ? foldName(artistName) : null
  const candidates = itunes
    .filter(c => c.artworkUrl100 && !isSingleOrEp(c.collectionName))
    .filter(c => !want || foldName(c.artistName) === want)
    .sort((a, b) => a.collectionName.length - b.collectionName.length)
    .map(c => ({ title: c.collectionName, art: c.artworkUrl100 }))
  const out: Record<string, string> = {}
  for (const a of albums) {
    const m = matchAlbumTitle(a.title, candidates)
    if (m) out[a.mbid] = m.album.art
  }
  return out
}

interface ArtistJob {
  key: string
  name: string
  itunesId: number | null
  albums: Album[]
}

/** Every album the cards can draw, grouped by the artist whose catalogue holds it. */
export function collectJobs(eras: AlbumErasLike, songs: SongAlbumsLike, topTracks: TopTracksLike): ArtistJob[] {
  const jobs = new Map<string, ArtistJob>()
  const add = (key: string, album: Album) => {
    const era = eras.artists[key]
    if (!era) return
    let job = jobs.get(key)
    if (!job) {
      const id = topTracks[key]?.itunesArtistId
      job = { key, name: era.displayName, itunesId: typeof id === 'number' ? id : null, albums: [] }
      jobs.set(key, job)
    }
    if (!job.albums.some(a => a.mbid === album.mbid)) job.albums.push(album)
  }
  for (const [key, era] of Object.entries(eras.artists)) for (const a of era.studioAlbums ?? []) add(key, { mbid: a.mbid, title: a.title })
  for (const [k, s] of Object.entries(songs.songs)) add(s.originalArtistKey ?? k.split('::')[0], { mbid: s.mbid, title: s.albumTitle })
  return [...jobs.values()].sort((a, b) => a.key.localeCompare(b.key))
}

interface AlbumErasLike {
  artists: Record<string, { displayName: string; studioAlbums?: Array<{ mbid: string; title: string }> }>
}
interface SongAlbumsLike {
  songs: Record<string, { mbid: string; albumTitle: string; originalArtistKey?: string }>
}
type TopTracksLike = Record<string, { itunesArtistId?: number; tracks?: Array<{ albumName?: string; albumArt?: string }> } | undefined>

/**
 * Tier 0, no network: the artwork already in artists-top-tracks.json, matched to the artist's
 * own albums. The matcher only binds to albums we hold for THIS artist, so a mis-resolved
 * top-tracks entry (#275: Bad Religion → channel ORANGE) matches nothing.
 */
export function topTrackCovers(job: { albums: Album[] }, entry: TopTracksLike[string]): Record<string, string> {
  const found = (entry?.tracks ?? [])
    .filter(t => t.albumName && t.albumArt)
    .map(t => ({ collectionName: t.albumName!, artistName: '', artworkUrl100: t.albumArt! }))
  return matchCovers(job.albums, found)
}

/** Fresh enough, and it has answered for every album the artist has now. */
export function isFresh(entry: CacheEntry | undefined, job: ArtistJob, now: number): boolean {
  if (!entry) return false
  if (now - Date.parse(entry.fetchedAt) > NINETY_DAYS) return false
  return job.albums.every(a => entry.checked.includes(a.mbid))
}

const readData = (file: string) => JSON.parse(readFileSync(resolve(DATA, file), 'utf-8'))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function loadCache(): CoverCache {
  try {
    return JSON.parse(readFileSync(resolve(CACHE_PATH), 'utf-8'))
  } catch {
    return { version: '1.0.0', artists: {} }
  }
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(resolve(path)), { recursive: true })
  writeFileSync(resolve(path), JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function resolveAlbumCovers(
  options: { dryRun?: boolean; force?: boolean; offline?: boolean; artist?: string; limit?: number; client?: Pick<iTunesClient, 'getAlbumsByArtistId' | 'searchAlbums'>; delayMs?: number; chunkPauseMs?: number } = {},
) {
  const { dryRun = false, force = false, offline = false, artist, limit = Infinity, delayMs = DELAY_MS, chunkPauseMs = CHUNK_PAUSE_MS } = options
  const client = options.client ?? new iTunesClient()
  const cache = loadCache()
  const topTracks = readData('artists-top-tracks.json') as TopTracksLike
  const jobs = collectJobs(readData('album-eras.json'), readData('song-albums.json'), topTracks)
  const now = Date.now()
  const todo = jobs.filter(j => (!artist || j.key === artist) && (force || !isFresh(cache.artists[j.key], j, now)))

  console.log(`🎨 Album covers: ${jobs.length} artists, ${offline ? 0 : todo.length} to fetch${offline ? ' (offline)' : limit < Infinity ? ` (limit ${limit})` : ''}`)
  let requests = 0
  let failed = 0
  let blocked = false
  for (const job of offline ? [] : todo.slice(0, limit)) {
    if (requests > 0 && requests % CHUNK === 0) {
      console.log(`   ⏸  ${requests} requests — pausing ${Math.round(chunkPauseMs / 1000)}s for iTunes' budget`)
      await sleep(chunkPauseMs)
    } else if (requests > 0) {
      await sleep(delayMs)
    }
    requests++
    try {
      const itunes = job.itunesId != null ? await client.getAlbumsByArtistId(job.itunesId) : await client.searchAlbums(job.name)
      const covers = matchCovers(job.albums, itunes, job.itunesId != null ? null : job.name)
      cache.artists[job.key] = {
        fetchedAt: new Date().toISOString(),
        via: job.itunesId != null ? 'id' : 'search',
        checked: job.albums.map(a => a.mbid),
        covers,
      }
      console.log(`   ✓ ${job.name}: ${Object.keys(covers).length}/${job.albums.length}`)
    } catch (e) {
      if (e instanceof ITunesBlockedError) {
        console.warn(`   ⛔ ${e.message}. Stopping; the next run carries on from here.`)
        blocked = true
        break
      }
      failed++ // not cached: a failure must never read as "no covers" for 90 days
      console.warn(`   ⚠ ${job.name}: ${e instanceof Error ? e.message : e}`)
    }
  }

  // The full lookup wins; top-tracks artwork fills in for artists not fetched yet (or albums
  // the lookup missed), so the file is useful from its very first, offline, run.
  const covers: Record<string, string> = {}
  let albums = 0
  let missing = 0
  for (const job of jobs) {
    albums += job.albums.length
    const entry = cache.artists[job.key]
    if (!entry) missing++
    const base = topTrackCovers(job, topTracks[job.key])
    for (const a of job.albums) {
      const url = entry?.covers[a.mbid] ?? base[a.mbid]
      if (url) covers[a.mbid] = url
    }
  }
  const sorted = Object.fromEntries(Object.entries(covers).sort(([a], [b]) => a.localeCompare(b)))
  const output: AlbumCovers = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    covers: sorted,
    stats: { albums, covered: Object.keys(sorted).length, artists: jobs.length, artistsMissing: missing },
  }

  if (!dryRun) {
    cache.artists = Object.fromEntries(Object.entries(cache.artists).sort(([a], [b]) => a.localeCompare(b)))
    writeJson(CACHE_PATH, cache)
    writeJson(OUTPUT_PATH, output)
  }
  console.log(`   Requests: ${requests}, failed: ${failed}${blocked ? ', stopped on a block' : ''}`)
  console.log(`   Covered: ${output.stats.covered}/${albums} albums; ${missing} artists not fetched yet`)
  console.log(dryRun ? '   🌵 DRY RUN — nothing written' : `   🎉 Saved to ${OUTPUT_PATH}`)
  return output
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  resolveAlbumCovers({
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
    offline: process.argv.includes('--offline'),
    artist: arg('--artist'),
    limit: arg('--limit') ? Number(arg('--limit')) : undefined,
  }).catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
