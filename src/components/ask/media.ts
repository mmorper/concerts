// Media for Ask the Archive's exhibit cards (#593): which picture a card shows, how it is framed,
// and what its caption is allowed to claim. Pure functions only — the cards and their fallbacks
// live in AskMedia.tsx, and everything here is unit-tested in media.test.ts.
//
// THE LADDER (.claude/skills/media-pipeline/SKILL.md, "The imagery rubric"):
//   1. personal — my photographs, public/data/media-index.json
//   2. sourced  — Deezer portraits, Cover Art Archive sleeves, Google Places venue photos
//   3. derived  — the genre colour with the name set over it. The floor; a card is never bare.
// Each tier also falls through at RUNTIME: a sourced URL that 404s drops to the next tier
// rather than leaving a broken image (AskMedia.tsx `LadderImage`).
//
// ATTRIBUTION — the two rules from the same skill, enforced in `photoCaption`:
//   • A photo from a different night says so. Never imply it is THE night.
//   • A photo of a different act says so. 48% of shows have openers; an unattributed frame
//     silently credited to the headliner is fabricated attribution on half the archive.

import { normalizeArtistName } from '@/utils/normalize'
import { ASK_API_BASE } from '@/services/askArchive'

export interface MediaCrop {
  x: number
  y: number
  w: number
  h: number
}

/** One row of media-index.json. Only the fields the cards read. */
export interface MediaAsset {
  kind: string
  url: string | null
  date: string
  artist: string | null
  artistNormalized: string | null
  subject: string
  hero?: boolean
  signature?: boolean
  crop?: MediaCrop | null
  order?: number
  width?: number
  height?: number
}

/** A still the site can actually show: an image with a committed file and known dimensions. */
export interface Photo extends MediaAsset {
  url: string
  width: number
  height: number
}

export interface MediaIndex {
  /** Every usable still from one night, best first. */
  byDate: Map<string, Photo[]>
  /** Every usable still of one act, newest night first, best first within a night. */
  byArtist: Map<string, Photo[]>
}

export const EMPTY_MEDIA: MediaIndex = { byDate: new Map(), byArtist: new Map() }

const isPhoto = (a: MediaAsset): a is Photo =>
  a.kind === 'image' && typeof a.url === 'string' && a.url.length > 0 && (a.width ?? 0) > 0 && (a.height ?? 0) > 0

/** Hero first, then the order the owner set when culling. */
const best = (a: Photo, b: Photo) => Number(!!b.hero) - Number(!!a.hero) || (a.order ?? 0) - (b.order ?? 0)

export function buildMediaIndex(assets: MediaAsset[] | null | undefined): MediaIndex {
  const byDate = new Map<string, Photo[]>()
  const byArtist = new Map<string, Photo[]>()
  for (const a of assets ?? []) {
    if (!isPhoto(a)) continue // videos never show on the site; no file → nothing to show
    ;(byDate.get(a.date) ?? byDate.set(a.date, []).get(a.date)!).push(a)
    if (a.subject === 'artist' && a.artistNormalized) {
      ;(byArtist.get(a.artistNormalized) ?? byArtist.set(a.artistNormalized, []).get(a.artistNormalized)!).push(a)
    }
  }
  for (const list of byDate.values()) list.sort(best)
  for (const list of byArtist.values()) list.sort((a, b) => b.date.localeCompare(a.date) || best(a, b))
  return { byDate, byArtist }
}

/** Frames of one act on one night, best first. A frame never defaults to the headliner. */
export function actPhotosOnNight(ix: MediaIndex, date: string, actSlug: string): Photo[] {
  return (ix.byDate.get(date) ?? []).filter((p) => p.subject === 'artist' && p.artistNormalized === actSlug)
}

/** Marquee, exterior, stub, the room before doors. */
export function venuePhotosOnNight(ix: MediaIndex, date: string): Photo[] {
  return (ix.byDate.get(date) ?? []).filter((p) => p.subject === 'venue')
}

/**
 * The frame that leads an act's card when the question isn't about one night: the owner's
 * `signature` mark (one per act, across every show), else the hero of their latest photographed
 * night, else the best frame of that night.
 */
export function leadPhoto(ix: MediaIndex, actSlug: string): Photo | null {
  const all = ix.byArtist.get(actSlug) ?? []
  return all.find((p) => p.signature) ?? all[0] ?? null
}

export type NightRelation = 'act' | 'other-act' | 'venue'

export interface NightPick {
  photo: Photo
  /** Who is in the frame relative to the night's headliner — the caption must say so. */
  relation: NightRelation
}

export interface NightLike {
  date: string
  headlinerNormalized: string
  openers?: string[]
}

