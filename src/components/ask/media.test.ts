import { describe, it, expect } from 'vitest'
import {
  buildMediaIndex,
  actPhotosOnNight,
  leadPhoto,
  nightPhoto,
  focalPosition,
  cropAspect,
  cropCoverage,
  heroLayout,
  photoCaption,
  venueSourcedPhoto,
  coverUrl,
  coverUrls,
  fmtDate,
  agePhrase,
  monthsPhrase,
  type MediaAsset,
  type Photo,
} from './media'

// Real rows from public/data/media-index.json (fields trimmed to what the cards read).
const hl15: MediaAsset = {
  kind: 'image', url: '/images/shows/2026-06-04-the-human-league-15.jpg', date: '2026-06-04',
  artist: 'The Human League', artistNormalized: 'the-human-league', subject: 'artist',
  crop: { x: 0.3497, y: 0, w: 0.6005, h: 1 }, order: 15, width: 2048, height: 1536,
}
const hl01: MediaAsset = { ...hl15, url: '/images/shows/2026-06-04-the-human-league-01.jpg', hero: true, order: 1, width: 1536, height: 2048, crop: { x: 0, y: 0, w: 1, h: 0.9375 } }
const hj03: MediaAsset = {
  kind: 'image', url: '/images/shows/2024-08-20-howard-jones-03.jpg', date: '2024-08-20',
  artist: 'Howard Jones', artistNormalized: 'howard-jones', subject: 'artist', hero: true,
  crop: { x: 0, y: 0.0856, w: 1, h: 0.7034 }, order: 3, width: 1152, height: 2048,
}
const haircut: MediaAsset = { ...hj03, url: '/images/shows/2024-08-20-haircut-100-01.jpg', artist: 'Haircut 100', artistNormalized: 'haircut-100', width: 2048, height: 1536, crop: { x: 0.3995, y: 0, w: 0.6005, h: 1 } }
const abcVideo: MediaAsset = { kind: 'video', url: null, date: '2024-08-20', artist: 'ABC', artistNormalized: 'abc', subject: 'artist', hero: true, width: 1080, height: 1920 }
const bowl: MediaAsset = { kind: 'image', url: '/images/shows/2026-06-04-venue-02.jpg', date: '2026-06-04', artist: null, artistNormalized: null, subject: 'venue', order: 2, width: 1536, height: 2048, crop: { x: 0, y: 0.0313, w: 1, h: 0.9375 } }
const psb: MediaAsset = { kind: 'image', url: '/images/shows/2022-10-07-pet-shop-boys-01.jpg', date: '2022-10-07', artist: 'Pet Shop Boys', artistNormalized: 'pet-shop-boys', subject: 'artist', hero: true, width: 1536, height: 2048, crop: { x: 0, y: 0, w: 1, h: 0.9375 } }

const ix = buildMediaIndex([hl15, hl01, hj03, haircut, abcVideo, bowl, psb])
const asPhoto = (a: MediaAsset) => a as Photo

describe('buildMediaIndex', () => {
  it('keeps only stills with a committed file — a video never reaches the site', () => {
    expect(ix.byDate.get('2024-08-20')!.map((p) => p.artist)).toEqual(['Howard Jones', 'Haircut 100'])
  })

  it('puts the hero first, then the cull order', () => {
    expect(ix.byArtist.get('the-human-league')!.map((p) => p.order)).toEqual([1, 15])
  })
})

describe('choosing the frame', () => {
  it('never hands an opener’s frame to the headliner', () => {
    expect(actPhotosOnNight(ix, '2024-08-20', 'howard-jones').map((p) => p.artist)).toEqual(['Howard Jones'])
    expect(actPhotosOnNight(ix, '2024-08-20', 'abc')).toEqual([]) // video only
  })

  it('leads an act’s card with the signature, else the latest hero', () => {
    expect(leadPhoto(ix, 'the-human-league')?.order).toBe(1)
    const withSig = buildMediaIndex([hl01, { ...hl15, signature: true }])
    expect(leadPhoto(withSig, 'the-human-league')?.order).toBe(15)
    expect(leadPhoto(ix, 'depeche-mode')).toBeNull()
  })

  it('picks a night’s frame: headliner, else an opener (labelled), else the venue', () => {
    expect(nightPhoto(ix, { date: '2024-08-20', headlinerNormalized: 'howard-jones', openers: ['ABC', 'Haircut 100'] })?.relation).toBe('act')
    // New Order headlined 2022-10-07; the only frame is Pet Shop Boys on the same bill.
    const no = nightPhoto(ix, { date: '2022-10-07', headlinerNormalized: 'new-order', openers: ['Pet Shop Boys', 'Paul Oakenfold'] })
    expect(no).toMatchObject({ relation: 'other-act', photo: { artist: 'Pet Shop Boys' } })
    const venueOnly = buildMediaIndex([bowl])
    expect(nightPhoto(venueOnly, { date: '2026-06-04', headlinerNormalized: 'the-human-league' })?.relation).toBe('venue')
    expect(nightPhoto(ix, { date: '1984-04-27', headlinerNormalized: 'adam-ant' })).toBeNull()
  })
})

