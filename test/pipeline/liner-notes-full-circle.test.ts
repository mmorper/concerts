/**
 * full-circle detector (#228, absorbing #230)
 *
 * You watched someone play a song, and you also watched the artist whose song it
 * is play it themselves. A join, not an aggregation — the test the issue sets is
 * "how the hell did he figure that out", and a frequency count never passes it.
 *
 * The failure modes worth pinning are all about identity: a man playing his own
 * back catalogue under a different marquee is not a full circle, and the same
 * story must not publish once per marquee.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { analyze } from '../../scripts/liner-notes/analyze'
import { score } from '../../scripts/liner-notes/score'
import { buildSetlistIndex } from '../../scripts/liner-notes/setlists'
import { buildAliasMap, EMPTY_ALIAS_MAP } from '../../scripts/liner-notes/artist-aliases'

const ROOT = join(__dirname, '..', '..')
const j = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

const concerts = j('public/data/concerts.json').concerts
const setlists = buildSetlistIndex(j('public/data/setlists-cache.json'))
const aliases = buildAliasMap(j('data/artist-aliases.json'))
const base = {
  venuesMetadata: j('public/data/venues-metadata.json'),
  artistsMetadata: j('public/data/artists-metadata.json'),
}
const TODAY = new Date('2026-08-05T00:00:00Z')

const findings = analyze(concerts, TODAY, { ...base, setlists, aliases }).findings.filter(
  (f) => f.detector === 'full-circle'
)
const dp = (f: (typeof findings)[number]) => f.dataPoints as Record<string, any>

describe('full-circle finds real joins', () => {
  it('produces findings', () => {
    expect(findings.length).toBeGreaterThan(10)
  })

  it('finds Nile Rodgers playing Notorious, 39 years after Duran Duran', () => {
    const f = findings.find((x) => dp(x).song === 'Notorious')
    expect(f).toBeDefined()
    expect(dp(f!).coverArtist).toBe('Nile Rodgers')
    expect(dp(f!).originalArtist).toBe('Duran Duran')
    expect(dp(f!).gapYears).toBe(39)
  })

  it('anchors on the first time the original act played it, not the nearest', () => {
    // Duran Duran played Notorious more than once. Picking the closest
    // performance would quietly shrink a 39-year span to 18.
    const f = findings.find((x) => dp(x).song === 'Notorious')!
    expect(dp(f).originalDate.slice(0, 4)).toBe('1987')
  })

  it('finds Dropkick Murphys playing Springsteen', () => {
    const f = findings.find((x) => dp(x).song === 'No Surrender')
    expect(dp(f!).originalArtist).toBe('Bruce Springsteen')
  })

  it('uses display names, never slugs', () => {
    for (const f of findings) {
      expect(dp(f).coverArtist, f.id).not.toMatch(/^[a-z0-9-]+$/)
      expect(dp(f).originalArtist, f.id).not.toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('the same-night case (#230)', () => {
  const sameNight = findings.filter((f) => dp(f).sameNight === true)

  it('finds Living Colour and Public Enemy playing Terrordome on one bill', () => {
    expect(sameNight).toHaveLength(1)
    const f = sameNight[0]
    expect(dp(f).song).toBe('Welcome to the Terrordome')
    expect(dp(f).coverDate).toBe(dp(f).originalDate)
    expect(f.tags).toContain('#same-night')
  })

  it('scores it top of the detector, not bottom', () => {
    // Its gap is 0, so any gap-driven scoring would bury the most striking
    // version of the story. #230 argued this deserved a hand-written post;
    // it is the strongest thing full-circle produces.
    const cc: Record<string, number> = {}
    for (const c of concerts) cc[c.headlinerNormalized] = (cc[c.headlinerNormalized] ?? 0) + 1
    const scored = score(
      findings,
      {
        artistsMetadata: base.artistsMetadata,
        artistsTopTracks: j('public/data/artists-top-tracks.json'),
        concertCountByArtist: cc,
      },
      TODAY
    )
    const ranked = scored.sort((a, b) => b.score - a.score)
    const sn = ranked.find((f) => dp(f).sameNight === true)!
    expect(ranked.indexOf(sn)).toBeLessThan(3)
  })
})

describe('identity: a man covering himself is not a full circle', () => {
  it('never pairs an act with itself', () => {
    for (const f of findings) {
      expect(dp(f).coverArtist, f.id).not.toBe(dp(f).originalArtist)
    }
  })

  it('collapses billings so one story publishes once', () => {
    // Brian Setzer played Stray Cats songs under three marquees. Without the
    // alias map "Rock This Town" is three findings, one per billing.
    const rockThisTown = findings.filter((f) => dp(f).song === 'Rock This Town')
    expect(rockThisTown).toHaveLength(1)

    const withoutAliases = analyze(concerts, TODAY, { ...base, setlists, aliases: EMPTY_ALIAS_MAP })
      .findings.filter((f) => f.detector === 'full-circle')
      .filter((f) => (f.dataPoints as any).song === 'Rock This Town')
    expect(withoutAliases.length).toBeGreaterThan(rockThisTown.length)
  })

  it('marks shared-member pairs so they can be ranked below strangers', () => {
    // Setzer playing a Stray Cats song is a man playing his own back catalogue.
    // Still a story, but not the same surprise as Dropkick Murphys covering
    // Springsteen — so it is labelled rather than dropped.
    const setzer = findings.find((f) => dp(f).song === 'Rock This Town')!
    expect(setzer.tags).toContain('#shares-member')
    expect(dp(setzer).sharedMember).toBe('Brian Setzer')

    const murphys = findings.find((f) => dp(f).song === 'No Surrender')!
    expect(murphys.tags).not.toContain('#shares-member')
  })
})

describe('degrading without setlists', () => {
  it('produces nothing at all rather than erroring', () => {
    const none = analyze(concerts, TODAY, { ...base, aliases }).findings.filter(
      (f) => f.detector === 'full-circle'
    )
    expect(none).toEqual([])
  })
})

describe('deep links', () => {
  it('every finding points at the night the circle closed', () => {
    const byDate = new Map<string, Set<string>>()
    for (const c of concerts) {
      if (!byDate.has(c.date)) byDate.set(c.date, new Set())
      byDate.get(c.date)!.add(c.headlinerNormalized)
      for (const o of c.openers ?? []) {
        byDate.get(c.date)!.add(o.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
      }
    }
    for (const f of findings) {
      expect(f.concertDate, f.id).toBe(dp(f).coverDate)
      expect(byDate.get(f.concertDate!)?.has(f.artists[0]), f.id).toBe(true)
    }
  })
})
