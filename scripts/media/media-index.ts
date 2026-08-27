/**
 * `public/data/media-index.json` — the mapping from a show to its personal media.
 *
 * ADDRESSED BY `url`, deliberately. Selects live in the repo today because the card
 * renderer needs the file at build time, Cloudflare already serves `public/` from the CDN,
 * and `git clone` restores every one. R2 only becomes the right answer past a few hundred
 * files — and because every consumer reads `url`, that migration costs no consumer changes.
 *
 * EVERY ASSET CARRIES ITS OWN `artist`. There is no per-show default and no fallback to the
 * headliner. 89 of 184 shows (48%) have openers, 187 credits in all, so an asset without
 * its own attribution is a fabricated credit waiting to be published as fact.
 *
 * @module scripts/media/media-index
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export const MEDIA_INDEX_PATH = 'public/data/media-index.json'

/** Tier 1 is personal photography and video. See the imagery rubric in the skill. */
export type Tier = 1 | 2 | 3

export interface MediaAsset {
  /**
   * What this is. One index describes all of a show's media, so a workflow asking "what do
   * I have for this night?" sees stills and video together instead of only half of it.
   */
  kind: 'image' | 'video'
  /**
   * Site-absolute path for anything served, null for anything not.
   *
   * Video is never served: the site does not show it, and it only ever goes outbound to
   * Shorts and TikTok. It gets a `path` instead, and a `url` if it is ever uploaded
   * somewhere a CI job can fetch — at which point consumers need no change, because they
   * already address by `url`.
   */
  url: string | null
  /** Repo-relative path on disk. Set for anything not committed — currently all video. */
  path?: string | null
  date: string
  /**
   * The Photos library asset this came from, when it came from one.
   *
   * Null for derived files that arrived through the inbox — an extracted frame has no
   * library identity. Recorded because it is the key that makes an upgrade pass possible:
   * a preview-quality asset can be replaced with its original later without any of the
   * curation being redone. It is also the only way to trace a committed file back to what
   * was reviewed.
   */
  uuid: string | null
  /**
   * The act in the frame, or null for `_venue` material.
   * Null means "the night", never "the headliner".
   */
  artist: string | null
  artistNormalized: string | null
  subject: 'artist' | 'venue'
  tier: Tier
  source: 'personal'
  hero: boolean
  /**
   * The owner's crop, normalised 0–1, authored at 4:5 (#342).
   *
   * Null means none was set, and the renderer applies the measured default rather than
   * guessing: top-aligned for a performer — which keeps the face in 18 of 20 published
   * assets — and centred for a venue, crowd or stub frame, which has no head to protect.
   */
  crop?: { x: number; y: number; w: number; h: number } | null
  order: number
  /** Dimensions of the committed master, after right-sizing. */
  width: number
  height: number
  /**
   * Dimensions of the ORIGINAL still in Photos.
   *
   * Recorded so crop-safety decisions (#352) can tell whether a bigger version exists
   * without a round trip to the library. With `uuid`, it is also what makes re-deriving at
   * another size a mechanical job rather than a re-curation.
   */
  sourceWidth: number
  sourceHeight: number
  bytes: number
  /**
   * Hash of the SOURCE file as it sat in the inbox. This is the idempotency key: it is
   * what lets a re-run recognise a photograph it has already taken, without depending on
   * the inbox filename, which the owner is free to change.
   */
  sourceSha256: string
  /**
   * Which copy of the asset this came from.
   *
   * `original` is the full-resolution file. `preview` is Photos' own 1536x2048 derivative,
   * used when the original could not be fetched — it clears a 1080x1350 card and a 9:16
   * crop, so a post is never blocked, but it is recorded so a later pass can upgrade it
   * in place without re-curating anything.
   */
  quality: 'original' | 'preview'
  /** Set when a STILL was pulled from a clip — needed to write an honest disclosure. */
  derivedFrom: { original: string; frame: number } | null
  /**
   * How to reproduce a VIDEO asset exactly, from the clip still in Photos.
   *
   * This is the durable artefact, not the file. The full-resolution trim is 134MB and is
   * reproducible from these three numbers, so it is never kept; what is kept is the
   * channel-sized render (~13MB), which is both what gets uploaded and the fallback if the
   * library entry ever disappears.
   */
  render?: { uuid: string; in: number; out: number } | null
  /** Seconds. Video only. */
  duration?: number | null
  /** From `notes.txt`. Carries a different-night disclosure or a caption. */
  notes: string | null
}

export interface MediaIndex {
  version: number
  generated: string
  assets: MediaAsset[]
}

export const EMPTY_INDEX: MediaIndex = { version: 1, generated: '', assets: [] }

export function loadIndex(file = resolve(MEDIA_INDEX_PATH)): MediaIndex {
  if (!existsSync(file)) return { ...EMPTY_INDEX, assets: [] }
  const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Partial<MediaIndex>
  return {
    version: parsed.version ?? 1,
    generated: parsed.generated ?? '',
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
  }
}

/** Sorted so a diff shows what changed rather than what moved. */
export function sortAssets(assets: MediaAsset[]): MediaAsset[] {
  return [...assets].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.url ?? a.path ?? '').localeCompare(b.url ?? b.path ?? '')
  )
}

export function saveIndex(index: MediaIndex, file = resolve(MEDIA_INDEX_PATH)): void {
  const out: MediaIndex = { ...index, assets: sortAssets(index.assets) }
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
}

/** Assets already recorded for one act (or the venue) on one night. */
export function assetsFor(index: MediaIndex, date: string, artistNormalized: string | null): MediaAsset[] {
  return index.assets.filter((a) => a.date === date && a.artistNormalized === artistNormalized)
}

/** True when this exact source file has already been ingested for this act. */
export function alreadyIngested(
  index: MediaIndex,
  date: string,
  artistNormalized: string | null,
  sha256: string
): MediaAsset | undefined {
  return index.assets.find(
    (a) => a.date === date && a.artistNormalized === artistNormalized && a.sourceSha256 === sha256
  )
}

/**
 * The next free ordinal for a group.
 *
 * Derived from what is already in the index rather than from a counter, so a second run
 * that adds one photograph numbers it after the existing ones instead of colliding.
 */
export function nextOrder(index: MediaIndex, date: string, artistNormalized: string | null): number {
  const existing = assetsFor(index, date, artistNormalized)
  return existing.reduce((max, a) => Math.max(max, a.order), 0) + 1
}

/**
 * `2024-08-20-howard-jones-03.jpg`, or `2024-08-20-venue-01.jpg` for the night itself.
 *
 * Video uses the SAME convention with a different extension. It previously carried the
 * clip's UUID — `2026-06-04-alison-moyet-7BF4D2F6-…-trim.mp4` — which was a handle grabbed
 * for uniqueness, not a name. A workflow reading both kinds should not have to learn two
 * conventions.
 */
export function assetFilename(date: string, slug: string | null, order: number, ext = 'jpg'): string {
  return `${date}-${slug ?? 'venue'}-${String(order).padStart(2, '0')}.${ext}`
}

/** Ordinals run per act AND per kind, so stills and video number independently. */
export function nextOrderOfKind(
  index: MediaIndex,
  date: string,
  artistNormalized: string | null,
  kind: MediaAsset['kind']
): number {
  return index.assets
    .filter((a) => a.date === date && a.artistNormalized === artistNormalized && a.kind === kind)
    .reduce((max, a) => Math.max(max, a.order), 0) + 1
}
