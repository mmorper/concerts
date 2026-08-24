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
  /** Site-absolute path. The stable address; everything else may be re-derived. */
  url: string
  date: string
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
  order: number
  width: number
  height: number
  bytes: number
  /**
   * Hash of the SOURCE file as it sat in the inbox. This is the idempotency key: it is
   * what lets a re-run recognise a photograph it has already taken, without depending on
   * the inbox filename, which the owner is free to change.
   */
  sourceSha256: string
  /** Set when the still was pulled from a clip — needed to write an honest disclosure. */
  derivedFrom: { original: string; frame: number } | null
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
    (a, b) => a.date.localeCompare(b.date) || a.url.localeCompare(b.url)
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

/** `2024-08-20-howard-jones-03.jpg`, or `2024-08-20-venue-01.jpg` for the night itself. */
export function assetFilename(date: string, slug: string | null, order: number): string {
  return `${date}-${slug ?? 'venue'}-${String(order).padStart(2, '0')}.jpg`
}
