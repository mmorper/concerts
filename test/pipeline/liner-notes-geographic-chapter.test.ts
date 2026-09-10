/**
 * geographic-chapter — a run is a stretch, not a life chapter.
 *
 * Published as "My West Coast Chapter: 26 Concerts Over 11 Years", and its social
 * copy told strangers "It started with Oingo Boingo… and I never left California
 * once" — in an archive that starts in 1984, holds 50 shows in a row around D.C.
 * a decade later, and has 70-odd California shows after the run "closed it out".
 * Two causes the detector owns:
 *
 *  - STATE_REGION files D.C. and Maryland under "Northeast" and Virginia under
 *    "South", so the archive's longest run in one place fell apart and never
 *    surfaced, while a West Coast run bounded by one Phoenix night did.
 *  - The finding carried nothing about where the run sits in the archive, so
 *    neither prompt could tell a stretch from an origin.
 */

import { describe, it, expect } from 'vitest'
import { analyze, placeOf } from '../../scripts/liner-notes/analyze'
import { detectorFacts } from '../../scripts/liner-notes/generate'
import type { Concert } from '../../src/types/concert'

const TODAY = new Date('2026-09-10T00:00:00Z')

function concert(date: string, headliner: string, state: string, city: string): Concert {
  const [y, m, d] = date.split('-').map(Number)
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    id: `c-${date}`,
    date,
    year: y,
    month: m,
    day: d,
    dayOfWeek: 'Monday',
    decade: `${Math.floor(y / 10) * 10}s`,
    headliner,
    headlinerNormalized: slug(headliner),
    openers: [],
    genre: 'Rock',
    genreNormalized: 'rock',
    venue: `${headliner} Hall`,
    venueNormalized: slug(`${headliner} Hall`),
    city,
    state,
    cityState: `${city}, ${state}`,
    reference: '',
    location: '',
  } as unknown as Concert
}

// California, one Arizona night, California, a D.C.-area run that crosses three
// states, then California again — the real archive's shape, in miniature.
const archive: Concert[] = [
  concert('1984-04-27', 'Adam Ant', 'California', 'Irvine'),
  concert('1985-03-31', 'Depeche Mode', 'California', 'Irvine'),
  concert('1988-10-15', 'Beach Boys', 'Arizona', 'Phoenix'),
  concert('1989-07-05', 'Howard Jones', 'California', 'Los Angeles'),
  concert('1990-03-10', 'Tone Loc', 'California', 'Long Beach'),
  concert('1999-04-02', 'Alien Fashion Show', 'California', 'Redondo Beach'),
  concert('2009-11-10', 'Rob Thomas', 'Virginia', 'Fairfax'),
  concert('2010-02-22', 'Social Distortion', 'District of Columbia', 'Washington'),
  concert('2011-05-06', 'Squeeze', 'Maryland', 'Baltimore'),
  concert('2018-04-27', 'Beck', 'District of Columbia', 'Washington'),
  concert('2018-05-12', 'The Human League', 'California', 'Huntington Beach'),
]

const chapters = () =>
  analyze(archive, TODAY).findings.filter((f) => f.detector === 'geographic-chapter')

describe('placeOf', () => {
  it('treats D.C., Maryland and Virginia as one place', () => {
    expect(placeOf('District of Columbia')).toBe('D.C. area')
    expect(placeOf('Maryland')).toBe('D.C. area')
    expect(placeOf('Virginia')).toBe('D.C. area')
  })

  it('leaves every other state on its region', () => {
    expect(placeOf('California')).toBe('West Coast')
    expect(placeOf('Arizona')).toBe('Mountain West')
    expect(placeOf('Massachusetts')).toBe('Northeast')
  })
})

describe('geographic-chapter', () => {
  it('finds a D.C.-area run that crosses three states', () => {
    const dc = chapters().find((f) => f.dataPoints.region === 'D.C. area')
    expect(dc?.id).toBe('geographic-d-c-area-2009')
    expect(dc?.dataPoints.showCount).toBe(4)
    expect(dc?.headline).toBe('4 Shows in a Row in the D.C. Area, 2009–2018')
  })

  it('never calls a run a chapter', () => {
    const found = chapters()
    expect(found.length).toBeGreaterThan(0)
    for (const f of found) expect(f.headline).not.toMatch(/chapter/i)
  })

  it('says where the run sits in the archive', () => {
    const west = chapters().find((f) => f.id === 'geographic-west-coast-1989')
    // Two California shows before it and one after: a stretch, not an origin or an end.
    expect(west?.dataPoints).toMatchObject({
      showCount: 3,
      earlierInRegion: 2,
      laterInRegion: 1,
      archiveShowCount: archive.length,
      archiveFirstShow: { date: '1984-04-27' },
      showBefore: { date: '1988-10-15', place: 'Mountain West' },
      showAfter: { date: '2009-11-10', place: 'D.C. area' },
    })
  })

  it('gives both prompts the same facts, and they place the run inside the archive', () => {
    const west = chapters().find((f) => f.id === 'geographic-west-coast-1989')!
    const facts = detectorFacts(west).join(' ')
    expect(facts).toContain('The archive begins on 1984-04-27')
    expect(facts).toContain('2 shows in "West Coast" came before this run, and 1 came after it.')
    expect(facts).toContain('Beach Boys in Phoenix, Arizona on 1988-10-15')
    expect(detectorFacts({ detector: 'rare-sighting', dataPoints: {} })).toEqual([])
  })
})
