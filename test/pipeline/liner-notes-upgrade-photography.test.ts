/**
 * Promoting a published post to the archive's own photography (#340).
 *
 * The ordering fix in `resolveImage` decides tier at CURATE time, and nothing re-runs it —
 * `refreshPostImages` re-resolves `url` from `ref` but never revisits `source`. So without
 * this step the fix reaches future posts only, and a post published before its show was
 * culled keeps a press shot forever. The archive gains photography retroactively; that is
 * the normal case, not the exception.
 */
import { describe, it, expect } from 'vitest'
import { upgradeToOwnPhotography, upgradeVenuePosts } from '../../scripts/liner-notes/refresh-images'
import type { ImageSources } from '../../scripts/liner-notes/image-refs'
import type { LinerNotesPost } from '../../src/types/liner-notes'

const HERO_CROP = { x: 0, y: 0.0856, w: 1, h: 0.7034 }

const sources = (): ImageSources =>
  ({
    artistsMetadata: { 'howard-jones': { name: 'Howard Jones', image: 'https://theaudiodb.com/hj.jpg' } },
    artistsTopTracks: {},
    venuesMetadata: {},
    mediaIndex: { assets: [{
      kind: 'image', url: '/images/shows/2024-08-20-howard-jones-03.jpg', date: '2024-08-20',
      artistNormalized: 'howard-jones', hero: true, order: 3, crop: HERO_CROP,
    }] },
  }) as unknown as ImageSources

const post = (o: Partial<LinerNotesPost> = {}): LinerNotesPost =>
  ({
    id: 'longevity-howard-jones', slug: 'howard-jones-39-years-of-shows',
    detector: 'artist-longevity', headline: 'Howard Jones: 39 Years of Shows',
    artists: ['howard-jones'], venues: ['youtube-theatre'], years: [1985, 2024],
    image: { url: 'https://theaudiodb.com/hj.jpg', alt: 'Howard Jones', source: 'artist', ref: 'howard-jones' },
    deepLinks: [], tags: [],
    ...o,
  }) as unknown as LinerNotesPost

describe('upgradeToOwnPhotography', () => {
  it('promotes a press shot to our own photograph', () => {
    const posts = [post()]
    expect(upgradeToOwnPhotography(posts, sources())).toEqual(['howard-jones-39-years-of-shows'])
    expect(posts[0].image.source).toBe('show')
    expect(posts[0].image.url).toBe('/images/shows/2024-08-20-howard-jones-03.jpg')
  })

  it('carries the crop box, the capture date and the byline', () => {
    // The box especially: it cannot be re-derived downstream, and og-image centre-crops
    // without it — which on a 1.91:1 card cuts the subject's head off.
    const posts = [post()]
    upgradeToOwnPhotography(posts, sources())
    expect(posts[0].image.crop).toEqual(HERO_CROP)
    expect(posts[0].image.shotOn).toBe('2024-08-20')
    expect(posts[0].image.credit).toBe('Mike Morper · 20 August 2024')
  })

  it('states the photograph\'s own date even when the post is about another night', () => {
    const posts = [post({
      deepLinks: [{ label: 'Setlist', url: '/?scene=artists&artist=howard-jones&show=1985-06-04', type: 'setlist' }],
    } as never)]
    upgradeToOwnPhotography(posts, sources())
    expect(posts[0].image.credit).toBe('Mike Morper · 20 August 2024')
  })

  it('replaces the stored alt, which described the OLD image', () => {
    const posts = [post({ image: { url: 'https://mzstatic.com/dia.jpg', alt: 'Album art', source: 'album', ref: 'howard-jones' } } as never)]
    upgradeToOwnPhotography(posts, sources())
    expect(posts[0].image.alt).toBe('Howard Jones')
  })

  it('LEAVES A VENUE POST ALONE', () => {
    // venue-loyalty and venue-ghost carry an artists array, so artists[0] is whoever sorts
    // first — on both Universal Amphitheater posts that is Howard Jones, photographed in
    // 2024 at a venue demolished years earlier. Right tier, wrong subject.
    for (const detector of ['venue-ghost', 'venue-loyalty', 'geographic-chapter', 'historical-moment', 'city-pulse']) {
      const posts = [post({ detector } as never)]
      expect(upgradeToOwnPhotography(posts, sources())).toEqual([])
      expect(posts[0].image.source).toBe('artist')
    }
  })

  it('is idempotent — a post already on our photography is not touched again', () => {
    const posts = [post()]
    upgradeToOwnPhotography(posts, sources())
    expect(upgradeToOwnPhotography(posts, sources())).toEqual([])
  })

  it('leaves an act with no photographs on its press shot', () => {
    // 178 of 184 shows. The normal path.
    const posts = [post({ artists: ['the-cure'] } as never)]
    expect(upgradeToOwnPhotography(posts, sources())).toEqual([])
    expect(posts[0].image.source).toBe('artist')
  })

  it('is safe with no media index at all', () => {
    const posts = [post()]
    expect(upgradeToOwnPhotography(posts, { artistsMetadata: {}, artistsTopTracks: {}, venuesMetadata: {} } as unknown as ImageSources)).toEqual([])
  })
})

