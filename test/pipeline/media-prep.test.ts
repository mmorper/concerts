/**
 * Tests for `media:prep` (#378).
 *
 * These exist because of a specific, repeated failure in this work: a command reports
 * success while doing nothing. An export hung twenty minutes on an interactive prompt with
 * no error. A `--only-photos` flag silently excluded every video. A broken venue lookup
 * produced a confidently wrong conclusion. None of those were visible in an exit code.
 *
 * So the discriminating parts are pure functions and every finding the project paid to
 * learn is pinned here as a test. If one of these ever flips, a rule was re-derived wrongly.
 */
import { describe, it, expect } from 'vitest'
import {
  findShow,
  folderPlan,
  lineupFor,
  showWindow,
  coarseRange,
  isValidDate,
  ShowNotFoundError,
  VENUE_FOLDER,
  type Concert,
} from '../../scripts/media/show'
import {
  concertLikelihood,
  hasScores,
  isFrameGrabEligible,
  isVertical916,
  quality,
  rankCandidates,
  haversineMeters,
  MAX_EVIDENCE,
  type Candidate,
} from '../../scripts/media/rank'
import { renderWorksheet } from '../../scripts/media/worksheet'

const SHOW: Concert = {
  date: '2024-08-20',
  headliner: 'Howard Jones',
  openers: ['ABC', 'Haircut 100'],
  venue: 'YouTube Theatre',
  city: 'Inglewood',
  state: 'California',
  location: { lat: 33.9515762, lng: -118.3367462 },
}

const CONCERTS: Concert[] = [
  SHOW,
  {
    date: '2018-04-27',
    headliner: 'Beck',
    openers: ['Torres'],
    venue: 'The Anthem',
    city: 'Washington',
    state: 'District of Columbia',
    location: { lat: 38.8800674, lng: -77.0260611 },
  },
]

const ZERO_SCORES = {
  overall: 0,
  curation: 0,
  low_light: 0,
  sharply_focused_subject: 0,
  well_framed_subject: 0,
  pleasant_lighting: 0,
  interesting_subject: 0,
  pleasant_composition: 0,
}

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    uuid: 'u1',
    original_filename: 'IMG_0001.HEIC',
    local_time: '2024-08-20T20:00:00',
    hour: 20,
    is_movie: false,
    live_photo: false,
    duration: null,
    width: 3024,
    height: 4032,
    keywords: [],
    labels: [],
    persons: [],
    place: null,
    latitude: null,
    longitude: null,
    contributors: ['Mike Morper'],
    favorite: false,
    in_cloud: false,
    is_missing: false,
    scores: { ...ZERO_SCORES, overall: 0.4, curation: 0.5 },
    ...over,
  }
}

const CTX = { venue: SHOW.venue, city: SHOW.city, lat: SHOW.location!.lat, lng: SHOW.location!.lng }

describe('resolving a date to a show', () => {
  it('accepts a real date', () => {
    expect(findShow(CONCERTS, '2024-08-20').headliner).toBe('Howard Jones')
  })

  it('fails loudly on a date the archive does not know, and names nearby shows', () => {
    // A date folder IS the concert, so an unknown date can never be a guess.
    expect(() => findShow(CONCERTS, '2024-08-21')).toThrow(ShowNotFoundError)
    try {
      findShow(CONCERTS, '2024-08-21')
    } catch (err) {
      expect((err as Error).message).toContain('2024-08-20')
      expect((err as Error).message).toContain('Howard Jones')
    }
  })

  it('rejects a malformed date rather than coercing it', () => {
    expect(() => findShow(CONCERTS, '20-08-2024')).toThrow(ShowNotFoundError)
    expect(isValidDate('2024-02-30')).toBe(false)
    expect(isValidDate('2024-08-20')).toBe(true)
  })
})

describe('the folder plan', () => {
  it('gives the HEADLINER a folder, not an implicit default', () => {
    // 48% of shows have openers. If root-level files fell back to the headliner,
    // forgetting to file an opener's photo would silently mis-credit it.
    const acts = lineupFor(SHOW)
    expect(acts[0]).toMatchObject({ name: 'Howard Jones', slug: 'howard-jones', role: 'headliner' })
    expect(acts.map((a) => a.slug)).toEqual(['howard-jones', 'abc', 'haircut-100'])
  })

  it('always includes _venue/', () => {
    // Venue-subject posts have no working tier-2 fallback while Places is unreliable,
    // so a personal marquee shot is often the only image available at tier 1 or 2.
    expect(folderPlan(SHOW).folders).toContain(VENUE_FOLDER)
  })

  it('creates one folder per act plus the venue', () => {
    expect(folderPlan(SHOW).folders).toEqual(['howard-jones', 'abc', 'haircut-100', VENUE_FOLDER])
  })

  it('handles a solo bill', () => {
    const solo = { ...SHOW, openers: [] }
    expect(folderPlan(solo).folders).toEqual(['howard-jones', VENUE_FOLDER])
  })

  it('suffixes a slug collision rather than merging two credits into one folder', () => {
    const twins = { ...SHOW, headliner: 'The Band', openers: ['The Band!'] }
    const plan = folderPlan(twins)
    expect(plan.collisions).toEqual(['the-band'])
    expect(plan.folders).toEqual(['the-band', 'the-band-2', VENUE_FOLDER])
  })
})

