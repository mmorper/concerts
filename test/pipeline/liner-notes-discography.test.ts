/**
 * Discography detectors (v5.4, #272)
 *
 * album-trajectory is the first detector in the pipeline where the narrator is
 * wrong about the future, so the tests care most about two things: that the
 * evidence travels with the finding (prose must cite, not assert), and that
 * every discography detector degrades to silence rather than to a stub.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { analyze, detectAlbumTrajectory, detectDiscographyCrossref, type AlbumErasSlim } from '../../scripts/liner-notes/analyze.ts'
import type { Concert } from '../../src/types/concert.ts'

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, 'public', 'data', f), 'utf8'))

const concerts: Concert[] = read('concerts.json').concerts
const eras: AlbumErasSlim = read('album-eras.json')
const artistsMetadata = read('artists-metadata.json')
const TODAY = new Date('2026-08-07')

describe('album-trajectory', () => {
  const findings = detectAlbumTrajectory(
    concerts.filter((c) => c.date <= '2026-08-07'),
    eras
  )

  it('finds the shows where the defining record did not exist yet', () => {
    // Data-coupled on purpose: this asserts against the real album-eras.json,
    // so it moves when the underlying data does — which is the point.
    //
    // 8 -> 10 when album-eras was re-derived after #275 corrected
    // artists-top-tracks.json (`definingAlbum` is derived from top tracks, so
    // the eras file had been lagging it). Strictly additive, nothing lost:
    //   + sting 1991-10-04            -> Ten Summoner's Tales
    //   + prophets-of-rage 2016-08-19 -> Prophets of Rage
    expect(findings).toHaveLength(10)
  })

  it('carries the Rose Bowl with its evidence, not just its claim', () => {
    const rb = findings.find(
      (f) => f.artists[0] === 'depeche-mode' && f.dataPoints.date === '1988-06-18'
    )
    expect(rb).toBeDefined()
    const dp = rb!.dataPoints as Record<string, unknown>
    expect(dp.definingAlbumTitle).toBe('Violator')
    expect(dp.monthsAway).toBe(20)
    // The evidence prose must cite instead of asserting a critical judgment.
    expect(dp.topTrackCount).toBe(3)
    expect(dp.topTrackTotal).toBe(5)
    expect(dp.albumsAfter).toBe(9)
  })

  it('images the post with the record that did not exist yet', () => {
    const rb = findings.find((f) => f.dataPoints.date === '1988-06-18')!
    expect(rb.suggestedImage).toEqual({
      type: 'album',
      artistNormalized: 'depeche-mode',
      albumName: 'Violator',
    })
  })

  it('carries album identity for a deep link nothing renders yet (spec §Part 7)', () => {
    // Inert in v5.4. Present so the future discography surface is a rendering
    // change rather than a migration of already-published posts.
    const dp = findings[0].dataPoints as Record<string, unknown>
    expect(dp.definingAlbumMbid).toMatch(/^[0-9a-f-]{36}$/)
    expect(dp.definingAlbumSlug).toBeTruthy()
    expect(Array.isArray(dp.albumsAheadIdentity)).toBe(true)
  })

  it('does not headline a self-titled record against its own artist', () => {
    // "Bat Fangs — 4 Months Before Bat Fangs" reads like a typo.
    const selfTitled = findings.filter(
      (f) => (f.dataPoints.definingAlbumTitle as string) === (f.dataPoints.artist as string)
    )
    expect(selfTitled.length).toBeGreaterThan(0) // Bat Fangs — guard against a vacuous test
    for (const f of selfTitled) {
      expect(f.headline).not.toMatch(new RegExp(`Before ${f.dataPoints.artist}$`))
      expect(f.headline).toMatch(/Their First Record|The Album That Shares Their Name/)
    }
  })

  it('ignores gaps too short to be a story', () => {
    const tooSoon = findings.filter((f) => (f.dataPoints.monthsAway as number) < 3)
    expect(tooSoon).toEqual([])
  })

  it('returns nothing without era data rather than a stub', () => {
    expect(detectAlbumTrajectory(concerts, undefined)).toEqual([])
  })
})

describe('discography-crossref', () => {
  const findings = detectDiscographyCrossref(
    concerts.filter((c) => c.date <= '2026-08-07'),
    eras
  )

  it('finds artists seen across two or more album cycles', () => {
    expect(findings.length).toBeGreaterThanOrEqual(28)
  })

  it('leads with the comedy of timing, not longevity', () => {
    // Otherwise this is artist-longevity with extra steps.
    const hj = findings.find((f) => f.artists[0] === 'howard-jones')
    expect(hj).toBeDefined()
    expect(hj!.dataPoints.eraCount).toBe(6)
    expect(hj!.headline).toMatch(/Shows, 6 Records|6 Album Eras/)
  })

  it('returns nothing without era data', () => {
    expect(detectDiscographyCrossref(concerts, undefined)).toEqual([])
  })

  it('is NOT registered in the dispatcher yet (#267 §5d)', () => {
    // Deliberately withheld: its supply concentrates on the four artists that
    // already hold 13 of 55 published posts. Enabling is a one-line change.
    const { findings: dispatched } = analyze(concerts, TODAY, { eras, artistsMetadata })
    expect(dispatched.some((f) => f.detector === 'discography-crossref')).toBe(false)
  })
})

describe('graceful degradation', () => {
  const withEras = analyze(concerts, TODAY, { eras, artistsMetadata })
  const without = analyze(concerts, TODAY, { artistsMetadata })

  it('leaves every detector that does not consume era data untouched', () => {
    // The load-bearing invariant: adding album-eras.json must not perturb the
    // 15 detectors that predate it.
    const untouched = (r: typeof withEras) =>
      r.findings
        .filter((f) => f.detector !== 'album-trajectory' && f.detector !== 'album-context')
        .map((f) => f.id)
        .sort()

    expect(untouched(withEras)).toEqual(untouched(without))
  })

  it('adds only trajectory findings and same-artist album-context', () => {
    const added = withEras.findings.length - without.findings.length
    const trajectory = withEras.findings.filter((f) => f.detector === 'album-trajectory').length
    const sameArtist = withEras.findings.filter(
      (f) => f.detector === 'album-context' && (f.dataPoints as Record<string, unknown>).isSameArtist
    ).length

    expect(trajectory).toBe(10) // see the count note in the first describe
    expect(added).toBe(trajectory + sameArtist)
  })

  it('keeps every pre-existing cross-artist album-context finding', () => {
    // Era data must only ADD to album-context, never displace what the
    // landmark list already produced.
    const cross = (r: typeof withEras) =>
      r.findings
        .filter((f) => f.detector === 'album-context' && !(f.dataPoints as Record<string, unknown>).isSameArtist)
        .map((f) => f.id)
        .sort()

    expect(cross(withEras)).toEqual(cross(without))
  })
})

describe('album-context repair (#272)', () => {
  const findings = analyze(concerts, TODAY, { eras, artistsMetadata }).findings.filter(
    (f) => f.detector === 'album-context'
  )

  it('gains same-artist supply the landmark list never produced', () => {
    // The 31 hand-curated landmarks yield ZERO same-artist findings — the
    // preference branch had never fired. These come from the discography join.
    const same = findings.filter((f) => (f.dataPoints as Record<string, unknown>).isSameArtist)
    expect(same.length).toBeGreaterThanOrEqual(10)
  })

  it('drops the weakest cross-artist coincidences', () => {
    // 17 cross-artist findings at the old 42-day bar; 11 at 21 days.
    const cross = findings.filter((f) => !(f.dataPoints as Record<string, unknown>).isSameArtist)
    expect(cross.length).toBeLessThan(17)
  })

  it('nets out ahead of where it started', () => {
    // The repair must not leave the detector poorer than it found it.
    expect(findings.length).toBeGreaterThan(17)
  })

  it('never publishes a cross-artist finding beyond the tightened window', () => {
    for (const f of findings) {
      const dp = f.dataPoints as Record<string, unknown>
      if (!dp.isSameArtist) expect(dp.daysApart as number).toBeLessThanOrEqual(21)
    }
  })
})
