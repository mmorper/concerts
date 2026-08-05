/**
 * guest-bridge detector (#228)
 *
 * Someone walked on during another act's set, and you also saw them perform in
 * their own right. The second half is the whole detector: Gorillaz account for
 * 10 of the 27 walk-ons in the corpus and would otherwise dominate it.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { analyze } from '../../scripts/liner-notes/analyze'
import { buildSetlistIndex, guestAppearances } from '../../scripts/liner-notes/setlists'
import { buildAliasMap, EMPTY_ALIAS_MAP } from '../../scripts/liner-notes/artist-aliases'

const ROOT = join(__dirname, '..', '..')
const j = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

const concerts = j('public/data/concerts.json').concerts
const setlists = buildSetlistIndex(j('public/data/setlists-cache.json'))
const aliases = buildAliasMap(j('data/artist-aliases.json'))
const base = {
  venuesMetadata: j('public/data/venues-metadata.json'),
  artistsMetadata: j('public/data/artists-metadata.json'),
  setlists,
}
const TODAY = new Date('2026-08-05T00:00:00Z')

const findings = analyze(concerts, TODAY, { ...base, aliases }).findings.filter(
  (f) => f.detector === 'guest-bridge'
)
const dp = (f: (typeof findings)[number]) => f.dataPoints as Record<string, any>

describe('guest-bridge finds real bridges', () => {
  it('produces findings', () => {
    expect(findings.length).toBeGreaterThan(0)
  })

  it("finds Lee Rocker joining Setzer for the Stray Cats' own song", () => {
    const f = findings.find((x) => dp(x).guest === 'Lee Rocker')
    expect(f).toBeDefined()
    expect(dp(f!).song).toBe('Rock This Town')
    expect(dp(f!).ownShowCount).toBeGreaterThan(1)
  })

  it('finds Sinéad O’Connor singing Blood of Eden with Peter Gabriel', () => {
    const f = findings.find((x) => dp(x).song === 'Blood of Eden')
    expect(dp(f!).host).toBe('Peter Gabriel')
  })

  it('uses display names, never slugs', () => {
    for (const f of findings) {
      for (const key of ['guest', 'host', 'ownAct']) {
        expect(dp(f)[key], `${f.id}.${key}`).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/)
      }
    }
  })
})

describe('the "in their own right" join is load-bearing', () => {
  it('drops guests who are strangers to the archive', () => {
    // 27 walk-ons in the corpus; only the ones you also saw headline survive.
    const all = guestAppearances(setlists)
    expect(all.length).toBeGreaterThan(findings.length * 2)
  })

  it('does not become The Gorillaz Show', () => {
    // Gorillaz are guest-heavy by design and supply 10 of the 27 walk-ons.
    // Bootie Brown, Del the Funky Homosapien, De La Soul and Fatoumata Diawara
    // all fail the join and drop out with no special-casing.
    const gorillaz = findings.filter((f) => dp(f).host === 'Gorillaz')
    expect(gorillaz.length).toBeLessThan(findings.length / 2)
  })

  it('never counts someone walking on with their own act', () => {
    for (const f of findings) {
      expect(dp(f).host, f.id).not.toBe(dp(f).ownAct)
    }
  })
})

describe('the alias map is a supply prerequisite, not just correctness', () => {
  it('finds fewer bridges without it', () => {
    const without = analyze(concerts, TODAY, { ...base, aliases: EMPTY_ALIAS_MAP }).findings.filter(
      (f) => f.detector === 'guest-bridge'
    )
    expect(without.length).toBeLessThan(findings.length)
  })

  it('resolves guests billed under a band name', () => {
    // Terri Nunn never appears on a bill; Berlin does, five times.
    const nunn = findings.find((x) => dp(x).guest === 'Terri Nunn')
    expect(nunn).toBeDefined()
    expect(dp(nunn!).seenAs).toBe('Berlin')
    expect(nunn!.tags).toContain('#shares-member')
  })
})

describe('degrading without setlists', () => {
  it('produces nothing rather than erroring', () => {
    const none = analyze(concerts, TODAY, {
      venuesMetadata: base.venuesMetadata,
      artistsMetadata: base.artistsMetadata,
      aliases,
    }).findings.filter((f) => f.detector === 'guest-bridge')
    expect(none).toEqual([])
  })
})

describe('deep links', () => {
  it('points at the night they walked on, with an artist who performed', () => {
    const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const byDate = new Map<string, Set<string>>()
    for (const c of concerts) {
      if (!byDate.has(c.date)) byDate.set(c.date, new Set())
      byDate.get(c.date)!.add(c.headlinerNormalized)
      for (const o of c.openers ?? []) byDate.get(c.date)!.add(slugOf(o))
    }
    for (const f of findings) {
      expect(f.concertDate, f.id).toBe(dp(f).guestDate)
      expect(byDate.get(f.concertDate!)?.has(f.artists[0]), f.id).toBe(true)
    }
  })
})