describe('upgradeVenuePosts', () => {
  // TEN OF TEN venue posts carried an album cover while Places had a photo for all of them.
  // `resolveImage` asks for the venue image first on these, but when Places had nothing yet
  // it fell through to album art — and nothing revisits `source`. Venue photos arrive on the
  // weekly metadata refresh, months after a post is written, so the fall-through was
  // permanent by default.
  //
  // The tell was in the data: `kia-forum-5-shows-over-3-decades` carried alt "Kia Forum"
  // over an Erasure album cover. The alt already described an image that was not there.
  const venueSources = (): ImageSources =>
    ({
      artistsMetadata: {},
      artistsTopTracks: {},
      venuesMetadata: {
        'kia-forum': { name: 'Kia Forum', photoUrls: { large: 'https://googleapis.com/kia.jpg' } },
        'irvine-meadows': { name: 'Irvine Meadows', photoUrls: { large: '/images/venues/fallback.jpg' } },
      },
      mediaIndex: { assets: [] },
    }) as unknown as ImageSources

  const venuePost = (o: Partial<LinerNotesPost> = {}): LinerNotesPost =>
    ({
      slug: 'kia-forum-5-shows-over-3-decades', detector: 'venue-loyalty',
      artists: ['erasure'], venues: ['kia-forum'], deepLinks: [], tags: [],
      image: { url: 'https://mzstatic.com/x.jpg', alt: 'Kia Forum', source: 'album', ref: 'erasure' },
      ...o,
    }) as unknown as LinerNotesPost

  it('gives a venue post its venue photograph once one exists', () => {
    const posts = [venuePost()]
    expect(upgradeVenuePosts(posts, venueSources())).toEqual(['kia-forum-5-shows-over-3-decades'])
    expect(posts[0].image.source).toBe('venue')
    expect(posts[0].image.ref).toBe('kia-forum')
  })

  it('replaces the alt, which already named the venue over an album cover', () => {
    const posts = [venuePost()]
    upgradeVenuePosts(posts, venueSources())
    expect(posts[0].image.alt).toBe('Kia Forum')
    expect(posts[0].image.url).toBe('https://googleapis.com/kia.jpg')
  })

  it('leaves an ARTIST post alone — that is the wrong subject', () => {
    // The mirror of the gate in upgradeToOwnPhotography. A venue photograph on an artist
    // post is the same error as an artist photograph on a venue post.
    const posts = [venuePost({ detector: 'artist-longevity' } as never)]
    expect(upgradeVenuePosts(posts, venueSources())).toEqual([])
    expect(posts[0].image.source).toBe('album')
  })

  it('never overwrites the archive\'s own photography', () => {
    // Personal beats sourced. A venue post that reached tier 1 has earned it.
    const posts = [venuePost({
      image: { url: '/images/shows/x.jpg', alt: 'x', source: 'show', ref: 'a' },
    } as never)]
    expect(upgradeVenuePosts(posts, venueSources())).toEqual([])
  })

  it('is not fooled by the bundled fallback standing in for a real photo', () => {
    // Irvine Meadows is demolished and Places has nothing, so `photoUrls` holds our own
    // generic image. Promoting to that would swap an album cover for a grey placeholder.
    const posts = [venuePost({ slug: 'irvine', venues: ['irvine-meadows'] } as never)]
    expect(upgradeVenuePosts(posts, venueSources())).toEqual([])
  })

  it('is idempotent', () => {
    const posts = [venuePost()]
    upgradeVenuePosts(posts, venueSources())
    expect(upgradeVenuePosts(posts, venueSources())).toEqual([])
  })
})

