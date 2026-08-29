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
import { getShowAsset, getShowImageUrl, resolveImageUrl, showByline, type ImageSources } from '../../scripts/liner-notes/image-refs'
import { buildPosts, type CurateOptions } from '../../scripts/liner-notes/curate'
import type { ScoredFinding } from '../../scripts/liner-notes/types'

const sources = (assets: Array<Partial<{ kind: string; url: string | null; date: string; artistNormalized: string | null; hero: boolean; signature: boolean; order: number; crop: { x: number; y: number; w: number; h: number } }>>): ImageSources =>
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

describe('loadBackground with a repo-local path', () => {
  it('reads a committed file instead of trying to fetch it', async () => {
    // THE BUG A MOCK CAUGHT. Until #340 every post image was a third-party URL, so
    // loadBackground only spoke http. A site-relative `/images/shows/…` fell to the
    // not-a-URL branch and returned a SOLID GROUND — a blank card with usedFallback: true,
    // which per that flag's contract means syndication must refuse the post. Wiring show
    // photos in without this would have made exactly the posts that gained a real
    // photograph publish worse, or not at all.
    const { loadBackground } = await import('../../scripts/liner-notes/og-image')
    const real = await loadBackground('/images/shows/2024-08-20-howard-jones-03.jpg')
    expect(real.usedFallback).toBe(false)
  })

  it('still falls back when a local path does not exist', async () => {
    const { loadBackground } = await import('../../scripts/liner-notes/og-image')
    const missing = await loadBackground('/images/shows/does-not-exist.jpg')
    expect(missing.usedFallback).toBe(true)
  })

  it('still refuses a bare string that is neither a url nor a path', async () => {
    const { loadBackground } = await import('../../scripts/liner-notes/og-image')
    expect((await loadBackground('images/shows/no-leading-slash.jpg')).usedFallback).toBe(true)
    expect((await loadBackground(undefined)).usedFallback).toBe(true)
  })
})

// ── The crop box has to survive the trip ────────────────────────────────────

describe('getShowAsset', () => {
  it('carries the crop box, which a URL cannot', () => {
    // The box is the reason this function exists. Tier and source are recoverable from the
    // URL path by syndication/provenance.ts; the crop is a per-frame judgement the owner
    // made in the review page and nothing downstream can re-derive it. A renderer that does
    // not receive it centre-crops — the exact failure #342 documents, which on the archive's
    // own photography cuts the head off, because these frames are shot upward from a crowd.
    const crop = { x: 0, y: 0.0856, w: 1, h: 0.7034 }
    const s = sources([{ url: '/images/shows/hj-03.jpg', order: 3, hero: true, crop }])
    expect(getShowAsset('howard-jones', s)?.crop).toEqual(crop)
  })

  it('carries the capture date, so a different night can be disclosed', () => {
    const s = sources([{ url: '/images/shows/hj-03.jpg', order: 3, date: '2024-08-20' }])
    expect(getShowAsset('howard-jones', s)?.date).toBe('2024-08-20')
  })

  it('picks the same asset getShowImageUrl names', () => {
    // getShowImageUrl is now a projection of this. If they can ever disagree, a post's
    // stored URL and its rendered crop are describing two different photographs.
    const s = sources([
      { url: '/images/shows/hj-01.jpg', order: 1 },
      { url: '/images/shows/hj-03.jpg', order: 3, hero: true },
    ])
    expect(getShowAsset('howard-jones', s)?.url).toBe(getShowImageUrl('howard-jones', s))
  })

  it('leaves the crop undefined when the owner never drew one', () => {
    // Not {0,0,1,1}. The renderer has to be able to tell "unreviewed" from "cropped to the
    // full frame", or an untouched asset silently claims a judgement nobody made.
    const s = sources([{ url: '/images/shows/hj-01.jpg', order: 1 }])
    expect(getShowAsset('howard-jones', s)?.crop).toBeUndefined()
  })
})

// ── The byline ──────────────────────────────────────────────────────────────

describe('showByline', () => {
  it('names the date of the photograph, and only that', () => {
    expect(showByline('2024-08-20')).toBe('Mike Morper · 20 August 2024')
  })

  it('NEVER renders a different-night disclaimer', () => {
    // Removed by the owner 2026-08-28. PROVENANCE.md specified a second variant —
    // "Mike Morper · July 2026, not the 1987 night" — and their reasoning for dropping it is
    // that the byline already states when the photograph was taken, so a reader given
    // "June 2026" under a headline about 2018 can connect those without being told. The
    // negation added nothing visible and made the card apologise for itself.
    for (const iso of ['2026-06-04', '1987-07-24', '2024-08-20']) {
      const line = showByline(iso)
      expect(line).not.toContain('not the')
      expect(line).not.toContain('night')
    }
  })

  it('is the FULL date, never month-only', () => {
    // The old different-night variant was month-only, which left the one genuinely ambiguous
    // case: "August 2024" under a post about a different August night. A full date closes it,
    // and closing it is what makes dropping the disclaimer safe rather than merely tidier.
    expect(showByline('2026-06-04')).toBe('Mike Morper · 4 June 2026')
  })
})