describe('the show window', () => {
  it('runs 17:00 to 04:00 the next morning', () => {
    expect(showWindow('2024-08-20')).toEqual({
      from: '2024-08-20T17:00:00',
      to: '2024-08-21T04:00:00',
    })
  })

  it('widens the coarse CLI pre-filter by a day on each side', () => {
    // The authoritative test is naive-local inside the query function; the CLI range only
    // shrinks the list, so it must never be the thing that decides the window.
    const range = coarseRange('2024-08-20')
    expect(range.from.slice(0, 10)).toBe('2024-08-19')
    expect(range.to.slice(0, 10)).toBe('2024-08-22')
  })
})

describe('quality — Apple scores', () => {
  it('treats an all-zero ScoreInfo as UNSCORED, never as a genuine zero', () => {
    // osxphotos builds a zeroed ScoreInfo on KeyError, so "never scored" is
    // indistinguishable from "scored zero" — and the scale is signed, making zero
    // MID-RANGE. 10.5% of window assets are in this state.
    expect(hasScores(ZERO_SCORES)).toBe(false)
    expect(hasScores(null)).toBe(false)
    expect(quality(ZERO_SCORES)).toBeNull()
    expect(hasScores({ ...ZERO_SCORES, overall: 0.3 })).toBe(true)
  })

  it('maps the signed scale onto 0..1 instead of assuming [0,1]', () => {
    expect(quality({ ...ZERO_SCORES, overall: -1, curation: -1 })).toBe(0)
    expect(quality({ ...ZERO_SCORES, overall: 1, curation: 1 })).toBe(1)
  })

  it('ranks on `overall` and `curation` ONLY — the face-biased fields do nothing', () => {
    // Measured bias, concert stills, with-people vs without: interesting_subject +0.341,
    // well_framed_subject +0.183, while overall (+0.004) and curation (0.000) are clean.
    // 35% of concert stills contain no detected person — marquees, exteriors, stubs.
    const base = { ...ZERO_SCORES, overall: 0.4, curation: 0.5 }
    const biased = { ...base, interesting_subject: 1, well_framed_subject: 1, pleasant_composition: 1 }
    expect(quality(biased)).toBe(quality(base))
  })

  it('ignores the inert fields', () => {
    const base = { ...ZERO_SCORES, overall: 0.4, curation: 0.5 }
    // sharply_focused_subject has stdev 0.035 across 551 stills. Sharpness is Laplacian.
    expect(quality({ ...base, sharply_focused_subject: 1 })).toBe(quality(base))
  })
})