/** The bill in running order of importance: headliner, then openers as billed. */
export function billSlugs(c: NightLike): string[] {
  return [c.headlinerNormalized, ...(c.openers ?? []).map(normalizeArtistName)]
}

/**
 * One frame for a night: the headliner's, else an opener's (labelled as theirs), else the venue.
 * Null when I took no stills that night — the caller drops to the sourced tier.
 */
export function nightPhoto(ix: MediaIndex, c: NightLike): NightPick | null {
  const [head, ...openers] = billSlugs(c)
  const own = actPhotosOnNight(ix, c.date, head)[0]
  if (own) return { photo: own, relation: 'act' }
  for (const o of openers) {
    const p = actPhotosOnNight(ix, c.date, o)[0]
    if (p) return { photo: p, relation: 'other-act' }
  }
  const v = venuePhotosOnNight(ix, c.date)[0]
  return v ? { photo: v, relation: 'venue' } : null
}

/** Every still from a night: frames of acts on the bill, best first, then the venue. */
export function nightPhotoCount(ix: MediaIndex, date: string): number {
  return ix.byDate.get(date)?.length ?? 0
}

// ---------------------------------------------------------------------------------------------
// Framing. Every published still carries a crop box the owner drew by hand (`media:crop`):
// normalised x/y/w/h, almost always 4:5. That box is the subject. A card never guesses from the
// frame centre; it positions the image so the box is in view.
// ---------------------------------------------------------------------------------------------

/** Width ÷ height of the owner's crop, in pixels. The whole frame when there is no crop. */
export function cropAspect(p: Pick<Photo, 'width' | 'height' | 'crop'>): number {
  const c = p.crop
  return c && c.w > 0 && c.h > 0 ? (c.w * p.width) / (c.h * p.height) : p.width / p.height
}

/**
 * The CSS `object-position` that keeps the owner's crop in view in a box of `aspect` (w ÷ h)
 * under `object-fit: cover`.
 *
 * Cover shows the largest window of that aspect the image allows; only its position is free.
 * The window is centred on the crop, clamped to the image. When the crop is BIGGER than the
 * window on an axis (a 4:5 crop in a square thumbnail), the window sits inside the crop instead —
 * horizontally centred, vertically `bias` of the way down. 0.3 keeps the upper part of the frame,
 * where a performer's face almost always is in a stage shot; the owner's crop already excludes
 * the floor. Tested against the published crops in media.test.ts.
 */
export function focalPosition(p: Pick<Photo, 'width' | 'height' | 'crop'>, aspect: number, bias = 0.3): string {
  const W = p.width
  const H = p.height
  const c = p.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  // The visible window, in image pixels.
  const vw = W / H > aspect ? H * aspect : W
  const vh = W / H > aspect ? H : W / aspect
  const cx = c.x * W
  const cy = c.y * H
  const cw = c.w * W
  const ch = c.h * H

  const along = (start: number, size: number, view: number, total: number, b: number): number => {
    const slack = total - view
    if (slack <= 0.5) return 50 // the window spans the whole axis; position is moot
    const offset = size <= view ? start + size / 2 - view / 2 : start + (size - view) * b
    const clamped = Math.min(Math.max(offset, 0), slack)
    return Math.round((clamped / slack) * 1000) / 10
  }
  const x = along(cx, cw, vw, W, 0.5)
  const y = along(cy, ch, vh, H, bias)
  return `${x}% ${y}%`
}

/** How much of the owner's crop a box of `aspect` keeps visible (0–1, by area). */
export function cropCoverage(p: Pick<Photo, 'width' | 'height' | 'crop'>, aspect: number): number {
  const W = p.width
  const H = p.height
  const c = p.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const vw = W / H > aspect ? H * aspect : W
  const vh = W / H > aspect ? H : W / aspect
  return Math.min(1, vw / (c.w * W)) * Math.min(1, vh / (c.h * H))
}

/**
 * Which hero shape keeps the subject: a 3:2 banner when it keeps at least 80% of the owner's crop
 * (most landscape frames — 4:3 stage shots keep 89%), otherwise the photo sits beside the text at
 * the crop's own aspect, where 100% of the crop is in view. A 16:9 banner was rejected: over the
 * published crops it kept as little as 60%, and over a portrait 4:5 crop under half — which is how
 * heads get cut off.
 */
export const BANNER_ASPECT = 3 / 2
export const BANNER_MIN_COVERAGE = 0.8
export function heroLayout(p: Pick<Photo, 'width' | 'height' | 'crop'>): 'banner' | 'portrait' {
  return cropCoverage(p, BANNER_ASPECT) >= BANNER_MIN_COVERAGE ? 'banner' : 'portrait'
}

// ---------------------------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------------------------

