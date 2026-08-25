/**
 * `npm run media:frames <YYYY-MM-DD>` — mine the clips you kept for stills.
 *
 * Video's place in this project is settled: at tier 1 a clip is not something you publish,
 * it is a SOURCE OF STILLS. Extracted frames scored an 83% keep rate judged blind — the
 * best of any category, better than native stills. Video as video is tier 3 (Shorts,
 * TikTok) and gated elsewhere.
 *
 * THE RULE THAT SHAPES THIS COMMAND: never download a clip you have not decided to mine.
 * The archive holds 150 clips across 36 shows; at ~150MB each, fetching them all is 22.5GB.
 * So the decision comes first and the download second, and only for what survived:
 *
 *   1. media:prep      WORKSHEET.md lists every clip with duration, resolution, 9:16 and
 *                      frame-grab eligibility — enough to kill fragments without a byte.
 *   2. Photos.app      WATCH the survivors. A poster frame cannot be judged; this is the
 *                      one step no tooling here replaces.
 *   3. media:review    mark the ones worth mining. For a clip, `1` means "mine this",
 *                      not "publish this".
 *   4. media:frames    <- downloads ONLY those, extracts, and puts the frames back on the
 *                      review page for a second pass.
 *   5. media:review    judge the frames as stills, then --finish.
 *   6. media:ingest    they land as tier-1 stills carrying `derivedFrom`.
 *
 * Extraction itself is the validated tooling from #348: sample ~1 frame/second, score each
 * by Laplacian variance, and enforce a MINIMUM GAP between picks. Top-N by sharpness
 * returns adjacent frames of the same moment — the burst problem, manufactured.
 *
 * @module scripts/media/frames
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import { tmpdir } from 'os'
import { findShow, loadConcerts, ShowNotFoundError } from './show'
import { loadSelects } from './selects'

const REVIEW_ROOT = resolve('concert-photos-audit/review')
const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const EXTRACT = resolve('concert-photos-audit/extract_frames.sh')
/** Trimmed clips land here for manual use — not in the repo, and not in media-index.json. */
const RENDERS = resolve('video/renders')

/** mm:ss for log lines. */
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Synthetic id for a frame, so the review page and selects need no special case. */
export const frameId = (clipUuid: string, index: number) => `frame:${clipUuid}:${index}`

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

/**
 * How many frames to keep from one clip.
 *
 * Scaled by duration rather than fixed: three picks from a nine-second clip are three views
 * of one moment, and three from three minutes throws most of it away. Capped because a
 * review page of near-identical frames is worse than a shorter one.
 */
export function framesToKeep(durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds <= 0) return 3
  return Math.max(2, Math.min(6, Math.round(durationSeconds / 15)))
}

interface PageItem {
  uuid: string
  original_filename: string
  show: string
  artist: string
  headliner: string
  openers: string[]
  lineup: string[]
  venue: string
  time: string
  media: string
  w: number
  h: number
  orientation: string
  v916: boolean
  grab: boolean
  persons: string[]
  labels: string[]
  incloud: boolean
  ismissing: boolean
  scores: Record<string, number> | null
  likelihood: number
  quality: number | null
  dir: string
  file: string
  source_file?: string
  duration?: number | null
}

