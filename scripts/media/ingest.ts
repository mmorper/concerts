/**
 * `npm run media:ingest` — accept the owner's selects back out of the inbox (#379).
 *
 * The step that turns a hand-picked photograph into a publishable asset:
 *
 *   1.  npm run media:prep <date>          scaffold folders + worksheet
 *   2.  review in Photos.app                human, out-of-process, by design
 *   3.  export selects into the inbox       human, drag and drop
 *   4.  npm run media:ingest                <- this
 *   5.  commit                              selects + media-index.json
 *
 * THE FAILURE THIS EXISTS TO PREVENT is a silently wrong credit. A folder that does not
 * match the bill, or a file dropped at the root of a date folder, is an ERROR that stops
 * that item — never a guess that defaults to the headliner. 89 of 184 shows (48%) have
 * openers, so a headliner default would mis-credit photographs on half the archive and the
 * post would state it as fact.
 *
 * PERSONAL MEDIA NEVER REACHES THE REPO UN-STRIPPED. GPS, capture time and device id are
 * removed, and their absence is ASSERTED on the written bytes by two independent checks
 * before the file is kept. A file that fails the assertion is deleted, not committed.
 *
 * Usage:
 *   npm run media:ingest                 every date folder in the inbox
 *   npm run media:ingest 2024-08-20      one show
 *   npm run media:ingest -- --dry-run    report only; writes nothing
 *
 * @module scripts/media/ingest
 */
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join, resolve, extname, basename } from 'path'
import sharp from 'sharp'
import { findShow, folderPlan, loadConcerts, VENUE_FOLDER, isValidDate, type Act, type Concert } from './show'
import { explainMatchFailure, isHeroName, matchFolder, parseDerivedFrom } from './match'
import { exifDateToIso, findMetadataLeaks, readExifSummary } from './exif'
import { crossCheckSelects, loadSelects } from './selects'
import {
  alreadyIngested,
  assetFilename,
  assetsFor,
  loadIndex,
  nextOrder,
  saveIndex,
  type MediaAsset,
  type MediaIndex,
} from './media-index'

const INBOX = resolve('concert-photos-audit/inbox')
const REVIEW_ROOT = resolve('concert-photos-audit/review')
const SHOWS_DIR = resolve('public/images/shows')
const URL_PREFIX = '/images/shows'

/** Formats sharp can decode and that are worth publishing as stills. */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.tif', '.tiff', '.webp'])
/** Recognised, but not this command's job — see the skipped report. */
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v', '.avi', '.hevc'])

/** Expected at the root of a date folder, and not a mis-filed photograph. */
const ROOT_ALLOWED = /^(WORKSHEET(\.prev)?\.md|notes\.txt)$/i

/** JPEG quality for committed selects. Renditions (#342) derive from these, so keep them good. */
const JPEG_QUALITY = 90

interface Report {
  taken: MediaAsset[]
  skipped: Array<{ path: string; reason: string }>
  errors: string[]
  warnings: string[]
  bytesWritten: number
  /** Every source file seen, as `<folder>/<filename>`, for the selects cross-check. */
  arrivals: Array<{ folder: string; filename: string }>
}


const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex')

/** Real files only — dotfiles are macOS debris (`.DS_Store`), never a select. */
function entriesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

function readNotes(dir: string): string | null {
  const p = join(dir, 'notes.txt')
  if (!existsSync(p)) return null
  const text = readFileSync(p, 'utf-8').trim()
  return text || null
}

/**
 * Convert, strip, and prove it was stripped.
 *
 * Returns the bytes only if the output is clean. Sharp drops EXIF/XMP/IPTC/ICC on a plain
 * re-encode, but "the encoder says so" is not evidence, so the output is checked by two
 * mechanisms — sharp's own view of the result, and a raw byte scan that shares no parser
 * with it.
 */
async function transcodeAndStrip(source: Buffer): Promise<{ bytes: Buffer; width: number; height: number; leaks: string[] }> {
  // No .keepMetadata() / .withMetadata(): the default is to drop everything, which is what
  // this pipeline wants. Rotation is applied from the EXIF orientation flag first, because
  // dropping the flag without applying it would silently sideways every portrait photo.
  const pipeline = sharp(source, { failOn: 'none' }).rotate().jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  const meta = await sharp(data).metadata()
  return { bytes: data, width: info.width, height: info.height, leaks: findMetadataLeaks(data, meta) }
}

