/**
 * Published feed integrity + media resolution (#234, #235)
 *
 * Both bugs shipped silently because the pipeline only ever checked that it
 * *ran*, never that its output was coherent — the same gap as #223 and #232.
 *
 * #234: `generateSlug` dodged the post it was about to replace and emitted a
 *       "-2" suffix; `mergePosts` then deleted the original by id, so the base
 *       slug vanished and every `relatedSlugs` pointing at it went dangling.
 * #235: `venues-metadata.json` stores the generic placeholder *as* a photo for
 *       11 of 79 venues, so `resolveImage` short-circuited on it and never
 *       reached album art further down the chain.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildPosts } from '../../scripts/liner-notes/curate'
import { generateUpTo } from '../../scripts/liner-notes/pipeline'
import type { CurateOptions } from '../../scripts/liner-notes/curate'
import type { ScoredFinding } from '../../scripts/liner-notes/types'
import type { LinerNotesData, LinerNotesPost } from '../../src/types/liner-notes'

const DATA = join(__dirname, '..', '..', 'public', 'data')
const feed: LinerNotesData = JSON.parse(readFileSync(join(DATA, 'liner-notes.json'), 'utf8'))

const PLACEHOLDER = '/images/venues/fallback.jpg'

describe('published feed integrity', () => {
  it('every relatedSlugs entry resolves to a post in the feed', () => {
    const slugs = new Set(feed.posts.map((p) => p.slug))
    const dangling = feed.posts.flatMap((p) =>
      (p.relatedSlugs ?? [])
        .filter((s) => !slugs.has(s))
        .map((s) => `${p.slug} → ${s}`)
    )

    expect(
      dangling,
      'These render as dead "related post" links. A post that was regenerated ' +
        'keeps its slug now (#234); if this fires, something removed a post ' +
        'without repairing the references to it.'
    ).toEqual([])
  })

  it('slugs are unique', () => {
    const slugs = feed.posts.map((p) => p.slug)
    expect(slugs.length).toBe(new Set(slugs).size)
  })

  it('ids are unique — mergePosts deduplicates on them', () => {
    const ids = feed.posts.map((p) => p.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('no post ships the generic venue placeholder as its image', () => {
    const placeheld = feed.posts.filter((p) => p.image?.url?.endsWith(PLACEHOLDER))
    expect(
      placeheld.map((p) => p.slug),
      'The image chain should fall through to album art or an artist photo ' +
        'rather than short-circuiting on a stored placeholder (#235).'
    ).toEqual([])
  })
})

// ── buildPosts unit coverage ────────────────────────────────────────────────

function finding(overrides: Partial<ScoredFinding> = {}): ScoredFinding {
  return {
    id: 'test-finding',
    detector: 'artist-longevity',
    category: 'personal',
    temporality: 'evergreen',
    headline: 'A Night Worth Remembering',
    dataPoints: {},
    artists: ['depeche-mode'],
    venues: ['irvine-meadows'],
    years: [2000],
    tags: [],
    score: 30,
    scoreBreakdown: {},
    prose: 'I saw them in 2000 and my ears rang for a week.',
    ...overrides,
  } as unknown as ScoredFinding
}

function options(overrides: Partial<CurateOptions> = {}): CurateOptions {
  return {
    artistsMetadata: { 'depeche-mode': { name: 'Depeche Mode', image: 'https://img/dm.jpg' } },
    artistsTopTracks: {
      'depeche-mode': {
        name: 'Depeche Mode',
        tracks: [{ name: 'Enjoy the Silence', albumName: 'Violator', albumArt: 'https://img/100x100bb.jpg' }],
      },
    },
    venuesMetadata: {},
    existingPosts: [],
    publishedAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  } as unknown as CurateOptions
}

function post(overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    id: 'test-finding',
    slug: 'a-night-worth-remembering',
    detector: 'artist-longevity',
    category: 'personal',
    temporality: 'evergreen',
    headline: 'A Night Worth Remembering',
    prose: '',
    image: { url: '', alt: '', source: 'placeholder' },
    artists: ['depeche-mode'],
    venues: [],
    years: [2000],
    tags: [],
    deepLinks: [],
    relatedSlugs: [],
    score: 30,
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as LinerNotesPost
}

describe('slug stability on regeneration (#234)', () => {
  it('keeps the existing slug when regenerating the same finding', () => {
    // The bug: the previous post was still in the collision set, so this
    // returned "…-2" — then mergePosts deleted the original by id.
    const [built] = buildPosts([finding()], options({ existingPosts: [post()] }))
    expect(built.slug).toBe('a-night-worth-remembering')
  })

  it('keeps the slug even when the headline has changed', () => {
    const [built] = buildPosts(
      [finding({ headline: 'A Different Headline Entirely' })],
      options({ existingPosts: [post()] })
    )
    // The URL is the longest-lived thing a post emits; re-slugging 404s it.
    expect(built.slug).toBe('a-night-worth-remembering')
  })

  it('still disambiguates two different findings that share a headline', () => {
    const existing = post({ id: 'some-other-finding', slug: 'a-night-worth-remembering' })
    const [built] = buildPosts([finding()], options({ existingPosts: [existing] }))
    expect(built.slug).toBe('a-night-worth-remembering-2')
  })
})

describe('venue placeholder is not a photo (#235)', () => {
  const venuesMetadata = {
    'irvine-meadows': {
      name: 'Irvine Meadows',
      photoUrls: { thumbnail: PLACEHOLDER, medium: PLACEHOLDER, large: PLACEHOLDER },
    },
    'real-venue': { name: 'Real Venue', photoUrls: { large: 'https://img/venue.jpg' } },
  }

  it('falls through to album art rather than stopping on the placeholder', () => {
    const [built] = buildPosts(
      [finding({ suggestedImage: { type: 'venue', venueNormalized: 'irvine-meadows' } } as Partial<ScoredFinding>)],
      options({ venuesMetadata } as Partial<CurateOptions>)
    )
    expect(built.image.source).toBe('album')
    expect(built.image.url).not.toContain('fallback.jpg')
  })

  it('still uses a venue photo when the venue actually has one', () => {
    const [built] = buildPosts(
      [finding({
        artists: [],
        venues: ['real-venue'],
        suggestedImage: { type: 'venue', venueNormalized: 'real-venue' },
      } as Partial<ScoredFinding>)],
      options({ venuesMetadata } as Partial<CurateOptions>)
    )
    expect(built.image.source).toBe('venue')
    expect(built.image.url).toBe('https://img/venue.jpg')
  })

  it('reaches the placeholder image only when nothing else resolves', () => {
    const [built] = buildPosts(
      [finding({
        artists: [],
        venues: ['irvine-meadows'],
        suggestedImage: { type: 'venue', venueNormalized: 'irvine-meadows' },
      } as Partial<ScoredFinding>)],
      options({ venuesMetadata } as Partial<CurateOptions>)
    )
    expect(built.image.source).toBe('placeholder')
  })
})

// ── Generation loop ─────────────────────────────────────────────────────────

describe('generateUpTo — one API call per published post (#231)', () => {
  const candidates = [
    finding({ id: 'first', headline: 'First' }),
    finding({ id: 'reserve-1', headline: 'Reserve One' }),
    finding({ id: 'reserve-2', headline: 'Reserve Two' }),
  ]

  it('stops at the target and never touches the reserve', async () => {
    const seen: string[] = []
    const { withProse, attempted } = await generateUpTo(candidates, 1, async (c) => {
      seen.push(c.id)
      return c
    })
    // The whole point of removing Stage 5b: 3 calls became 1.
    expect(attempted).toBe(1)
    expect(seen).toEqual(['first'])
    expect(withProse.map((f) => f.id)).toEqual(['first'])
  })

  it('falls through to the reserve when prose fails validation', async () => {
    const { withProse, attempted } = await generateUpTo(candidates, 1, async (c) =>
      c.id === 'first' ? ({ ...c, prose: undefined } as ScoredFinding) : c
    )
    expect(attempted).toBe(2)
    expect(withProse.map((f) => f.id)).toEqual(['reserve-1'])
  })

  it('treats an undefined result as a failure rather than crashing', async () => {
    const { withProse, attempted } = await generateUpTo(candidates, 1, async (c) =>
      c.id === 'first' ? undefined : c
    )
    expect(attempted).toBe(2)
    expect(withProse.map((f) => f.id)).toEqual(['reserve-1'])
  })

  it('returns empty rather than throwing when every candidate fails', async () => {
    const { withProse, attempted } = await generateUpTo(candidates, 1, async () => undefined)
    expect(withProse).toEqual([])
    expect(attempted).toBe(3)
  })

  it('fills multiple slots in seed mode', async () => {
    const { withProse, attempted } = await generateUpTo(candidates, 3, async (c) => c)
    expect(attempted).toBe(3)
    expect(withProse).toHaveLength(3)
  })

  it('generates in rank order', async () => {
    const seen: string[] = []
    await generateUpTo(candidates, 3, async (c) => {
      seen.push(c.id)
      return c
    })
    expect(seen).toEqual(['first', 'reserve-1', 'reserve-2'])
  })
})
