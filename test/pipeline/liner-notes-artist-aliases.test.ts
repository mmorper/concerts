/**
 * Artist billing-alias map (#227)
 *
 * The map exists to stop a cover detector announcing "you've heard Rock This
 * Town from four different artists" about one man — while *not* collapsing the
 * pairs whose separateness is the story. Both halves are tested, because
 * over-collapsing is the more expensive mistake: it silently destroys findings
 * rather than producing visibly silly ones.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  billingsOf,
  buildAliasMap,
  canonicalOf,
  displayNameOf,
  EMPTY_ALIAS_MAP,
  isSameAct,
  relatedActs,
  sharedMemberOf,
} from '../../scripts/liner-notes/artist-aliases'

const ROOT = join(__dirname, '..', '..')
const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'artist-aliases.json'), 'utf8'))
const map = buildAliasMap(raw)

const concerts: Array<{ headliner: string; headlinerNormalized: string; openers: string[] }> =
  JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'concerts.json'), 'utf8')).concerts

describe('same-act: collapse the marquees', () => {
  it('resolves every Brian Setzer billing to one identity', () => {
    for (const billing of [
      'brian-setzer',
      'the-brian-setzer-orchestra',
      'brian-setzer-and-the-nashvillians',
      'brian-setzer-68-comeback-special',
    ]) {
      expect(canonicalOf(map, billing), billing).toBe('brian-setzer')
    }
  })

  it('treats any two of those billings as the same act', () => {
    expect(isSameAct(map, 'the-brian-setzer-orchestra', 'brian-setzer-68-comeback-special')).toBe(true)
  })

  it('lists every billing for the act', () => {
    expect(billingsOf(map, 'brian-setzer-and-the-nashvillians')).toHaveLength(4)
  })

  it('carries a display name', () => {
    expect(displayNameOf(map, 'the-brian-setzer-orchestra')).toBe('Brian Setzer')
  })
})

describe('shares-member: link, never collapse', () => {
  // Each of these is a story precisely because the two acts are different.
  const pairs: Array<[string, string, string]> = [
    ['oingo-boingo', 'danny-elfman', 'Danny Elfman'],
    ['wham', 'george-michael', 'George Michael'],
    ['brian-setzer', 'stray-cats', 'Brian Setzer'],
    ['stray-cats', 'lee-rocker', 'Lee Rocker'],
    ['social-distortion', 'mike-ness', 'Mike Ness'],
    ['streetlight-manifesto', 'bandits-of-the-acoustic-revolution', 'Tomas Kalnoky'],
  ]

  it.each(pairs)('%s and %s stay separate acts', (a, b) => {
    expect(isSameAct(map, a, b)).toBe(false)
  })

  it.each(pairs)('%s and %s are linked, naming the member', (a, b, who) => {
    expect(relatedActs(map, a)).toContain(b)
    expect(relatedActs(map, b)).toContain(a)
    expect(sharedMemberOf(map, a, b)).toBe(who)
  })

  it('links setlist guests to the act I actually saw', () => {
    // Terri Nunn never appears on a bill; she appears as a guest. The link is
    // what lets a guest resolve to an act in the archive.
    expect(relatedActs(map, 'terri-nunn')).toContain('berlin')
    expect(relatedActs(map, 'gwen-stefani')).toContain('no-doubt')
    expect(relatedActs(map, 'brian-baker')).toContain('bad-religion')
  })
})

describe('unmapped artists behave exactly as before', () => {
  it('resolves to itself', () => {
    expect(canonicalOf(map, 'depeche-mode')).toBe('depeche-mode')
    expect(billingsOf(map, 'depeche-mode')).toEqual(['depeche-mode'])
  })

  it('has no relations and no display name', () => {
    expect(relatedActs(map, 'depeche-mode')).toEqual([])
    expect(displayNameOf(map, 'depeche-mode')).toBeUndefined()
  })

  it('is not the same act as anything else', () => {
    expect(isSameAct(map, 'depeche-mode', 'new-order')).toBe(false)
  })
})

describe('degrading without a map', () => {
  it('an empty map is the identity — never an error', () => {
    expect(canonicalOf(EMPTY_ALIAS_MAP, 'the-brian-setzer-orchestra')).toBe('the-brian-setzer-orchestra')
    expect(isSameAct(EMPTY_ALIAS_MAP, 'brian-setzer', 'the-brian-setzer-orchestra')).toBe(false)
    expect(relatedActs(EMPTY_ALIAS_MAP, 'berlin')).toEqual([])
  })

  it('survives a malformed file rather than throwing', () => {
    expect(() => buildAliasMap(null)).not.toThrow()
    expect(() => buildAliasMap({ sameAct: [{}], sharesMember: [{}] })).not.toThrow()
    expect(buildAliasMap({}).canonical.size).toBe(0)
  })
})

describe('the map matches the archive', () => {
  const onBill = new Set<string>()
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  for (const c of concerts) {
    onBill.add(c.headlinerNormalized)
    for (const o of c.openers ?? []) onBill.add(slug(o))
  }

  it('every same-act billing is an artist that actually appears', () => {
    // A typo'd slug would silently never match, which is how this kind of map
    // rots without anyone noticing.
    const missing = [...map.canonical.keys()].filter((s) => !onBill.has(s))
    expect(missing).toEqual([])
  })

  it('at least one act in every shares-member pair appears on a bill', () => {
    // The other side may be a setlist guest only (Terri Nunn), which is fine —
    // but a pair where neither is in the archive links nothing.
    for (const [act, others] of map.related) {
      const anchored = onBill.has(act) || others.some((o) => onBill.has(o))
      expect(anchored, `${act} links to nothing in the archive`).toBe(true)
    }
  })
})
