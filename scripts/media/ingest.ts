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
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join, resolve, extname, basename } from 'path'
import { tmpdir } from 'os'
import sharp from 'sharp'
import { findShow, folderPlan, loadConcerts, VENUE_FOLDER, isValidDate, type Act, type Concert } from './show'
import { explainMatchFailure, isHeroName, matchFolder, parseDerivedFrom } from './match'
import { exifDateToIso, findMetadataLeaks, readExifSummary } from './exif'
import { crossCheckSelects, loadSelects, type SelectsFile } from './selects'
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
const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const SHOWS_DIR = resolve('public/images/shows')
const URL_PREFIX = '/images/shows'

/** Formats sharp can decode and that are worth publishing as stills. */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.tif', '.tiff', '.webp'])
/** Recognised, but not this command's job — see the skipped report. */
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v', '.avi', '.hevc'])

/** Expected at the root of a date folder, and not a mis-filed photograph. */
const ROOT_ALLOWED = /^(WORKSHEET(\.prev)?\.md|notes\.txt)$/i

/** JPEG quality for committed masters. Renditions (#342) derive from these, so keep them good. */
const JPEG_QUALITY = 90

/**
 * Long edge of a committed master, in pixels.
 *
 * The repo holds a right-sized MASTER, not the original. 2048px clears everything the
 * channels actually ask for — a 4:5 card at 1080×1350, a 9:16 crop at 1080×1920 — with
 * headroom left for crop safety (#352). Committing the original instead means shipping a
 * 5412×7216 file to render a 1350px card.
 *
 * The size difference is what makes the archive viable in git: on the pilot show, 41.4MB
 * of originals became 8.4MB of masters. Projected across a few hundred eventual selects
 * that is ~150MB rather than ~760MB.
 *
 * NOTHING IS LOST. The original never leaves Photos, and `media-index.json` records the
 * `uuid`, so any asset can be re-fetched and re-derived at any size. The metadata is the
 * durable thing; this file is a cache of it that CI can actually reach — the syndication
 * and liner-notes jobs run on ubuntu-latest, where the Photos library does not exist.
 */
const MASTER_LONG_EDGE = 2048

/**
 * How long the fetch may make NO PROGRESS before it says something.
 *
 * Deliberately not a wall clock. A wall-clock timeout cannot tell a wedged Photos from a
 * macOS permission dialog sitting on screen while nobody is at the desk — and those need
 * opposite responses. Killing a run because the owner went to make coffee would be worse
 * than the hang it was meant to catch.
 *
 * So: progress is measured by files actually appearing. While they keep appearing, the
 * fetch has as long as it needs, however slow iCloud is. When they stop, it SAYS so and
 * keeps waiting — because the most likely cause is a dialog that only a person can answer.
 */
const STALL_WARN_MS = 3 * 60 * 1000

/**
 * Run a command, watching a directory for progress rather than watching the clock.
 *
 * Never kills on its own unless `timeoutMs` is set. An interactive run is expected to be
 * interrupted by the owner if they decide it really is stuck; that is a better judgement
 * than a timer can make, because only they can see whether a permission prompt is up.
 */
function runWatchingProgress(
  cmd: string,
  args: string[],
  watchDir: string,
  timeoutMs: number
): Promise<{ ok: boolean; stalled: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (d) => { stderr += d.toString() })

    const started = Date.now()
    let lastCount = -1
    let lastProgress = Date.now()
    let warned = false

    const poll = setInterval(() => {
      let count = 0
      try { count = existsSync(watchDir) ? readdirSync(watchDir).length : 0 } catch { /* mid-write */ }
      if (count !== lastCount) {
        lastCount = count
        lastProgress = Date.now()
        warned = false
      } else if (!warned && Date.now() - lastProgress > STALL_WARN_MS) {
        warned = true
        console.log('')
        console.log(`  ⏸  No new files for ${Math.round(STALL_WARN_MS / 60000)} minutes. Still waiting — this is not a failure.`)
        console.log(`     macOS may be showing a permission prompt. If one is on screen, answer it`)
        console.log(`     and this continues on its own. Otherwise Photos may be busy with iCloud.`)
        console.log(`     Ctrl-C is safe: your selects and attributions are already saved.`)
        console.log('')
      }
      if (timeoutMs > 0 && Date.now() - started > timeoutMs) {
        clearInterval(poll)
        child.kill('SIGTERM')
        resolve({ ok: false, stalled: true, stderr })
      }
    }, 10_000)

    child.on('close', (code) => {
      clearInterval(poll)
      resolve({ ok: code === 0, stalled: false, stderr })
    })
    child.on('error', () => {
      clearInterval(poll)
      resolve({ ok: false, stalled: false, stderr })
    })
  })
}

