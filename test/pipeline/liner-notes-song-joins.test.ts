/**
 * Song joins in existing detectors (#229)
 *
 * The setlist corpus — 2,700-odd performances across 159 concerts — was
 * completely unexploited: every detector took `concerts: Concert[]` and none had
 * ever opened a setlist. These tests pin the joins and, more importantly, the
 * two rules that keep them honest:
 *
 *   1. A concert with no setlist degrades silently. No stub sentence, no
 *      half-populated data point, no link promising songs that aren't there.
 *   2. Song detail is a *join*, never a lone title — the "delete the song and
 *      see if the story still stands" rule from the issue.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { analyze } from '../../scripts/liner-notes/analyze'
import {
  buildSetlistIndex,
  describeSong,
  hasSongJoin,
  songsAtEveryShow,
  songsFor,
} from '../../scripts/liner-notes/setlists'

const DATA = join(__dirname, '..', '..', 'public', 'data')
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'))

const concerts = read('concerts.json').concerts
const setlists = buildSetlistIndex(read('setlists-cache.json'))
const meta = {
  venuesMetadata: read('venues-metadata.json'),
  artistsMetadata: read('artists-metadata.json'),
}
const TODAY = new Date('2026-08-05T00:00:00Z')

const withSongs = analyze(concerts, TODAY, { ...meta, setlists }).findings
const withoutSongs = analyze(concerts, TODAY, meta).findings

describe('the setlist index', () => {
  it('is keyed on date + artist, never a row id (#242)', () => {
    for (const key of setlists.keys()) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}::[a-z0-9-]+$/)
      expect(key).not.toContain('concert-')
    }
  })

  it('excludes tape entries — PA music is not a performance', () => {
    // Foo Fighters at RFK closed with "Best of You"; the two entries after it
    // are the anthem and an AC/DC record played over the fireworks. Taking the
    // literal last row would have made venue-ghost claim the wrong last song.
    const rfk = songsFor(setlists, '2015-07-04', 'foo-fighters')
    expect(rfk.at(-1)!.name).toBe('Best of You')
    expect(rfk.some((s) => s.name === 'You Shook Me All Night Long')).toBe(false)
  })

  it('attributes covers to the original artist (#225)', () => {
    const nile = songsFor(setlists, '2026-07-31', 'nile-rodgers')
    const notorious = nile.find((s) => s.name === 'Notorious')
    expect(describeSong(notorious)).toBe('Notorious (Duran Duran cover)')
  })

  it('needs three shows before calling a song a constant', () => {
    const shows = [{ date: '2026-07-31' }, { date: '2026-07-31' }]
    expect(songsAtEveryShow(setlists, shows, 'nile-rodgers')).toEqual([])
  })
})

describe('degrading silently without setlists', () => {
  // full-circle and guest-bridge are setlist-*native* — no setlists, no findings,
  // by design. The invariant here is about the detectors that predate the corpus
  // and which it merely enriches.
  const SETLIST_NATIVE = new Set(['full-circle', 'guest-bridge'])
  const enriched = (fs: typeof withSongs) => fs.filter((f) => !SETLIST_NATIVE.has(f.detector))

  it('produces the same findings with or without the index', () => {
    // The corpus enriches; it must never gate. Same count, same ids.
    expect(enriched(withSongs).length).toBe(enriched(withoutSongs).length)
    expect(enriched(withSongs).map((f) => f.id).sort()).toEqual(
      enriched(withoutSongs).map((f) => f.id).sort()
    )
  })

  it('carries no song join at all when the index is absent', () => {
    expect(withoutSongs.filter((f) => hasSongJoin(f.tags))).toEqual([])
  })

  it('never emits an empty or placeholder song data point', () => {
    const SONG_KEYS = [
      'songsAtEveryShow',
      'songsInBothRoles',
      'returnedWith',
      'openedWith',
      'closedWith',
      'lastSongEver',
    ]
    for (const f of withSongs) {
      const dp = f.dataPoints as Record<string, unknown>
      for (const key of SONG_KEYS) {
        if (!(key in dp)) continue
        const value = dp[key]
        expect(value, `${f.id}.${key}`).toBeTruthy()
        if (Array.isArray(value)) expect(value.length, `${f.id}.${key}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('the joins themselves', () => {
  const byId = new Map(withSongs.map((f) => [f.id, f]))
  const dp = (id: string) => byId.get(id)?.dataPoints as Record<string, any> | undefined

  it('artist-longevity finds the song played at every show', () => {
    // Depeche Mode: "Everything Counts" at all five shows, 1985–2023.
    expect(dp('longevity-depeche-mode')?.songsAtEveryShow).toContain('Everything Counts')
  })

  it("artist-longevity's constant can be someone else's song", () => {
    // Social Distortion's single constant across seven shows is a Johnny Cash
    // cover, which is a better fact than any frequency count.
    expect(dp('longevity-social-distortion')?.songsAtEveryShow).toContain('Ring of Fire')
  })

  it('opener-to-headliner finds songs played in both roles', () => {
    // Crowded House opened for Peter Gabriel in 1993 and headlined 30 years later.
    const songs = dp('opener-to-headliner-crowded-house')?.songsInBothRoles
    expect(songs?.length).toBeGreaterThan(0)
    expect(songs).toContain('Fall at Your Feet')
  })

  it('drought-comeback finds what they opened the comeback with', () => {
    // New Order, back after 37 years. #229 records this as opening with the
    // Wagner prelude "Das Rheingold: Vorspiel" — but that entry is tape:true,
    // walk-on music played before they took the stage. The first thing they
    // actually performed was "Regret". The issue was written off unfiltered data.
    expect(dp('drought-comeback-new-order')?.returnedWith).toBe('Regret')
  })

  it('does not mistake walk-on music for the first song back', () => {
    const returned = withSongs
      .filter((f) => f.detector === 'drought-comeback')
      .map((f) => (f.dataPoints as any).returnedWith)
      .filter(Boolean)
    expect(returned.some((s: string) => s.includes('Das Rheingold'))).toBe(false)
    // Devo's comeback entry was likewise a video interlude, not a song.
    expect(returned.some((s: string) => s.includes('Video'))).toBe(false)
  })

  it('venue-ghost finds the last song played in a room that is gone', () => {
    expect(dp('venue-ghost-irvine-meadows')?.lastSongEver).toBe('Father, Son')
  })

  it('rare-sighting finds the shape of the only night', () => {
    const bruce = dp('rare-sighting-bruce-springsteen')
    expect(bruce?.openedWith).toBe('Born in the U.S.A.')
    expect(bruce?.closedWith).toBe('Glory Days')
  })
})

describe('setlist links stay honest', () => {
  // Everyone who performed that night, openers included: `artists-metadata.json`
  // covers 280 artists against 107 headliners, and a `?show=` link naming an
  // opener resolves — verified live against the deployed meta-injector.
  const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const byDate = new Map<string, Set<string>>()
  for (const c of concerts) {
    if (!byDate.has(c.date)) byDate.set(c.date, new Set())
    byDate.get(c.date)!.add(c.headlinerNormalized)
    for (const o of (c as any).openers ?? []) byDate.get(c.date)!.add(slugOf(o))
  }

  it('artists[0] performed on the night concertDate points at', () => {
    // venue-ghost lists every artist who played the venue; leading with the
    // *first* night's headliner while pointing at the *last* night's date is
    // the #239 mismatch, which this detector would have reintroduced.
    const bad = withSongs
      .filter((f) => f.concertDate)
      .filter((f) => !byDate.get(f.concertDate!)?.has(f.artists[0]))
      .map((f) => `${f.detector} ${f.concertDate} → ${f.artists[0]}`)
    expect(bad).toEqual([])
  })

  it('venue-ghost leads with the closing night headliner when it has a last song', () => {
    const ghost = withSongs.find((f) => f.id === 'venue-ghost-irvine-meadows')!
    const lastNight = (ghost.dataPoints as any).lastShow.date
    expect(byDate.get(lastNight)?.has(ghost.artists[0])).toBe(true)
  })
})
