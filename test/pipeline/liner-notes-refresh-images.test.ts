import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { refreshPostImages } from '../../scripts/liner-notes/refresh-images.ts'
import type { LinerNotesPost } from '../../src/types/liner-notes.ts'

/**
 * Covers #252: published posts froze a third-party image URL that could be
 * revoked at any time, with nothing to detect or repair it.
 */

const PLACEHOLDER = '/images/venues/fallback-active.jpg'

const sources = {
  artistsMetadata: {
    'joe-jackson': { name: 'Joe Jackson', image: 'https://cdn.test/artist/joe.jpg' },
    'social-distortion': { name: 'Social Distortion', image: 'https://cdn.test/artist/sd.jpg' },
  },
  artistsTopTracks: {
    'joe-jackson': {
      tracks: [{ albumName: 'Night and Day', albumArt: 'https://cdn.test/album/nd/100x100bb.jpg' }],
    },
  },
  venuesMetadata: {
    'house-of-blues-anaheim': {
      name: 'House of Blues Anaheim',
      photoUrls: {
        thumbnail: 'https://cdn.test/venue/hob-400.jpg',
        medium: 'https://cdn.test/venue/hob-800.jpg',
        large: 'https://cdn.test/venue/hob-1200.jpg',
      },
    },
    'venue-without-photo': {
      name: 'Venue Without Photo',
      photoUrls: {
        large: '/images/venues/fallback.jpg',
      },
    },
  },
}

function post(overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    slug: 'test-post',
    image: { url: 'https://cdn.test/stale.jpg', alt: 'Alt text', source: 'venue' },
    artists: ['joe-jackson'],
    venues: ['house-of-blues-anaheim'],
    ...overrides,
  } as LinerNotesPost
}

describe('refreshPostImages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const respond = (status: number) =>
    vi.mocked(fetch).mockResolvedValue({ ok: status >= 200 && status < 300, status } as Response)

  it('backfills a missing ref from the post venue and re-resolves the URL', async () => {
    respond(200)
    const posts = [post()]

    const result = await refreshPostImages(posts, sources, { validate: false })

    expect(posts[0].image.ref).toBe('house-of-blues-anaheim')
    expect(posts[0].image.url).toBe('https://cdn.test/venue/hob-1200.jpg')
    expect(result.backfilled).toBe(1)
    expect(result.reresolved).toBe(1)
  })

  it('re-resolves an artist image from its ref', async () => {
    respond(200)
    const posts = [
      post({
        image: { url: 'https://old.test/sd.jpg', alt: 'Social Distortion', source: 'artist' },
        artists: ['social-distortion'],
        venues: [],
      }),
    ]

    await refreshPostImages(posts, sources, { validate: false })

    expect(posts[0].image.ref).toBe('social-distortion')
    expect(posts[0].image.url).toBe('https://cdn.test/artist/sd.jpg')
  })

  it('upsizes album art when re-resolving', async () => {
    respond(200)
    const posts = [
      post({
        image: {
          url: 'https://old.test/nd/100x100bb.jpg',
          alt: 'Night and Day',
          source: 'album',
          ref: 'joe-jackson',
          albumName: 'Night and Day',
        },
      }),
    ]

    await refreshPostImages(posts, sources, { validate: false })

    expect(posts[0].image.url).toBe('https://cdn.test/album/nd/600x600bb.jpg')
  })

  it('repairs a dead URL by falling through to another source on the post', async () => {
    // The venue image 403s; album art for the same post is healthy.
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      const dead = url === 'https://cdn.test/venue/hob-1200.jpg'
      return { ok: !dead, status: dead ? 403 : 200 } as Response
    })

    const posts = [post()]
    const result = await refreshPostImages(posts, sources, { validate: true })

    expect(result.repaired).toBe(1)
    expect(result.fellBack).toBe(0)
    expect(posts[0].image.source).toBe('album')
    expect(posts[0].image.url).toBe('https://cdn.test/album/nd/600x600bb.jpg')
    // The human-written alt text survives repair.
    expect(posts[0].image.alt).toBe('Alt text')
    expect(result.deadUrls[0]).toContain('hob-1200.jpg')
  })

  it('falls back to the local placeholder when nothing on the post resolves', async () => {
    respond(404)
    const posts = [
      post({
        image: { url: 'https://cdn.test/gone.jpg', alt: 'Gone', source: 'venue' },
        artists: [],
        venues: ['venue-without-photo'],
      }),
    ]

    const result = await refreshPostImages(posts, sources, { validate: true })

    expect(result.fellBack).toBe(1)
    expect(posts[0].image.source).toBe('placeholder')
    expect(posts[0].image.url).toBe(PLACEHOLDER)
  })

  /**
   * The important one. A 5xx or a network error is not evidence that an image
   * is gone — treating it as such would let one bad CI run rewrite healthy data
   * to placeholders across every post at once.
   */
  it('does NOT downgrade a post on a 5xx', async () => {
    respond(503)
    const posts = [post({ image: { url: 'https://cdn.test/venue/hob-1200.jpg', alt: 'A', source: 'venue', ref: 'house-of-blues-anaheim' } })]

    const result = await refreshPostImages(posts, sources, { validate: true })

    expect(result.fellBack).toBe(0)
    expect(result.repaired).toBe(0)
    expect(posts[0].image.url).toBe('https://cdn.test/venue/hob-1200.jpg')
  })

  it('does NOT downgrade a post when the network throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    const posts = [post({ image: { url: 'https://cdn.test/venue/hob-1200.jpg', alt: 'A', source: 'venue', ref: 'house-of-blues-anaheim' } })]

    const result = await refreshPostImages(posts, sources, { validate: true })

    expect(result.fellBack).toBe(0)
    expect(posts[0].image.url).toBe('https://cdn.test/venue/hob-1200.jpg')
  })

  it('never treats the bundled venue fallback as a resolved photo', async () => {
    respond(200)
    const posts = [
      post({
        image: { url: 'https://old.test/x.jpg', alt: 'X', source: 'venue', ref: 'venue-without-photo' },
        artists: [],
        venues: ['venue-without-photo'],
      }),
    ]

    await refreshPostImages(posts, sources, { validate: false })

    // Resolution yields nothing, so the stale URL is left for validation to judge
    // rather than being "healed" into the fallback image.
    expect(posts[0].image.url).toBe('https://old.test/x.jpg')
  })

  it('leaves placeholder-sourced posts alone', async () => {
    respond(200)
    const posts = [
      post({ image: { url: PLACEHOLDER, alt: 'Concert', source: 'placeholder' } }),
    ]

    const result = await refreshPostImages(posts, sources, { validate: false })

    expect(result.backfilled).toBe(0)
    expect(result.reresolved).toBe(0)
    expect(posts[0].image.url).toBe(PLACEHOLDER)
  })

  it('skips network checks for local asset paths', async () => {
    const posts = [
      post({ image: { url: PLACEHOLDER, alt: 'Concert', source: 'placeholder' } }),
    ]

    await refreshPostImages(posts, sources, { validate: true })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports changed slugs so derived assets can be regenerated', async () => {
    respond(200)
    const posts = [post({ slug: 'changed-post' })]

    const result = await refreshPostImages(posts, sources, { validate: false })

    expect(result.changedSlugs).toEqual(['changed-post'])
  })
})
