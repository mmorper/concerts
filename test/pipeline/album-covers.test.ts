/**
 * Tests for scripts/resolve-album-covers.ts — iTunes covers for the Ask cards, resolved
 * once at build time.
 *
 * The two failures that matter: a WRONG sleeve (worse than the derived one), and a failed
 * request cached as "no covers" for 90 days (the bug resolve-song-albums.ts already paid
 * for once with empty MusicBrainz tracklists).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { collectJobs, isFresh, matchCovers, resolveAlbumCovers, type CacheEntry } from '../../scripts/resolve-album-covers.ts'
import { ITunesBlockedError, type ItunesAlbum } from '../../scripts/utils/itunes-client.ts'

const art = (n: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/${n}/100x100bb.jpg`
const it_ = (collectionName: string, artistName = 'The Human League', n = collectionName): ItunesAlbum => ({ collectionName, artistName, artworkUrl100: art(n) })
const DARE = { mbid: 'e8e7999e-0b87-3298-947d-2ad22717fc27', title: 'Dare' }
const CRASH = { mbid: '0aca24c5-d99d-3bc7-913c-8761e3409304', title: 'Crash' }

describe('matchCovers', () => {
  it('matches through edition dressing and prefers the plain edition', () => {
    const covers = matchCovers([DARE, CRASH], [it_('Dare (Deluxe Edition)', undefined, 'deluxe'), it_('Dare', undefined, 'plain'), it_('Crash (Bonus Track Version)', undefined, 'crash')])
    expect(covers).toEqual({ [DARE.mbid]: art('plain'), [CRASH.mbid]: art('crash') })
  })

  it('leaves an album out rather than guess', () => {
    expect(matchCovers([DARE], [it_('Greatest Hits'), it_('Dare to Be Different')])).toEqual({})
  })

  it('ignores singles and EPs that share an album title', () => {
    expect(matchCovers([DARE], [it_('Dare - Single')])).toEqual({})
  })

  it('on the search path, requires the artist to be the one asked for', () => {
    const found = [it_('Crash', 'Dave Matthews Band', 'dmb'), it_('Crash', 'Human League', 'thl')]
    expect(matchCovers([CRASH], found, 'The Human League')).toEqual({ [CRASH.mbid]: art('thl') })
  })
})

describe('collectJobs', () => {
  it('groups every studio album and song-album under its artist, with the iTunes id when known', () => {
    const eras = { artists: { 'the-human-league': { displayName: 'The Human League', studioAlbums: [DARE] }, 'merle-kilgore': { displayName: 'Merle Kilgore', studioAlbums: [] } } }
    const songs = { songs: { 'the-human-league::love-action': { mbid: DARE.mbid, albumTitle: 'Dare' }, 'x::y': { mbid: CRASH.mbid, albumTitle: 'Crash', originalArtistKey: 'the-human-league' } } }
    const jobs = collectJobs(eras, songs, { 'the-human-league': { itunesArtistId: 14138758 } })
    expect(jobs).toEqual([{ key: 'the-human-league', name: 'The Human League', itunesId: 14138758, albums: [DARE, CRASH] }])
  })

  it('covers the real archive: every artist with albums, nearly all by exact iTunes id', () => {
    const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf-8'))
    const jobs = collectJobs(read('album-eras.json'), read('song-albums.json'), read('artists-top-tracks.json'))
    const albums = jobs.reduce((n, j) => n + j.albums.length, 0)
    expect(jobs.length).toBeGreaterThan(200)
    expect(albums).toBeGreaterThan(2000)
    expect(jobs.filter(j => j.itunesId == null).length).toBeLessThan(10) // one request per artist, not per album
    expect(jobs.find(j => j.key === 'the-human-league')?.albums.map(a => a.title)).toContain('Hysteria')
  })
})

describe('isFresh', () => {
  const job = { key: 'k', name: 'K', itunesId: 1, albums: [DARE] }
  const entry = (days: number, checked = [DARE.mbid]): CacheEntry => ({ fetchedAt: new Date(Date.now() - days * 864e5).toISOString(), via: 'id', checked, covers: {} })
  it('is fresh inside 90 days', () => expect(isFresh(entry(10), job, Date.now())).toBe(true))
  it('is stale after 90 days', () => expect(isFresh(entry(91), job, Date.now())).toBe(false))
  it('is stale when the artist has an album the entry never answered for', () => expect(isFresh(entry(1, []), job, Date.now())).toBe(false))
})

describe('resolveAlbumCovers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('stops on a block, and never caches a failed request as "no covers"', async () => {
    const calls: string[] = []
    const client = {
      getAlbumsByArtistId: vi.fn(async (id: number) => {
        calls.push(String(id))
        if (calls.length === 1) throw new Error('iTunes API error 500')
        throw new ITunesBlockedError(`artist ID ${id}`)
      }),
      searchAlbums: vi.fn(async () => []),
    }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await resolveAlbumCovers({ dryRun: true, force: true, client, delayMs: 0, chunkPauseMs: 0 })
    expect(calls).toHaveLength(2) // the 500 is skipped, the 403 ends the run
    expect(out.stats.artists).toBeGreaterThan(200)
  })
})
