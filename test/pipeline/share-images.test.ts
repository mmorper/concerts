import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { describe, it, expect } from 'vitest'
import { shareByline, shareCredits, staleShareImages, type ShareAsset } from '../../scripts/media/share-images'

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
  it('has one for every published still, so a new show cannot skip `npm run media:share`', () => {
    const { assets } = JSON.parse(readFileSync('public/data/media-index.json', 'utf-8')) as {
      assets: Array<{ kind: string; url: string | null }>
    }
    const missing = assets
      .filter((a) => a.kind === 'image' && a.url)
      .map((a) => basename(a.url as string))
      .filter((file) => !existsSync(join('public/og/shows', file)))
    expect(missing).toEqual([])
  })
})
