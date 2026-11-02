/**
 * `npm run media:publish-video [date]` — put a show's trimmed clips on the site.
 *
 * Encodes each render to its web copy, uploads it and a poster to the public R2 bucket, fetches
 * both back through the public URL, and only then writes `url` and `poster` into
 * media-index.json. The Photos panel plays any video with a `url`, so this is the step that
 * turns a clip on.
 *
 * 🔴 AN UPLOAD IS PUBLIC THE MOMENT IT FINISHES, not when the PR merges. Publishing is the
 * owner's call, clip by clip: for a clip, "kept" in the review page means worth keeping, not
 * worth showing. So a run with no date only prints the list, and `--all` has to be asked for.
 *
 * Runs on the owner's Mac only. The renders are gitignored, so no CI job could do this.
 *
 *   --dry-run        encode and check into video/web/, upload nothing. Needs no credentials.
 *   --only <name>    one clip, by filename prefix: 2026-09-16-thompson-twins-02
 *   --force          publish again a clip that already has a url
 *   --poster-at <s>  take the poster at this second instead of a third of the way in
 *   --all            with no date: every clip not yet published
 *
 * @module scripts/media/publish-video
 */
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { config } from 'dotenv'
import { R2Host, hostConfigFromEnv } from '../syndication/host'
import { loadIndex, saveIndex, type MediaAsset } from './media-index'
import { findShow, loadConcerts, ShowNotFoundError } from './show'
import {
  CACHE_FOREVER,
  checkWebEncode,
  clipFilename,
  corsMissing,
  findPosterLeaks,
  findVideoLeaks,
  isFaststart,
  objectKeys,
  posterArgs,
  posterTime,
  selectClips,
  verifyHosted,
  versionedUrl,
  webEncodeArgs,
  type Probe,
} from './web-video'

config({ quiet: true })

/** Gitignored. The web copies are rebuilt from the renders on every run, never reused. */
const WEB_DIR = resolve('video/web')
const ENV_PREFIX = 'R2_MEDIA'

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}

interface WebCopy {
  file: string
  bytes: Buffer
  posterFile: string
  poster: Buffer
}

/** Encode, then prove the output is right from the output itself, not from ffmpeg's exit code. */
function encode(asset: MediaAsset, posterAt: number | undefined): WebCopy {
  const render = resolve(asset.path!)
  if (!existsSync(render)) {
    throw new Error(`render is missing at ${asset.path}. In a worktree, link video/renders from the main checkout.`)
  }
  const name = clipFilename(asset)
  const file = join(WEB_DIR, name)
  const posterFile = join(WEB_DIR, name.replace(/\.mp4$/, '.jpg'))
  execFileSync('ffmpeg', webEncodeArgs(render, file), { stdio: ['ignore', 'pipe', 'pipe'] })
  execFileSync('ffmpeg', posterArgs(file, posterFile, posterAt ?? posterTime(asset.duration)), {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {
      encoding: 'utf-8',
      maxBuffer: 16 * 1024 * 1024,
    })
  ) as Probe
  const bytes = readFileSync(file)
  const poster = readFileSync(posterFile)
  const problems = [
    ...checkWebEncode(probe),
    ...findVideoLeaks(bytes),
    ...findPosterLeaks(poster),
    ...(isFaststart(bytes) ? [] : ['moov is not ahead of mdat']),
    ...(poster.length > 0 ? [] : ['poster is empty']),
  ]
  if (problems.length > 0) throw new Error(problems.join('; '))
  return { file, bytes, posterFile, poster }
}

