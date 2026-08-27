/**
 * `data/media-decisions.json` — the durable record of what the owner judged, and the only
 * part of the review that survives this Mac.
 *
 * WHY IT EXISTS. Culling is the expensive step and most of its cost is the rejections: 37
 * of the 66 decisions on 2026-06-04 were "no". Those lived only in
 * `concert-photos-audit/review/<date>/verdicts.json`, which is ignored twice over — by the
 * repo root and again by a second `.gitignore` inside that directory — so they existed on
 * one machine and nowhere else. Lose it and a later audit re-surfaces every photograph the
 * owner has already turned down, across 184 shows.
 *
 * WHAT IT DOES NOT TOUCH. The evaluation workspace stays ignored exactly as it is. This
 * file is an EXTRACT written to `data/`, which is tracked, so no safety rule is narrowed to
 * make it durable. That matters: those ignore rules are the mechanism keeping personal
 * photographs and downloaded originals out of the repo, and the way to get one fact out of
 * an ignored directory is to copy the fact, never to widen the rule.
 *
 * WHAT IT HOLDS. A Photos UUID, a verdict, and — for keepers — the attribution and the
 * owner's clip marks. Nothing else: no filenames, no capture times, no GPS, no EXIF, no
 * pixels. Owner-approved 2026-08-25 on the grounds that a UUID and a verdict disclose
 * nothing the published archive does not already say.
 *
 * WHAT IT IS FOR. Re-derivation without re-culling. `media-index.json` already carries the
 * keepers (uuid, sourceSha256, `derivedFrom`, `render: {uuid, in, out}`), so the published
 * images can be rebuilt from git alone. This is the other half — the negative space — so a
 * rebuild does not ask the same questions twice.
 *
 * @module scripts/media/decisions
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import type { Verdict } from './selects'

export const DECISIONS_PATH = resolve('data/media-decisions.json')

/** One judged asset. Deliberately a subset of `Verdict` — UI-only fields do not persist. */
export interface Decision {
  verdict: 'keep' | 'reject'
  /** Resolved act name, keepers only. */
  artist?: string
  subject?: 'performer' | 'venue' | 'crowd' | 'stub'
  /** The frame that leads this act. One per act per show, chosen by hand. */
  hero?: true
  /** Normalised crop box authored at 4:5 (#342). Durable: re-deriving must not re-ask. */
  crop?: { x: number; y: number; w: number; h: number }
  /** Seconds into a clip the owner marked for a still. These beat the algorithm (#395). */
  frames?: number[]
  /** Seconds. The section of a clip worth keeping. */
  trim?: { in: number; out: number }
}

export interface ShowDecisions {
  /** How many assets the review page put in front of the owner. */
  reviewed: number
  /** ISO-8601, when `media:review --finish` last wrote this show. */
  decidedAt: string
  /** Keyed by Photos UUID, or `frame:<uuid>:<n>` for an extracted frame. */
  decisions: Record<string, Decision>
}

export interface DecisionsFile {
  version: 1
  shows: Record<string, ShowDecisions>
}

const EMPTY: DecisionsFile = { version: 1, shows: {} }

export function loadDecisions(path = DECISIONS_PATH): DecisionsFile {
  if (!existsSync(path)) return { ...EMPTY, shows: {} }
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as DecisionsFile
  if (parsed.version !== 1) {
    throw new Error(`${path}: unsupported version ${parsed.version} (expected 1)`)
  }
  return parsed
}

/**
 * Strip a raw verdict down to what deserves to persist.
 *
 * Returns null for anything unjudged. A half-finished review is normal — the page saves on
 * every keystroke — and an absent verdict is NOT a rejection. Recording it as one would
 * quietly bury assets the owner never actually looked at.
 */
export function toDecision(v: Verdict): Decision | null {
  if (v.verdict !== 'keep' && v.verdict !== 'reject') return null
  const d: Decision = { verdict: v.verdict }
  if (v.verdict === 'reject') return d
  if (v.artist) d.artist = v.artist
  if (v.subject) d.subject = v.subject
  // Recorded only when true — a durable record of a choice, not of its absence.
  if (v.hero) d.hero = true
  if (v.crop) d.crop = { x: v.crop.x, y: v.crop.y, w: v.crop.w, h: v.crop.h }
  if (v.frames?.length) d.frames = [...v.frames]
  if (v.trim) d.trim = { in: v.trim.in, out: v.trim.out }
  return d
}

/**
 * Fold one show's verdicts into the file, replacing that show wholesale.
 *
 * Replace rather than merge: the review page is the authority on a show it has just
 * finished, and merging would make a verdict the owner CHANGED to "reject" impossible to
 * express — the old "keep" would survive alongside it. Other shows are untouched.
 */
export function recordShow(
  file: DecisionsFile,
  date: string,
  verdicts: Record<string, Verdict>,
  decidedAt: string
): { file: DecisionsFile; kept: number; rejected: number; skipped: number } {
  const decisions: Record<string, Decision> = {}
  let skipped = 0
  for (const uuid of Object.keys(verdicts).sort()) {
    const d = toDecision(verdicts[uuid])
    if (d) decisions[uuid] = d
    else skipped++
  }
  const counts = Object.values(decisions)
  return {
    file: {
      ...file,
      shows: {
        ...file.shows,
        [date]: { reviewed: Object.keys(decisions).length, decidedAt, decisions },
      },
    },
    kept: counts.filter((d) => d.verdict === 'keep').length,
    rejected: counts.filter((d) => d.verdict === 'reject').length,
    skipped,
  }
}

/** Every UUID the owner has already ruled on, across all shows. */
export function decidedUuids(file: DecisionsFile): Set<string> {
  const seen = new Set<string>()
  for (const show of Object.values(file.shows)) {
    for (const uuid of Object.keys(show.decisions)) seen.add(uuid)
  }
  return seen
}

export function saveDecisions(file: DecisionsFile, path = DECISIONS_PATH): void {
  mkdirSync(dirname(path), { recursive: true })
  // Shows sorted by date so the diff of a new show is an insertion, not a reshuffle.
  const shows: Record<string, ShowDecisions> = {}
  for (const date of Object.keys(file.shows).sort()) shows[date] = file.shows[date]
  writeFileSync(path, JSON.stringify({ ...file, shows }, null, 2) + '\n')
}
