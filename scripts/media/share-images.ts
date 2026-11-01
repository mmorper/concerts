/**
 * One share image per published still: what a social post shows when someone shares a link to
 * that photo. `workers/meta-injector/worker.js` points `og:image` here.
 *
 * Every channel crops a preview to about 1.91:1, and almost every still is a portrait 4:5. Cropped
 * to fill, a stage shot keeps a band across the chest. So the whole crop sits centred at full
 * height, over a dark blur of itself, and nothing the owner framed is lost.
 *
 * BUILT, NOT COMMITTED. A box redrawn in `media:crop` must reach the image with no extra step, and
 * 15MB of derivatives have no business in a history that never forgets a byte. A file that cannot
 * be made is reported and skipped: the Worker then previews that link as the show.
 *
 * Masters are already stripped, and sharp writes no metadata unless asked to.
 *
 * @module scripts/media/share-images
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { basename, join, resolve } from 'path'
import sharp from 'sharp'

const INDEX = resolve('public/data/media-index.json')
const PUBLIC = resolve('public')
const OUT = resolve('public/og/shows')

const WIDTH = 1200
const HEIGHT = 630

interface CropBox {
  x: number
  y: number
  w: number
  h: number
}

interface Asset {
  kind: string
  url: string | null
  crop?: CropBox | null
}

/** The owner's crop in pixels, kept inside the image. No crop means the whole frame. */
export function cropRegion(
  crop: CropBox | null | undefined,
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const left = Math.min(Math.max(Math.round(c.x * width), 0), width - 1)
  const top = Math.min(Math.max(Math.round(c.y * height), 0), height - 1)
  return {
    left,
    top,
    width: Math.max(Math.min(Math.round(c.w * width), width - left), 1),
    height: Math.max(Math.min(Math.round(c.h * height), height - top), 1),
  }
}

async function render(source: string, crop: CropBox | null | undefined, target: string): Promise<void> {
  const { width = 0, height = 0 } = await sharp(source).metadata()
  const photo = await sharp(source)
    .extract(cropRegion(crop, width, height))
    .resize(WIDTH, HEIGHT, { fit: 'inside' })
    .toBuffer()
  await sharp(source)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .blur(40)
    .modulate({ brightness: 0.4 })
    .composite([{ input: photo, gravity: 'center' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(target)
}

async function main(): Promise<void> {
  const { assets } = JSON.parse(readFileSync(INDEX, 'utf-8')) as { assets: Asset[] }
  const stills = assets.filter((a) => a.kind === 'image' && a.url)

  // Rebuilt from nothing each time, so a removed still cannot leave a share image behind.
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  let made = 0
  const skipped: string[] = []
  for (const asset of stills) {
    const source = join(PUBLIC, asset.url as string)
    try {
      if (!existsSync(source)) throw new Error('master is missing')
      await render(source, asset.crop, join(OUT, basename(asset.url as string)))
      made++
    } catch (err) {
      skipped.push(`${asset.url}: ${(err as Error).message}`)
    }
  }

  console.log(`share images: ${made} of ${stills.length} written to public/og/shows/`)
  for (const line of skipped) console.warn(`  skipped ${line}`)
}

if (process.argv[1] && /share-images\.ts$/.test(process.argv[1])) void main()
