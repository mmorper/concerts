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
  const args = process.argv.slice(2)
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  /* 🔴 AN ARTIST SLUG IS A SCOPE TOO, AND IT IS THE ONE A SIGNATURE NEEDS.
     A signature is the best frame of an act across EVERY show, so it cannot be judged from
     one night's strip — you have to see every frame of that act at once. A date filter
     cannot express that, and marking `B` in the review page shows you one show by
     construction. This is the view where the comparison is actually possible. */
  const artist = args.find((a) => !a.startsWith('-') && !/^\d{4}-\d{2}-\d{2}$/.test(a))
  if (!existsSync(INDEX)) fail(`No media-index.json. Ingest a show first.`)

  const index = JSON.parse(readFileSync(INDEX, 'utf-8')) as {
    assets: Array<{
      kind: string; url?: string | null; date: string; crop?: unknown
      artistNormalized?: string | null; artist?: string | null; signature?: boolean
    }>
  }
  const published = index.assets.filter((a) => a.kind === 'image' && a.url)

  if (args.includes('--artists') || (artist && !published.some((a) => a.artistNormalized === artist))) {
    /* Discovery. Nobody can type a slug they have never seen, and the acts worth opening are
       the ones photographed MORE THAN ONCE — those are the only ones with a choice to make. */
    const byAct = new Map<string, Set<string>>()
    for (const a of published) {
      if (!a.artistNormalized) continue
      byAct.set(a.artistNormalized, (byAct.get(a.artistNormalized) ?? new Set()).add(a.date))
    }
    if (artist) console.error(`\n  No published stills for "${artist}".`)
    console.log(`\n  Acts with published photography — ${'shows'.padStart(6)}  ${'signature'.padStart(9)}`)
    for (const [act, dates] of [...byAct].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]))) {
      const many = dates.size > 1
      const sig = published.some((a) => a.artistNormalized === act && a.signature)
      console.log(
        `    ${act.padEnd(30)} ${String(dates.size).padStart(6)}  ${(sig ? 'set' : many ? 'NOT SET' : '—').padStart(9)}` +
          (many && !sig ? '   ← a choice to make' : '')
      )
    }
    console.log(`\n  npm run media:crop <artist-slug>\n`)
    process.exit(artist ? 1 : 0)
  }

  const stills = published.filter(
    (a) => (!date || a.date === date) && (!artist || a.artistNormalized === artist)
  )
  if (stills.length === 0) {
    fail(date ? `No published stills for ${date}.` : 'No published stills yet.')
  }

  const held = portHolder(PORT)
  if (held) {
    fail(
      `Port ${PORT} is already in use by pid ${held}.\n\n` +
        `  Stop it, then re-run:\n      kill ${held}\n\n` +
        `  Or serve elsewhere:\n      MEDIA_CROP_PORT=8789 npm run media:crop${date ? ` ${date}` : artist ? ` ${artist}` : ''}`
    )
  }

  const done = stills.filter((a) => a.crop).length
  const shows = new Set(stills.map((a) => a.date)).size
  const scope = artist
    ? ` of ${stills[0]?.artist ?? artist} across ${shows} show${shows === 1 ? '' : 's'}`
    : date
      ? ` from ${date}`
      : ' across every show'
  console.log(`\n✂️  ${stills.length} published still${stills.length === 1 ? '' : 's'}${scope}` +
    ` — ${done} already cropped\n`)
  if (artist && shows > 1) {
    console.log(`  Every show at once, newest first — this is the view a signature needs.`)
    console.log(`  Press ${'B'} on the best frame of the act overall.\n`)
  }
  console.log(`  No Photos access: these are the committed files under public/images/shows/.`)
  console.log(`  Boxes are saved the moment you press enter — to media-index.json AND to`)
  console.log(`  data/media-decisions.json, so a re-derivation never loses them.\n`)

  const server = spawn('python3', [SERVER], {
    stdio: 'inherit',
    env: {
      ...process.env,
      MEDIA_CROP_DATE: date ?? '',
      MEDIA_CROP_ARTIST: artist ?? '',
      MEDIA_CROP_PORT: String(PORT),
    },
  })
  server.on('exit', (code) => {
    if (code) fail(`The crop server exited with code ${code}.`)
  })

  console.log(`  → http://127.0.0.1:${PORT}/`)
  console.log(`\n  ← → move · drag the box · [ ] resize · enter save · 0 default · x clear`)
  console.log(`  Ctrl-C when you are done.\n`)
}

if (process.argv[1] && /media\/crop\.ts$/.test(process.argv[1])) main()
