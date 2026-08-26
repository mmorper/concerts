/**
 * `npm run media:review <YYYY-MM-DD>` — cull one show's stills on a localhost page (#380).
 *
 * The step between prep and ingest, and the one the owner actually spends time in:
 *
 *   1.  npm run media:prep <date>      scaffold folders + worksheet
 *   2a. npm run media:review <date>    <- STILLS: judge them here
 *   2b. Photos.app                     VIDEO: a poster frame cannot be judged, so play it
 *   3.  npm run media:review <date> --finish   write selects.json
 *   4.  npm run media:ingest <date>    strip, name, index, report
 *
 * WHY STILLS ARE REVIEWED HERE AND VIDEO IS NOT. Photos.app does playback, scrubbing and
 * trimming better than anything this project would build, so video review stays there.
 * Stills are the opposite case: 58 frames judged one keystroke at a time, with the two
 * ranking factors and the night's lineup on screen, is exactly what a review page is for —
 * and triaging them in Photos means making the attribution call twice, once when judging
 * and again when choosing a folder. That second call is where a Soft Cell frame lands in
 * `alison-moyet/`.
 *
 * PREVIEWS, NOT ORIGINALS. `--preview` exports the JPEG Photos already generated, which is
 * always on disk. Originals frequently are not: 42 of 58 assets for 2026-06-04 are
 * iCloud-only, and pulling those needs `--download-missing`, which drives Photos over
 * AppleScript and requires a separate Automation permission this project has declined
 * twice. Judging happens on previews; the originals are only fetched for the handful that
 * survive.
 *
 * READ-ONLY. Every library access goes through the guard at
 * `concert-photos-audit/bin/osxphotos`. Nothing here writes to Photos.
 *
 * @module scripts/media/review
 */
import { execFileSync, spawn } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { findShow, folderPlan, loadConcerts, showWindow, coarseRange, ShowNotFoundError } from './show'
import { rankCandidates, type Candidate, type Ranked } from './rank'
import { buildSelects, loadVerdicts, saveSelects, SELECTS_FILE } from './selects'
import { loadDecisions, recordShow, saveDecisions, DECISIONS_PATH } from './decisions'

const REVIEW_ROOT = resolve('concert-photos-audit/review')
const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const QUERY_FN = resolve('scripts/media/query_window.py')
const PAGE = resolve('scripts/media/review-page.html')
const SERVER = resolve('scripts/media/review_server.py')

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

