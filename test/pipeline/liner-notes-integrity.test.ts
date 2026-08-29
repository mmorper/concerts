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
import { analyze } from '../../scripts/liner-notes/analyze'
import { buildPosts } from '../../scripts/liner-notes/curate'
import { generateUpTo } from '../../scripts/liner-notes/pipeline'
import { foldSongTitle } from '../../scripts/utils/song-title'
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

  it('a post named after a song plays that song, or admits it is not (#299)', () => {
    // A `full-circle` headline opens with the song in quotes:
    //   "Notorious": Nile Rodgers and Duran Duran, 39 Years Apart
    //   "Welcome to the Terrordome": Twice in One Night
    // So the feed itself can be checked, which is where the bug was visible
    // and where the unit tests could not see it. Playing a different song is
    // only acceptable when the post SAYS it is a stand-in.
    const wrong = feed.posts
      .filter((p) => p.detector === 'full-circle' && p.audio)
      .map((p) => ({ post: p, song: /^"([^"]+)"/.exec(p.headline)?.[1] }))
      .filter(({ post, song }) => {
        if (!song) return false
        if (post.audio!.role === 'best-known') return false
        return foldSongTitle(post.audio!.trackName) !== foldSongTitle(song)
      })
      .map(({ post, song }) => `${post.slug}: names "${song}", plays "${post.audio!.trackName}"`)

    expect(
      wrong,
      'The post this bug was filed about was headlined "Notorious" and played ' +
        'Get Lucky. Either resolve the song, or label the fallback.'
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

  it('falls past the placeholder to the next real image', () => {
    // The point of this test is that the bundled fallback never wins — a venue whose only
    // "photo" is our own grey placeholder must not stop the chain.
    //
    // WHICH image it lands on changed on 2026-08-29: the fallback order was album → artist
    // → venue and is now venue → artist → album, the owner's rubric. A press shot outranks
    // cover artwork because it is a photograph of someone who was there; the venue outranks
    // both because it is a photograph of the room on the ticket.
    const [built] = buildPosts(
      [finding({ suggestedImage: { type: 'venue', venueNormalized: 'irvine-meadows' } } as Partial<ScoredFinding>)],
      options({ venuesMetadata } as Partial<CurateOptions>)
    )
    expect(built.image.source).toBe('artist')
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

// ── Setlist deep links ──────────────────────────────────────────────────────

describe('setlist deep links (#198 wiring)', () => {
  const concerts: Array<{ date: string; headlinerNormalized: string }> =
    JSON.parse(readFileSync(join(DATA, 'concerts.json'), 'utf8')).concerts

  const nightsByDate = new Map<string, Set<string>>()
  for (const c of concerts) {
    if (!nightsByDate.has(c.date)) nightsByDate.set(c.date, new Set())
    nightsByDate.get(c.date)!.add(c.headlinerNormalized)
  }

  const datesWithSongs = (() => {
    const cache = JSON.parse(readFileSync(join(DATA, 'setlists-cache.json'), 'utf8'))
    const dates = new Set<string>()
    for (const entry of Object.values<any>(cache.entries ?? {})) {
      const sets = entry?.setlist?.sets?.set
      if (!Array.isArray(sets)) continue
      if (sets.reduce((n: number, s: any) => n + (s.song?.length ?? 0), 0) > 0 && entry.date) {
        dates.add(entry.date)
      }
    }
    return dates
  })()

  const setlistLinks = feed.posts
    .map((p) => ({ post: p, link: p.deepLinks?.find((l) => l.type === 'setlist') }))
    .filter((x) => x.link)

  it('the feed actually carries setlist links', () => {
    // Regression guard: for the archive's whole history this was zero, because
    // no detector set `concertDate` — the field existed and nothing fed it.
    expect(setlistLinks.length).toBeGreaterThan(0)
  })

  it('every setlist link pairs an artist with a night they actually headlined', () => {
    const bad = setlistLinks
      .map(({ post, link }) => {
        const m = link!.url.match(/artist=([^&]+)&show=(\d{4}-\d{2}-\d{2})/)
        if (!m) return `${post.slug}: malformed ${link!.url}`
        const [, artist, date] = m
        const played = nightsByDate.get(date)?.has(decodeURIComponent(artist))
        return played ? null : `${post.slug}: ${artist} did not headline ${date}`
      })
      .filter(Boolean)

    // city-pulse used to list every matching year's artist chronologically, so
    // artists[0] — which the link pairs with concertDate — was a different
    // artist from the one the post is about (#239).
    expect(bad).toEqual([])
  })

  it('never links to a night with no setlist on record', () => {
    const empty = setlistLinks
      .map(({ post, link }) => {
        const date = link!.url.match(/show=(\d{4}-\d{2}-\d{2})/)?.[1]
        return date && !datesWithSongs.has(date) ? `${post.slug} → ${date}` : null
      })
      .filter(Boolean)

    // A link promising a setlist and opening an empty panel is worse than none.
    expect(empty).toEqual([])
  })
})

describe('buildDeepLinks setlist gating', () => {
  const withDate = (over: Partial<ScoredFinding> = {}) =>
    finding({ concertDate: '2000-06-01', artists: ['depeche-mode'], ...over } as Partial<ScoredFinding>)

  it('emits the link when the night has a setlist', () => {
    const [built] = buildPosts(
      [withDate()],
      options({ datesWithSetlists: new Set(['2000-06-01']) } as Partial<CurateOptions>)
    )
    const link = built.deepLinks.find((l) => l.type === 'setlist')
    expect(link?.url).toBe('/?scene=artists&artist=depeche-mode&show=2000-06-01')
  })

  it('suppresses the link when that night has no setlist', () => {
    const [built] = buildPosts(
      [withDate()],
      options({ datesWithSetlists: new Set(['1999-01-01']) } as Partial<CurateOptions>)
    )
    expect(built.deepLinks.find((l) => l.type === 'setlist')).toBeUndefined()
  })

  it('emits unconditionally when no setlist index is supplied', () => {
    const [built] = buildPosts([withDate()], options())
    expect(built.deepLinks.find((l) => l.type === 'setlist')).toBeDefined()
  })
})

// ── Finding id stability ────────────────────────────────────────────────────

describe('finding ids survive a data re-import (#242)', () => {
  const concerts = JSON.parse(readFileSync(join(DATA, 'concerts.json'), 'utf8')).concerts
  const meta = {
    venuesMetadata: JSON.parse(readFileSync(join(DATA, 'venues-metadata.json'), 'utf8')),
    artistsMetadata: JSON.parse(readFileSync(join(DATA, 'artists-metadata.json'), 'utf8')),
  }
  const TODAY = new Date('2026-08-05T00:00:00Z')

  it('no finding id changes when every concert.id is renumbered', () => {
    // Row ids are re-import artifacts. Finding ids are load-bearing: mergePosts
    // deduplicates on them and slug preservation looks the previous post up by
    // id, so a shifted id republishes the same story as a new post with a "-2"
    // slug. That already happened once — two Foo Fighters posts about
    // 2015-07-04, published six months apart.
    const before = analyze(concerts, TODAY, meta).findings.map((f) => f.id)
    const renumbered = concerts.map((c: any, i: number) => ({ ...c, id: `concert-${i + 5000}` }))
    const after = new Set(analyze(renumbered, TODAY, meta).findings.map((f) => f.id))

    expect(before.filter((id) => !after.has(id))).toEqual([])
  })

  it('no two posts tell the same story about the same night', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const p of feed.posts) {
      const date = p.deepLinks?.find((l) => l.type === 'setlist')?.url?.match(/show=(\d{4}-\d{2}-\d{2})/)?.[1]
      if (!date) continue
      const key = `${p.detector}@${date}`
      if (seen.has(key)) dupes.push(`${seen.get(key)} + ${p.slug}`)
      else seen.set(key, p.slug)
    }
    expect(dupes).toEqual([])
  })
})