function main(): void {
  const date = process.argv.slice(2).find((a) => !a.startsWith('-'))
  if (!date) fail('Usage: npm run media:frames <YYYY-MM-DD>')

  let concert
  try {
    concert = findShow(loadConcerts(), date)
  } catch (err) {
    if (err instanceof ShowNotFoundError) fail(err.message)
    throw err
  }

  const runDir = join(REVIEW_ROOT, concert.date)
  if (!existsSync(runDir)) fail(`No review run for ${date}. Run \`npm run media:review ${date}\` first.`)
  const selects = loadSelects(runDir)
  if (!selects) fail(`No selects.json for ${date}. Finish the review first:\n  npm run media:review ${date} -- --finish`)

  const items = JSON.parse(readFileSync(join(runDir, 'all.json'), 'utf-8')) as PageItem[]
  const byUuid = new Map(items.map((i) => [i.uuid, i]))

  // Only clips the owner actually kept. This is the gate that keeps 22.5GB off the disk.
  const clips = selects.selects
    .filter((s) => !s.sourceFile && byUuid.get(s.uuid)?.media === 'video')
    .map((s) => ({ sel: s, item: byUuid.get(s.uuid)! }))

  if (clips.length === 0) {
    console.log(`\n${concert.date} — no clips were kept in the review. Nothing to mine.\n`)
    console.log(`Clips are marked in the review page like stills; for a clip, "usable" means`)
    console.log(`"worth mining for frames". WORKSHEET.md lists them for the Photos pass.\n`)
    return
  }

  if (!existsSync(EXTRACT)) fail(`Frame extraction script is missing at ${EXTRACT}.`)

  console.log(`\n${concert.date} — ${concert.headliner} @ ${concert.venue}`)
  console.log(`  ${clips.length} clip(s) kept. Downloading only these — the rest of the archive stays in iCloud.\n`)

  const stage = join(tmpdir(), `media-frames-${date}-${process.pid}`)
  mkdirSync(stage, { recursive: true })
  const uuidFile = join(stage, 'uuids.txt')
  writeFileSync(uuidFile, clips.map((c) => c.sel.uuid).join('\n') + '\n')

  try {
    execFileSync(
      GUARD,
      [
        'export', stage,
        '--uuid-from-file', uuidFile,
        '--download-missing',
        // PhotoKit, not AppleScript — see the note in ingest.ts. Driving Photos.app over
        // Apple Events to pull iCloud originals wedges it mid-batch; PhotoKit talks to the
        // library directly and never launches the app.
        '--use-photokit',
        // NOT --convert-to-jpeg: ffmpeg needs the actual video.
        '--skip-original-if-edited',
        '--filename', '{uuid}',
        '--no-progress',
        '--update',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024 }
    )
  } catch (err) {
    const e = err as Error & { stderr?: Buffer }
    fail(`Downloading the clips failed.\n  ${e.stderr?.toString().trim().split('\n').slice(-3).join('\n  ') ?? e.message}`)
  }

  const downloaded = new Map<string, string>()
  for (const name of readdirSync(stage)) {
    const m = /^([0-9A-Fa-f-]{36})/.exec(name)
    if (m && !name.endsWith('.txt') && !name.endsWith('.db')) downloaded.set(m[1].toUpperCase(), name)
  }

  const framesDir = join(runDir, 'img')
  const added: PageItem[] = []

  for (const { sel, item } of clips) {
    const clipFile = downloaded.get(sel.uuid.toUpperCase())
    if (!clipFile) {
      console.log(`  ⚠ ${sel.originalFilename}: did not download — skipped`)
      continue
    }
    const out = join(stage, `frames-${sel.uuid}`)
    const marked = sel.marks?.frames ?? []
    const src = join(stage, clipFile)

    // A trim renders to video/renders/ for MANUAL use. Nothing in the publishing pipeline
    // consumes a clip yet — #349/#350 are gated on #100 — so it is deliberately not
    // pretended into media-index.json. The marks are the durable record; the file is
    // reproducible from {uuid, in, out} at any time.
    let trimFile: string | null = null
    if (sel.marks?.trim) {
      const { in: a, out: b } = sel.marks.trim
      mkdirSync(RENDERS, { recursive: true })
      const target = join(RENDERS, `${date}-${sel.artistNormalized ?? 'venue'}-${basename(clipFile, extname(clipFile))}-trim.mp4`)
      try {
        // -c copy would be faster but cuts only on keyframes, which moves the in-point by
        // up to a couple of seconds — the exact precision the owner just marked by hand.
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-accurate_seek', '-ss', String(a),
                                '-i', src, '-t', String(b - a), '-c:v', 'libx264', '-crf', '18',
                                '-preset', 'medium', '-c:a', 'aac', target],
                     { stdio: ['ignore', 'pipe', 'pipe'] })
        const mb = statSync(target).size / 1e6
        trimFile = target
        console.log(`    trim ${fmt(a)}–${fmt(b)} → ${target.replace(process.cwd() + '/', '')} (${mb.toFixed(1)} MB)`)
      } catch (err) {
        console.log(`    ⚠ trim failed: ${(err as Error).message.split('\n')[0]}`)
      }
    }

    // WHAT THE MARKS MEAN — the owner's definitions, not ours.
    //
    //   frame timecodes  -> stills at exactly those moments
    //   in/out points    -> ONE DERIVED VIDEO. A clip is a video; in and out define its
    //                       boundaries. That is the whole output.
    //   both             -> those stills and that video
    //   neither          -> the algorithm picks frames, the fallback for a clip kept but
    //                       never marked
    //
    // This shipped wrong twice. First it ignored the trim and sampled the whole clip;
    // then it "fixed" that by sampling INSIDE the trim — still extracting stills nobody
    // asked for. A trim is a request for a video, and answering it with frames is
    // inventing work.
    const extractFrom = trimFile ?? src
    const offset = trimFile ? (sel.marks?.trim?.in ?? 0) : 0
    const wantsAutoFrames = marked.length === 0 && !sel.marks?.trim

    if (marked.length > 0) {
      // THE OWNER'S MARKS WIN. They watched the clip and read the time off the Photos
      // scrubber; the algorithm only knows which frame is sharpest. Judged against the
      // three it picked from IMG_5739.MOV, the owner could pick better moments by hand,
      // which is the whole reason this path exists.
      mkdirSync(out, { recursive: true })
      console.log(`  ${sel.originalFilename} → grabbing ${marked.length} marked frame(s)…`)
      marked.forEach((t) => {
        // -ss before -i seeks fast; -accurate_seek keeps it on the right frame anyway.
        // Named the way extract_frames.sh names its output so `parseDerivedFrom` reads the
        // provenance without a second convention to learn.
        const name = `${basename(clipFile, extname(clipFile))}__f${String(Math.round(t)).padStart(4, '0')}__lap0.jpg`
        try {
          execFileSync('ffmpeg', ['-loglevel', 'error', '-accurate_seek', '-ss', String(t), '-i', src,
                                  '-frames:v', '1', '-q:v', '2', join(out, name)],
                       { stdio: ['ignore', 'pipe', 'pipe'] })
        } catch (err) {
          console.log(`    ⚠ ${fmt(t)}: ${(err as Error).message.split('\n')[0]}`)
        }
      })
    } else if (!wantsAutoFrames) {
      // Trim marked, no frames asked for. The video above IS the deliverable.
      console.log(`    (trim only — no stills taken)`)
    } else {
      const keep = framesToKeep(item.duration ?? null)
      console.log(`  ${sel.originalFilename} → no marks; extracting ${keep} frames automatically…`)
      try {
        execFileSync('sh', [EXTRACT, extractFrom, out, String(keep)], {
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 32 * 1024 * 1024,
        })
      } catch (err) {
        console.log(`  ⚠ ${sel.originalFilename}: extraction failed — ${(err as Error).message.split('\n')[0]}`)
        continue
      }
    }

    // Verify the files, not the exit code.
    const produced = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith('.jpg')) : []
    if (produced.length === 0) {
      console.log(`  ⚠ ${sel.originalFilename}: extraction produced no frames`)
      continue
    }

    produced.sort()
    produced.forEach((rawName, n) => {
      // A frame cut from the trim is named by its position WITHIN the trim, but provenance
      // has to describe the original clip — otherwise "frame 5" of a trim starting at 1:49
      // reads as 5 seconds into a three-minute video, and a different-night disclosure
      // written from it would be wrong about when it was taken.
      const name = offset > 0
        ? rawName.replace(/__f(\d+)__/, (_, d: string) => `__f${String(Number(d) + Math.round(offset)).padStart(4, '0')}__`)
        : rawName
      const from = join(out, rawName)
      const staged = `${sel.uuid.toUpperCase()}_f${n}_pv.jpeg`
      // The frame is BOTH the review thumbnail and the thing that gets ingested — it is
      // already full capture resolution, so there is no lower-quality proxy to make.
      execFileSync('cp', [from, join(framesDir, staged)])
      added.push({
        ...item,
        uuid: frameId(sel.uuid, n),
        // extract_frames.sh names its output <clip>__f<idx>__lap<score>.jpg, which
        // `parseDerivedFrom` reads — so provenance survives into media-index.json.
        original_filename: name,
        media: 'photo',
        // A frame is a still: the 9:16 gate applies to video capture, not to this.
        v916: false,
        file: staged,
        source_file: join(framesDir, staged),
        // Unranked — the model never saw these. The page shows them for judgement.
        likelihood: item.likelihood,
        quality: null,
      })
    })
    console.log(`    ${produced.length} frames staged`)
  }

  if (added.length === 0) {
    console.log('\n  No frames were produced.\n')
    return
  }

  // Frames go on the END of the page, so the stills you already judged keep their order.
  const merged = [...items.filter((i) => !i.uuid.startsWith('frame:')), ...added]
  writeFileSync(join(runDir, 'all.json'), JSON.stringify(merged, null, 2) + '\n')
  rmSync(stage, { recursive: true, force: true })

  console.log(`\n  ${added.length} frames added to the review page.`)
  console.log(`  The clips themselves were deleted — they re-download on demand and are the`)
  console.log(`  bulkiest, least precious thing in the workspace.`)
  console.log(`\n  Next:`)
  console.log(`    npm run media:review ${concert.date}              judge the frames`)
  console.log(`    npm run media:review ${concert.date} -- --finish`)
  console.log(`    npm run media:ingest ${concert.date}\n`)
}

main()
