/**
 * `npm run media:crop [YYYY-MM-DD]` — set the crop box on already-published stills.
 *
 * WHY NOT `media:review`. Re-opening the review page to add a crop costs a full Photos read
 * and a permission prompt per show, surfaces every rejected asset beside the kept ones, and
 * crops a Photos PREVIEW rather than the published JPEG the renderer will crop. Those are
 * different files; a box drawn on one does not reliably transfer.
 *
 * This reads `media-index.json` and serves the committed files from `public/images/shows/`.
 * No library access, no prompt, and the pixels on screen are the pixels that get cropped.
 *
 * It is also the tool for changing your mind later. A crop is not a one-time judgement made
 * during culling — it is a framing decision that can be revisited without re-culling
 * anything, which is exactly the case that prompted it: 34 stills were published before the
 * crop tool existed.
 *
 * Usage:
 *   npm run media:crop                 every published still, newest show first
 *   npm run media:crop 2026-06-04      one show
 *
 * @module scripts/media/crop
 */
import { execFileSync, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const INDEX = resolve('public/data/media-index.json')
const SERVER = resolve('scripts/media/crop_server.py')
const PORT = Number(process.env.MEDIA_CROP_PORT ?? 8788)

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

/** Who holds the port, and what they are serving — same refusal as media:review (#405). */
function portHolder(port: number): string | null {
  try {
    const pid = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim().split('\n')[0]
    return pid || null
  } catch {
    return null
  }
}

function main(): void {
  const date = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  if (!existsSync(INDEX)) fail(`No media-index.json. Ingest a show first.`)

  const index = JSON.parse(readFileSync(INDEX, 'utf-8')) as {
    assets: Array<{ kind: string; url?: string | null; date: string; crop?: unknown }>
  }
  const stills = index.assets.filter(
    (a) => a.kind === 'image' && a.url && (!date || a.date === date)
  )
  if (stills.length === 0) {
    fail(date ? `No published stills for ${date}.` : 'No published stills yet.')
  }

  const held = portHolder(PORT)
  if (held) {
    fail(
      `Port ${PORT} is already in use by pid ${held}.\n\n` +
        `  Stop it, then re-run:\n      kill ${held}\n\n` +
        `  Or serve elsewhere:\n      MEDIA_CROP_PORT=8789 npm run media:crop${date ? ` ${date}` : ''}`
    )
  }

  const done = stills.filter((a) => a.crop).length
  console.log(`\n✂️  ${stills.length} published still${stills.length === 1 ? '' : 's'}` +
    `${date ? ` from ${date}` : ' across every show'} — ${done} already cropped\n`)
  console.log(`  No Photos access: these are the committed files under public/images/shows/.`)
  console.log(`  Boxes are saved the moment you press enter — to media-index.json AND to`)
  console.log(`  data/media-decisions.json, so a re-derivation never loses them.\n`)

  const server = spawn('python3', [SERVER], {
    stdio: 'inherit',
    env: { ...process.env, MEDIA_CROP_DATE: date ?? '', MEDIA_CROP_PORT: String(PORT) },
  })
  server.on('exit', (code) => {
    if (code) fail(`The crop server exited with code ${code}.`)
  })

  console.log(`  → http://127.0.0.1:${PORT}/`)
  console.log(`\n  ← → move · drag the box · [ ] resize · enter save · 0 default · x clear`)
  console.log(`  Ctrl-C when you are done.\n`)
}

if (process.argv[1] && /media\/crop\.ts$/.test(process.argv[1])) main()