// ── The ordering, which is what made any of this reachable ──────────────────

const finding = (o: Partial<ScoredFinding> = {}): ScoredFinding =>
  ({
    id: 'longevity-howard-jones', detector: 'artist-longevity', category: 'personal',
    temporality: 'evergreen', headline: 'Howard Jones: 39 Years of Shows', dataPoints: {},
    artists: ['howard-jones'], venues: ['pacific-amphitheatre'], years: [1985, 2024],
    tags: [], score: 40, scoreBreakdown: {}, prose: 'Thirty-nine years.',
    suggestedImage: { type: 'artist', artistNormalized: 'howard-jones' },
    ...o,
  }) as unknown as ScoredFinding

const curateOptions = (o: Partial<CurateOptions> = {}): CurateOptions =>
  ({
    artistsMetadata: { 'howard-jones': { name: 'Howard Jones', image: 'https://theaudiodb.com/hj.jpg' } },
    artistsTopTracks: { 'howard-jones': { name: 'Howard Jones', tracks: [{ name: 'Things Can Only Get Better', albumName: 'Dream Into Action', albumArt: 'https://mzstatic.com/dia.jpg' }] } },
    venuesMetadata: { 'universal-amphitheater': { name: 'Universal Amphitheater', photoUrls: { large: 'https://googleapis.com/ua.jpg' } } },
    mediaIndex: { assets: [{
      kind: 'image', url: '/images/shows/2024-08-20-howard-jones-03.jpg', date: '2024-08-20',
      artistNormalized: 'howard-jones', hero: true, order: 3,
      crop: { x: 0, y: 0.0856, w: 1, h: 0.7034 },
    }] },
    existingPosts: [], publishedAt: '2026-08-27T00:00:00.000Z',
    ...o,
  }) as unknown as CurateOptions

describe('resolveImage ordering', () => {
  it('the archive\'s own photograph outranks the artist press shot the detector suggested', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. The show branch used to sit below both the
    // detector's suggestedImage and the top-tracks album-art fallback, which did not
    // deprioritise it — it made it unreachable. Every act with published photography also
    // has album art AND an artist image, so an earlier branch always returned first. 58
    // posts published, not one `source: "show"`.
    const [post] = buildPosts([finding()], curateOptions())
    expect(post.image.source).toBe('show')
    expect(post.image.url).toBe('/images/shows/2024-08-20-howard-jones-03.jpg')
  })

  it('outranks album art too', () => {
    const [post] = buildPosts(
      [finding({ suggestedImage: { type: 'album', artistNormalized: 'howard-jones', albumName: 'Dream Into Action' } })],
      curateOptions()
    )
    expect(post.image.source).toBe('show')
  })

  it('carries the crop box and the byline onto the post', () => {
    const [post] = buildPosts([finding()], curateOptions())
    expect(post.image.crop).toEqual({ x: 0, y: 0.0856, w: 1, h: 0.7034 })
    expect(post.image.shotOn).toBe('2024-08-20')
    expect(post.image.credit).toBe('Mike Morper · 20 August 2024')
  })

  it('states the photograph\'s own date even when the post is about another night', () => {
    // The disclaimer variant was removed by the owner 2026-08-28. The date is the disclosure:
    // a reader given 20 August 2024 under a post about 1985 can connect that unaided.
    const [post] = buildPosts([finding({ concertDate: '1985-08-16' })], curateOptions())
    expect(post.image.credit).toBe('Mike Morper · 20 August 2024')
  })

  it('does NOT put an artist photograph on a venue post', () => {
    // venue-loyalty and venue-ghost are venue-scoped but still carry an artists array, so
    // artists[0] is whoever sorts first — on both Universal Amphitheater posts that is
    // Howard Jones, whose only frames were taken in 2024 at a different venue, years after
    // Universal was demolished. Right tier, wrong subject.
    const [post] = buildPosts(
      [finding({
        id: 'venue-ghost-universal-amphitheater', detector: 'venue-ghost',
        venues: ['universal-amphitheater'],
        suggestedImage: { type: 'venue', venueNormalized: 'universal-amphitheater' },
      })],
      curateOptions()
    )
    expect(post.image.source).toBe('venue')
  })

  it('still falls back to tier 2 for an act with no photographs', () => {
    // 178 of 184 shows. The normal path, and it must not have changed.
    const [post] = buildPosts(
      [finding({ artists: ['the-cure'], suggestedImage: { type: 'artist', artistNormalized: 'the-cure' } })],
      curateOptions({ artistsMetadata: { 'the-cure': { name: 'The Cure', image: 'https://theaudiodb.com/cure.jpg' } } })
    )
    expect(post.image.source).toBe('artist')
    expect(post.image.crop).toBeUndefined()
    expect(post.image.credit).toBeUndefined()
  })
})

// ── The OG card has to honour the box ───────────────────────────────────────

