/**
 * `npm run media:prep <YYYY-MM-DD>` — scaffold one show's inbox and point at its media (#378).
 *
 * The command the owner runs after a show. It creates the folders that `media:ingest` will
 * read, and a worksheet that says which assets in Photos are worth looking at.
 *
 *   1.  npm run media:prep 2026-06-04     <- this
 *   2.  review in Photos.app               human, out-of-process, by design
 *   3.  export selects into the inbox      human, drag and drop
 *   4.  npm run media:ingest               strip, name, index, report
 *
 * ON DEMAND, ONE SHOW AT A TIME. Scaffolding all 184 dates would create 555 folders and
 * destroy the inbox's value as a signal — you could no longer glance at it and see what is
 * pending.
 *
 * READ-ONLY AGAINST PHOTOS. Every library access goes through
 * `concert-photos-audit/bin/osxphotos`, the read-only guard, never `.osxphotos-raw`. The
 * Photos library is the owner's irreplaceable source of record and is never modified.
 *
 * VERIFY OUTPUT, NOT EXIT CODES. The recurring failure in this work is a command that
 * reports success while doing nothing — an export that hung twenty minutes on a prompt, a
 * `--only-photos` flag that silently excluded every video, a string replace that never
 * matched. So this asserts its own output before it claims to have worked.
 *
 * Usage:
 *   npm run media:prep 2026-06-04
 *   npm run media:prep 2026-06-04 -- --scaffold-only   # folders + bill, no library read
 *
 * @module scripts/media/prep
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import { findShow, folderPlan, loadConcerts, showWindow, coarseRange, ShowNotFoundError, VENUE_FOLDER } from './show'
import { rankCandidates, type Candidate } from './rank'
import { renderWorksheet } from './worksheet'

const INBOX = resolve('concert-photos-audit/inbox')
const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const QUERY_FN = resolve('scripts/media/query_window.py')
const WORKSHEET = 'WORKSHEET.md'
const WORKSHEET_PREV = 'WORKSHEET.prev.md'

interface QueryPayload {
  window_from: string
  window_to: string
  coarse_scanned: number
  excluded: { no_date: number; outside_window: number }
  candidates: Candidate[]
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

/** Files already in a folder, so a re-run can prove it touched none of them. */
function contentsOf(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).sort()
}

/**
 * Create the folders, never their contents.
 *
 * `mkdir -p` semantics: an existing folder is left exactly as it is. This function must
 * never write a file into an act folder — those hold the owner's selects.
 */
function scaffold(dateDir: string, folders: string[]): { created: string[]; existing: string[]; keptFiles: number } {
  const created: string[] = []
  const existing: string[] = []
  let keptFiles = 0
  mkdirSync(dateDir, { recursive: true })
  for (const folder of folders) {
    const path = join(dateDir, folder)
    if (existsSync(path)) {
      existing.push(folder)
      keptFiles += contentsOf(path).length
    } else {
      mkdirSync(path, { recursive: true })
      created.push(folder)
    }
  }
  return { created, existing, keptFiles }
}

/**
 * Read the window out of Photos through the read-only guard.
 *
 * The CLI date pair is a COARSE pre-filter widened by a day on each side; the
 * authoritative naive-local window test runs inside the query function, which is how every
 * probe in this project has done it. Trusting the CLI filter would make the window
 * silently timezone-dependent.
 */
