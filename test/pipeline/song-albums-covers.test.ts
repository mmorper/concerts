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

  it('survives HOP 2 — an act whose discography lives under a different key', () => {
    // THE TRAP. canonicalOf alone returns the concert-side slug, which is
    // deliberately not the discography key for exactly these cases. Without
    // the discographyKeys relation these drop to null, and a null here is
    // indistinguishable from the common, correct "we don't hold this artist".
    const deps = realDeps()

    expect(resolveOriginalArtistKey('OMD', deps)).toBe('orchestral-manoeuvres-in-the-dark')
    expect(resolveOriginalArtistKey('Yaz', deps)).toBe('yazoo')
    expect(resolveOriginalArtistKey('The English Beat', deps)).toBe('the-beat')
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
    // `omd` exists in discography.json with zero albums. Returning it would be
    // worse than returning nothing: the caller would stop looking and the real
    // 100-album catalogue under the full name would never be reached.
    const key = resolveOriginalArtistKey('OMD', realDeps())
    expect(key).not.toBe('omd')
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