async function ingestFile(args: {
  file: string
  date: string
  act: Act | null
  index: MediaIndex
  report: Report
  notes: string | null
  dryRun: boolean
}): Promise<void> {
  const { file, date, act, index, report, notes, dryRun } = args
  const name = basename(file)
  const ext = extname(name).toLowerCase()
  const rel = file.slice(INBOX.length + 1)

  if (VIDEO_EXT.has(ext)) {
    // Not silently dropped: video selects are a real thing the owner may have exported,
    // and they belong to the rendition work (#342) and the Shorts/TikTok track (#349/#350).
    report.skipped.push({ path: rel, reason: 'video — ingest handles stills; see #342 / #349' })
    return
  }
  if (!IMAGE_EXT.has(ext)) {
    report.skipped.push({ path: rel, reason: `unsupported extension ${ext || '(none)'}` })
    return
  }

  const source = readFileSync(file)
  const hash = sha256(source)
  const artistNormalized = act ? act.slug : null

  const seen = alreadyIngested(index, date, artistNormalized, hash)
  if (seen) {
    report.skipped.push({ path: rel, reason: `already ingested as ${seen.url}` })
    return
  }

  // EXIF is a CROSS-CHECK, never the source of truth. A missing date is normal — ffmpeg
  // strips DateTimeOriginal outright and Photos exports of edited files are inconsistent —
  // so only a contradiction is worth saying, and the folder still wins.
  let exif = { dateTimeOriginal: null as string | null, make: null as string | null, model: null as string | null, hasGps: false }
  try {
    const meta = await sharp(source, { failOn: 'none' }).metadata()
    exif = readExifSummary(meta.exif)
  } catch {
    /* unreadable metadata is not a reason to reject a photograph */
  }
  const exifDate = exifDateToIso(exif.dateTimeOriginal)
  if (exifDate && exifDate !== date) {
    report.warnings.push(
      `${rel}: EXIF says ${exifDate}, filed under ${date}. The folder wins — but if this is ` +
        `genuinely from another night, the post must disclose it (notes.txt).`
    )
  }

  let out
  try {
    out = await transcodeAndStrip(source)
  } catch (err) {
    report.errors.push(`${rel}: could not be decoded — ${(err as Error).message}`)
    return
  }

  if (out.leaks.length > 0) {
    // Assert, do not trust. A file that still carries metadata is not committed.
    report.errors.push(`${rel}: REFUSED — metadata survived stripping: ${out.leaks.join('; ')}`)
    return
  }

  const order = nextOrder(index, date, artistNormalized)
  const filename = assetFilename(date, artistNormalized, order)
  const target = join(SHOWS_DIR, filename)
  const hero = isHeroName(name)

  const asset: MediaAsset = {
    url: `${URL_PREFIX}/${filename}`,
    date,
    artist: act ? act.name : null,
    artistNormalized,
    subject: act ? 'artist' : 'venue',
    tier: 1,
    source: 'personal',
    hero,
    order,
    width: out.width,
    height: out.height,
    bytes: out.bytes.length,
    sourceSha256: hash,
    derivedFrom: parseDerivedFrom(name),
    notes,
  }

  if (hero) {
    // The owner's most recent explicit instruction wins, and it is never silent: an
    // earlier hero is demoted and reported, rather than two heroes coexisting.
    for (const prior of assetsFor(index, date, artistNormalized)) {
      if (prior.hero) {
        prior.hero = false
        report.warnings.push(`${rel}: takes over as hero for ${act?.name ?? 'the venue'} — ${prior.url} demoted.`)
      }
    }
  }

  if (!dryRun) {
    mkdirSync(SHOWS_DIR, { recursive: true })
    writeFileSync(target, out.bytes)
    // Re-read from disk. Everything above verified a buffer; this verifies the file.
    const written = readFileSync(target)
    const writtenMeta = await sharp(written).metadata()
    const leaks = findMetadataLeaks(written, writtenMeta)
    if (leaks.length > 0) {
      unlinkSync(target)
      report.errors.push(`${rel}: REFUSED — metadata found on the written file: ${leaks.join('; ')}`)
      return
    }
  }

  index.assets.push(asset)
  report.taken.push(asset)
  report.bytesWritten += out.bytes.length
  if (exif.hasGps || exif.make) {
    const had = [exif.hasGps ? 'GPS' : null, exif.make ? `${exif.make} ${exif.model ?? ''}`.trim() : null]
      .filter(Boolean)
      .join(', ')
    report.warnings.push(`${rel}: stripped ${had}${exifDate ? ` and capture time ${exifDate}` : ''}.`)
  }
}

