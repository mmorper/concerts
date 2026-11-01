import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'
import { mediaId } from '../../src/components/ask/media'
import {
  shareByline,
  shareCredits,
  shareFile,
  shareTargets,
  staleShareImages,
  type ShareAsset,
} from '../../scripts/media/share-images'

const concert = { date: '2026-09-16', venue: 'Pavilion Theatre', city: 'Glasgow', cityState: 'Glasgow, UK' }

describe('share image credits', () => {
  it('leads with the act, then the venue and month', () => {
    const credits = shareCredits({ artist: 'Thompson Twins', subject: 'artist', date: '2026-09-16' }, concert)
    expect(credits.display).toBe('Thompson Twins')
    expect(credits.meta).toBe('Pavilion Theatre &middot; Glasgow, UK<br>September 2026')
  })

  it('leads with the venue on a frame of the room, and does not repeat it', () => {
    const credits = shareCredits({ artist: null, subject: 'venue', date: '2026-09-16' }, concert)
    expect(credits.display).toBe('Pavilion Theatre')
    expect(credits.meta).toBe('Glasgow, UK<br>September 2026')
  })

  it('never names an act on a venue frame, even if one is recorded', () => {
    const credits = shareCredits({ artist: 'Thompson Twins', subject: 'venue', date: '2026-09-16' }, concert)
    expect(credits.display).toBe('Pavilion Theatre')
  })

  it('escapes what goes into the card as markup', () => {
    const credits = shareCredits({ artist: null, subject: 'venue', date: '2026-09-16' }, { ...concert, cityState: 'A & B' })
    expect(credits.meta).toContain('A &amp; B')
  })

  it('writes the byline in the card’s one form', () => {
    expect(shareByline('2026-09-16')).toBe('Mike Morper · 16 September 2026')
  })
})

describe('which assets get a share image', () => {
  const R2 = 'https://media.morperhaus.org'
  const still: ShareAsset = { kind: 'image', url: '/images/shows/2026-09-16-blancmange-01.jpg', date: '2026-09-16', artist: 'Blancmange', subject: 'artist' }
  const clip: ShareAsset = {
    kind: 'video',
    url: `${R2}/videos/2026-09-16-blancmange-01.mp4?v=abc123def456`,
    poster: `${R2}/posters/2026-09-16-blancmange-01.jpg?v=123abc456def`,
    date: '2026-09-16',
    artist: 'Blancmange',
    subject: 'artist',
  }

  it('gives a published video a card', () => {
    expect(shareTargets([clip])).toEqual([clip])
  })

  it('gives an unpublished video none', () => {
    expect(shareTargets([{ ...clip, url: null, poster: null }])).toEqual([])
  })

  it('keeps stills, and narrows to one show', () => {
    expect(shareTargets([still, clip], '2026-09-16')).toEqual([still, clip])
    expect(shareTargets([still, clip], '2026-09-14')).toEqual([])
  })

  it('names a clip’s card for the Worker’s lookup, without the version', () => {
    const id = mediaId({ ...clip, kind: 'video', url: clip.url as string })
    expect(id).toBe('blancmange-01-video')
    expect(shareFile(clip)).toBe(`${clip.date}-${id}.jpg`)
  })

  it('does not rename a still', () => {
    expect(shareFile(still)).toBe('2026-09-16-blancmange-01.jpg')
  })

  it('credits the clip’s own act, an opener here, not the night’s headliner', () => {
    const credits = shareCredits(clip, { ...concert, headliner: 'Thompson Twins' } as typeof concert)
    expect(credits.display).toBe('Blancmange')
  })
})

describe('which share images a crop session leaves stale', () => {
  const box = { x: 0, y: 0, w: 1, h: 0.9375 }
  const still: ShareAsset = { kind: 'image', url: '/images/shows/a.jpg', date: '2026-09-16', artist: 'X', subject: 'artist', crop: box }
  const urls = (list: ShareAsset[]) => list.map((a) => a.url)
  const had = new Map([['/images/shows/a.jpg', box]])

  it('leaves an untouched still alone', () => {
    expect(staleShareImages([still], had, () => true)).toEqual([])
  })

  it('picks up a redrawn box, the case nothing else would catch', () => {
    const moved = { ...still, crop: { ...box, y: 0.05 } }
    expect(urls(staleShareImages([moved], had, () => true))).toEqual(['/images/shows/a.jpg'])
  })

  it('picks up a still with no image yet, as on a new show', () => {
    expect(urls(staleShareImages([still], had, () => false))).toEqual(['/images/shows/a.jpg'])
  })

  it('picks up a box drawn for the first time', () => {
    expect(urls(staleShareImages([still], new Map(), () => true))).toEqual(['/images/shows/a.jpg'])
  })

  it('skips videos, and stills with no box, which the card refuses', () => {
    const video = { ...still, kind: 'video' }
    const uncropped = { ...still, crop: null }
    expect(staleShareImages([video, uncropped], new Map(), () => false)).toEqual([])
  })
})

describe('share images on disk', () => {
  it('has one for every published still and video, so a new show cannot skip `npm run media:share`', () => {
    const { assets } = JSON.parse(readFileSync('public/data/media-index.json', 'utf-8')) as { assets: ShareAsset[] }
    const missing = shareTargets(assets)
      .map(shareFile)
      .filter((file) => !existsSync(join('public/og/shows', file)))
    expect(missing).toEqual([])
  })
})
