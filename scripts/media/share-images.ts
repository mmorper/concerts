/**
 * `npm run media:share [date]` — one share image per published still and video.
 *
 * What a social post shows when someone shares a link to that photo or clip.
 * `workers/meta-injector/worker.js` points `og:image` at the file, and a preview often travels
 * with nothing else, so the credits have to be in the image.
 *
 * It is the social card's wide layout, drawn by the same template, so the two cannot drift: the
 * photograph in a 630 square with the byline inside it, and the type beside it. There is no hook
 * because a photo has no story of its own, and no pill because colour on a card means the post's
 * category. The display line says who, as an On This Day card does.
 *
 * A VIDEO GETS THE SAME CARD, from its poster with a play mark. The name is the clip's id,
 * `<date>-<act>-NN-video.jpg`, which is what the Worker looks up. The poster is letterboxed, never
 * cropped: a clip has no box, and where a crop sits decides whether the performer is in frame,
 * which is the owner's call. The fill behind it is the same frame, blurred and dimmed. There is
 * no `og:video`: a Bluesky link card holds one image and Mastodon ignores the tag, so the card is
 * the preview rather than a stand-in for a player.
 *
 * COMMITTED, like the rest of `public/og/`. Rendering needs Chromium and Google Fonts, which have
 * no place in a Pages build, so it runs on the owner's Mac. `media:crop` does it on the way out,
 * for every still whose box changed or that has no image, so nobody has to remember.
 * `test/pipeline/share-images.test.ts` fails if a published still or video has no image.
 *
 * This command is for what `media:crop` cannot see: a newly published video, a change to the
 * template, or a bad render.
 *
 *   npm run media:share                every still and published video
 *   npm run media:share 2026-09-16     one show
 *
 * An asset that cannot be rendered is reported and the command exits 1. Its link previews as the
 * show until it is fixed, which is the Worker's fallback rather than a failure anyone sees.
 *
 * @module scripts/media/share-images
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { basename, join, resolve } from 'path'
import sharp from 'sharp'
import type { Browser } from 'puppeteer'
import { launchBrowser } from '../utils/launch-browser'
import { encodeUnder, escapeHtml, FORMATS, monthYear, WIDE_HEIGHT, WIDE_SLOT, WIDE_WIDTH } from '../syndication/render-card'
import { derivationFor, deriveRect } from './derive'

const INDEX = resolve('public/data/media-index.json')
const CONCERTS = resolve('public/data/concerts.json')
const PUBLIC = resolve('public')
const OUT = resolve('public/og/shows')
/** Where `media:publish-video` leaves its local copies. Gitignored. */
const WEB_VIDEO = resolve('video/web')

/** The play mark, in the middle of the slot. White on a dark disc, to read over any frame. */
const PLAY_MARK = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="132" viewBox="0 0 132 132">
    <circle cx="66" cy="66" r="64" fill="rgba(8,10,16,0.62)" stroke="rgba(255,255,255,0.9)" stroke-width="4"/>
    <path d="M52 40 L98 66 L52 92 Z" fill="#fff"/>
  </svg>`
)

export interface ShareAsset {
  kind: string
  url: string | null
  /** The frame shown before a video plays. Video only. */
  poster?: string | null
  date: string
  artist: string | null
  subject: string
  crop?: { x: number; y: number; w: number; h: number } | null
}

interface Concert {
  date: string
  venue: string
  cityState?: string
  city: string
}

type Asset = ShareAsset

/** "Mike Morper · 16 September 2026". One state, the capture date, as on the cards. */
export function shareByline(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `Mike Morper · ${day}`
}

/**
 * The two lines of type. The act leads, and a frame with no act is about the room, so the venue
 * takes the display line and is not repeated beneath it.
 */
export function shareCredits(asset: Pick<Asset, 'artist' | 'subject' | 'date'>, concert: Concert) {
  const place = concert.cityState ?? concert.city
  const month = monthYear(asset.date)
  return asset.subject === 'artist' && asset.artist
    ? { display: asset.artist, meta: `${escapeHtml(concert.venue)} &middot; ${escapeHtml(place)}<br>${month}` }
    : { display: concert.venue, meta: `${escapeHtml(place)}<br>${month}` }
}

/**
 * What a published asset's share image is called. A video carries the same `-video` suffix as
 * `mediaId`, because the link names the clip and the Worker builds this name from the link.
 */
export function shareFile(asset: Pick<Asset, 'kind' | 'url'>): string {
  const file = basename(asset.url as string).split('?')[0]
  return asset.kind === 'video' ? file.replace(/\.[^.]+$/, '-video.jpg') : file
}

/** Which assets get a share image: anything published. A video with no `url` is not. */
export function shareTargets(assets: Asset[], only?: string): Asset[] {
  return assets.filter((a) => (a.kind === 'image' || a.kind === 'video') && a.url && (!only || a.date === only))
}

/** The still in the card's square, framed by the owner's box. */
async function stillSlot(asset: Asset): Promise<Buffer> {
  if (!asset.crop) throw new Error('no crop box — run `npm run media:crop`')
  const source = join(PUBLIC, asset.url as string)
  if (!existsSync(source)) throw new Error('master is missing')

  const { width = 0, height = 0 } = await sharp(source).metadata()
  const rect = deriveRect(asset.crop, { width, height }, FORMATS.wide.slotAspect, derivationFor(1))
  return sharp(source)
    .extract(rect)
    .resize(WIDE_SLOT, WIDE_SLOT, { fit: 'fill' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

/** The local poster when this checkout has one, because it needs no network; otherwise the live one. */
async function posterBytes(asset: Asset): Promise<Buffer> {
  if (!asset.poster) throw new Error('no poster — run `npm run media:publish-video`')
  const local = join(WEB_VIDEO, basename(asset.url as string).split('?')[0].replace(/\.[^.]+$/, '.jpg'))
  if (existsSync(local)) return readFileSync(local)
  const response = await fetch(asset.poster)
  if (!response.ok) throw new Error(`poster answered ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/** The whole frame in the card's square, over a blurred copy of itself, with the play mark. */