describe('framing on the owner’s crop', () => {
  it('a box at the crop’s own aspect shows exactly the crop', () => {
    // Landscape frame, crop on the right: the window lands on x≈716px, where the crop starts.
    expect(cropAspect(asPhoto(hl15))).toBeCloseTo(0.8, 2)
    expect(focalPosition(asPhoto(hl15), cropAspect(asPhoto(hl15)))).toBe('87.5% 50%')
    // Portrait frame, crop starting 8.6% down.
    expect(focalPosition(asPhoto(hj03), cropAspect(asPhoto(hj03)))).toBe('50% 28.9%')
  })

  it('a box smaller than the crop sits inside it, toward the top where faces are', () => {
    // Square thumb of a 4:5 crop: keeps the full width and the upper part of the crop.
    const [, y] = focalPosition(asPhoto(hl01), 1).split(' ').map(parseFloat)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(50)
  })

  it('chooses a banner only when it keeps at least 80% of the crop', () => {
    // A 4:3 stage shot in a 3:2 banner keeps 89% of a full-height crop. 16:9 would keep 75%.
    expect(cropCoverage(asPhoto(hl15), 3 / 2)).toBeCloseTo(0.889, 2)
    expect(cropCoverage(asPhoto(hl15), 16 / 9)).toBeCloseTo(0.75, 2)
    expect(heroLayout(asPhoto(hl15))).toBe('banner')
    // A banner over a portrait 4:5 crop keeps about half of it — the photo goes beside the text.
    expect(cropCoverage(asPhoto(hj03), 3 / 2)).toBeLessThan(0.6)
    expect(heroLayout(asPhoto(hj03))).toBe('portrait')
  })

  it('degrades to the frame itself when a row has no crop', () => {
    expect(focalPosition({ width: 1600, height: 900, crop: null }, 16 / 9)).toBe('50% 50%')
  })
})

describe('captions — the two attribution rules', () => {
  const ctx = {
    venueOf: (d: string) => ({ '2026-06-04': 'Hollywood Bowl', '2024-08-20': 'YouTube Theatre', '2022-10-07': 'Hollywood Bowl' })[d],
    headlinerOf: (d: string) => ({ '2026-06-04': 'The Human League', '2024-08-20': 'Howard Jones', '2022-10-07': 'New Order' })[d],
  }

  it('names the act, the place and the night', () => {
    expect(photoCaption(asPhoto(hl15), { ...ctx, aboutAct: 'the-human-league' })).toBe('My photo · Hollywood Bowl · Jun 4, 2026')
  })

  it('says a frame from another night is not this night', () => {
    expect(photoCaption(asPhoto(hj03), { ...ctx, aboutAct: 'howard-jones', aboutDate: '1985-06-04' })).toBe(
      'My photo from Aug 20, 2024, not this night',
    )
  })

  it('says a frame of another act is theirs, and whose bill it was', () => {
    expect(photoCaption(asPhoto(psb), { ...ctx, aboutAct: 'new-order' })).toBe('Pet Shop Boys, on New Order’s bill · Oct 7, 2022')
  })

  it('labels a venue frame as the venue', () => {
    expect(photoCaption(asPhoto(bowl), { ...ctx, aboutAct: 'the-human-league' })).toBe('Hollywood Bowl · Jun 4, 2026')
  })
})

describe('sourced images', () => {
  it('skips the generic venue placeholder — it is not a photo of the venue', () => {
    expect(venueSourcedPhoto({ photoUrls: { medium: '/images/venues/fallback.jpg' } })).toBeNull()
    expect(venueSourcedPhoto({ photoUrls: { medium: '/images/venues/fallback-active.jpg?w=800' } })).toBeNull()
    expect(venueSourcedPhoto({ manualPhotos: [{ url: '/images/venues/irvinemeadows-1.jpg' }], photoUrls: { medium: 'https://lh3/x' } })).toBe(
      '/images/venues/irvinemeadows-1.jpg',
    )
    expect(venueSourcedPhoto(null)).toBeNull()
  })

  it('builds Cover Art Archive URLs by release-group', () => {
    expect(coverUrl('b08c68d7-c203-3dfc-ac37-ab09c140e663', 500)).toBe(
      'https://coverartarchive.org/release-group/b08c68d7-c203-3dfc-ac37-ab09c140e663/front-500',
    )
  })

  it('tries the next size, then the original, when a CAA thumbnail is missing', () => {
    const base = 'https://coverartarchive.org/release-group/24deab6d-9374-34df-b413-3a14eadad293/front'
    expect(coverUrls('24deab6d-9374-34df-b413-3a14eadad293')).toEqual([`${base}-250`, `${base}-500`, base])
    expect(coverUrls('24deab6d-9374-34df-b413-3a14eadad293', 500)).toEqual([`${base}-500`, base])
  })

  it('formats a calendar date without a timezone shift', () => {
    expect(fmtDate('2026-06-04')).toBe('Jun 4, 2026')
  })
})

describe('duration phrases', () => {
  it('reads like the worker’s prose', () => {
    expect(agePhrase(30)).toBe('30 days')
    expect(agePhrase(270)).toBe('9 months')
    expect(agePhrase(780)).toBe('2.1 years')
    expect(agePhrase(5554)).toBe('15 years')
    expect(monthsPhrase(21)).toBe('21 months')
    expect(monthsPhrase(91)).toBe('7.6 years')
    expect(monthsPhrase(1)).toBe('1 month')
  })
})