describe('loadBackground with a crop box', () => {
  const HERO = '/images/shows/2024-08-20-howard-jones-03.jpg'
  const CROP = { x: 0, y: 0.0856, w: 1, h: 0.7034 }

  it('takes different pixels with the box than without it', async () => {
    // The 1.91:1 card shows 42% of an authored 4:5 box — the most aggressive slice in the
    // system. Centre-cropping takes that 42% from the middle and discards the top fifth of
    // the crop, which on a frame shot upward from a crowd is the head. Nothing about the
    // failure is loud: the card renders, it is the right size, and the subject is
    // decapitated. So this asserts the two paths do not agree.
    const { loadBackground } = await import('../../scripts/liner-notes/og-image')
    const cropped = await (await loadBackground(HERO, CROP)).background.png().toBuffer()
    const centred = await (await loadBackground(HERO)).background.png().toBuffer()
    expect(cropped.equals(centred)).toBe(false)
  })

  it('still produces a 1200x630 card', async () => {
    const { loadBackground, WIDTH, HEIGHT } = await import('../../scripts/liner-notes/og-image')
    const meta = await (await loadBackground(HERO, CROP)).background.png().toBuffer()
      .then((b) => (import('sharp')).then((s) => s.default(b).metadata()))
    expect(meta.width).toBe(WIDTH)
    expect(meta.height).toBe(HEIGHT)
  })

  it('takes the crop from the TOP of the box, not its centre', async () => {
    // The rule, asserted against the pixels rather than restated. Top-derivation starts at
    // the box top (y=175); centre-derivation starts 418px lower and is a different image.
    const sharp = (await import('sharp')).default
    const { deriveRect } = await import('../../scripts/media/derive')
    const { loadBackground, WIDTH, HEIGHT } = await import('../../scripts/liner-notes/og-image')
    const file = 'public/images/shows/2024-08-20-howard-jones-03.jpg'
    const src = { width: 1152, height: 2048 }

    expect(deriveRect(CROP, src, WIDTH / HEIGHT, 'top').top).toBe(175)
    expect(deriveRect(CROP, src, WIDTH / HEIGHT, 'centre').top).toBe(593)

    const shipped = await (await loadBackground(HERO, CROP)).background.png().toBuffer()
    const top = await sharp(file).extract(deriveRect(CROP, src, WIDTH / HEIGHT, 'top'))
      .resize(WIDTH, HEIGHT, { fit: 'fill' }).png().toBuffer()
    expect(shipped.equals(top)).toBe(true)
  })

  it('falls back to a centre crop when no box has been drawn', async () => {
    // Unreviewed, not broken. A card is still owed for the site's own og:image.
    const { loadBackground } = await import('../../scripts/liner-notes/og-image')
    expect((await loadBackground(HERO)).usedFallback).toBe(false)
  })
})

// ── Choosing between shows ──────────────────────────────────────────────────

describe('the signature — the best frame of an act across every show', () => {
  it('outranks a per-show hero', () => {
    // `hero` is one per act PER NIGHT, so an act photographed at three shows has three of
    // them. A post reaching for "a photograph of Howard Jones" without being about one
    // particular night — most posts — had nothing to choose between them.
    const s = sources([
      { url: '/images/shows/2024-hj-01.jpg', order: 1, hero: true, date: '2024-08-20' },
      { url: '/images/shows/2026-hj-03.jpg', order: 3, hero: true, date: '2026-06-04', signature: true },
    ])
    expect(getShowImageUrl('howard-jones', s)).toBe('/images/shows/2026-hj-03.jpg')
  })

  it('is what stops the EARLIEST show winning by accident', () => {
    // Before this the last tie-break was `date` ascending, so between two heroes from two
    // nights the older one won — not because anyone chose it, but because that is what a
    // stable sort does. The signature makes the choice explicit.
    const heroesOnly = sources([
      { url: '/images/shows/2026-hj-01.jpg', order: 1, hero: true, date: '2026-06-04' },
      { url: '/images/shows/2012-hj-01.jpg', order: 1, hero: true, date: '2012-06-12' },
    ])
    expect(getShowImageUrl('howard-jones', heroesOnly)).toBe('/images/shows/2012-hj-01.jpg')

    const marked = sources([
      { url: '/images/shows/2026-hj-01.jpg', order: 1, hero: true, date: '2026-06-04', signature: true },
      { url: '/images/shows/2012-hj-01.jpg', order: 1, hero: true, date: '2012-06-12' },
    ])
    expect(getShowImageUrl('howard-jones', marked)).toBe('/images/shows/2026-hj-01.jpg')
  })

  it('changes nothing when no signature is marked', () => {
    // Which is every act today — none has been photographed at two shows yet. The mark is
    // additive and the existing order is untouched without it.
    const s = sources([
      { url: '/images/shows/hj-01.jpg', order: 1 },
      { url: '/images/shows/hj-03.jpg', order: 3, hero: true },
    ])
    expect(getShowImageUrl('howard-jones', s)).toBe('/images/shows/hj-03.jpg')
  })
})
