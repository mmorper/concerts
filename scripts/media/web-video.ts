/**
 * The web copy of a clip: what `media:publish-video` encodes, and the checks it must pass.
 *
 * A RENDER IS NOT A WEB FILE. `video/renders/` holds channel-sized masters, and 16 of the 18
 * there are 10-bit H.264 High 10 in HLG, as the iPhone shot them. That played in Chromium 152
 * and AVFoundation on the owner's Mac (2026-11-01), but no phone has been tried, and how a
 * browser shows HLG on an SDR screen is up to that browser. 8-bit SDR High takes the question
 * away. Renders also keep `moov` at the END of the file, which cost three requests to start
 * playing where the web copy needs one, and they are about four times the size.
 *
 * Tone mapping is `scale` with `flags=unstable`, because Homebrew's ffmpeg has no `zscale` and
 * so no `zscale,tonemap`. `intent=perceptual` won by eye on three shows: a plain `format=yuv420p`
 * leaves a grey haze, and `relative_colorimetric` burns out hair and stage lights. A clip that
 * is already SDR passes through unchanged.
 *
 * Everything here is pure, or takes its `fetch` as an argument, so it can be tested without
 * ffmpeg or a bucket.
 *
 * @module scripts/media/web-video
 */
import { findMetadataLeaks } from './exif'
import type { MediaAsset } from './media-index'

/** Short edge, aspect preserved. The panel is 460px; 720 leaves room for a 2x screen. */
export const WEB_SHORT_EDGE = 720
export const WEB_CRF = 26

/**
 * A year, immutable, because the URL changes when the bytes do (`versionedUrl`). A browser
 * seeks a video with range requests, and this is what lets the CDN answer them from cache.
 */
export const CACHE_FOREVER = 'public, max-age=31536000, immutable'

/** Sent on the range check, so a missing CORS policy shows up before a browser finds it. */
const SITE_ORIGIN = 'https://concerts.morperhaus.org'