describe('the imagery precedence — photography, then venue, then artist', () => {
  // The owner's rubric, 2026-08-29. Two sets answer two different questions and collapsing
  // them broke the first rule: `3-concerts-in-12-days` was sent to a photo of The Belasco
  // while the archive holds five frames of Foals taken AT that show.
  const both = (): ImageSources =>
    ({
      artistsMetadata: { foals: { name: 'Foals' } },
      artistsTopTracks: {},
      venuesMetadata: {
        'the-belasco': { name: 'The Belasco', photoUrls: { large: 'https://googleapis.com/b.jpg' } },
      },
      mediaIndex: { assets: [{
        kind: 'image', url: '/images/shows/2023-07-18-foals-01.jpg', date: '2023-07-18',
        artistNormalized: 'foals', hero: true, order: 1, crop: { x: 0, y: 0, w: 1, h: 0.8 },
      }] },
    }) as unknown as ImageSources

  const streak = (o: Partial<LinerNotesPost> = {}): LinerNotesPost =>
    ({
      slug: '3-concerts-in-12-days', detector: 'concert-streak',
      artists: ['foals'], venues: ['the-belasco'], deepLinks: [], tags: [],
      image: { url: 'https://theaudiodb.com/f.jpg', alt: 'Foals', source: 'artist', ref: 'foals' },
      ...o,
    }) as unknown as LinerNotesPost

  it('gives an EVENT post our own photography, not the venue', () => {
    // A festival or streak post is place-forward against a PRESS SHOT, never against our
    // own photograph. `artists[0]` there is a real subject — the headliner, or an act
    // genuinely on the bill — unlike a venue-loyalty post where it is whoever sorts first.
    const posts = [streak()]
    upgradeToOwnPhotography(posts, both())
    expect(posts[0].image.source).toBe('show')
    expect(posts[0].image.url).toContain('foals')
  })

  it('falls to the venue only when there is no photography', () => {
    const posts = [streak({ artists: ['the-cure'] } as never)]
    upgradeToOwnPhotography(posts, both())
    upgradeVenuePosts(posts, both())
    expect(posts[0].image.source).toBe('venue')
  })

  it('still keeps an artist photograph off a true venue-subject post', () => {
    // The narrow set, unchanged. On venue-loyalty `artists[0]` is arbitrary.
    const posts = [streak({ detector: 'venue-loyalty' } as never)]
    upgradeToOwnPhotography(posts, both())
    expect(posts[0].image.source).not.toBe('show')
  })

  it('keeps the two sets distinct, because they answer different questions', async () => {
    const { VENUE_SUBJECT_DETECTORS, PLACE_FORWARD_DETECTORS } =
      await import('../../scripts/liner-notes/image-refs')
    expect(PLACE_FORWARD_DETECTORS.has('festival-mega-bill')).toBe(true)
    expect(VENUE_SUBJECT_DETECTORS.has('festival-mega-bill')).toBe(false)
    for (const d of VENUE_SUBJECT_DETECTORS) expect(PLACE_FORWARD_DETECTORS.has(d)).toBe(true)
  })
})
