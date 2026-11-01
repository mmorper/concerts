/**
 * When the setlist pre-fetch reuses a cached entry and when it asks setlist.fm again.
 *
 * The Hollywood Bowl bill (2026-06-04) was fetched on 06-02, when setlist.fm's event pages
 * existed but held no songs. Those empty pages were reused on every run after, so the site
 * never showed the Human League's, Alison Moyet's or Soft Cell's set.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { canReuseCachedSetlist, fetchSetlistUnderBillings, setlistSongCount } from '../../scripts/prefetch-setlists.ts'

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
  const cache = JSON.parse(readFileSync('public/data/setlists-cache.json', 'utf-8'))
  type Entry = Parameters<typeof canReuseCachedSetlist>[0] & { artistName: string; concertId: string }
  const entries: Entry[] = cache.entries

  it('has the Hollywood Bowl sets the early fetch had left empty', () => {
    const bowl = entries.filter((e) => e.date === '2026-06-04')
    expect(bowl.map((e) => [e.artistName, setlistSongCount(e.setlist) > 0]).sort()).toEqual([
      ['Alison Moyet', true],
      ['Soft Cell', true],
      ['The Human League', true],
    ])
  })

  it('only ever re-asks about recent shows: an old empty page is left alone', () => {
    const retried = entries.filter((e) => e.setlist !== null && !canReuseCachedSetlist(e))
    for (const e of retried) expect(Date.parse(e.fetchedAt) - Date.parse(e.date)).toBeLessThanOrEqual(30 * 864e5)
  })
})

describe('fetchSetlistUnderBillings', () => {
  const found = { id: 'tt-glasgow' } as never
  const noResults = () => Promise.reject(new Error('API error: 404 Not Found'))
  const quiet = () => Promise.resolve()

  it("finds the reunion shows under setlist.fm's billing when the archive's name has none", async () => {
    const asked: string[] = []
    const out = await fetchSetlistUnderBillings(
      'Thompson Twins',
      (name) => (asked.push(name), name === "Thompson Twins' Tom Bailey" ? Promise.resolve(found) : noResults()),
      quiet,
    )
    expect(out).toBe(found)
    expect(asked).toEqual(['Thompson Twins', "Thompson Twins' Tom Bailey"])
  })

  it("stops at the archive's own name when it matches (1984 and 1985 are filed under it)", async () => {
    const asked: string[] = []
    await fetchSetlistUnderBillings('Thompson Twins', (name) => (asked.push(name), Promise.resolve(found)), quiet)
    expect(asked).toEqual(['Thompson Twins'])
  })

  it('an act with no other billing is one request, and its 404 is thrown as before', async () => {
    await expect(fetchSetlistUnderBillings('Blancmange', noResults, quiet)).rejects.toThrow('404')
  })

  it('does not paper over a real error (rate limit) by trying the next name', async () => {
    const asked: string[] = []
    const limited = (name: string) => (asked.push(name), Promise.reject(new Error('Rate limit exceeded')))
    await expect(fetchSetlistUnderBillings('Thompson Twins', limited, quiet)).rejects.toThrow('Rate limit')
    expect(asked).toEqual(['Thompson Twins'])
  })
})
