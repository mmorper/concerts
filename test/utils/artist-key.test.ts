/**
 * Artist key matching contract tests.
 *
 * Every case here is a real drift instance found in live data — ten headliners
 * whose discography records existed but were unreachable. The final test is the
 * important one: it asserts this module never changes a stored slug, because
 * those slugs are published in deep links, RSS, and every liner note.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §Part 2a
 */

import { describe, it, expect } from 'vitest'
import { foldArtistName, buildArtistKeyIndex, resolveArtistKey } from '../../scripts/utils/artist-key'
import { normalizeArtistName } from '../../src/utils/normalize'

/** Mirrors the shape of discography.json, with the real drifted keys. */
const discography = {
  'echo-the-bunnymen': { artistName: 'Echo & The Bunnymen' },
  'run-d-m-c': { artistName: 'Run-D.M.C.' },
  'tone-l-c': { artistName: 'Tone-Lōc' },
  'the-beach-boys': { artistName: 'The Beach Boys' },
  'art-of-noise': { artistName: 'Art of Noise' },
  'peter-hook-the-light': { artistName: 'Peter Hook & The Light' },
  'depeche-mode': { artistName: 'Depeche Mode' },
  yazoo: { artistName: 'Yazoo' },
}

const index = buildArtistKeyIndex(discography)

const resolve = (
  slug: string,
  displayName: string,
  options?: Parameters<typeof resolveArtistKey<{ artistName: string }>>[4]
) => resolveArtistKey(slug, displayName, index, discography, options)

describe('foldArtistName', () => {
  it('folds diacritics instead of deleting the base letter', () => {
    // The live defect: "Tone-Lōc" normalized to "tone-l-c" — the o vanished.
    expect(foldArtistName('Tone-Lōc')).toBe('tone loc')
  })

  it('expands ampersand to the word', () => {
    // Only a LEADING article is dropped, so the interior "The" survives — what
    // matters is that both sources fold to the same string.
    expect(foldArtistName('Echo & The Bunnymen')).toBe('echo and the bunnymen')
    expect(foldArtistName('Echo & The Bunnymen')).toBe(foldArtistName('Echo and the Bunnymen'))
    expect(foldArtistName('Peter Hook & The Light')).toBe('peter hook and the light')
  })

  it('elides periods rather than splitting on them', () => {
    expect(foldArtistName('Run-D.M.C.')).toBe('run dmc')
  })

  it('drops a leading article', () => {
    expect(foldArtistName('The Beach Boys')).toBe('beach boys')
    expect(foldArtistName('Beach Boys')).toBe(foldArtistName('The Beach Boys'))
  })

  it('elides apostrophes', () => {
    expect(foldArtistName("Guns N' Roses")).toBe('guns n roses')
  })

  it('returns empty for empty input', () => {
    expect(foldArtistName('')).toBe('')
  })
})

describe('resolveArtistKey — the six mechanical drift cases', () => {
  const cases: Array<[string, string, string]> = [
    ['echo-and-the-bunnymen', 'Echo and the Bunnymen', 'echo-the-bunnymen'],
    ['run-dmc', 'Run DMC', 'run-d-m-c'],
    ['tone-loc', 'Tone Loc', 'tone-l-c'],
    ['beach-boys', 'Beach Boys', 'the-beach-boys'],
    ['the-art-of-noise', 'The Art of Noise', 'art-of-noise'],
    ['peter-hook-and-the-light', 'Peter Hook and the Light', 'peter-hook-the-light'],
  ]

  it.each(cases)('resolves %s', (slug, displayName, expected) => {
    const result = resolve(slug, displayName)
    expect(result.key).toBe(expected)
    expect(result.via).toBe('folded')
  })
})

describe('resolveArtistKey — direct and alias paths', () => {
  it('prefers a direct key hit and does not fold unnecessarily', () => {
    const result = resolve('depeche-mode', 'Depeche Mode')
    expect(result).toEqual({ key: 'depeche-mode', via: 'direct' })
  })

  it('falls through to the alias resolver for editorial cases', () => {
    // Yaz (US) and Yazoo (UK) are one band — knowledge no fold can derive.
    const aliasesOf = (slug: string) => (slug === 'yaz' ? ['yaz', 'yazoo'] : [slug])
    const result = resolve('yaz', 'Yaz', { aliasesOf })
    expect(result).toEqual({ key: 'yazoo', via: 'alias' })
  })

  it('returns unresolved when nothing matches', () => {
    const result = resolve('some-unknown-band', 'Some Unknown Band')
    expect(result).toEqual({ key: null, via: 'unresolved' })
  })

  it('does not invent a match from an alias that is also absent', () => {
    const aliasesOf = () => ['still-not-here']
    expect(resolve('missing', 'Missing', { aliasesOf }).key).toBeNull()
  })
})

describe('resolveArtistKey — isUsable skips empty records', () => {
  // Real case: `omd` exists in discography.json with 0 albums, while the real
  // 100-album record is under `orchestral-manoeuvres-in-the-dark`. A direct hit
  // on the empty record is worse than no hit — it stops the search.
  const withEmpty = {
    omd: { artistName: 'OMD', albums: [] as unknown[] },
    'orchestral-manoeuvres-in-the-dark': {
      artistName: 'Orchestral Manoeuvres in the Dark',
      albums: [{}, {}],
    },
  }
  const emptyIndex = buildArtistKeyIndex(withEmpty)
  const aliasesOf = (slug: string) =>
    slug === 'omd' ? ['omd', 'orchestral-manoeuvres-in-the-dark'] : [slug]

  it('takes the direct hit when no usability predicate is given', () => {
    const result = resolveArtistKey('omd', 'OMD', emptyIndex, withEmpty, { aliasesOf })
    expect(result).toEqual({ key: 'omd', via: 'direct' })
  })

  it('skips the empty record and resolves through the alias', () => {
    const result = resolveArtistKey('omd', 'OMD', emptyIndex, withEmpty, {
      aliasesOf,
      isUsable: (record) => record.albums.length > 0,
    })
    expect(result).toEqual({ key: 'orchestral-manoeuvres-in-the-dark', via: 'alias' })
  })
})

describe('INVARIANT — stored slugs are never touched', () => {
  it('does not change normalizeArtistName output for any drifted name', () => {
    // foldArtistName is for COMPARISON ONLY. If someone ever wires it into slug
    // generation, published deep links and RSS URLs break. This asserts the two
    // remain separate functions with separate outputs.
    const names = [
      'Echo & The Bunnymen',
      'Run-D.M.C.',
      'Tone-Lōc',
      'The Beach Boys',
      'Peter Hook & The Light',
    ]

    for (const name of names) {
      expect(normalizeArtistName(name)).not.toBe(foldArtistName(name))
    }
  })

  it('leaves normalizeArtistName behaviour exactly as documented', () => {
    expect(normalizeArtistName('The Art of Noise')).toBe('the-art-of-noise')
    expect(normalizeArtistName('Duran Duran')).toBe('duran-duran')
    expect(normalizeArtistName('Violent Femmes')).toBe('violent-femmes')
  })
})