async function clipSlot(asset: Asset): Promise<Buffer> {
  const poster = await posterBytes(asset)
  const fill = await sharp(poster)
    .resize(WIDE_SLOT, WIDE_SLOT, { fit: 'cover' })
    .blur(36)
    .modulate({ brightness: 0.42 })
    .toBuffer()
  const frame = await sharp(poster).resize(WIDE_SLOT, WIDE_SLOT, { fit: 'inside' }).toBuffer()
  return sharp(fill)
    .composite([{ input: frame }, { input: PLAY_MARK }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function render(browser: Browser, asset: Asset, concert: Concert, target: string): Promise<void> {
  const format = FORMATS.wide
  const photo = await (asset.kind === 'video' ? clipSlot(asset) : stillSlot(asset))

  const { display, meta } = shareCredits(asset, concert)
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: WIDE_WIDTH, height: WIDE_HEIGHT, deviceScaleFactor: 1 })
    await page.setContent(
      format.template({
        imageDataUri: `data:image/jpeg;base64,${photo.toString('base64')}`,
        alt: display,
        byline: shareByline(asset.date),
        acts: '',
        hook: display,
        hookSize: format.hookSizes[0],
        meta,
        pill: '',
      }),
      { waitUntil: 'load' }
    )
    await page.evaluate(() => document.fonts.ready)

    // Step down until the name clears the top of the card. Only a very long name ever does.
    for (const size of format.hookSizes) {
      const fits = await page.evaluate((px: number) => {
        const hook = document.getElementById('hook') as HTMLElement
        hook.style.fontSize = `${px}px`
        return hook.getBoundingClientRect().top >= 32
      }, size)
      if (fits) break
    }

    const shot = await page.screenshot({ type: 'png' })
    const { buffer } = await encodeUnder(Buffer.from(shot), format.maxBytes)
    writeFileSync(target, buffer)
  } finally {
    await page.close()
  }
}

/**
 * Which stills need a new share image after a crop session: the box changed, or there is no image
 * yet. A still with no box is left out, because the card refuses to guess at one.
 *
 * @param before crop box by url, as it stood when the session began
 */
export function staleShareImages(
  assets: ShareAsset[],
  before: Map<string, ShareAsset['crop']>,
  hasImage: (file: string) => boolean
): ShareAsset[] {
  return assets.filter((a) => {
    if (a.kind !== 'image' || !a.url || !a.crop) return false
    const moved = JSON.stringify(before.get(a.url) ?? null) !== JSON.stringify(a.crop)
    return moved || !hasImage(basename(a.url))
  })
}

/** Render these assets. Returns what could not be made, one line each. */
export async function renderShareImages(targets: ShareAsset[]): Promise<{ made: number; failed: string[] }> {
  const data = JSON.parse(readFileSync(CONCERTS, 'utf-8')) as { concerts: Concert[] }
  mkdirSync(OUT, { recursive: true })
  const browser = await launchBrowser()
  let made = 0
  const failed: string[] = []
  try {
    for (const asset of targets) {
      try {
        const concert = data.concerts.find((c) => c.date === asset.date)
        if (!concert) throw new Error('no concert on that date')
        await render(browser, asset, concert, join(OUT, shareFile(asset)))
        made++
      } catch (err) {
        failed.push(`${asset.url}: ${(err as Error).message}`)
      }
    }
  } finally {
    await browser.close()
  }
  return { made, failed }
}

/**
 * What `media:crop` calls while it runs: bring the share images up to the index, and remember
 * what was tried in `known` so a still that will not render is reported once rather than forever.
 */
export async function refreshShareImages(known: Map<string, ShareAsset['crop']>): Promise<void> {
  const { assets } = JSON.parse(readFileSync(INDEX, 'utf-8')) as { assets: ShareAsset[] }
  const stale = staleShareImages(assets, known, (file) => tried.has(file) || existsSync(join(OUT, file)))
  if (stale.length === 0) return
  for (const a of stale) {
    known.set(a.url as string, a.crop)
    tried.add(basename(a.url as string))
  }
  const { made, failed } = await renderShareImages(stale)
  console.log(`  share image${made === 1 ? '' : 's'} updated: ${made} — commit with the crops`)
  for (const line of failed) console.error(`  ✖ ${line}
    Re-run with: npm run media:share`)
}

/** Stills already attempted this session, so a failure is not retried every poll. */
const tried = new Set<string>()

async function main(): Promise<void> {
  const only = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const { assets } = JSON.parse(readFileSync(INDEX, 'utf-8')) as { assets: Asset[] }
  const targets = shareTargets(assets, only)
  if (only && targets.length === 0) {
    console.error(`\n✖ Nothing published for ${only}.\n`)
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })
  // A full run removes images whose asset has gone, or a stale file would keep answering links.
  if (!only) {
    const wanted = new Set(targets.map(shareFile))
    for (const file of readdirSync(OUT)) if (!wanted.has(file)) rmSync(join(OUT, file))
  }

  const { made, failed } = await renderShareImages(targets)

  console.log(`\nshare images: ${made} of ${targets.length} written to public/og/shows/`)
  for (const line of failed) console.error(`  ✖ ${line}`)
  if (failed.length > 0) process.exit(1)
}

if (process.argv[1] && /share-images\.ts$/.test(process.argv[1])) void main()