/** The 4:5 card. A master that cannot fill it is not publishable, so it is not committed. */
const CARD_MIN_SHORT = 1080
const CARD_MIN_LONG = 1350

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
async function transcodeAndStrip(
  source: Buffer
): Promise<{ bytes: Buffer; width: number; height: number; sourceWidth: number; sourceHeight: number; leaks: string[] }> {
  // Read the source dimensions before touching it, so the index can record what the
  // original offers. That answers "is there crop headroom here?" without a round trip to
  // Photos — which matters for #352, where the answer decides whether a crop is safe.
  const src = await sharp(source, { failOn: 'none' }).rotate().metadata()

  // No .keepMetadata() / .withMetadata(): the default is to drop everything, which is what
  // this pipeline wants. Rotation is applied from the EXIF orientation flag first, because
  // dropping the flag without applying it would silently sideways every portrait photo.
  const pipeline = sharp(source, { failOn: 'none' })
    .rotate()
    // `withoutEnlargement` so a source already smaller than the master size — a Photos
    // preview used as a fallback is 1536×2048 — is committed as it is rather than upscaled
    // into a file that only looks bigger.
    .resize({ width: MASTER_LONG_EDGE, height: MASTER_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  const meta = await sharp(data).metadata()
  return {
    bytes: data,
    width: info.width,
    height: info.height,
    sourceWidth: src.width ?? info.width,
    sourceHeight: src.height ?? info.height,
    leaks: findMetadataLeaks(data, meta),
  }
}

async function ingestFile(args: {
  file: string
  date: string
  act: Act | null
  /** Which copy this file is. Inbox files are whatever the owner exported. */
  quality?: 'original' | 'preview'
  /** How to name this file in the report. Defaults to its path under the inbox. */
  label?: string
  /** The library asset this file came from, when it came from one. */
  uuid?: string | null
  /**
   * Name to read provenance from, when the file on disk is not named for its origin.
   *
   * A staged frame is called `<clip-uuid>_f0_pv.jpeg` so the review page can address it
   * by UUID — which tells `parseDerivedFrom` nothing. The name that carries the
   * provenance is the extractor's, `<clip>__f0113__lap0.jpg`, and it lives on the select.
   */
  provenanceName?: string | null
  index: MediaIndex
  report: Report
  notes: string | null
  dryRun: boolean
}): Promise<void> {
  const { file, date, act, index, report, notes, dryRun } = args
  const quality = args.quality ?? 'original'
  const name = basename(file)
  const ext = extname(name).toLowerCase()
  const rel = args.label ?? file.slice(INBOX.length + 1)

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

  const short = Math.min(out.width, out.height)
  const long = Math.max(out.width, out.height)
  if (short < CARD_MIN_SHORT || long < CARD_MIN_LONG) {
    // Not committed. A 768x1024 Photos preview is below the 4:5 card floor, so publishing
    // it means shipping an upscaled or letterboxed post. The judgement is not lost — the
    // select still stands, and re-running once the original downloads produces a real
    // master in its place.
    report.errors.push(
      `${rel}: ${out.width}×${out.height} is below the ${CARD_MIN_SHORT}×${CARD_MIN_LONG} card floor — NOT committed.` +
        (quality === 'preview' ? `\n  This is Photos' preview; the original will clear it. Re-run once it downloads.` : '')
    )
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
    kind: 'image',
    url: `${URL_PREFIX}/${filename}`,
    date,
    uuid: args.uuid ?? null,
    artist: act ? act.name : null,
    artistNormalized,
    subject: act ? 'artist' : 'venue',
    tier: 1,
    source: 'personal',
    hero,
    order,
    quality,
    width: out.width,
    height: out.height,
    sourceWidth: out.sourceWidth,
    sourceHeight: out.sourceHeight,
    bytes: out.bytes.length,
    sourceSha256: hash,
    derivedFrom: parseDerivedFrom(args.provenanceName ?? name),
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

/**
 * Fetch the originals the review already approved, and ingest them.
 *
 * THIS IS THE POINT OF THE WHOLE PIPELINE. The expensive work — looking at 58 frames and
 * saying which are worth publishing and who is in them — is done and recorded by UUID.
 * Turning that into files on disk is mechanical, and it must not send the owner back into
 * Photos to hunt for filenames. Most of the archive lives in iCloud, so a workflow that
 * only handles local originals would be manual for the majority of the backlog.
 *
 * `--download-missing` drives Photos to materialise an iCloud original. Measured: 1.22MB
 * and six seconds for a 3024x4032 HEIC, and `ismissing` flips to false afterwards. The
 * spec's objection to this flag bundled the AppleScript permission with video's 15-30GB;
 * for stills the volume argument does not apply — the whole still backlog is a few
 * hundred MB.
 *
 * Materialising an original is NOT a library mutation: it writes no user data, no
 * metadata, no albums, no edits. It is what Photos does when you open the photograph.
 *
 * If an original cannot be fetched, the staged PREVIEW is used and recorded as such. 22 of
 * 23 previews on the pilot show cleared a 1080x1350 card and a 9:16 crop, so a post is
 * never blocked by a download — and `quality: 'preview'` means a later pass can upgrade
 * the file in place without any of the curation being redone.
 */
async function ingestFromSelects(args: {
  date: string
  concert: Concert
  acts: Act[]
  selects: SelectsFile
  index: MediaIndex
  report: Report
  dryRun: boolean
  fetchTimeoutMs: number
}): Promise<void> {
  const { date, acts, selects, index, report, dryRun, fetchTimeoutMs } = args
  if (selects.selects.length === 0) return

  const stage = join(tmpdir(), `media-ingest-${date}-${process.pid}`)
  mkdirSync(stage, { recursive: true })
  // Extracted frames are already files; only library assets need fetching.
  const fromLibrary = selects.selects.filter((s) => !s.sourceFile)
  const uuidFile = join(stage, 'uuids.txt')
  writeFileSync(uuidFile, fromLibrary.map((s) => s.uuid).join('\n') + '\n')

  const cloud = selects.selects.filter((s) => s.needsDownload).length
  if (fromLibrary.length > 0) {
    console.log(
      `  fetching ${fromLibrary.length} originals${cloud ? ` (${cloud} from iCloud — this takes a few seconds each)` : ''}…`
    )
  }

  let exported = new Map<string, string>()
  if (!dryRun && fromLibrary.length > 0) {
    {
      const result = await runWatchingProgress(
        GUARD,
        [
          'export', stage,
          '--uuid-from-file', uuidFile,
          // Materialise iCloud originals. Without this, every asset the owner did not
          // happen to have on disk silently exports nothing.
          '--download-missing',
          // PHOTOKIT, NOT APPLESCRIPT. Without this, osxphotos launches Photos.app and
          // drives it one asset at a time over Apple Events — and Photos wedges. Measured:
          // it hung mid-batch around asset 20 of 23, stuck inside dispatchRawAppleEvent at
          // 14.6MB, never finishing its launch. Three assets silently fell back to
          // previews as a result, and clearing it needed a force-quit that left
          // photolibraryd degraded until a reboot.
          //
          // PhotoKit talks to the photo library directly. Verified: a genuinely missing
          // asset downloaded from iCloud in under a second with Photos.app NOT RUNNING at
          // all, and a 25-asset batch reached 17 before the test was cut short — Photos
          // never launched once.
          //
          // Upstream labels it alpha and warns it does not work under iTerm2 (use
          // Terminal.app). Weighed against a failure mode that hangs an app the owner
          // depends on, alpha is the better risk — and if it fails, the run degrades to
          // previews rather than wedging anything.
          '--use-photokit',
          // Convert with APPLE's codecs, not ours. sharp reports `heif.input === true`,
          // but the HEVC decoder is not compiled into its libvips: real iPhone HEICs fail
          // with "Support for this compression format has not been built in", and DNG is
          // not readable at all. 19 of 23 assets on the pilot show died this way. Letting
          // osxphotos convert on export fixes HEIC and ProRAW DNG in one flag.
          '--convert-to-jpeg', '--jpeg-quality', '1.0',
          // One file per asset, and the right one: if a photograph was edited in Photos,
          // the EDIT is what the owner saw in the review page and chose. Without this,
          // osxphotos writes both and the original silently wins the filename race.
          '--skip-original-if-edited',
          // Live Photos would otherwise drag in their motion clip as a second file.
          '--skip-live',
          // Name by UUID so the mapping back to the select is exact — original filenames
          // are not unique inside one show window.
          '--filename', '{uuid}',
          '--no-progress',
          '--update',
        ],
        stage,
        fetchTimeoutMs
      )
      if (!result.ok) {
        report.warnings.push(
          result.stalled
            ? `Fetch stopped after the --fetch-timeout you set — falling back to previews.\n` +
              `    Re-run to upgrade them in place; nothing you judged is lost.`
            : `Fetching originals failed; falling back to previews.\n    ${result.stderr.trim().split('\n').slice(-2).join(' ')}`
        )
      }
    }
    // Verify the files, not the exit code.
    for (const name of readdirSync(stage)) {
      const m = /^([0-9A-Fa-f-]{36})/.exec(name)
      if (m && statSync(join(stage, name)).isFile()) exported.set(m[1].toUpperCase(), name)
    }
  }

  const reviewImg = join(REVIEW_ROOT, date, 'img')
  const staged = new Map<string, string>()
  for (const sel of selects.selects) {
    // Placement follows the FOLDER, which is derived from the subject. Trusting
    // artistNormalized alone put a marquee shot under the headliner on the pilot show.
    const act =
      sel.folder === '_venue'
        ? null
        : sel.artistNormalized
          ? (acts.find((a) => a.slug === sel.artistNormalized) ?? null)
          : null
    if (sel.folder !== '_venue' && sel.artistNormalized && !act) {
      report.errors.push(`${sel.originalFilename}: selects names "${sel.artist}", which is not on this show's bill.`)
      continue
    }

    const originalName = exported.get(sel.uuid.toUpperCase())
    const isVideo = /\.(mov|mp4|m4v|avi|hevc)$/i.test(sel.originalFilename)
    const previewPath = join(reviewImg, `${sel.uuid.toUpperCase()}_pv.jpeg`)
    let file: string
    let quality: 'original' | 'preview'

    if (sel.sourceFile) {
      // An extracted frame. It never came from Photos, so there is nothing to export —
      // and it is full quality: ffmpeg cut it out of the clip at capture resolution.
      if (!existsSync(sel.sourceFile)) {
        report.errors.push(`${sel.originalFilename}: extracted frame is missing at ${sel.sourceFile}`)
        continue
      }
      file = sel.sourceFile
      quality = 'original'
      staged.set(file, sel.originalFilename)
    } else if (originalName) {
      file = join(stage, originalName)
      quality = 'original'
      // ingestFile reports paths relative to the inbox; a staged fetch has no inbox path,
      // so give it the name the owner recognises.
      staged.set(join(stage, originalName), sel.originalFilename)
    } else if (isVideo) {
      // A clip's "preview" is its POSTER FRAME, and a poster frame cannot be judged — that
      // is the finding the whole video workflow is built around. Falling back to it would
      // publish an unjudged frame as a photograph. The clip needs `media:frames`, which
      // downloads it and extracts real frames.
      report.errors.push(
        `${sel.originalFilename}: clip not downloaded, and its preview is only a poster frame.\n` +
          `Run \`npm run media:frames ${date}\` to mine it for stills instead.`
      )
      continue
    } else if (existsSync(previewPath)) {
      file = previewPath
      quality = 'preview'
      staged.set(previewPath, `${sel.originalFilename} (preview)`)
      if (!dryRun) report.warnings.push(
        `${sel.originalFilename}: original not fetched — using Photos' preview. ` +
          `Fine for a 1080x1350 card; re-run to upgrade it in place once it downloads.`
      )
    } else {
      report.errors.push(`${sel.originalFilename}: neither an original nor a preview is available.`)
      continue
    }

    if (dryRun) {
      report.skipped.push({ path: sel.originalFilename, reason: `would fetch and ingest to ${sel.folder}/` })
      continue
    }
    await ingestFile({
      file, date, act, quality, index, report, notes: null, dryRun,
      label: staged.get(file),
      provenanceName: sel.sourceFile ? sel.originalFilename : null,
      // A frame has no library identity of its own; record the CLIP it came from.
      uuid: sel.sourceFile ? null : sel.uuid,
    })
  }
}

async function ingestDate(dateDir: string, concerts: Concert[], index: MediaIndex, report: Report, dryRun: boolean, fetchTimeoutMs: number): Promise<void> {
  const date = basename(dateDir)
  const hasInbox = existsSync(dateDir)

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
  const showNotes = hasInbox ? readNotes(dateDir) : null

  // PASS ONE — see what arrived, without writing anything. The placement check has to
  // happen before any file is committed: writing a wrongly-credited asset and reporting it
  // afterwards leaves it in media-index.json, and the next run skips it as already done.
  const folders: Array<{ entry: string; match: ReturnType<typeof matchFolder>; files: string[] }> = []

  for (const entry of hasInbox ? entriesOf(dateDir) : []) {
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
  if (selects) {
    refuse = crossCheckSelects(selects, arrivals, report)
    // Fetch what the review approved. The inbox below stays for DERIVED files — extracted
    // frames, trimmed clips, crops — which have no UUID and can only arrive as files.
    await ingestFromSelects({ date, concert, acts, selects, index, report, dryRun, fetchTimeoutMs })
  }

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
  // Opt-in only. By default the fetch waits as long as it needs: a permission prompt
  // waiting on an empty desk is not a failure, and a timer cannot tell the difference.
  const tIdx = args.indexOf('--fetch-timeout')
  const fetchTimeoutMs = tIdx >= 0 ? Math.max(1, Number(args[tIdx + 1] || 0)) * 60_000 : 0
  const only = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--fetch-timeout')

  if (!existsSync(INBOX) && !existsSync(REVIEW_ROOT)) {
    console.log(`\nNothing to ingest — no review runs and no inbox.`)
    console.log(`Run \`npm run media:review <date>\` first.\n`)
    return
  }

  const concerts = loadConcerts()
  const index = loadIndex()
  const report: Report = { taken: [], skipped: [], errors: [], warnings: [], bytesWritten: 0, arrivals: [] }

  // Dates come from BOTH trees. A reviewed show usually has no inbox folder at all now —
  // its originals are fetched from selects.json — and requiring one would mean the
  // ordinary path could never run.
  const inboxDates = existsSync(INBOX)
    ? entriesOf(INBOX).filter((d) => statSync(join(INBOX, d)).isDirectory())
    : []
  const reviewDates = existsSync(REVIEW_ROOT)
    ? entriesOf(REVIEW_ROOT).filter((d) => existsSync(join(REVIEW_ROOT, d, 'selects.json')))
    : []
  const dates = [...new Set([...inboxDates, ...reviewDates])].sort()
  const targets = only ? dates.filter((d) => d === only) : dates

  if (only && targets.length === 0) {
    console.error(`\n✖ No inbox folder for ${only}. Present: ${dates.join(', ') || '(none)'}\n`)
    process.exit(1)
  }

  console.log(`\nmedia:ingest — ${targets.length} date folder(s)${dryRun ? '  [DRY RUN, nothing is written]' : ''}\n`)

  for (const date of targets) {
    await ingestDate(join(INBOX, date), concerts, index, report, dryRun, fetchTimeoutMs)
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
    // Only committed stills are asserted here; video is not written by this command.
    if (asset.kind !== 'image' || !asset.url) continue
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
