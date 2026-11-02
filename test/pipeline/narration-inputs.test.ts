import { describe, it, expect } from 'vitest'
import {
  buildArtistInputs,
  buildVenueInputs,
  type NarrationConcert,
} from '../../scripts/narrations/inputs'

const show = (date: string, headliner: string, openers: string[] = [], venue = 'The Room'): NarrationConcert => ({
  date,
  year: Number(date.slice(0, 4)),
  headliner,
  headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  openers,
  venue,
  venueNormalized: venue.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  city: 'A City',
})

const TODAY = '2026-11-02'
const artist = (concerts: NarrationConcert[], slug: string, aliases = null as never) =>
  buildArtistInputs(concerts, aliases, TODAY).find((e) => e.slug === slug)?.input as Record<string, never>

describe('artist narration inputs', () => {
  it('counts the shows an act opened, not only the ones it headlined', () => {
    const input = artist([show('2003-01-01', 'Big Act', ['The Beat']), show('2010-01-01', 'The Beat')], 'the-beat')
    expect(input).toMatchObject({ count: 2, headlined: 1, opened: 1, firstYear: 2003, lastYear: 2010 })
  })

  it('names the role and the headliner on every show, so nothing has to be guessed', () => {
    const input = artist([show('2003-01-01', 'Big Act', ['The Beat']), show('2010-01-01', 'The Beat')], 'the-beat')
    expect(input.shows[0]).toMatchObject({ date: '2003-01-01', role: 'opener', headliner: 'Big Act' })
    expect(input.shows[1]).toMatchObject({ date: '2010-01-01', role: 'headliner' })
  })

  it('keeps shows in date order whatever order the file holds them', () => {
    const input = artist([show('2010-01-01', 'Act'), show('2003-01-01', 'Act')], 'act')
    expect((input.shows as unknown as Array<{ date: string }>).map((s) => s.date)).toEqual(['2003-01-01', '2010-01-01'])
  })

  it('merges an act\'s billings', () => {
    const aliases = { sameAct: [{ billings: ['solo-name', 'solo-name-band'] }] } as never
    const input = artist([show('2000-01-01', 'Solo Name'), show('2001-01-01', 'Solo Name Band')], 'solo-name', aliases)
    expect(input.count).toBe(2)
  })

  it('never counts an upcoming show as seen', () => {
    const input = artist([show('2020-01-01', 'Act'), show('2027-03-10', 'Act')], 'act')
    expect(input).toMatchObject({ count: 1, lastYear: 2020 })
    expect(input.upcoming).toHaveLength(1)
  })

  it('counts a show on today as upcoming until tomorrow', () => {
    expect(artist([show(TODAY, 'Act')], 'act').count).toBe(0)
  })

  it('handles an act with only an upcoming show', () => {
    expect(artist([show('2027-03-10', 'New Act')], 'new-act')).toMatchObject({ count: 0, firstYear: null, topVenue: null })
  })

  it('changes the input once a show has passed, so the narration regenerates', () => {
    const concerts = [show('2026-11-11', 'Act')]
    const before = buildArtistInputs(concerts, null, '2026-11-02')[0].input
    const after = buildArtistInputs(concerts, null, '2026-11-12')[0].input
    expect(after).not.toEqual(before)
  })

  it('only writes narrations for acts that have headlined', () => {
    const slugs = buildArtistInputs([show('2003-01-01', 'Big Act', ['Opener'])], null, TODAY).map((e) => e.slug)
    expect(slugs).toEqual(['big-act'])
  })
})

describe('venue narration inputs', () => {
  const meta = { 'the-room': { name: 'The Room', cityState: 'A City, CA' } }

  it('lists each bill, so one night with six acts is not "one band"', () => {
    const [{ input }] = buildVenueInputs(meta, [show('1987-06-30', 'Big Act', ['One', 'Two'])], TODAY)
    expect(input).toMatchObject({ totalConcerts: 1, uniqueHeadliners: 1, uniqueArtists: 3 })
    expect((input.shows as Array<{ openers: string[] }>)[0].openers).toEqual(['One', 'Two'])
  })

  it('keeps upcoming shows out of the counts', () => {
    const [{ input }] = buildVenueInputs(meta, [show('2020-01-01', 'Act'), show('2027-03-10', 'Next')], TODAY)
    expect(input).toMatchObject({ totalConcerts: 1, topHeadliners: ['Act'] })
    expect(input.upcoming).toHaveLength(1)
  })

  it('handles a venue with no shows yet', () => {
    const [{ input }] = buildVenueInputs(meta, [], TODAY)
    expect(input).toMatchObject({ totalConcerts: 0, topHeadliners: [] })
  })
})
