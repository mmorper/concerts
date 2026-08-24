/**
 * Two-factor ranking for concert-window candidates.
 *
 * The window is a DATE filter, not a concert filter: 17:00->04:00 catches the whole
 * evening. Of 66 Beck-window frames (2018-04-27) none were of the concert — they were a
 * wedding. So a candidate needs two separate questions answered, and conflating them
 * produces confident nonsense:
 *
 *   concert-likelihood — is this the right SUBJECT?      (labels, low_light, place, hour, tag)
 *   quality            — is it worth PUBLISHING?          (Apple `overall` + `curation`)
 *
 * The Black Keys proved they are independent: the model scored 0.84 (correct — they ARE
 * concert photos) and the owner rejected all 8 (also correct — they are BAD concert
 * photos). One number cannot carry both.
 *
 * SCORE, NEVER FILTER. Every signal here ranks. A hard cut would drop the 18:00 daylight
 * marquee shot, which is the scarcest frame in the archive: venue-subject posts have no
 * working tier-2 fallback while Places is unreliable (#315).
 *
 * @module scripts/media/rank
 */

/** One asset as the Photos query saw it. Mirrors the payload from `query_window.py`. */
export interface Candidate {
  uuid: string
  original_filename: string
  /** Naive local time, "YYYY-MM-DDTHH:MM:SS" — the window is defined in local time. */
  local_time: string
  hour: number
  is_movie: boolean
  live_photo: boolean
  duration: number | null
  width: number
  height: number
  keywords: string[]
  labels: string[]
  persons: string[]
  place: string | null
  latitude: number | null
  longitude: number | null
  contributors: string[]
  /**
   * Filename of the preview staged by the query function, when one was requested.
   * The copy happens inside the osxphotos process because Full Disk Access is scoped to
   * that binary — node reading a path inside the library gets EPERM.
   */
  preview_file: string | null
  favorite: boolean
  in_cloud: boolean
  is_missing: boolean
  /** All 27 fields zeroed means Photos never scored it — see `hasScores`. */
  scores: Record<string, number> | null
}

export interface Ranked extends Candidate {
  likelihood: number
  /** null when Photos never computed a score. Such assets are listed, never ranked. */
  quality: number | null
  signals: string[]
  orientation: 'portrait' | 'landscape' | 'square'
  vertical916: boolean
  frameGrab: boolean
  mhTagged: boolean
}

export interface ShowContext {
  venue: string
  city: string
  lat?: number
  lng?: number
}

/**
 * Photos ML labels that say "this is a show".
 *
 * Measured coverage ~78% of the library, and the strongest computed signal available.
 * Compare a real show to the wedding that shared its window:
 *   19:12  Concert, Drum Kit, Entertainer, Guitar   (Howard Jones)
 *   17:05  Ceremony, Groom, Foliage                 (a wedding, in the Beck window)
 */
export const CONCERT_LABELS = new Set(
  [
    'concert', 'stage', 'crowd', 'audience', 'entertainer', 'music', 'musician',
    'musical instrument', 'guitar', 'bass guitar', 'drum', 'drum kit', 'keyboard',
    'piano', 'microphone', 'performance', 'auditorium', 'music speakers', 'singer',
    'light', 'lighting', 'nightclub', 'disco',
  ].map((l) => l.toLowerCase())
)

/**
 * Labels that say "this evening was something else".
 *
 * Negative evidence, and it only ever ranks a frame DOWN the list — nothing here removes
 * a candidate from the worksheet. The wedding carried no GPS and the right contributor,
 * so labels and darkness were the only signals that caught it.
 */
export const NON_CONCERT_LABELS = new Set(
  [
    'groom', 'bride', 'wedding', 'ceremony', 'bouquet', 'flower arrangement', 'bow tie',
    'formal wear', 'necktie', 'suit', 'cake', 'restaurant', 'food', 'meal', 'dish',
    'document', 'text', 'screenshot', 'receipt', 'menu',
  ].map((l) => l.toLowerCase())
)

/** The owner's own hand-applied tag. A signal, never a filter — see `concertLikelihood`. */
export const OWNER_KEYWORD = 'mh-concerts'

/**
 * Weights, stated rather than tuned.
 *
 * Every term is POSITIVE EVIDENCE ONLY apart from `nonConcertLabels`. Absence never
 * subtracts: GPS is present on 63% of the library and named place on 60%, so penalising
 * its absence would bias the ranking downward exactly the way this audit exists to avoid.
 */
