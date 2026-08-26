/**
 * Show photographs as post images (#340).
 *
 * The archive's own photography is tier 1 in the imagery rubric — above an artist press
 * image or a Google Places venue photo — and until now no post could reference it. The
 * classifier in syndication/provenance.ts already recognised `/images/shows/`; nothing ever
 * produced such a URL.
 *
 * Selection must be DETERMINISTIC and must express decisions the owner already made. These
 * pin that: hero first, then the ranked ordinal, then date. Never arbitrary.
 */
import { describe, it, expect } from 'vitest'
import { getShowImageUrl, resolveImageUrl, type ImageSources } from '../../scripts/liner-notes/image-refs'

const sources = (assets: Array<Partial<{ kind: string; url: string | null; date: string; artistNormalized: string | null; hero: boolean; order: number }>>): ImageSources =>
  ({
    artistsMetadata: {},
    artistsTopTracks: {},
    venuesMetadata: {},
    mediaIndex: {
      assets: assets.map((a) => ({
        kind: 'image', url: '/images/shows/x.jpg', date: '2024-08-20',
        artistNormalized: 'howard-jones', hero: false, order: 1, ...a,
      })),
    },
  }) as unknown as ImageSources

describe('getShowImageUrl', () => {
  it('prefers the hero over a lower ordinal', () => {
    // The owner pressed H on that frame. That decision outranks rank order, which is the
    // whole reason hero marking exists.
    const s = sources([
      { url: '/images/shows/hj-01.jpg', order: 1 },
      { url: '/images/shows/hj-03.jpg', order: 3, hero: true },
    ])
    expect(getShowImageUrl('howard-jones', s)).toBe('/images/shows/hj-03.jpg')
  })

  it('falls back to the lowest ordinal when no hero is marked', () => {
    // Two of three shows have no hero. -01 is the best frame of that act by review rank,
    // so it is the right default — not the first one the filter happened to reach.
    const s = sources([
      { url: '/images/shows/db-05.jpg', order: 5 },
      { url: '/images/shows/db-02.jpg', order: 2 },
    ])
    expect(getShowImageUrl('david-byrne', { ...s, mediaIndex: { assets: s.mediaIndex!.assets.map((a) => ({ ...a, artistNormalized: 'david-byrne' })) } }))
      .toBe('/images/shows/db-02.jpg')
  })

  it('breaks a tie on date, so the choice is stable rather than incidental', () => {
    const s = sources([
      { url: '/images/shows/late.jpg', order: 1, date: '2026-06-04' },
      { url: '/images/shows/early.jpg', order: 1, date: '2024-08-20' },
    ])
    expect(getShowImageUrl('howard-jones', s)).toBe('/images/shows/early.jpg')
  })

  it('never returns a video', () => {
    // A render carries `url: null` — video is never served from this repo — and a post
    // needs something fetchable. ABC's only asset on 2024-08-20 is a render, which is why
    // it still falls back to a press image.
    const s = sources([{ kind: 'video', url: null, order: 1, hero: true }])
    expect(getShowImageUrl('howard-jones', s)).toBeUndefined()
  })

  it('returns undefined for an act with no photographs', () => {
    // 181 of 184 shows. Falling through silently is the normal path, not an error.
    expect(getShowImageUrl('the-cure', sources([]))).toBeUndefined()
  })

  it('is undefined when there is no media index at all', () => {
    const s = { artistsMetadata: {}, artistsTopTracks: {}, venuesMetadata: {} } as unknown as ImageSources
    expect(getShowImageUrl('howard-jones', s)).toBeUndefined()
  })
})

describe('resolveImageUrl for a show image', () => {
  it('re-resolves from the artist ref, so a better frame improves old posts', () => {
    // ref is the ARTIST, not the file. Publish a hero later and the post picks it up on the
    // next run without being edited — the same self-healing every other source relies on.
    const before = sources([{ url: '/images/shows/hj-01.jpg', order: 1 }])
    expect(resolveImageUrl({ source: 'show', ref: 'howard-jones' }, before)).toBe('/images/shows/hj-01.jpg')

    const after = sources([
      { url: '/images/shows/hj-01.jpg', order: 1 },
      { url: '/images/shows/hj-03.jpg', order: 3, hero: true },
    ])
    expect(resolveImageUrl({ source: 'show', ref: 'howard-jones' }, after)).toBe('/images/shows/hj-03.jpg')
  })
})
