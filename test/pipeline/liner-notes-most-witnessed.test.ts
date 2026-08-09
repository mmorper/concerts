/**
 * most-witnessed-album detector (v6.0, #277 §5b)
 *
 * The record you have heard the most of, live. The tests care most about the
 * claims it is allowed to make: it ranks by DISTINCT songs rather than
 * performances, and it refuses to publish a fraction it cannot support.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectMostWitnessedAlbum, type SongAlbumsSlim } from '../../scripts/liner-notes/analyze.ts'
import { buildSetlistIndex } from '../../scripts/liner-notes/setlists.ts'
import type { Concert } from '../../src/types/concert.ts'

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, 'public', 'data', f), 'utf8'))

const concerts: Concert[] = read('concerts.json').concerts
const setlists = buildSetlistIndex(read('setlists-cache.json'))
const songAlbums: SongAlbumsSlim = read('song-albums.json')
const artistsMetadata = read('artists-metadata.json')
const discographyKeys = JSON.parse(
  readFileSync(join(ROOT, 'data', 'artist-aliases.json'), 'utf8')
).discographyKeys

const trackCache = JSON.parse(
  readFileSync(join(ROOT, 'data', 'cache', 'musicbrainz-tracks.json'), 'utf8')
)
const albumTrackCounts: Record<string, number> = {}
for (const [mbid, entry] of Object.entries<{ tracks?: string[] }>(trackCache.entries ?? {})) {
  if (Array.isArray(entry?.tracks)) albumTrackCounts[mbid] = entry.tracks.length
}

const ctx = {
  artistsMetadata: artistsMetadata.artists ?? artistsMetadata,
  discographyKeys,
  albumTrackCounts,
}

const findings = detectMostWitnessedAlbum(concerts, setlists, songAlbums, ctx)

describe('most-witnessed-album', () => {
  it('names exactly one album — there is only one "most"', () => {
    expect(findings).toHaveLength(1)
    expect(findings[0].detector).toBe('most-witnessed-album')
    expect(findings[0].category).toBe('personal')
  })

  it('carries every data point the spec asks for', () => {
    const dp = findings[0].dataPoints as Record<string, unknown>
    for (const key of [
      'albumTitle',
      'artist',
      'distinctSongsWitnessed',
      'totalPerformances',
      'showsSpanned',
      'firstDate',
      'lastDate',
      'albumTrackCount',
    ]) {
      expect(dp).toHaveProperty(key)
    }
    expect(dp.distinctSongsWitnessed as number).toBeGreaterThanOrEqual(2)
    expect(dp.totalPerformances as number).toBeGreaterThanOrEqual(
      dp.distinctSongsWitnessed as number
    )
  })

  it('ranks by distinct songs, so one song at five shows does not win', () => {
    const dp = findings[0].dataPoints as Record<string, unknown>
    const songs = dp.songsWitnessed as string[]
    expect(new Set(songs).size).toBe(songs.length)
    expect(songs.length).toBe(dp.distinctSongsWitnessed)
  })

  it('refuses a fraction it cannot support', () => {
    // The cached track list describes ONE release while the resolver indexes the
    // whole release-group, so B-sides can push the witnessed count above it —
    // Garbage's debut counts 17 witnessed against a cached 12. Reporting "17 of
    // 12" in a permalinked post is worse than reporting nothing.
    const dp = findings[0].dataPoints as Record<string, unknown>
    const count = dp.albumTrackCount as number | null
    if (count !== null) {
      expect(count).toBeGreaterThanOrEqual(dp.distinctSongsWitnessed as number)
    }
  })

  it('does not repeat the artist name for a self-titled record', () => {
    const dp = findings[0].dataPoints as Record<string, unknown>
    const artist = (dp.artist as string).toLowerCase()
    const album = (dp.albumTitle as string).toLowerCase()
    if (artist === album) {
      expect(findings[0].headline).toContain('The Album That Shares Their Name')
    }
    // The artist is always named, whatever the album is called.
    expect(findings[0].headline).toContain(dp.artist as string)
  })

  it('anchors on a real night that supplied the album', () => {
    const f = findings[0]
    const dp = f.dataPoints as Record<string, unknown>
    expect(f.concertDate).toBe(dp.date)
    const anchor = concerts.find((c) => c.date === f.concertDate)
    expect(anchor).toBeDefined()
    expect(dp.firstDate as string <= (f.concertDate as string)).toBe(true)
    expect((f.concertDate as string) <= (dp.lastDate as string)).toBe(true)
  })

  it('tags per spec §5b', () => {
    expect(findings[0].tags).toContain('#most-witnessed')
    expect(findings[0].tags).toContain('#album-eras')
  })
})

describe('most-witnessed-album — degradation', () => {
  it('returns [] with no attribution data', () => {
    expect(detectMostWitnessedAlbum(concerts, setlists, undefined, ctx)).toEqual([])
  })

  it('returns [] with no setlists', () => {
    expect(detectMostWitnessedAlbum(concerts, undefined, songAlbums, ctx)).toEqual([])
  })

  it('returns [] rather than crowning an album heard once', () => {
    const oneSong: SongAlbumsSlim = {
      songs: Object.fromEntries(Object.entries(songAlbums.songs).slice(0, 1)),
    }
    expect(detectMostWitnessedAlbum(concerts, setlists, oneSong, ctx)).toEqual([])
  })

  it('reports a null track count when the cache is absent, never a guess', () => {
    const noCounts = detectMostWitnessedAlbum(concerts, setlists, songAlbums, {
      ...ctx,
      albumTrackCounts: undefined,
    })
    expect(noCounts[0].dataPoints.albumTrackCount).toBeNull()
  })
})
