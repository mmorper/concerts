/**
 * When the setlist pre-fetch reuses a cached entry and when it asks setlist.fm again.
 *
 * The Hollywood Bowl bill (2026-06-04) was fetched on 06-02, when setlist.fm's event pages
 * existed but held no songs. Those empty pages were reused on every run after, so the site
 * never showed the Human League's, Alison Moyet's or Soft Cell's set.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { canReuseCachedSetlist, setlistSongCount } from '../../scripts/prefetch-setlists.ts'

const withSongs = { sets: { set: [{ song: [{ name: 'Fascination' }] }] } } as never
const emptyPage = { sets: { set: [] } } as never
const entry = (setlist: unknown, date: string, fetchedAt: string) => ({ setlist: setlist as never, date, fetchedAt })

describe('canReuseCachedSetlist', () => {
  it('keeps a setlist that has songs, whenever it was fetched', () => {
    expect(canReuseCachedSetlist(entry(withSongs, '2026-06-04', '2026-06-02T14:40:00Z'))).toBe(true)
  })

  it('asks again about an empty page fetched before the show', () => {
    expect(canReuseCachedSetlist(entry(emptyPage, '2026-06-04', '2026-06-02T14:40:11Z'))).toBe(false)
  })

  it('asks again about an empty page fetched within 30 days after it', () => {
    expect(canReuseCachedSetlist(entry(emptyPage, '2026-09-14', '2026-09-30T00:00:00Z'))).toBe(false)
  })

  it('trusts an empty page fetched long after the show — 1980s pages stay empty', () => {
    expect(canReuseCachedSetlist(entry(emptyPage, '1985-03-31', '2026-01-05T00:00:00Z'))).toBe(true)
  })

  it('still retries a miss (no setlist found), as before', () => {
    expect(canReuseCachedSetlist(entry(null, '1985-03-31', '2026-01-05T00:00:00Z'))).toBe(false)
  })
})

describe('the shipped cache', () => {
  it('retries exactly the empty pages fetched too early: the Hollywood Bowl bill and Danny Elfman', () => {
    const cache = JSON.parse(readFileSync('public/data/setlists-cache.json', 'utf-8'))
    const retried = cache.entries
      .filter((e: { setlist: unknown }) => e.setlist !== null && setlistSongCount(e.setlist as never) === 0)
      .filter((e: Parameters<typeof canReuseCachedSetlist>[0]) => !canReuseCachedSetlist(e))
      .map((e: { artistName: string; date: string }) => `${e.date} ${e.artistName}`)
      .sort()
    expect(retried).toEqual(['2026-06-04 Alison Moyet', '2026-06-04 Soft Cell', '2026-06-04 The Human League', '2026-09-14 Danny Elfman'])
  })
})