function queryPhotos(date: string): QueryPayload {
  if (!existsSync(GUARD)) {
    fail(`The read-only osxphotos guard is missing at ${GUARD}. It is tracked in git — restore it.`)
  }

  const window = showWindow(date)
  const coarse = coarseRange(date)
  const runDir = join(tmpdir(), `media-prep-${date}-${process.pid}`)
  mkdirSync(runDir, { recursive: true })
  const paramsFile = join(runDir, 'params.json')
  const outFile = join(runDir, 'candidates.json')
  writeFileSync(paramsFile, JSON.stringify({ window_from: window.from, window_to: window.to }))

  console.log(`  reading Photos ${window.from.slice(11, 16)}–${window.to.slice(11, 16)} local (coarse ${coarse.from.slice(0, 10)}…${coarse.to.slice(0, 10)})`)

  try {
    execFileSync(
      GUARD,
      [
        'query',
        '--from-date', coarse.from,
        '--to-date', coarse.to,
        // NOTE: the separator is `::`, not the single `:` the --help text claims.
        '--query-function', `${QUERY_FN}::probe`,
        '--quiet',
      ],
      {
        env: { ...process.env, MEDIA_PREP_PARAMS: paramsFile, MEDIA_PREP_OUT: outFile },
        // osxphotos narrates twenty lines of "Processing ..." to stderr on every run.
        // Captured rather than inherited so it cannot bury this command's own report —
        // and printed in full if the run fails, where it is the only diagnostic there is.
        stdio: ['ignore', 'ignore', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      }
    )
  } catch (err) {
    const e = err as Error & { stderr?: Buffer; status?: number }
    const detail = e.stderr?.toString().trim()
    // 69 is the guard's own "binary not present", and its message already explains how to
    // build one — repeating that here would only bury it.
    if (e.status === 69) {
      fail(
        `${detail ?? 'The osxphotos binary is not installed.'}\n\n` +
          `  Or re-run with --scaffold-only to create the folders without reading the library.`
      )
    }
    fail(
      `osxphotos failed. If macOS has not granted Full Disk Access to that binary, grant it\n` +
        `  and re-run; see concert-photos-audit/bin/BUILD.txt.\n  ${e.message}` +
        (detail ? `\n\n${detail}` : '')
    )
  }

  // Verify output, not the exit code: osxphotos exits 0 whether or not the function ran.
  if (!existsSync(outFile)) {
    fail(
      `osxphotos exited cleanly but wrote no candidate file.\n` +
        `  The query function did not run. Check that ${QUERY_FN} is readable and that the\n` +
        `  --query-function separator is "::".`
    )
  }
  return JSON.parse(readFileSync(outFile, 'utf-8')) as QueryPayload
}

function main(): void {
  const args = process.argv.slice(2)
  const scaffoldOnly = args.includes('--scaffold-only')
  const date = args.find((a) => !a.startsWith('-'))

  if (!date) {
    fail('Usage: npm run media:prep <YYYY-MM-DD>\n  e.g. npm run media:prep 2026-06-04')
  }

  let concert
  try {
    concert = findShow(loadConcerts(), date)
  } catch (err) {
    if (err instanceof ShowNotFoundError) fail(err.message)
    throw err
  }

  const { acts, folders, collisions } = folderPlan(concert)
  const dateDir = join(INBOX, concert.date)

  console.log(`\n${concert.date} — ${concert.headliner} @ ${concert.venue}, ${concert.city}`)
  console.log(`  ${acts.length} ${acts.length === 1 ? 'act' : 'acts'}: ${acts.map((a) => a.name).join(', ')}`)

  const before = new Map(folders.map((f) => [f, contentsOf(join(dateDir, f))]))
  const { created, existing, keptFiles } = scaffold(dateDir, folders)

  if (collisions.length > 0) {
    console.log(`  ⚠ slug collision on ${collisions.join(', ')} — suffixed rather than merged`)
  }
  console.log(`  folders: ${created.length} created, ${existing.length} already there (${keptFiles} files left untouched)`)

  let payload: QueryPayload = {
    window_from: showWindow(concert.date).from,
    window_to: showWindow(concert.date).to,
    coarse_scanned: 0,
    excluded: { no_date: 0, outside_window: 0 },
    candidates: [],
  }
  if (scaffoldOnly) {
    console.log('  --scaffold-only: the Photos library was not read')
  } else {
    payload = queryPhotos(concert.date)
  }

  const { scored, unscored } = rankCandidates(payload.candidates, {
    venue: concert.venue,
    city: concert.city,
    lat: concert.location?.lat,
    lng: concert.location?.lng,
  })

  const markdown = renderWorksheet({
    concert,
    acts,
    window: { from: payload.window_from, to: payload.window_to },
    coarseScanned: payload.coarse_scanned,
    excluded: payload.excluded,
    scored,
    unscored,
    generatedAt: new Date().toISOString().slice(0, 10),
  })

  // The worksheet is generated output and a re-run replaces it, but one copy is kept so a
  // re-run can never destroy something the owner wrote on it by hand.
  const worksheetPath = join(dateDir, WORKSHEET)
  if (existsSync(worksheetPath)) {
    renameSync(worksheetPath, join(dateDir, WORKSHEET_PREV))
    console.log(`  previous worksheet kept as ${WORKSHEET_PREV}`)
  }
  writeFileSync(worksheetPath, markdown)

  assertOutput({ dateDir, folders, before, worksheetPath, scored, unscored })

  const total = scored.length + unscored.length
  console.log(`\n  ${total} candidates listed (${scored.length} scored, ${unscored.length} unscored)`)
  if (payload.excluded.outside_window > 0 || payload.excluded.no_date > 0) {
    console.log(
      `  excluded: ${payload.excluded.outside_window} outside the window, ` +
        `${payload.excluded.no_date} with no capture date — nothing else`
    )
  }
  if (!scaffoldOnly && total === 0) {
    console.log('  No media in this window. That is a real answer: fall back to tier 2.')
  }
  console.log(`\n  → ${worksheetPath}`)
  console.log(`\nNext: review in Photos.app, drop selects into the act folders, run media:ingest.\n`)
}

/**
 * Assert the work actually happened, before saying it did.
 *
 * Every claim this command makes is checked here against the filesystem. A two-line
 * assertion costs nothing and catches what reading an exit code never will.
 */
function assertOutput(ctx: {
  dateDir: string
  folders: string[]
  before: Map<string, string[]>
  worksheetPath: string
  scored: ReturnType<typeof rankCandidates>['scored']
  unscored: ReturnType<typeof rankCandidates>['unscored']
}): void {
  const problems: string[] = []

  for (const folder of ctx.folders) {
    const path = join(ctx.dateDir, folder)
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      problems.push(`folder ${folder}/ was not created`)
      continue
    }
    // Nothing pre-existing may have been touched: the act folders hold the owner's selects.
    const was = ctx.before.get(folder) ?? []
    const now = contentsOf(path)
    const lost = was.filter((f) => !now.includes(f))
    if (lost.length > 0) problems.push(`${folder}/ lost ${lost.length} file(s): ${lost.join(', ')}`)
  }
  if (!ctx.folders.includes(VENUE_FOLDER)) problems.push(`${VENUE_FOLDER}/ missing from the plan`)

  if (!existsSync(ctx.worksheetPath) || statSync(ctx.worksheetPath).size === 0) {
    problems.push('WORKSHEET.md is missing or empty')
  } else {
    const body = readFileSync(ctx.worksheetPath, 'utf-8')
    const all = [...ctx.scored, ...ctx.unscored]
    // The filename column is the entire point of the worksheet — it is what gets pasted
    // into the Photos search field. A row without one points at nothing.
    const missing = all.filter((r) => !r.original_filename || !body.includes(`\`${r.original_filename}\``))
    if (missing.length > 0) {
      problems.push(`${missing.length} candidate(s) reached the worksheet without an original_filename`)
    }
    const rows = body.split('\n').filter((l) => /^\| \d+ \| `/.test(l)).length
    if (rows !== all.length) problems.push(`worksheet has ${rows} rows for ${all.length} candidates`)
  }

  if (problems.length > 0) {
    fail(`media:prep did not produce what it claims:\n  - ${problems.join('\n  - ')}`)
  }
}

main()
