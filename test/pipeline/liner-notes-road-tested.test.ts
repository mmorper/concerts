/**
 * road-tested detector (v6.0, #277 §5a)
 *
 * The inverse of album-trajectory: there the record was ahead, here the song
 * was. The tests care most about the BOUNDS, because both of them are the
 * difference between a memory and a fabricated one, and because both were
 * settled by counting rather than by intuition.
 *
 * The negative fixtures are real rows in the shipped data, not invented ones —
 * a synthetic fixture cannot go stale, which is exactly why it cannot catch the
 * regression that matters here.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectRoadTested, type SongAlbumsSlim } from '../../scripts/liner-notes/analyze.ts'
import { buildSetlistIndex } from '../../scripts/liner-notes/setlists.ts'
import type { Concert } from '../../src/types/concert.ts'

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, 'public', 'data', f), 'utf8'))

const concerts: Concert[] = read('concerts.json').concerts
const setlists = buildSetlistIndex(read('setlists-cache.json'))
const songAlbums: SongAlbumsSlim = read('song-albums.json')
const artistsMetadata = read('artists-metadata.json')
const discographyKeys = JSON.parse(
  readFileSync(join(ROOT, 'data', 'artist-aliases.json'), 'utf8')
).discographyKeys

const ctx = {
  artistsMetadata: artistsMetadata.artists ?? artistsMetadata,
  discographyKeys,
}

const findings = detectRoadTested(concerts, setlists, songAlbums, ctx)
const byArtist = (slug: string) => findings.filter((f) => f.artists[0] === slug)

describe('road-tested — what it finds', () => {
  it('finds the nights a song was played before its record existed', () => {
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.detector).toBe('road-tested')
      expect(f.category).toBe('cultural')
      expect(f.dataPoints.daysBeforeRelease as number).toBeGreaterThan(0)
    }
  })

  it('carries the corroboration, so prose can cite instead of assert', () => {
    const cure = byArtist('the-cure')[0]
    expect(cure).toBeDefined()
    const dp = cure.dataPoints as Record<string, unknown>
    expect(dp.albumTitle).toBe('Songs of a Lost World')
    expect(dp.daysBeforeRelease).toBe(527)
    // Five songs off one unreleased record is evidence a single-song finding lacks.
    expect(dp.songCountFromSameFutureAlbum).toBe(5)
    expect((dp.songsHeardEarly as string[]).length).toBe(5)
  })

  it('still fires in the 1–3 year band', () => {
    // A tightening of the cap to one year would silently delete these. The Cure
    // at 527d and Social Distortion at 519d are the canaries.
    const mid = findings.filter((f) => {
      const d = f.dataPoints.daysBeforeRelease as number
      return d > 365 && d <= 1095
    })
    expect(mid.length).toBeGreaterThanOrEqual(2)
    expect(mid.map((f) => f.artists[0])).toContain('social-distortion')
  })
})

describe('road-tested — the upper bound (1,095 days)', () => {
  it('never fires past three years', () => {
    for (const f of findings) {
      expect(f.dataPoints.daysBeforeRelease as number).toBeLessThanOrEqual(1095)
    }
  })

  it("does NOT fire on James' 'Sit Down' or The Alarm's 'The Stand'", () => {
    // Both are real rows in the shipped data at 10,856d and 10,169d, and both
    // resolve to a re-recording made decades after the night. Publishing either
    // would be a fabricated memory.
    expect(byArtist('james')).toHaveLength(0)
    expect(byArtist('the-alarm')).toHaveLength(0)
  })
})

describe('road-tested — the lower bound is precision, not a flat floor', () => {
  it('never fires on a release date that is not day-precise', () => {
    for (const f of findings) {
      expect(f.dataPoints.releaseDatePrecision).toBe('day')
    }
  })

  it("does NOT fire on Crowded House's 'In My Command' (Together Alone, 1993-10)", () => {
    // Reads as a 13-day gap only because the earliest possible date is assumed;
    // the true gap is unknowable between 13 and 43 days. A flat 14-day floor
    // decided this row on a storage artifact.
    const ch = byArtist('crowded-house')
    for (const f of ch) {
      expect(f.dataPoints.albumTitle).not.toBe('Together Alone')
    }
  })

  it('DOES fire on Royal Blood at 10 days, four songs off an unreleased record', () => {
    // The finding a flat 14-day floor deleted. If a future change re-tightens
    // the floor, this fails loudly instead of silently dropping it.
    const rb = byArtist('royal-blood')[0]
    expect(rb).toBeDefined()
    const dp = rb.dataPoints as Record<string, unknown>
    expect(dp.daysBeforeRelease).toBe(10)
    expect(dp.albumTitle).toBe('How Did We Get So Dark?')
    expect(dp.songCountFromSameFutureAlbum).toBe(4)
  })
})

describe('road-tested — headlines', () => {
  it('renders a sub-month gap in days, never "0 Months"', () => {
    const rb = byArtist('royal-blood')[0]
    expect(rb.headline).toContain('10 Days Before')
    expect(rb.headline).not.toContain('0 Months')
  })

  it('never says "1 Years"', () => {
    // Anchored: "2.1 Years" is correct and contains the naive substring.
    for (const f of findings) expect(f.headline).not.toMatch(/(?<![\d.])1 Years/)
  })

  it('does not repeat the artist name for a self-titled record', () => {
    // "Bat Fangs — 4 Months Before Bat Fangs" reads like a typo.
    for (const f of findings) {
      const artist = f.dataPoints.artist as string
      const album = f.dataPoints.albumTitle as string
      if (artist.toLowerCase() === album.toLowerCase()) {
        expect(f.headline).toContain('The Album That Shares Their Name')
      }
    }
  })
})

describe('road-tested — degradation', () => {
  it('returns [] with no attribution data, rather than a stub', () => {
    expect(detectRoadTested(concerts, setlists, undefined, ctx)).toEqual([])
  })

  it('returns [] with no setlists', () => {
    expect(detectRoadTested(concerts, undefined, songAlbums, ctx)).toEqual([])
  })

  it('returns [] when the attribution file is present but empty', () => {
    expect(detectRoadTested(concerts, setlists, { songs: {} }, ctx)).toEqual([])
  })

  it('claims the ALBUM and never the song, in every tag and headline', () => {
    // Garbage's "No Horses" was a 2017 single that only reached an album in
    // 2021 — the song existed the night it was heard. Only the album was ahead.
    for (const f of findings) {
      expect(f.tags).toContain('#road-tested')
      expect(f.headline.toLowerCase()).not.toContain('before the song')
      expect(f.headline.toLowerCase()).not.toContain('existed')
    }
  })
})