describe('concert-likelihood — is this the right subject?', () => {
  it('ranks a concert frame above a wedding frame in the same window', () => {
    // Of 66 Beck-window frames on 2018-04-27, none were of the concert.
    const show = candidate({ labels: ['Concert', 'Crowd', 'Drum Kit', 'Entertainer'], scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.9 } })
    const wedding = candidate({ labels: ['Groom', 'Bouquet', 'Bow Tie'], hour: 17, scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.01 } })
    expect(concertLikelihood(show, CTX).score).toBeGreaterThan(concertLikelihood(wedding, CTX).score)
  })

  it('does NOT penalise a daylight frame for being bright', () => {
    // The 18:00 marquee shot is the scarcest frame in the archive. Darkness is positive
    // evidence only; its absence must cost nothing.
    const dark = candidate({ labels: ['Concert'], scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.9 } })
    const bright = candidate({ labels: ['Concert'], scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.0 } })
    const noLightData = candidate({ labels: ['Concert'], scores: { ...ZERO_SCORES, overall: 0.4 } })
    expect(concertLikelihood(bright, CTX).score).toBe(concertLikelihood(noLightData, CTX).score)
    expect(concertLikelihood(dark, CTX).score).toBeGreaterThan(concertLikelihood(bright, CTX).score)
  })

  it('does NOT penalise a frame for having no GPS', () => {
    // GPS is present on 63% of the library. Penalising its absence reintroduces exactly
    // the downward bias this audit exists to avoid.
    const noGps = candidate({ labels: ['Concert'] })
    const offSite = candidate({ labels: ['Concert'], latitude: 40.0, longitude: -74.0 })
    expect(concertLikelihood(noGps, CTX).score).toBe(concertLikelihood(offSite, CTX).score)
  })

  it('weights the owner`s mh-concerts tag without filtering on it', () => {
    // 412 hand-tagged assets across 53 shows, 41 of them outside the window, one show
    // tagged 57 of 58. Strongest single signal, and incomplete — so it can never gate.
    const tagged = candidate({ keywords: ['mh-concerts'] })
    const untagged = candidate({})
    expect(concertLikelihood(tagged, CTX).score).toBeGreaterThan(concertLikelihood(untagged, CTX).score)
    // An untagged frame still scores above zero: it is ranked, not excluded.
    expect(concertLikelihood(untagged, CTX).score).toBeGreaterThan(0)
  })

  it('credits proximity to the venue coordinate', () => {
    const atVenue = candidate({ latitude: 33.9515, longitude: -118.3367 })
    const far = candidate({ latitude: 34.05, longitude: -118.24 })
    expect(concertLikelihood(atVenue, CTX).score).toBeGreaterThan(concertLikelihood(far, CTX).score)
    expect(concertLikelihood(atVenue, CTX).signals.join(' ')).toContain('venue:')
  })

  it('falls back to the CITY in a place name, not the venue name', () => {
    // Photos names SoFi Stadium for a show at the adjacent YouTube Theatre, so a
    // venue-name test would miss its own show.
    const c = candidate({ place: 'SoFi Stadium, Inglewood, California, United States' })
    expect(concertLikelihood(c, CTX).signals).toContain('venue:place')
  })

  it('never saturates every candidate at the top of the scale', () => {
    // Clamping the raw weights at 1.0 made every frame of a well-tagged show score 100,
    // and the likelihood factor stopped sorting anything at all.
    const full = candidate({
      keywords: ['mh-concerts'],
      labels: ['Concert', 'Crowd', 'Drum Kit', 'Entertainer', 'Guitar'],
      latitude: 33.9515,
      longitude: -118.3367,
      scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.9 },
    })
    const noDark = candidate({ ...full, scores: { ...ZERO_SCORES, overall: 0.4, low_light: 0.0 } })
    expect(concertLikelihood(full, CTX).score).toBe(1)
    expect(concertLikelihood(noDark, CTX).score).toBeLessThan(1)
    expect(concertLikelihood(noDark, CTX).score).toBeGreaterThan(0.7)
    expect(MAX_EVIDENCE).toBeGreaterThan(1)
  })

  it('measures distance sanely', () => {
    expect(haversineMeters({ lat: 33.9515, lng: -118.3367 }, { lat: 33.9515, lng: -118.3367 })).toBe(0)
    expect(haversineMeters({ lat: 33.9515, lng: -118.3367 }, { lat: 33.9516, lng: -118.3367 })).toBeLessThan(20)
  })
})

describe('eligibility gates', () => {
  it('gates 9:16 on capture height for landscape', () => {
    // A 9:16 crop of landscape is limited by height: usable width is h * 9/16.
    expect(isVertical916(1920, 1080)).toBe(false) // 1080p landscape -> 607x1080
    expect(isVertical916(3840, 2160)).toBe(true) // 4K landscape -> 1215x2160
    expect(isVertical916(1080, 1920)).toBe(true) // portrait, native
    expect(isVertical916(0, 0)).toBe(false)
  })

  it('gates frame-grab on the short side clearing 1350', () => {
    expect(isFrameGrabEligible(3840, 2160)).toBe(true)
    expect(isFrameGrabEligible(1920, 1080)).toBe(false)
  })

  it('marks 9:16 for video only — stills are unaffected by the orientation gate', () => {
    const { scored } = rankCandidates(
      [candidate({ is_movie: false, width: 3840, height: 2160 })],
      CTX
    )
    expect(scored[0].vertical916).toBe(false)
  })
})

