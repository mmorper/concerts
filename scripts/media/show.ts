/**
 * Resolve a date to the one concert it names, and to the folders that concert needs.
 *
 * All 184 concert dates are unique, so a date maps to exactly one show and the inbox can
 * use the date as its primary key. A date NOT in concerts.json is an error rather than a
 * guess — scaffolding folders for a show the archive does not know about would invite
 * media that ingest can never place.
 *
 * @module scripts/media/show
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { normalizeArtistName } from '../../src/utils/normalize'

export interface Concert {
  date: string
  headliner: string
  openers: string[]
  venue: string
  city: string
  state: string
  location?: { lat: number; lng: number }
}

export interface Act {
  name: string
  slug: string
  /** The headliner is a folder like any other — see `lineupFor`. */
  role: 'headliner' | 'opener'
}

/** The frames that belong to the night rather than to any performer. */
export const VENUE_FOLDER = '_venue'

/** Photos stores naive local time, so a show anywhere falls in the same local window. */
export const WINDOW_START_HOUR = 17
export const WINDOW_HOURS = 11

export class ShowNotFoundError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false
  // Parsed as UTC on purpose: a local parse round-trips through toISOString() and would
  // reject valid dates for anyone east of Greenwich.
  const d = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date
}

export function loadConcerts(file = resolve('public/data/concerts.json')): Concert[] {
  const raw = JSON.parse(readFileSync(file, 'utf-8'))
  const concerts = Array.isArray(raw) ? raw : raw.concerts
  if (!Array.isArray(concerts) || concerts.length === 0) {
    throw new Error(`No concerts found in ${file} — the archive cannot be read.`)
  }
  return concerts as Concert[]
}

/**
 * The night's full bill, headliner first.
 *
 * Every act gets an entry INCLUDING the headliner. There is no implicit default: if
 * root-level files fell back to the headliner, forgetting to file an opener's photo would
 * silently mis-credit it, and 89 of 184 shows (48%) have openers — 187 credits in total.
 * With a folder required per act, a stray root file is an error ingest can flag rather
 * than a wrong answer it produces.
 */
export function lineupFor(concert: Concert): Act[] {
  const acts: Act[] = [{ name: concert.headliner, slug: normalizeArtistName(concert.headliner), role: 'headliner' }]
  for (const opener of concert.openers ?? []) {
    acts.push({ name: opener, slug: normalizeArtistName(opener), role: 'opener' })
  }
  return acts
}

/**
 * Folder names for the show, in creation order.
 *
 * Two acts on one bill could in principle normalise to the same slug (none do today).
 * Deduplicating silently would lose a credit, so the collision is surfaced by suffixing
 * and reported — ingest then matches forgivingly against this same lineup.
 */
export function folderPlan(concert: Concert): { acts: Act[]; folders: string[]; collisions: string[] } {
  const acts = lineupFor(concert)
  const seen = new Map<string, number>()
  const collisions: string[] = []
  const folders: string[] = []
  for (const act of acts) {
    const n = (seen.get(act.slug) ?? 0) + 1
    seen.set(act.slug, n)
    if (n > 1) {
      collisions.push(act.slug)
      act.slug = `${act.slug}-${n}`
    }
    folders.push(act.slug)
  }
  folders.push(VENUE_FOLDER)
  return { acts, folders, collisions }
}

export function findShow(concerts: Concert[], date: string): Concert {
  if (!isValidDate(date)) {
    throw new ShowNotFoundError(`"${date}" is not a YYYY-MM-DD date.`)
  }
  const match = concerts.find((c) => c.date === date)
  if (!match) {
    const near = concerts
      .map((c) => ({ c, gap: Math.abs(Date.parse(`${c.date}T00:00:00`) - Date.parse(`${date}T00:00:00`)) }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3)
      .map(({ c }) => `  ${c.date}  ${c.headliner} @ ${c.venue}`)
    throw new ShowNotFoundError(
      `No concert on ${date} in public/data/concerts.json.\n\n` +
        `A date folder IS the concert, so an unknown date cannot be scaffolded.\n` +
        `Add the show to the archive first, or check the date. Nearest shows:\n${near.join('\n')}`
    )
  }
  return match
}

/** 17:00 on the show date through 04:00 the next morning, as naive local timestamps. */
export function showWindow(date: string): { from: string; to: string } {
  const start = new Date(`${date}T00:00:00`)
  start.setHours(WINDOW_START_HOUR, 0, 0, 0)
  const end = new Date(start.getTime() + WINDOW_HOURS * 3600 * 1000)
  const stamp = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` +
    `T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
  return { from: stamp(start), to: stamp(end) }
}

/**
 * A deliberately wide range for the osxphotos CLI pre-filter.
 *
 * The authoritative window test runs in Python against naive local time, exactly as every
 * probe did. The CLI filter only exists to shrink the list handed to that function, so it
 * is widened by a day on each side rather than trusted to agree about timezones.
 */
export function coarseRange(date: string): { from: string; to: string } {
  const day = 86400_000
  const base = Date.parse(`${date}T00:00:00Z`)
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  return { from: `${iso(base - day)}T00:00:00`, to: `${iso(base + 2 * day)}T00:00:00` }
}