/** ffmpeg arguments that turn a render into its web copy. Portrait stays portrait. */
export function webEncodeArgs(src: string, out: string): string[] {
  const size = `'if(gt(iw,ih),-2,${WEB_SHORT_EDGE})':'if(gt(iw,ih),${WEB_SHORT_EDGE},-2)'`
  const color = 'out_color_matrix=bt709:out_primaries=bt709:out_transfer=bt709:out_range=tv:intent=perceptual'
  return [
    '-loglevel', 'error', '-y', '-i', src,
    '-map', '0:v:0', '-map', '0:a:0?',
    // Nothing from the source container survives, and +bitexact keeps the bytes repeatable,
    // so re-encoding an unchanged render gives the same URL.
    '-map_metadata', '-1', '-map_chapters', '-1',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact',
    '-vf', `scale=${size}:flags=lanczos+unstable:${color},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(WEB_CRF),
    '-profile:v', 'high', '-level:v', '4.0',
    // A keyframe every two seconds or so, so a seek lands close to where it was aimed.
    '-g', '60',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart',
    out,
  ]
}

/** A third of the way in, past the camera settling. `--poster-at` overrides it. */
export function posterTime(duration: number | null | undefined): number {
  return duration && duration > 0 ? Math.round((duration / 3) * 10) / 10 : 0
}

/** Cut from the WEB copy, so the poster matches the first frame of play in colour and size. */
export function posterArgs(webFile: string, out: string, at: number): string[] {
  return [
    '-loglevel', 'error', '-y', '-ss', String(at), '-i', webFile,
    '-frames:v', '1', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact',
    '-q:v', '3', out,
  ]
}

interface Atom {
  type: string
  start: number
  end: number
}

/** The top-level boxes of an MP4, read directly rather than through ffmpeg. */
export function topLevelAtoms(bytes: Buffer): Atom[] {
  const atoms: Atom[] = []
  let at = 0
  while (at + 8 <= bytes.length) {
    const small = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    // 1 means a 64-bit size follows the type; 0 means "to the end of the file".
    const size = small === 1 ? Number(bytes.readBigUInt64BE(at + 8)) : small === 0 ? bytes.length - at : small
    if (size < 8 || at + size > bytes.length) break
    atoms.push({ type, start: at, end: at + size })
    at += size
  }
  return atoms
}

/** True when a browser can start playing from the first bytes it receives. */
export function isFaststart(bytes: Buffer): boolean {
  const atoms = topLevelAtoms(bytes)
  const moov = atoms.findIndex((a) => a.type === 'moov')
  const mdat = atoms.findIndex((a) => a.type === 'mdat')
  return moov !== -1 && mdat !== -1 && moov < mdat
}

const VIDEO_LEAK_MARKERS: Array<{ label: string; bytes: Buffer }> = [
  { label: 'QuickTime metadata', bytes: Buffer.from('com.apple.quicktime', 'latin1') },
  { label: 'a GPS location', bytes: Buffer.from([0xa9, 0x78, 0x79, 0x7a]) }, // ©xyz
  { label: 'a location string', bytes: Buffer.from('ISO6709', 'latin1') },
  { label: 'a device make', bytes: Buffer.from([0xa9, 0x6d, 0x61, 0x6b]) }, // ©mak
  { label: 'a device model', bytes: Buffer.from([0xa9, 0x6d, 0x6f, 0x64]) }, // ©mod
]

/**
 * Container metadata that must not go public. Empty means clean.
 *
 * Scans every box except `mdat`. The media itself is 20MB of compressed noise, where a
 * four-byte marker turns up by chance often enough to block a clean clip.
 */
export function findVideoLeaks(bytes: Buffer): string[] {
  const boxes = topLevelAtoms(bytes).filter((a) => a.type !== 'mdat')
  if (boxes.length === 0) return ['no readable MP4 boxes']
  const header = Buffer.concat(boxes.map((a) => bytes.subarray(a.start, a.end)))
  return VIDEO_LEAK_MARKERS.filter((m) => header.includes(m.bytes)).map((m) => `the file contains ${m.label}`)
}

/** The raw byte check the stills use, for a poster. It never passes through sharp. */
export const findPosterLeaks = (bytes: Buffer): string[] => findMetadataLeaks(bytes, {})

/** The parts of `ffprobe -show_streams -show_format -of json` these checks read. */
export interface Probe {
  streams: Array<{
    codec_type?: string
    codec_name?: string
    profile?: string
    pix_fmt?: string
    color_transfer?: string
    width?: number
    height?: number
    tags?: Record<string, string>
  }>
  format: { tags?: Record<string, string> }
}

/** An allowlist, so a tag nobody thought of fails rather than publishes. */
const SAFE_TAGS = new Set(['major_brand', 'minor_version', 'compatible_brands', 'language', 'handler_name', 'vendor_id', 'encoder'])
const GENERIC_HANDLERS = /^(VideoHandler|SoundHandler)$/

/** Why this encode must not go on the site. Empty means it may. */
export function checkWebEncode(probe: Probe): string[] {
  const problems: string[] = []
  const video = probe.streams.find((s) => s.codec_type === 'video')
  if (!video) return ['no video stream']

  if (video.codec_name !== 'h264') problems.push(`codec is ${video.codec_name}, not h264`)
  if (video.profile !== 'High') problems.push(`profile is ${video.profile}, which browsers may not decode`)
  if (video.pix_fmt !== 'yuv420p') problems.push(`pixel format is ${video.pix_fmt}, not 8-bit yuv420p`)
  if (video.color_transfer !== 'bt709') problems.push(`transfer is ${video.color_transfer}, not SDR bt709`)
  if (Math.min(video.width ?? 0, video.height ?? 0) !== WEB_SHORT_EDGE) {
    problems.push(`short edge is not ${WEB_SHORT_EDGE}: ${video.width}x${video.height}`)
  }

  const audio = probe.streams.find((s) => s.codec_type === 'audio')
  if (audio && audio.codec_name !== 'aac') problems.push(`audio is ${audio.codec_name}, not aac`)

  for (const tags of [probe.format.tags, ...probe.streams.map((s) => s.tags)]) {
    for (const [name, value] of Object.entries(tags ?? {})) {
      if (!SAFE_TAGS.has(name)) problems.push(`unexpected metadata tag: ${name}`)
      else if (name === 'handler_name' && !GENERIC_HANDLERS.test(value)) problems.push(`handler_name is "${value}"`)
    }
  }
  return problems
}

/** Where a clip and its poster sit in the bucket. Named as in the index, so a key reads back. */
export function objectKeys(filename: string): { video: string; poster: string } {
  return { video: `videos/${filename}`, poster: `posters/${filename.replace(/\.mp4$/, '.jpg')}` }
}

/**
 * The public address of a stored object.
 *
 * The version is on the query string, NOT the filename: `mediaId` builds share links from the
 * filename, so a re-encode must not change it. It still busts the cache, because the query
 * string is part of Cloudflare's cache key, and R2 ignores it.
 */
export function versionedUrl(publicUrl: string, key: string, sha256: string): string {
  return `${publicUrl}/${key}?v=${sha256.slice(0, 12)}`
}

export interface ClipSelection {
  ready: MediaAsset[]
  held: Array<{ asset: MediaAsset; reason: string }>
}

/** The filename a video goes by everywhere: the last part of its render path. */
export const clipFilename = (asset: Pick<MediaAsset, 'path'>): string => asset.path?.split('/').pop() ?? ''

/** Which videos a run covers, and why any of the rest were left out. */
export function selectClips(
  assets: MediaAsset[],
  opts: { date?: string; only?: string; force?: boolean }
): ClipSelection {
  const out: ClipSelection = { ready: [], held: [] }
  for (const asset of assets) {
    if (asset.kind !== 'video') continue
    if (opts.date && asset.date !== opts.date) continue
    if (opts.only && !clipFilename(asset).startsWith(opts.only)) continue
    if (!asset.path) out.held.push({ asset, reason: 'no render path in the index' })
    // Never default to the headliner. A clip with no act named has no place in a gatefold.
    else if (asset.subject === 'artist' && !asset.artistNormalized) out.held.push({ asset, reason: 'no act credited' })
    else if (asset.url && !opts.force) out.held.push({ asset, reason: 'already published' })
    else out.ready.push(asset)
  }
  return out
}

type Fetch = typeof fetch

interface HostedFile {
  url: string
  bytes: Buffer
  contentType: string
}

/** One attempt at reading a hosted file back. Returns what is wrong, empty when nothing is. */
async function readBack(file: HostedFile, fetchImpl: Fetch): Promise<string[]> {
  const { url, bytes, contentType } = file
  const problems: string[] = []
  const head = await fetchImpl(url, { method: 'HEAD' })
  if (head.status !== 200) return [`HEAD returned ${head.status}`]
  if (head.headers.get('content-type') !== contentType) {
    problems.push(`content-type is ${head.headers.get('content-type')}`)
  }
  if (head.headers.get('content-length') !== String(bytes.length)) {
    problems.push(`content-length is ${head.headers.get('content-length')}, expected ${bytes.length}`)
  }
  if (!head.headers.get('cache-control')?.includes('immutable')) {
    problems.push(`cache-control is ${head.headers.get('cache-control')}`)
  }

  // The start of the file is what a player reads first, and the end is where a seek goes. Both
  // are compared to the local bytes, because a 206 with the wrong content is still a 206.
  const size = Math.min(1024, bytes.length)
  for (const [start, end] of [[0, size - 1], [bytes.length - size, bytes.length - 1]]) {
    const res = await fetchImpl(url, { headers: { Range: `bytes=${start}-${end}` } })
    const body = Buffer.from(await res.arrayBuffer())
    if (res.status !== 206) problems.push(`range ${start}-${end} returned ${res.status}`)
    else if (res.headers.get('content-range') !== `bytes ${start}-${end}/${bytes.length}`) {
      problems.push(`content-range is ${res.headers.get('content-range')}`)
    } else if (!body.equals(bytes.subarray(start, end + 1))) problems.push(`range ${start}-${end} has the wrong bytes`)
  }
  return problems
}

/**
 * Prove a file is live by fetching it back through the public URL, range requests included.
 *
 * Retries because the first read of a new object can reach the CDN before it settles, and a
 * cold miss is not a failure. An upload that returned 200 proves only that R2 stored it.
 */
export async function verifyHosted(
  file: HostedFile,
  fetchImpl: Fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  attempts = 3
): Promise<string[]> {
  let problems: string[] = []
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(3000)
    try {
      problems = await readBack(file, fetchImpl)
    } catch (err) {
      problems = [(err as Error).message]
    }
    if (problems.length === 0) return []
  }
  return problems
}

/**
 * A warning rather than a failure. A plain `<video src>` loads without CORS. The policy is only
 * needed for a future `crossorigin` use, but it is cheap to set now and needs a cache purge later.
 */
export async function corsMissing(url: string, fetchImpl: Fetch = fetch): Promise<boolean> {
  const res = await fetchImpl(url, { headers: { Origin: SITE_ORIGIN, Range: 'bytes=0-0' } })
  return !res.headers.get('access-control-allow-origin')
}
