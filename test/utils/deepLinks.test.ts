/**
 * Deep-link contract tests.
 *
 * These assert the SPA's builders against test/fixtures/deep-link-urls.json —
 * the shared fixture every URL-emitting surface checks itself against. If this
 * file and docs/DEEP_LINKING.md ever disagree, one of them is a bug.
 */

import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/deep-link-urls.json'
import {
  artistDeepLink,
  venueDeepLink,
  venueMapDeepLink,
  timelineYearDeepLink,
  setlistDeepLink,
  isValidShowDate,
  resolveShow,
  absoluteUrl,
} from '../../src/utils/deepLinks'

describe('deep-link builders match the shared fixture', () => {
  it('builds artist links', () => {
    expect(artistDeepLink(fixture.artist.input.slug)).toBe(fixture.artist.url)
  })

  it('builds venue links', () => {
    expect(venueDeepLink(fixture.venue.input.slug)).toBe(fixture.venue.url)
  })

  it('builds venue-on-map links', () => {
    expect(venueMapDeepLink(fixture.venueOnMap.input.slug)).toBe(
      fixture.venueOnMap.url
    )
  })

  it('builds timeline year links', () => {
    expect(timelineYearDeepLink(fixture.timelineYear.input.year)).toBe(
      fixture.timelineYear.url
    )
  })

  it('builds setlist links', () => {
    expect(
      setlistDeepLink(fixture.setlist.input.slug, fixture.setlist.input.date)
    ).toBe(fixture.setlist.url)
  })

  it('builds setlist links for the earliest show in the archive', () => {
    expect(
      setlistDeepLink(
        fixture.setlistEarliest.input.slug,
        fixture.setlistEarliest.input.date
      )
    ).toBe(fixture.setlistEarliest.url)
  })

  it('keeps setlist links additive — the artist link is a strict prefix', () => {
    const artist = artistDeepLink(fixture.setlist.input.slug)
    expect(fixture.setlist.url.startsWith(artist)).toBe(true)
  })

  it('never emits an id-keyed show param', () => {
    expect(fixture.setlist.url).not.toMatch(/show=concert-/)
  })
})

describe('isValidShowDate', () => {
  it('accepts real ISO dates', () => {
    expect(isValidShowDate('2026-07-31')).toBe(true)
    expect(isValidShowDate('1984-04-27')).toBe(true)
  })

  it('rejects every malformed value in the fixture', () => {
    for (const bad of fixture.invalidShowValues) {
      expect(isValidShowDate(bad), `expected "${bad}" to be rejected`).toBe(
        false
      )
    }
  })

  it('rejects null and undefined', () => {
    expect(isValidShowDate(null)).toBe(false)
    expect(isValidShowDate(undefined)).toBe(false)
  })

  it('rejects rollover dates rather than silently shifting them', () => {
    // Without the round-trip check, new Date('2026-02-30') becomes March 2
    // and would resolve to the wrong night.
    expect(isValidShowDate('2026-02-30')).toBe(false)
    expect(isValidShowDate('2026-13-01')).toBe(false)
  })
})

describe('resolveShow', () => {
  const concerts = [
    { date: '2026-07-31', headlinerNormalized: 'nile-rodgers' },
    { date: '1984-04-27', headlinerNormalized: 'adam-ant' },
  ]

  it('resolves a date to its concert', () => {
    expect(resolveShow(concerts, '2026-07-31')?.headlinerNormalized).toBe(
      'nile-rodgers'
    )
  })

  it('prefers the artist match when two shows share a date', () => {
    const sameDay = [
      { date: '2026-07-31', headlinerNormalized: 'early-set' },
      { date: '2026-07-31', headlinerNormalized: 'nile-rodgers' },
    ]
    expect(
      resolveShow(sameDay, '2026-07-31', 'nile-rodgers')?.headlinerNormalized
    ).toBe('nile-rodgers')
  })

  it('falls back to first-match when the artist does not match', () => {
    // Degrades to something useful rather than erroring.
    expect(
      resolveShow(concerts, '2026-07-31', 'someone-else')?.headlinerNormalized
    ).toBe('nile-rodgers')
  })

  it('returns null for unknown dates', () => {
    expect(resolveShow(concerts, '1999-01-01')).toBeNull()
  })

  it('returns null for malformed dates instead of throwing', () => {
    for (const bad of fixture.invalidShowValues) {
      expect(resolveShow(concerts, bad)).toBeNull()
    }
  })
})

describe('absoluteUrl', () => {
  it('prefixes an explicit origin', () => {
    expect(
      absoluteUrl(fixture.setlist.url, 'https://concerts.morperhaus.org')
    ).toBe(`https://concerts.morperhaus.org${fixture.setlist.url}`)
  })
})