/** "Jun 4, 2026". Dates are calendar dates, so format in UTC — never shift a night by a timezone. */
export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export interface CaptionContext {
  /** The act the card is about. A frame of anyone else says who it is. */
  aboutAct?: string
  /** The night the card is about. A frame from another night says so. */
  aboutDate?: string
  /** Venue name for the frame's own night. */
  venueOf: (date: string) => string | undefined
  /** Headliner name for the frame's own night, for "on X's bill". */
  headlinerOf: (date: string) => string | undefined
}

/**
 * What a photo's caption may claim. Every branch names the night, so no caption can imply a
 * frame is from a night it isn't.
 */
export function photoCaption(p: Photo, ctx: CaptionContext): string {
  const when = fmtDate(p.date)
  const where = ctx.venueOf(p.date)
  if (p.subject === 'venue') return [where ?? 'The venue', when].join(' · ')
  if (ctx.aboutAct && p.artistNormalized && p.artistNormalized !== ctx.aboutAct) {
    const head = ctx.headlinerOf(p.date)
    const who = p.artist ?? 'Another act'
    return head && normalizeArtistName(head) !== p.artistNormalized ? `${who}, on ${head}’s bill · ${when}` : `${who} · ${when}`
  }
  if (ctx.aboutDate && p.date !== ctx.aboutDate) return `My photo from ${when}, not this night`
  return ['My photo', where, when].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------------------------
// Sourced images
// ---------------------------------------------------------------------------------------------

/**
 * Cover Art Archive front cover for a MusicBrainz release-group.
 *
 * Loaded straight from the browser. CAA's failures did show up in practice, so cards try the
 * iTunes redirect first — see `coverUrls`.
 */
export function coverUrl(mbid: string, size: 250 | 500 = 250): string {
  return `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-${size}`
}

/**
 * Every URL worth trying for one sleeve, in order.
 *
 * 1. The ask-chat Worker's `/api/ask/cover/<mbid>`, which redirects to the same album on Apple's
 *    artwork CDN (workers/ask-chat/src/cover.ts). First because it is the one that loads: on
 *    2026-10-31 Cover Art Archive 500'd on Dare, Hysteria, Secrets and Credo — originals and
 *    thumbnails alike — in the Human League discography card. It 404s when iTunes has no album
 *    whose artist and title both match, which simply moves the image down the ladder.
 * 2. Cover Art Archive, which is exact (keyed by the id) but flaky. Its resized thumbnails are
 *    generated separately from the upload and are sometimes missing for a record whose front
 *    image exists (Streetlight Manifesto, Social Distortion on v6.2.0), so it tries the next
 *    size, then the full-size original, before the card draws the derived sleeve.
 */
export function coverUrls(mbid: string, size: 250 | 500 = 250, apiBase: string = ASK_API_BASE): string[] {
  const id = encodeURIComponent(mbid)
  const base = `https://coverartarchive.org/release-group/${id}/front`
  const caa = size === 250 ? [`${base}-250`, `${base}-500`, base] : [`${base}-500`, base]
  // `v` changes when the route's answers change, so a browser's cached 404 from the old one is skipped.
  return [`${apiBase}/api/ask/cover/${id}?size=${size}&v=2`, ...caa]
}

export interface VenuePhotoMeta {
  manualPhotos?: Array<{ url: string }> | null
  photoUrls?: { thumbnail?: string; medium?: string; large?: string } | null
}

/**
 * The venue's sourced photo: a hand-placed one first, then Google Places. The generic
 * placeholder (`/images/venues/fallback*.jpg`) is not a photo of the venue, so it counts as none.
 */
export function venueSourcedPhoto(meta: VenuePhotoMeta | null | undefined): string | null {
  const candidates = [meta?.manualPhotos?.[0]?.url, meta?.photoUrls?.medium, meta?.photoUrls?.large]
  return candidates.find((u): u is string => !!u && !/\/images\/venues\/fallback[^/]*$/.test(u.split('?')[0])) ?? null
}

/** "1984", from "1984-03-17", "1984-03" or "1984". */
export const yearOf = (releaseDate: string): string => releaseDate.slice(0, 4)

/** "9 months", "2.1 years", "14 days" — how old a record was on the night. Mirrors the worker's agePhrase. */
export function agePhrase(days: number): string {
  if (days < 45) return `${days} days`
  if (days < 365) return `${Math.round(days / 30.44)} months`
  const years = days / 365.25
  return `${years < 10 ? years.toFixed(1) : Math.round(years)} years`
}

/** "21 months", "7.6 years" — small gaps in months, long ones in years. Mirrors monthsAwayPhrase. */
export function monthsPhrase(months: number): string {
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`
  return `${Math.round((months / 12) * 10) / 10} years`
}