describe('ranking the whole window', () => {
  it('lists everything — nothing is filtered out', () => {
    const all = [
      candidate({ uuid: 'a', original_filename: 'A.HEIC' }),
      candidate({ uuid: 'b', original_filename: 'B.HEIC', labels: ['Groom', 'Bouquet'] }),
      candidate({ uuid: 'c', original_filename: 'C.HEIC', scores: ZERO_SCORES }),
    ]
    const { scored, unscored } = rankCandidates(all, CTX)
    expect(scored.length + unscored.length).toBe(3)
  })

  it('keeps unscored assets OUT of the ranked table', () => {
    // Zero is mid-range on a signed scale, so an unscored asset left in the main sort
    // lands in the middle and reads as an average photograph.
    const all = [
      candidate({ uuid: 'good', scores: { ...ZERO_SCORES, overall: 0.9, curation: 0.9 } }),
      candidate({ uuid: 'none', scores: ZERO_SCORES }),
      candidate({ uuid: 'poor', scores: { ...ZERO_SCORES, overall: -0.9, curation: -0.9 } }),
    ]
    const { scored, unscored } = rankCandidates(all, CTX)
    expect(scored.map((r) => r.uuid)).toEqual(['good', 'poor'])
    expect(unscored.map((r) => r.uuid)).toEqual(['none'])
    expect(unscored[0].quality).toBeNull()
  })

  it('sorts by likelihood x quality, so a real-but-bad photo sinks', () => {
    // The Black Keys case: the model scored 0.84 (correct, they ARE concert photos) and
    // the owner rejected all 8 (also correct, they are BAD concert photos).
    const realButBad = candidate({
      uuid: 'bad',
      labels: ['Concert', 'Crowd'],
      scores: { ...ZERO_SCORES, overall: -0.7, curation: -0.7, low_light: 0.9 },
    })
    const goodConcert = candidate({
      uuid: 'good',
      labels: ['Concert', 'Crowd'],
      scores: { ...ZERO_SCORES, overall: 0.8, curation: 0.8, low_light: 0.9 },
    })
    const { scored } = rankCandidates([realButBad, goodConcert], CTX)
    expect(scored[0].uuid).toBe('good')
  })

  it('flags a duplicate original_filename', () => {
    // The filename column is a Photos search term and it is not unique — one show window
    // really does hold two assets called IMG_0430.jpg.
    const { scored } = rankCandidates(
      [
        candidate({ uuid: 'x', original_filename: 'IMG_0430.jpg' }),
        candidate({ uuid: 'y', original_filename: 'IMG_0430.jpg' }),
        candidate({ uuid: 'z', original_filename: 'IMG_0431.jpg' }),
      ],
      CTX
    )
    expect(scored.filter((r) => r.signals.includes('dup-name'))).toHaveLength(2)
    expect(scored.find((r) => r.uuid === 'z')!.signals).not.toContain('dup-name')
  })
})

describe('the worksheet', () => {
  const build = (candidates: Candidate[]) => {
    const { scored, unscored } = rankCandidates(candidates, CTX)
    return renderWorksheet({
      concert: SHOW,
      acts: lineupFor(SHOW),
      window: showWindow(SHOW.date),
      coarseScanned: candidates.length + 5,
      excluded: { no_date: 1, outside_window: 4 },
      scored,
      unscored,
      generatedAt: '2026-08-23',
    })
  }

  it('carries original_filename for EVERY candidate — that is the whole point', () => {
    const candidates = [
      candidate({ uuid: 'a', original_filename: 'IMG_5693.HEIC' }),
      candidate({ uuid: 'b', original_filename: 'IMG_5694.MOV', is_movie: true, duration: 12.5 }),
      candidate({ uuid: 'c', original_filename: 'IMG_5695.HEIC', scores: ZERO_SCORES }),
    ]
    const md = build(candidates)
    for (const c of candidates) expect(md).toContain(`\`${c.original_filename}\``)
  })

  it('lists every act including the headliner, and _venue/', () => {
    const md = build([candidate()])
    expect(md).toContain('`howard-jones/`')
    expect(md).toContain('`abc/`')
    expect(md).toContain('`haircut-100/`')
    expect(md).toContain(`\`${VENUE_FOLDER}/\``)
  })

  it('reports what was excluded at each stage', () => {
    const md = build([candidate()])
    expect(md).toContain('excluded: no capture date | 1')
    expect(md).toContain('outside 17:00–04:00 local | 4')
    expect(md).toContain('Nothing else was excluded.')
  })

  it('states that the window is a date filter, not a concert filter', () => {
    expect(build([candidate()])).toContain('DATE filter, not a concert filter')
  })

  it('emits one numbered row per candidate', () => {
    const candidates = Array.from({ length: 7 }, (_, i) =>
      candidate({ uuid: `u${i}`, original_filename: `IMG_${i}.HEIC` })
    )
    const rows = build(candidates).split('\n').filter((l) => /^\| \d+ \| `/.test(l))
    expect(rows).toHaveLength(7)
  })

  it('renders an empty window without pretending it found something', () => {
    const md = build([])
    expect(md).toContain('No scored candidates in this window')
    expect(md).toContain('**0**')
  })
})