/** Upload, read back, and return the two URLs. Removes a fresh upload that fails its check. */
async function publish(host: R2Host, publicUrl: string, asset: MediaAsset, web: WebCopy) {
  const keys = objectKeys(clipFilename(asset))
  const url = versionedUrl(publicUrl, keys.video, sha256(web.bytes))
  const poster = versionedUrl(publicUrl, keys.poster, sha256(web.poster))

  // Poster first, so a clip is never live without one.
  await host.put(keys.poster, web.poster, 'image/jpeg', CACHE_FOREVER)
  await host.put(keys.video, web.bytes, 'video/mp4', CACHE_FOREVER)

  const problems = [
    ...(await verifyHosted({ url: poster, bytes: web.poster, contentType: 'image/jpeg' })),
    ...(await verifyHosted({ url, bytes: web.bytes, contentType: 'video/mp4' })),
  ]
  if (problems.length > 0) {
    // Personal video nobody can reach from the site should not sit in a public bucket. A clip
    // already live keeps its objects, because the index still points at them.
    if (!asset.url) await Promise.all([host.remove(keys.video), host.remove(keys.poster)])
    throw new Error(`read-back failed: ${problems.join('; ')}`)
  }
  return { url, poster }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const all = args.includes('--all')
  const only = option(args, '--only')
  const posterRaw = option(args, '--poster-at')
  const posterAt = posterRaw === undefined ? undefined : Number(posterRaw)
  if (posterAt !== undefined && !(posterAt >= 0)) fail(`--poster-at needs a number of seconds, got ${posterRaw}`)
  if (posterAt !== undefined && !only) fail('--poster-at is for one clip. Name it with --only.')

  if (date) {
    try {
      findShow(loadConcerts(), date)
    } catch (err) {
      if (err instanceof ShowNotFoundError) fail(err.message)
      throw err
    }
  }

  const index = loadIndex()
  const { ready, held } = selectClips(index.assets, { date, only, force })

  for (const { asset, reason } of held) {
    if (reason !== 'already published') console.log(`  ⚠ ${clipFilename(asset) || asset.date}: ${reason}`)
  }
  if (ready.length === 0) {
    console.log(`\nNothing to publish${date ? ` for ${date}` : ''}.\n`)
    return
  }

  // A date or a named clip is a decision. A bare run is not, and every upload here goes public.
  if (!date && !only && !all && !dryRun) {
    console.log(`\n${ready.length} clip(s) not yet published:\n`)
    for (const asset of ready) console.log(`  ${clipFilename(asset)}`)
    console.log(`\nName a show or a clip to publish it. --all publishes every one of these.\n`)
    return
  }

  const hostConfig = hostConfigFromEnv(process.env, ENV_PREFIX)
  if (!dryRun && !hostConfig) {
    const names = ['ACCOUNT_ID', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'BUCKET', 'PUBLIC_URL']
    fail(`Missing from .env: ${names.map((n) => `${ENV_PREFIX}_${n}`).join(', ')}.\n  See docs/SECRETS.md.`)
  }
  const host = hostConfig ? new R2Host(hostConfig) : undefined

  mkdirSync(WEB_DIR, { recursive: true })
  console.log(`\n${dryRun ? 'Dry run: ' : ''}${ready.length} clip(s)\n`)

  let failed = 0
  let total = 0
  let corsChecked = false
  for (const asset of ready) {
    const name = clipFilename(asset)
    try {
      const web = encode(asset, posterAt)
      total += web.bytes.length
      console.log(`  ${name}: ${mb(asset.bytes)} → ${mb(web.bytes.length)}, poster ${(web.poster.length / 1e3).toFixed(0)} KB`)
      if (dryRun || !host) continue

      const live = await publish(host, hostConfig!.publicUrl, asset, web)
      if (!corsChecked && (await corsMissing(live.url))) {
        console.log(`  ⚠ no CORS policy on the bucket. Playback works, but see docs/SECRETS.md.`)
      }
      corsChecked = true
      asset.url = live.url
      asset.poster = live.poster
      // The first upload stands. A re-encode with --force is not a new video to a search engine.
      asset.uploadedAt ??= new Date().toISOString()
      // Saved per clip, so a failure later in the run keeps what has already been proven live.
      index.generated = new Date().toISOString()
      saveIndex(index)
      console.log(`    ${live.url}`)
    } catch (err) {
      failed++
      console.log(`  ✖ ${name}: ${(err as Error).message.split('\n')[0]}`)
    }
  }

  console.log(`\n  ${ready.length - failed} of ${ready.length} done, ${mb(total)} in all.`)
  if (dryRun) console.log(`  Files are in video/web/. Nothing was uploaded and the index is unchanged.`)
  else console.log(`  These URLs are public now. Commit media-index.json so the site can show them.`)
  console.log('')
  if (failed > 0) process.exit(1)
}

main().catch((err) => fail((err as Error).message))
