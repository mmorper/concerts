/**
 * `selects.json` — what the owner decided, and the check on what they then filed.
 *
 * The review page records a verdict per asset UUID. This turns those raw verdicts into the
 * approved list: keepers only, each resolved against that night's lineup so it carries a
 * real artist rather than a button label.
 *
 * WHY IT EXISTS SEPARATELY FROM THE VERDICTS. `verdicts.json` is UI state — it changes on
 * every keystroke, holds rejects, and can carry a half-finished record. `selects.json` is
 * a decision: it is written deliberately, it is complete, and `media:ingest` treats it as
 * the ANSWER against which the files that actually arrive are checked. A keeper attributed
 * to Soft Cell in the review page and then dropped into `alison-moyet/` is a mis-credit
 * that nothing else in the pipeline can catch — this file is what catches it.
 *
 * @module scripts/media/selects
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Act } from './show'

/** One asset as the review page left it. Keys are UUIDs. */
export interface Verdict {
  verdict?: 'keep' | 'reject' | null
  /** The act the owner said is in the frame, as displayed in the picker. */
  artist?: string | null
  subject?: 'performer' | 'venue' | 'crowd' | 'stub' | null
}

export interface Select {
  uuid: string
  originalFilename: string
  /** Resolved against the lineup — the name as `concerts.json` spells it. */
  artist: string | null
  artistNormalized: string | null
  subject: 'performer' | 'venue' | 'crowd' | 'stub' | null
  /** The inbox folder this select belongs in. `_venue` when it is not a performer. */
  folder: string
  /** True when the original is iCloud-only, so exporting it needs a download. */
  needsDownload: boolean
  time: string
  /**
   * A file already on disk, for selects that are not library assets.
   *
   * An extracted frame has no UUID — it did not come out of Photos, it was cut out of a
   * clip afterwards. Ingest reads this path directly instead of exporting.
   */
  sourceFile?: string | null
  /**
   * Position in the ranked review list, 1-based.
   *
   * Carried so ingest can give the best frame of each act `-01`, which is the one a
   * single-image post uses. Sorting by time instead would hand that slot to whatever
   * happened earliest.
   */
  rank: number
}

export interface SelectsFile {
  version: number
  date: string
  headliner: string
  venue: string
  generated: string
  /** Every asset that was looked at, so coverage is visible rather than assumed. */
  reviewed: number
  selects: Select[]
  /** Keepers the owner never attributed. Listed, never guessed. */
  unattributed: Array<{ uuid: string; originalFilename: string; time: string }>
}

export const SELECTS_FILE = 'selects.json'
export const VERDICTS_FILE = 'verdicts.json'

/** Frames that belong to the night rather than a performer go to `_venue/`. */
export const VENUE_SUBJECTS = new Set(['venue', 'crowd', 'stub'])

export function loadVerdicts(runDir: string): Record<string, Verdict> {
  const path = join(runDir, VERDICTS_FILE)
  if (!existsSync(path)) return {}
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, Verdict>
  delete (raw as Record<string, unknown>).__calibration__
  return raw
}

export function loadSelects(runDir: string): SelectsFile | null {
  const path = join(runDir, SELECTS_FILE)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as SelectsFile) : null
}

export function saveSelects(runDir: string, file: SelectsFile): void {
  writeFileSync(join(runDir, SELECTS_FILE), JSON.stringify(file, null, 2) + '\n')
}

/**
 * Which folder a select belongs in.
 *
 * A performer frame goes to that act's folder. Anything else — marquee, crowd, stub —
 * belongs to the night, not to a person, and goes to `_venue`. A keeper marked `performer`
 * with no act named cannot be placed, and is reported rather than guessed at.
 */
export function folderFor(subject: Select['subject'], act: Act | null): string | null {
  if (subject && VENUE_SUBJECTS.has(subject)) return '_venue'
  return act ? act.slug : null
}

export interface AssetFacts {
  uuid: string
  original_filename: string
  local_time: string
  is_missing: boolean
  /** 1-based position in the ranked list the review page displayed. */
  rank: number
  /** Set for extracted frames, which are files rather than library assets. */
  source_file?: string | null
}

/**
 * Turn raw verdicts into the approved list.
 *
 * Attribution is matched against THAT NIGHT'S lineup only — the picker was populated from
 * it, so an exact match is expected, but the comparison is case- and punctuation-tolerant
 * so a hand-edited verdicts file still resolves. Anything that does not resolve is
 * reported in `unattributed`, never defaulted to the headliner.
 */
