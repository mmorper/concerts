/**
 * Tests for cover routing in scripts/resolve-song-albums.ts (v6.0 Window 2).
 *
 * A cover attributed to the performing artist is the worst failure this
 * feature can produce: Dropkick Murphys playing "No Surrender" did not put it
 * on a Dropkick Murphys album, and a liner note saying otherwise is a
 * fabricated fact about someone else's catalogue.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §Part 3
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolveOriginalArtistKey } from '../../scripts/resolve-song-albums.ts'
import { buildAliasMap } from '../../scripts/liner-notes/artist-aliases.ts'
import { buildArtistKeyIndex } from '../../scripts/utils/artist-key.ts'

const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf-8'))

/** The same wiring resolve-song-albums.ts builds, from the real data files. */
function realDeps() {
  const discography = read('discography.json')
  const aliases = read('artist-aliases.json')

  const aliasesOfSlug = new Map<string, string[]>()
  const add = (slug: string, alias: string) => {
    const list = aliasesOfSlug.get(slug) ?? []
    if (!list.includes(alias)) list.push(alias)
    aliasesOfSlug.set(slug, list)
  }
  for (const e of aliases.sameAct ?? []) {
    for (const b of e.billings ?? []) for (const o of e.billings ?? []) add(b, o)
  }
  for (const e of aliases.discographyKeys ?? []) {
    if (e.act && e.discographyKey) add(e.act, e.discographyKey)
  }

  return {
    aliasMap: buildAliasMap(aliases),
    keyIndex: buildArtistKeyIndex(discography),
    discography,
    aliasesOf: (slug: string) => aliasesOfSlug.get(slug) ?? [],
  }
}

describe('resolveOriginalArtistKey', () => {
  it('resolves an original artist whose name is already the discography key', () => {
    const key = resolveOriginalArtistKey('Depeche Mode', realDeps())
    expect(key).toBe('depeche-mode')
  })

  it('resolves the acts that used to need a second hop', () => {
    // These three carried a `discographyKeys` relation — `omd` →
    // `orchestral-manoeuvres-in-the-dark`, `yaz` → `yazoo`, `the-english-beat`
    // → `the-beat` — and the relation has been REMOVED because the thing it
    // bridged was a bug, not a fact about these bands.
    //
    // enrich-discography.ts keyed its output by `normalizeArtistName(name)`
    // rather than by the artist's slug, so a record whose display name did not
    // round-trip landed under a name-shaped key nothing looked up. 20 artists
    // were affected. The relation was three of them, patched by hand.
    //
    // The discography is now keyed by slug, so the concert-side slug IS the
    // discography key and hop 2 is a no-op here. Asserted rather than deleted,
    // because a regression in the keying would land exactly here.
    const deps = realDeps()

    expect(resolveOriginalArtistKey('OMD', deps)).toBe('omd')
    expect(resolveOriginalArtistKey('Yaz', deps)).toBe('yaz')
    expect(resolveOriginalArtistKey('The English Beat', deps)).toBe('the-english-beat')
  })

  it('returns null for an artist we hold no discography for', () => {
    // Most covered artists were never seen live, so this is the COMMON case,
    // not an error — 283 of 354 cover performances in the archive.
    expect(resolveOriginalArtistKey('Rage Against the Machine', realDeps())).toBeNull()
    expect(resolveOriginalArtistKey('[traditional]', realDeps())).toBeNull()
  })

  it('returns null rather than guessing on empty or junk input', () => {
    const deps = realDeps()
    expect(resolveOriginalArtistKey('', deps)).toBeNull()
    expect(resolveOriginalArtistKey('   ', deps)).toBeNull()
  })

  it('does not accept a record that exists but holds no albums', () => {
    // A record with zero albums is a worse answer than no record: the caller
    // stops looking, and a real catalogue elsewhere is never reached.
    //
    // `omd` used to be the live example of this — an empty record under the
    // slug while 100 albums sat under the full name. The keying fix means
    // there is no longer a real empty record to point at, so the rule is
    // asserted against a synthetic one. That is the better test anyway: it
    // survives the data being correct.
    const deps = realDeps()
    const emptied = {
      ...deps,
      discography: { ...deps.discography, 'depeche-mode': { albums: [] } },
    }

    expect(resolveOriginalArtistKey('Depeche Mode', emptied)).not.toBe('depeche-mode')
    // And the real record still resolves, so the guard is not just rejecting
    // everything.
    expect(resolveOriginalArtistKey('Depeche Mode', deps)).toBe('depeche-mode')
  })
})

describe('cover routing invariants in the shipped data', () => {
  const songAlbums = read('song-albums.json')

  it('every cover entry names the original artist it was routed through', () => {
    const covers = Object.values<any>(songAlbums.songs).filter(s => s.isCover)
    expect(covers.length).toBeGreaterThan(0)
    for (const c of covers) {
      expect(typeof c.originalArtistKey).toBe('string')
      expect(c.originalArtistKey.length).toBeGreaterThan(0)
    }
  })

  it('never marks a non-cover entry with cover fields', () => {
    // The fields are optional and written only for covers — emitting
    // false/null on ~90% of entries is the same waste in a different shape.
    const nonCovers = Object.entries<any>(songAlbums.songs).filter(([, s]) => !s.isCover)
    for (const [, s] of nonCovers) {
      expect(s).not.toHaveProperty('originalArtistKey')
    }
  })
})