export const WEIGHTS = {
  /** 412 assets hand-tagged across 53 shows. Strongest single signal — and incomplete
   *  (41 tagged assets fall outside the window, one show has 57 of 58 tagged), which is
   *  precisely why it is weighted rather than filtered on. */
  ownerTag: 0.35,
  /** Any concert label at all. */
  concertLabel: 0.25,
  /** Each additional concert label, capped — five of them is not twice as certain as two. */
  extraConcertLabel: 0.05,
  extraConcertLabelCap: 0.15,
  /** Clean split measured across 769 window assets: 0.00-0.02 daylight, 0.64-1.00 at a show. */
  darkness: 0.2,
  /** The only signal that answers "was this AT the venue". */
  atVenue: 0.2,
  /** Doors-to-encore. Deliberately small: the marquee shot is taken before this. */
  peakHour: 0.1,
  nonConcertLabels: -0.3,
} as const

/**
 * The most evidence any one asset can carry.
 *
 * The raw weights sum past 1.0, so clamping there SATURATES: on a well-tagged show every
 * candidate came back at 100 and the likelihood factor stopped sorting anything at all.
 * Normalising by the reachable maximum keeps the full range in use, so "tagged, at the
 * venue, dark, at showtime, many labels" reads as 100 while "the same minus darkness"
 * reads as 84 — which is the distinction the daylight marquee shot depends on.
 */
export const MAX_EVIDENCE =
  WEIGHTS.ownerTag +
  WEIGHTS.concertLabel +
  WEIGHTS.extraConcertLabelCap +
  WEIGHTS.darkness +
  WEIGHTS.atVenue +
  WEIGHTS.peakHour

/** low_light above this reads as a dark room rather than daylight. */
export const DARK_THRESHOLD = 0.5

/** Radius around the venue coordinate, in metres. */
export const VENUE_RADIUS_M = 1500

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * True when Photos actually scored this asset.
 *
 * On a KeyError osxphotos builds a ScoreInfo with every field zeroed, so "never scored" is
 * indistinguishable from "scored zero" — and the scale is SIGNED (~-1..+1), which makes
 * zero MID-RANGE. 10.5% of window assets are in this state. Left in the ranking they sort
 * silently into the middle and look like average photographs.
 */
export function hasScores(scores: Record<string, number> | null): boolean {
  if (!scores) return false
  return Object.values(scores).some((v) => typeof v === 'number' && v !== 0)
}

/** Signed ~-1..+1 to 0..1. Any UI that assumes [0,1] renders negatives as nothing. */
const toUnit = (signed: number) => Math.min(1, Math.max(0, (signed + 1) / 2))

/**
 * Quality — worth publishing?
 *
 * `overall` and `curation` ONLY. Measured face bias on concert stills (median, with people
 * vs without): `overall` +0.004 and `curation` 0.000 are clean, while
 * `interesting_subject` is +0.341 and `well_framed_subject` +0.183. 35% of concert stills
 * contain no detected person — marquees, exteriors, ticket stubs — so ranking on the
 * biased fields buries a third of the corpus on subject matter rather than quality, and it
 * hits hardest where the archive is most exposed.
 *
 * `sharply_focused_subject` is inert (stdev 0.035 across 551 stills) and `promotion` is
 * entirely flat; neither is used. Sharpness, where it is needed, is computed locally by
 * Laplacian variance.
 */
export function quality(scores: Record<string, number> | null): number | null {
  if (!hasScores(scores)) return null
  const overall = toUnit(scores!.overall ?? 0)
  const curation = toUnit(scores!.curation ?? 0)
  return Number((overall * 0.7 + curation * 0.3).toFixed(4))
}