async function ingestDate(dateDir: string, concerts: Concert[], index: MediaIndex, report: Report, dryRun: boolean): Promise<void> {
  const date = basename(dateDir)

  if (!isValidDate(date)) {
    report.errors.push(`inbox/${date}/ is not a YYYY-MM-DD folder. A date folder IS the concert.`)
    return
  }
  let concert: Concert
  try {
    concert = findShow(concerts, date)
  } catch {
    report.errors.push(
      `${date}/ — no concert on that date in concerts.json.\n` +
        `Nothing was ingested from it. All 184 dates are unique, so this is never a guess.`
    )
    return
  }

  const { acts } = folderPlan(concert)
  const showNotes = readNotes(dateDir)

  // PASS ONE — see what arrived, without writing anything. The placement check has to
  // happen before any file is committed: writing a wrongly-credited asset and reporting it
  // afterwards leaves it in media-index.json, and the next run skips it as already done.
  const folders: Array<{ entry: string; match: ReturnType<typeof matchFolder>; files: string[] }> = []

  for (const entry of entriesOf(dateDir)) {
    const path = join(dateDir, entry)
    if (!statSync(path).isDirectory()) {
      if (ROOT_ALLOWED.test(entry)) continue
      // A root-level file is an ERROR, not a headliner default. This is the whole reason
      // every act — including the headliner — gets its own folder.
      report.errors.push(
        `${date}/${entry} sits at the root of the date folder.\n` +
          `It was NOT ingested: crediting it would mean guessing which act is in the frame.\n` +
          `Move it into one of: ${acts.map((a) => `${a.slug}/`).join(', ')}, ${VENUE_FOLDER}/`
      )
      continue
    }

    const match = matchFolder(entry, acts)
    if (match.kind === 'unknown' || match.kind === 'ambiguous') {
      report.errors.push(explainMatchFailure(match, date, acts))
      continue
    }

    const files = entriesOf(path).filter((f) => statSync(join(path, f)).isFile() && f.toLowerCase() !== 'notes.txt')
    if (files.length === 0) {
      // An empty artist folder is a SIGNAL, not an absence: no personal media for that
      // act, so the post falls back to tier 2. It is reported, never treated as an error.
      const who = match.kind === 'venue' ? 'the venue' : match.act.name
      report.skipped.push({ path: `${date}/${entry}/`, reason: `empty — no personal media for ${who}, falls back to tier 2` })
      continue
    }
    folders.push({ entry, match, files })
  }

  const arrivals = folders.flatMap((f) =>
    f.files.map((filename) => ({
      folder: f.match.kind === 'venue' ? VENUE_FOLDER : (f.match as { act: Act }).act.slug,
      filename,
    }))
  )
  for (const a of arrivals) report.arrivals.push(a)

  // If this show was reviewed, hold the filing up against what was decided there BEFORE
  // anything is written. `selects.json` is the only record of who is actually in a frame.
  let refuse = new Set<string>()
  const selects = loadSelects(join(REVIEW_ROOT, date))
  if (selects) refuse = crossCheckSelects(selects, arrivals, report)

  // PASS TWO — write what survived.
  for (const { entry, match, files } of folders) {
    if (match.kind !== 'act' && match.kind !== 'venue') continue
    const path = join(dateDir, entry)
    const folder = match.kind === 'venue' ? VENUE_FOLDER : match.act.slug
    // `hero.*` / `01.*` first so it claims the lowest ordinal; the rest keep filename order.
    const ordered = [...files].sort((a, b) => Number(isHeroName(b)) - Number(isHeroName(a)) || a.localeCompare(b))
    const folderNotes = readNotes(path) ?? showNotes

    for (const f of ordered) {
      if (refuse.has(`${folder}/${f}`)) {
        report.skipped.push({ path: `${date}/${entry}/${f}`, reason: 'refused — attributed to a different act in the review' })
        continue
      }
      await ingestFile({
        file: join(path, f),
        date,
        act: match.kind === 'venue' ? null : match.act,
        index,
        report,
        notes: folderNotes,
        dryRun,
      })
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const only = args.find((a) => !a.startsWith('-'))

  if (!existsSync(INBOX)) {
    console.log(`\nNothing to ingest — ${INBOX} does not exist.`)
    console.log(`Run \`npm run media:prep <date>\` first.\n`)
    return
  }

  const concerts = loadConcerts()
  const index = loadIndex()
  const report: Report = { taken: [], skipped: [], errors: [], warnings: [], bytesWritten: 0, arrivals: [] }

  const dates = entriesOf(INBOX).filter((d) => statSync(join(INBOX, d)).isDirectory())
  const targets = only ? dates.filter((d) => d === only) : dates

  if (only && targets.length === 0) {
    console.error(`\n✖ No inbox folder for ${only}. Present: ${dates.join(', ') || '(none)'}\n`)
    process.exit(1)
  }

  console.log(`\nmedia:ingest — ${targets.length} date folder(s)${dryRun ? '  [DRY RUN, nothing is written]' : ''}\n`)

  for (const date of targets) {
    await ingestDate(join(INBOX, date), concerts, index, report, dryRun)
  }

  // Report what was TAKEN and what was SKIPPED — a stage that discards silently is a stage
  // that can be wrong invisibly.
  if (report.taken.length > 0) {
    console.log(`${dryRun ? 'Would take' : 'Taken'} (${report.taken.length}):`)
    for (const a of report.taken) {
      const who = a.artist ?? '_venue'
      const extra = [a.hero ? 'hero' : null, a.derivedFrom ? `from ${a.derivedFrom.original}` : null]
        .filter(Boolean)
        .join(', ')
      console.log(`  ${a.url}   ${who}${extra ? `  (${extra})` : ''}`)
    }
    const mb = (report.bytesWritten / 1024 / 1024).toFixed(1)
    console.log(`  ${mb} MB ${dryRun ? 'would be written to' : 'written to'} public/images/shows/`)
    console.log('')
  }

  if (report.skipped.length > 0) {
    console.log(`Skipped (${report.skipped.length}):`)
    for (const s of report.skipped) console.log(`  ${s.path} — ${s.reason}`)
    console.log('')
  }

  if (report.warnings.length > 0) {
    console.log(`Warnings (${report.warnings.length}):`)
    for (const w of report.warnings) console.log(`  ⚠ ${w}`)
    console.log('')
  }

  if (report.errors.length > 0) {
    console.log(`Errors (${report.errors.length}) — these were NOT ingested:`)
    for (const e of report.errors) console.log(`  ✖ ${e.split('\n').join('\n    ')}`)
    console.log('')
  }

  if (report.taken.length > 0 && !dryRun) {
    index.generated = new Date().toISOString()
    saveIndex(index)
    assertIndex(report)
    console.log(`  → public/data/media-index.json (${index.assets.length} assets total)`)
    console.log(`\nCommit the new files in public/images/shows/ together with media-index.json.\n`)
  } else if (report.taken.length === 0) {
    console.log('Nothing new to ingest.\n')
  }

  // Errors are reported in full and then the command fails, so a wrong credit can never be
  // mistaken for a clean run in CI or in a scrollback.
  if (report.errors.length > 0) process.exit(1)
}

/**
 * Prove the committed files are what was claimed, before the command reports success.
 *
 * Re-reads every file just written from disk and re-runs the leak scan. The per-file check
 * already did this, but this one runs after `saveIndex`, so what is asserted is exactly the
 * state that is about to be committed.
 */
function assertIndex(report: Report): void {
  const problems: string[] = []
  const saved = loadIndex()
  for (const asset of report.taken) {
    const onDisk = join(SHOWS_DIR, basename(asset.url))
    if (!existsSync(onDisk)) {
      problems.push(`${asset.url} is in the index but not on disk`)
      continue
    }
    if (statSync(onDisk).size === 0) problems.push(`${asset.url} was written empty`)
    const bytes = readFileSync(onDisk)
    const leaks = findMetadataLeaks(bytes, {})
    if (leaks.length > 0) problems.push(`${asset.url} carries metadata: ${leaks.join('; ')}`)
    const recorded = saved.assets.find((a) => a.url === asset.url)
    if (!recorded) problems.push(`${asset.url} was written but did not reach media-index.json`)
    else if (!recorded.artistNormalized && recorded.subject !== 'venue') {
      problems.push(`${asset.url} reached the index without an artist and without being venue material`)
    }
  }
  if (problems.length > 0) {
    console.error(`\n✖ media:ingest did not produce what it claims:\n  - ${problems.join('\n  - ')}\n`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`\n✖ ${(err as Error).stack ?? err}\n`)
  process.exit(1)
})
