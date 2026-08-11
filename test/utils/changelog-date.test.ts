/**
 * Release date rendering on /whats-playing.
 *
 * Every release date on that page was a day early from the day it shipped —
 * v6.0.0 rendered "August 9" for a 2026-08-10 release, v5.0.0 "June 19" for
 * 2026-06-20. `new Date('2026-08-10')` is UTC midnight, and formatting it in
 * any timezone behind UTC lands on the previous day.
 *
 * The tests below pin the timezone rather than trusting the runner's, because
 * the bug is invisible in UTC and in every zone east of Greenwich: a suite that
 * happened to run in London would have gone green on the broken code.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { formatReleaseDate } from '../../src/components/changelog/constants'

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
})

describe('formatReleaseDate', () => {
  it('renders the day that was written down, west of Greenwich', () => {
    // Where the bug lived. Pacific is UTC-7, so a UTC-midnight timestamp
    // formatted locally is the previous afternoon.
    process.env.TZ = 'America/Los_Angeles'
    expect(formatReleaseDate('2026-08-10')).toBe('August 10, 2026')
  })

  it('renders the same day east of Greenwich', () => {
    // The zone that would have hidden it — this passed on the broken code too.
    process.env.TZ = 'Australia/Sydney'
    expect(formatReleaseDate('2026-08-10')).toBe('August 10, 2026')
  })

  it('renders the same day in UTC', () => {
    process.env.TZ = 'UTC'
    expect(formatReleaseDate('2026-08-10')).toBe('August 10, 2026')
  })

  it('holds across a month boundary', () => {
    // The 1st is where an off-by-one is most visible: it reads as last month.
    process.env.TZ = 'America/Los_Angeles'
    expect(formatReleaseDate('2026-09-01')).toBe('September 1, 2026')
  })

  it('holds across a year boundary', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(formatReleaseDate('2027-01-01')).toBe('January 1, 2027')
  })

  it('agrees with every date the shipped changelog carries', () => {
    // Guards the real file rather than a fixture: a release entry whose date
    // renders as a different day is the defect, whatever the value.
    process.env.TZ = 'America/Los_Angeles'
    const releases = require('../../src/data/changelog.json').releases as Array<{
      version: string
      date: string
    }>

    const wrong = releases
      .map((r) => {
        const [y, m, d] = r.date.split('-').map(Number)
        const rendered = formatReleaseDate(r.date)
        const expected = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        })
        return rendered === expected ? null : `${r.version}: ${r.date} -> ${rendered}`
      })
      .filter(Boolean)

    expect(wrong).toEqual([])
  })
})