/** Concert-likelihood — the right subject? Returns the score and the evidence behind it. */
export function concertLikelihood(
  c: Candidate,
  show: ShowContext
): { score: number; signals: string[] } {
  const signals: string[] = []
  let score = 0

  const keywords = c.keywords.map((k) => k.toLowerCase())
  if (keywords.includes(OWNER_KEYWORD)) {
    score += WEIGHTS.ownerTag
    signals.push('tagged')
  }

  const labels = c.labels.map((l) => l.toLowerCase())
  const concertHits = labels.filter((l) => CONCERT_LABELS.has(l))
  if (concertHits.length > 0) {
    score += WEIGHTS.concertLabel
    score += Math.min(
      WEIGHTS.extraConcertLabelCap,
      (concertHits.length - 1) * WEIGHTS.extraConcertLabel
    )
    signals.push(`labels:${concertHits.length}`)
  }
  const nonConcertHits = labels.filter((l) => NON_CONCERT_LABELS.has(l))
  if (nonConcertHits.length > 0 && concertHits.length === 0) {
    score += WEIGHTS.nonConcertLabels
    signals.push(`not-a-show:${nonConcertHits.slice(0, 2).join('/')}`)
  }

  // Darkness is positive evidence only. A low value means daylight, which is exactly what
  // the 18:00 marquee shot looks like, so it must not be penalised.
  const lowLight = c.scores?.low_light
  if (typeof lowLight === 'number' && lowLight > DARK_THRESHOLD) {
    score += WEIGHTS.darkness
    signals.push('dark')
  }

  if (c.latitude != null && c.longitude != null && show.lat != null && show.lng != null) {
    const metres = haversineMeters(
      { lat: c.latitude, lng: c.longitude },
      { lat: show.lat, lng: show.lng }
    )
    if (metres <= VENUE_RADIUS_M) {
      score += WEIGHTS.atVenue
      signals.push(`venue:${Math.round(metres)}m`)
    }
  } else if (c.place && show.city && c.place.toLowerCase().includes(show.city.toLowerCase())) {
    // A reverse-geocoded place name is more robust than a radius when it exists, and it is
    // matched on CITY rather than venue: the Howard Jones show is at YouTube Theatre but
    // Photos names the adjacent SoFi Stadium, so a venue-name test would miss its own show.
    score += WEIGHTS.atVenue
    signals.push('venue:place')
  }

  if (c.hour >= 19 || c.hour < 2) {
    score += WEIGHTS.peakHour
    signals.push('showtime')
  }

  const normalised = Math.min(1, Math.max(0, score / MAX_EVIDENCE))
  return { score: Number(normalised.toFixed(4)), signals }
}

export function orientationOf(width: number, height: number): Ranked['orientation'] {
  if (height > width) return 'portrait'
  if (width > height) return 'landscape'
  return 'square'
}

/**
 * 9:16 eligibility — Shorts and TikTok accept nothing else.
 *
 * A landscape crop is limited by capture HEIGHT: usable width is h * 9/16. So 1080p
 * landscape yields 607x1080 and fails, while 4K landscape yields 1215x2160 and passes.
 * Portrait capture always passes if its short side clears 1080. Stills are unaffected —
 * a 12MP phone still cropped to 4:5 clears the gate comfortably.
 */
export function isVertical916(width: number, height: number): boolean {
  if (!width || !height) return false
  return height >= width ? Math.min(width, height) >= 1080 : Math.round((height * 9) / 16) >= 1080
}

/** Frame-grab eligibility: short side >= 1350, the 4:5 card's height requirement. */
export function isFrameGrabEligible(width: number, height: number): boolean {
  if (!width || !height) return false
  return Math.min(width, height) >= 1350
}

export function rankOne(c: Candidate, show: ShowContext): Ranked {
  const { score, signals } = concertLikelihood(c, show)
  return {
    ...c,
    likelihood: score,
    quality: quality(c.scores),
    signals,
    orientation: orientationOf(c.width, c.height),
    vertical916: c.is_movie && isVertical916(c.width, c.height),
    frameGrab: isFrameGrabEligible(c.width, c.height),
    mhTagged: c.keywords.some((k) => k.toLowerCase() === OWNER_KEYWORD),
  }
}

/**
 * Rank everything, and keep the unscored visibly apart.
 *
 * Nothing is dropped. Assets Photos never scored cannot be given a combined rank without
 * inventing one, so they are listed in their own section ordered by likelihood alone
 * rather than allowed to sort into the middle of the main table on a fabricated zero.
 */
export function rankCandidates(
  candidates: Candidate[],
  show: ShowContext
): { scored: Ranked[]; unscored: Ranked[] } {
  const ranked = candidates.map((c) => rankOne(c, show))

  // `original_filename` is the column the owner pastes into the Photos search field, and
  // it is not unique — the library really does hold two assets called IMG_0430.jpg in one
  // show window. Unflagged, that search returns two hits and the wrong one gets exported.
  const counts = new Map<string, number>()
  for (const r of ranked) counts.set(r.original_filename, (counts.get(r.original_filename) ?? 0) + 1)
  for (const r of ranked) {
    if ((counts.get(r.original_filename) ?? 0) > 1) r.signals.push('dup-name')
  }

  const scored = ranked
    .filter((r) => r.quality !== null)
    .sort(
      (a, b) =>
        b.likelihood * (b.quality as number) - a.likelihood * (a.quality as number) ||
        a.local_time.localeCompare(b.local_time)
    )
  const unscored = ranked
    .filter((r) => r.quality === null)
    .sort((a, b) => b.likelihood - a.likelihood || a.local_time.localeCompare(b.local_time))
  return { scored, unscored }
}
