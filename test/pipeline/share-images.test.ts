import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { describe, it, expect } from 'vitest'
import { shareByline, shareCredits } from '../../scripts/media/share-images'

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