function queryPhotos(date: string, imgDir?: string): QueryPayload {
  if (!existsSync(GUARD)) fail(`The read-only osxphotos guard is missing at ${GUARD}.`)
  const window = showWindow(date)
  const coarse = coarseRange(date)
  const runDir = join(tmpdir(), `media-review-${date}-${process.pid}`)
  mkdirSync(runDir, { recursive: true })
  const paramsFile = join(runDir, 'params.json')
  const outFile = join(runDir, 'candidates.json')
  writeFileSync(paramsFile, JSON.stringify({ window_from: window.from, window_to: window.to }))

  try {
    execFileSync(
      GUARD,
      ['query', '--from-date', coarse.from, '--to-date', coarse.to,
       '--query-function', `${QUERY_FN}::probe`, '--quiet'],
      {
        env: {
          ...process.env,
          MEDIA_PREP_PARAMS: paramsFile,
          MEDIA_PREP_OUT: outFile,
          ...(imgDir ? { MEDIA_REVIEW_IMG_DIR: imgDir } : {}),
        },
        stdio: ['ignore', 'ignore', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      }
    )
  } catch (err) {
    const e = err as Error & { stderr?: Buffer; status?: number }
    const detail = e.stderr?.toString().trim()
    fail(`osxphotos failed.\n  ${e.message}${detail ? `\n\n${detail}` : ''}`)
  }
  // Verify output, not the exit code: osxphotos exits 0 whether or not the function ran.
  if (!existsSync(outFile)) fail('osxphotos exited cleanly but wrote no candidate file.')
  return JSON.parse(readFileSync(outFile, 'utf-8')) as QueryPayload
}

/**
 * Confirm the previews the query function staged, and say which assets have none.
 *
 * The copy itself happens inside `query_window.py`, under the osxphotos binary: macOS
 * scopes Full Disk Access to that binary, so node reading a path inside the Photos library
 * gets EPERM. That is exactly why the binary is built locally and TCC-scoped.
 *
 * Verify the files, never a return code — a stage that reports success while writing
 * nothing is the failure this project keeps meeting.
 */
function confirmPreviews(ranked: Ranked[], imgDir: string): { staged: Map<string, string>; missing: Ranked[] } {
  const staged = new Map<string, string>()
  const missing: Ranked[] = []
  for (const r of ranked) {
    const name = r.preview_file
    if (!name) { missing.push(r); continue }
    const path = join(imgDir, name)
    if (!existsSync(path) || statSync(path).size === 0) { missing.push(r); continue }
    staged.set(r.uuid.toUpperCase(), name)
  }
  return { staged, missing }
}

/** The shape `review-page.html` fetches. Keys match what the page reads off each item. */
function pageItems(ranked: Ranked[], show: { headliner: string; venue: string; openers: string[]; lineup: string[] }, imgFiles: Map<string, string>) {
  return ranked
    .filter((r) => imgFiles.has(r.uuid.toUpperCase()))
    .map((r) => ({
      uuid: r.uuid,
      // The Photos search term. The preview is named by UUID, which finds nothing.
      original_filename: r.original_filename,
      show: r.local_time.slice(0, 10),
      artist: show.headliner,
      headliner: show.headliner,
      openers: show.openers,
      lineup: show.lineup,
      venue: show.venue,
      time: r.local_time.slice(11, 16),
      media: r.is_movie ? 'video' : r.live_photo ? 'live' : 'photo',
      // Carried so `media:frames` can scale how many frames it keeps to the clip's length.
      duration: r.duration,
      w: r.width,
      h: r.height,
      orientation: r.orientation,
      v916: r.vertical916,
      grab: r.frameGrab,
      persons: r.persons,
      labels: r.labels.slice(0, 6),
      incloud: r.in_cloud,
      ismissing: r.is_missing,
      scores: r.scores,
      // The page shows this beside its own client-side Laplacian sharpness. Both factors
      // stay visible: a real concert photo can still be a bad one.
      likelihood: r.likelihood,
      quality: r.quality,
      dir: 'img',
      file: imgFiles.get(r.uuid.toUpperCase()),
    }))
}

function setup(date: string): void {
  let concert
  try {
    concert = findShow(loadConcerts(), date)
  } catch (err) {
    if (err instanceof ShowNotFoundError) fail(err.message)
    throw err
  }
  const { acts } = folderPlan(concert)
  const runDir = join(REVIEW_ROOT, concert.date)
  const imgDir = join(runDir, 'img')
  mkdirSync(runDir, { recursive: true })

  console.log(`\n${concert.date} — ${concert.headliner} @ ${concert.venue}`)
  console.log(`  ${acts.length} acts: ${acts.map((a) => a.name).join(', ')}`)

  console.log(`  reading Photos and staging previews (Photos' own; nothing downloads)…`)
  const payload = queryPhotos(concert.date, imgDir)
  const { scored, unscored } = rankCandidates(payload.candidates, {
    venue: concert.venue,
    city: concert.city,
    lat: concert.location?.lat,
    lng: concert.location?.lng,
  })
  // Unscored assets are listed here too: they are unmeasured, not worse, and the whole
  // point of a review page is that a person looks at them.
  const ranked = [...scored, ...unscored]
  if (ranked.length === 0) {
    console.log('\n  No media in this window. Nothing to review — fall back to tier 2.\n')
    return
  }

  const { staged: imgFiles, missing } = confirmPreviews(ranked, imgDir)

  const items = pageItems(ranked, {
    headliner: concert.headliner,
    venue: concert.venue,
    openers: concert.openers ?? [],
    lineup: acts.map((a) => a.name),
  }, imgFiles)

  // Frames extracted by `media:frames` live in this same file and are NOT re-derivable
  // from the library — they were cut out of a clip afterwards. Re-running the review must
  // refresh the library assets without throwing away work already done on the frames.
  const allPath = join(runDir, 'all.json')
  let frames: unknown[] = []
  if (existsSync(allPath)) {
    try {
      const prior = JSON.parse(readFileSync(allPath, 'utf-8')) as Array<{ uuid: string; source_file?: string }>
      frames = prior.filter((i) => i.uuid?.startsWith('frame:') && i.source_file && existsSync(i.source_file))
    } catch {
      /* an unreadable previous run is not a reason to fail this one */
    }
  }
  writeFileSync(allPath, JSON.stringify([...items, ...frames], null, 2) + '\n')
  if (frames.length > 0) console.log(`  ${frames.length} extracted frame(s) kept on the page`)
  copyFileSync(PAGE, join(runDir, 'index.html'))

  if (!existsSync(join(runDir, 'verdicts.json'))) writeFileSync(join(runDir, 'verdicts.json'), '{}\n')

  console.log(`  ${items.length} of ${ranked.length} previews ready`)
  if (missing.length > 0) {
    // Reported, never silent: an asset with no preview cannot be judged here, and the
    // owner needs to know it was left out rather than assume it was rejected.
    console.log(`  ⚠ ${missing.length} have no preview in the library and are NOT on the page —`)
    console.log(`    review these in Photos:`)
    for (const r of missing.slice(0, 8)) console.log(`      ${r.original_filename}`)
    if (missing.length > 8) console.log(`      …and ${missing.length - 8} more`)
  }

  const videos = ranked.filter((r) => r.is_movie).length
  if (videos > 0) {
    console.log(`\n  ${videos} clips are on the page for context, but a poster frame cannot be judged.`)
    console.log(`  Review those in Photos.app — WORKSHEET.md lists them with searchable filenames.`)
  }

  console.log(`\n  → http://127.0.0.1:8787/index.html`)
  console.log(`\n  1 usable · 0 reject · P V C S subject · then pick the act · U undo`)
  console.log(`  When you are done:  npm run media:review ${concert.date} -- --finish\n`)

  const server = spawn('python3', [SERVER], {
    env: { ...process.env, REVIEW_DIR: runDir },
    stdio: 'inherit',
  })
  process.on('SIGINT', () => { server.kill('SIGINT'); process.exit(0) })
}

/** Turn the raw verdicts into the approved list, and say what has to happen next. */
function finish(date: string): void {
  let concert
  try {
    concert = findShow(loadConcerts(), date)
  } catch (err) {
    if (err instanceof ShowNotFoundError) fail(err.message)
    throw err
  }
  const { acts } = folderPlan(concert)
  const runDir = join(REVIEW_ROOT, concert.date)
  if (!existsSync(runDir)) fail(`No review run for ${date}. Run \`npm run media:review ${date}\` first.`)

  const items = JSON.parse(readFileSync(join(runDir, 'all.json'), 'utf-8')) as Array<{
    uuid: string
    original_filename: string
    time: string
    ismissing: boolean
    source_file?: string
  }>
  const verdicts = loadVerdicts(runDir)
  // all.json is written in ranked order, so the index IS the rank.
  const assets = items.map((i, n) => ({
    uuid: i.uuid,
    original_filename: i.original_filename,
    local_time: `${concert.date}T${i.time}:00`,
    is_missing: i.ismissing,
    source_file: i.source_file ?? null,
    rank: n + 1,
  }))

  const file = buildSelects({
    date: concert.date,
    headliner: concert.headliner,
    venue: concert.venue,
    acts,
    assets,
    verdicts,
    generated: new Date().toISOString(),
  })
  saveSelects(runDir, file)

  /* The durable half. `selects.json` holds the keepers and lives in the ignored evaluation
     workspace; this writes the whole judgement — rejections included — to tracked `data/`.
     Rejections are the expensive part of culling and the part nothing else records, so
     without this a later audit re-asks every question the owner has already answered. */
  const rec = recordShow(loadDecisions(), concert.date, verdicts, new Date().toISOString())
  saveDecisions(rec.file)

  console.log(`\n${concert.date} — ${file.selects.length} selects from ${file.reviewed} judged\n`)
  const byFolder = new Map<string, typeof file.selects>()
  for (const s of file.selects) {
    if (!byFolder.has(s.folder)) byFolder.set(s.folder, [])
    byFolder.get(s.folder)!.push(s)
  }
  for (const [folder, rows] of [...byFolder].sort()) {
    console.log(`  ${folder}/  (${rows.length})`)
    for (const r of rows) console.log(`    #${String(r.rank).padStart(2)}  ${r.time.slice(11, 16)}  ${r.originalFilename}${r.needsDownload ? '  [iCloud]' : ''}`)
  }
  if (file.unattributed.length > 0) {
    console.log(`\n  ⚠ ${file.unattributed.length} keeper(s) with no act named — NOT in selects:`)
    for (const u of file.unattributed) console.log(`      ${u.time.slice(11, 16)}  ${u.originalFilename}`)
    console.log(`    Re-open the page and pick an act. 48% of shows have openers, so this is never defaulted.`)
  }
  console.log(`\n  → ${join(runDir, SELECTS_FILE)}`)
  console.log(`  → ${DECISIONS_PATH}  (${rec.kept} keep, ${rec.rejected} reject${rec.skipped ? `, ${rec.skipped} unjudged, not recorded` : ''})`)
  const cloud = file.selects.filter((s) => s.needsDownload).length
  console.log(`\nNext: npm run media:ingest ${concert.date}`)
  console.log(`  It fetches these originals itself${cloud ? ` (${cloud} from iCloud)` : ''}, strips them, and indexes them.`)
  console.log(`  Nothing to export by hand.\n`)
}

function main(): void {
  const args = process.argv.slice(2)
  const date = args.find((a) => !a.startsWith('-'))
  if (!date) fail('Usage: npm run media:review <YYYY-MM-DD>\n  add -- --finish to write selects.json')
  if (args.includes('--finish')) finish(date)
  else setup(date)
}

main()