export function buildSelects(args: {
  date: string
  headliner: string
  venue: string
  acts: Act[]
  assets: AssetFacts[]
  verdicts: Record<string, Verdict>
  generated: string
}): SelectsFile {
  const { date, headliner, venue, acts, assets, verdicts, generated } = args
  const byUuid = new Map(assets.map((a) => [a.uuid, a]))
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

  const selects: Select[] = []
  const unattributed: SelectsFile['unattributed'] = []

  for (const [uuid, v] of Object.entries(verdicts)) {
    if (v?.verdict !== 'keep') continue
    const asset = byUuid.get(uuid)
    if (!asset) continue // reviewed under a different run; not this show's business

    const named = v.artist ? (acts.find((a) => fold(a.name) === fold(v.artist as string)) ?? null) : null
    const subject = (v.subject ?? null) as Select['subject']
    const folder = folderFor(subject, named)

    // SUBJECT DECIDES PLACEMENT, and the artist must agree with it.
    //
    // The review page treats subject and act as independent, so a frame can be marked
    // `venue` while an act is also selected — which happened on the pilot show. That left
    // `folder: '_venue'` next to `artistNormalized: 'the-human-league'`, and ingest placed
    // it by the artist: a marquee shot published as a photograph of the headliner. Exactly
    // the mis-credit this file exists to prevent, arriving through the contract rather
    // than through a mis-filed folder.
    //
    // A venue, crowd or stub frame belongs to the NIGHT. Its act is dropped here so the
    // two fields can never disagree downstream.
    const act = folder === '_venue' ? null : named

    if (!folder) {
      // A keeper with no placement. The owner said it is worth publishing but not who is
      // in it, and half the archive has openers — so this waits for a person, not a guess.
      unattributed.push({ uuid, originalFilename: asset.original_filename, time: asset.local_time })
      continue
    }

    selects.push({
      uuid,
      originalFilename: asset.original_filename,
      artist: act ? act.name : null,
      artistNormalized: act ? act.slug : null,
      subject,
      folder,
      // A frame already on disk never needs downloading, whatever its clip's state was.
      needsDownload: asset.source_file ? false : asset.is_missing,
      time: asset.local_time,
      sourceFile: asset.source_file ?? null,
      rank: asset.rank,
    })
  }

  // Grouped by folder, best first — `-01` is the frame a single-image post reaches for.
  selects.sort((a, b) => a.folder.localeCompare(b.folder) || a.rank - b.rank)
  unattributed.sort((a, b) => a.time.localeCompare(b.time))

  return {
    version: 1,
    date,
    headliner,
    venue,
    generated,
    reviewed: Object.values(verdicts).filter((v) => v?.verdict).length,
    selects,
    unattributed,
  }
}


/** Just the fields `crossCheckSelects` writes into. */
export interface CrossCheckReport {
  errors: string[]
  warnings: string[]
}

export /**
 * Compare what was FILED against what was DECIDED in the review page.
 *
 * This is the only stage that can catch a mis-credit. Ingest cannot tell that a Soft Cell
 * photograph was dropped into `alison-moyet/` — the folder is its only evidence. The
 * review page knows, because that is where the owner said who was in the frame. So
 * `selects.json` is carried forward as the answer key.
 *
 * Matched on the filename STEM, case-insensitively: Photos rewrites the extension when it
 * converts on export (HEIC in, JPEG out), so comparing whole names would flag every file.
 */
function crossCheckSelects(
  selects: SelectsFile,
  arrivals: Array<{ folder: string; filename: string }>,
  report: CrossCheckReport
): Set<string> {
  const stem = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase()
  const arrivedBy = new Map<string, string[]>()
  for (const a of arrivals) {
    const k = stem(a.filename)
    if (!arrivedBy.has(k)) arrivedBy.set(k, [])
    arrivedBy.get(k)!.push(a.folder)
  }
  /** `<folder>/<filename>` of files that must NOT be written. */
  const refuse = new Set<string>()

  const misfiled: string[] = []
  for (const sel of selects.selects) {
    // A select that is NOT in the inbox is the normal case: ingest fetches those originals
    // itself. Only a select that arrived in the WRONG folder is worth saying anything about.
    const folders = arrivedBy.get(stem(sel.originalFilename))
    if (!folders || folders.length === 0) continue
    if (!folders.includes(sel.folder)) {
      misfiled.push(
        `${sel.originalFilename} was filed under ${folders.join(', ')}/ but you attributed it to ` +
          `${sel.artist ?? 'the venue'} (${sel.folder}/) while reviewing it`
      )
      // Refused, not merely reported. Writing it would put a wrong credit into
      // media-index.json, and a later run would then skip it as already ingested.
      for (const f of arrivals) {
        if (stem(f.filename) === stem(sel.originalFilename) && !folders.includes(sel.folder)) {
          refuse.add(`${f.folder}/${f.filename}`)
        }
      }
    }
  }

  if (misfiled.length > 0) {
    // An error, not a warning, and it BLOCKS the write. A wrong credit published as fact
    // is the failure this whole pipeline is shaped around, and the review page already
    // holds the right answer.
    report.errors.push(
      `Filed under a different act than you attributed it to — NOT ingested:\n` +
        misfiled.map((m) => `  ${m}`).join('\n') +
        `\n  Move the file, or change the attribution in the review page.`
    )
  }
  if (selects.unattributed.length > 0) {
    report.warnings.push(
      `${selects.unattributed.length} keeper(s) in the review still have no act named, so they ` +
        `were never in selects.json. Re-open the review page and pick an act.`
    )
  }
  return refuse
}
