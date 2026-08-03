/**
 * Deep-link URL builders and parsers
 *
 * SINGLE SOURCE OF TRUTH for deep-link URL shape in the SPA.
 * The prose contract is docs/DEEP_LINKING.md (v1.2); the machine-readable
 * contract is test/fixtures/deep-link-urls.json, which this module is
 * asserted against.
 *
 * Other surfaces emit the same shapes independently — the MCP server
 * (workers/mcp-server/src/tools.ts), ask exhibits
 * (workers/ask-chat/src/exhibits.ts), the sitemap and facts generators.
 * They cannot import this module (workers are self-contained with their own
 * tsconfig), so they assert against the same JSON fixture instead.
 *
 * @module deepLinks
 */

export type SceneName =
  | 'timeline'
  | 'venues'
  | 'geography'
  | 'genres'
  | 'artists'
  | 'ask'

/** `/?scene=artists&artist=depeche-mode` */
export function artistDeepLink(slug: string): string {
  return `/?scene=artists&artist=${encodeURIComponent(slug)}`
}

/** `/?scene=venues&venue=irvine-meadows` */
export function venueDeepLink(slug: string): string {
  return `/?scene=venues&venue=${encodeURIComponent(slug)}`
}

/** `/?scene=geography&venue=9-30-club` — same venue, map scene */
export function venueMapDeepLink(slug: string): string {
  return `/?scene=geography&venue=${encodeURIComponent(slug)}`
}

/** `/?scene=timeline&year=2024` */
export function timelineYearDeepLink(year: number): string {
  return `/?scene=timeline&year=${year}`
}

/**
 * `/?scene=artists&artist=nile-rodgers&show=2026-07-31`
 *
 * Keyed on the concert date, which is globally unique across the archive.
 * Never `concert.id` — those values are row-order artifacts, so a data
 * re-import that renumbers rows would break every link ever shared.
 *
 * `artist` stays in the URL even though `date` alone resolves: it reuses the
 * existing artist-focus path unchanged and keeps the link readable to a human.
 */
export function setlistDeepLink(artistSlug: string, date: string): string {
  return `${artistDeepLink(artistSlug)}&show=${encodeURIComponent(date)}`
}

/** Absolute form, for anything that leaves the app (share sheets, clipboard). */
export function absoluteUrl(path: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${path}`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate a `show` param value.
 *
 * Rejects anything that is not a real calendar date in `YYYY-MM-DD` form.
 * The round-trip check catches JS Date rollover, so `2026-02-30` (which
 * would otherwise silently become March 2) is rejected rather than resolving
 * to the wrong night.
 */
export function isValidShowDate(value: string | null | undefined): boolean {
  if (!value || !ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  // Round-trip: rollover dates won't match the input they came from.
  const roundTrip = [
    parsed.getFullYear().toString().padStart(4, '0'),
    (parsed.getMonth() + 1).toString().padStart(2, '0'),
    parsed.getDate().toString().padStart(2, '0'),
  ].join('-')
  return roundTrip === value
}

/** A concert as far as deep-link resolution is concerned. */
interface ResolvableConcert {
  date: string
  headlinerNormalized: string
}

/**
 * Resolve a `show` date to a concert.
 *
 * Matches on date **and** artist when both are present, then falls back to
 * first-match on date alone. Uniqueness of date is a property of the current
 * data (verified: 183 records, zero collisions), not an enforced invariant —
 * two shows on one date is physically possible (a festival; an early and late
 * set), so this must never assume a single result.
 *
 * Returns null when nothing matches, which callers treat as "fall back to the
 * artist gatefold" rather than as an error.
 */
export function resolveShow<T extends ResolvableConcert>(
  concerts: T[],
  date: string | null | undefined,
  artistSlug?: string | null
): T | null {
  if (!isValidShowDate(date)) return null
  const onDate = concerts.filter(c => c.date === date)
  if (onDate.length === 0) return null
  if (artistSlug) {
    const withArtist = onDate.find(c => c.headlinerNormalized === artistSlug)
    if (withArtist) return withArtist
  }
  return onDate[0]
}
