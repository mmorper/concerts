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
import { upgradeToOwnPhotography } from '../../scripts/liner-notes/refresh-images'
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

  it('discloses a different night when the post is about one specific night', () => {
    const posts = [post({
      deepLinks: [{ label: 'Setlist', url: '/?scene=artists&artist=howard-jones&show=1985-06-04', type: 'setlist' }],
    } as never)]
    upgradeToOwnPhotography(posts, sources())
    expect(posts[0].image.credit).toBe('Mike Morper · August 2024, not the 1985 night')
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
