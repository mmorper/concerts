/**
 * Reading `song-albums.json` from a billing name.
 *
 * The file is keyed `artistKey::foldedSongTitle`, where `artistKey` is the
 * PERFORMING artist as the resolver settled it — `performer.key ?? slug`. That
 * key is not always the slug of the name on the marquee, and the divergences are
 * deliberate. This module is the one place that bridges the gap.
 *
 * ── WHY THIS IS SHARED ───────────────────────────────────────────────────────
 * Two consumers need it and neither can import the resolver: the MCP Worker
 * (Node built-ins are not available in a Workers bundle) and the liner-notes
 * detectors. Resolving the key differently in either place would silently match
 * nothing — the same failure `songAlbumKey`'s docblock warns about, one level up.
 * Zero imports beyond `song-title.js`, which is itself pure, so this bundles
 * into a Worker.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §Part 3, §6a
 */

import { songAlbumKey } from './song-title.js'

/** Hop 2 — an act whose discography is filed under a different key than the marquee. */
export interface DiscographyKeyRelation {
  act: string
  discographyKey: string
}

/**
 * The data this resolution needs, passed in rather than read, so the Worker can
 * supply its cached fetches and the build scripts their file reads.
 */
export interface SongAlbumLookupContext {
  /** `artist-aliases.json`'s `discographyKeys` relation. */
  discographyKeys?: readonly DiscographyKeyRelation[] | null
  /** `artists-metadata.json` — only `name` is read. */
  artistsMetadata?: Record<string, { name?: string } | undefined> | null
}

/** Matches `src/utils/normalize.ts` and the resolver's `slugOf`. Comparison only. */
function slugOf(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Every artist key this billing might be filed under, in priority order.
 *
 * Three candidates, all cheap. A wrong guess cannot produce a wrong annotation —
 * it simply misses, because the song key built from it will not exist.
 *
 *   1. hop 2 — `omd` -> `orchestral-manoeuvres-in-the-dark`. Skipping this fails
 *      SILENTLY, indistinguishable from "we hold no discography for this act".
 *   2. the billing slug, correct for 122 of the 126 artists in the shipped file.
 *   3. the slug of the DISPLAY name, which is what the discography is keyed by.
 *      Mechanical, and the only route reaching `Echo & The Bunnymen` ->
 *      `echo-the-bunnymen` and `Joan Jett & The Blackhearts` ->
 *      `joan-jett-and-the-blackhearts`, where the two sources disagree about
 *      whether an ampersand is a word.
 *
 * Verified to reach all 126 artist prefixes present in `song-albums.json`.
 */
export function songAlbumArtistKeys(
  billing: string,
  ctx: SongAlbumLookupContext = {}
): string[] {
  const slug = slugOf(billing)
  if (!slug) return []

  const hop = ctx.discographyKeys?.find(d => d.act === slug)?.discographyKey
  const viaDisplayName = slugOf(ctx.artistsMetadata?.[slug]?.name ?? '')

  // Deduped so a caller that folds identically does not pay for three lookups.
  return [...new Set([hop, slug, viaDisplayName].filter((k): k is string => Boolean(k)))]
}

/**
 * The attribution for one artist's performance of one song, or null.
 *
 * Generic over the record type so the Worker and the build scripts can each keep
 * their own shape without this module depending on either.
 */
export function lookupSongAlbum<T>(
  songs: Record<string, T> | null | undefined,
  billing: string,
  songTitle: string,
  ctx: SongAlbumLookupContext = {}
): T | null {
  if (!songs || !songTitle) return null
  for (const key of songAlbumArtistKeys(billing, ctx)) {
    const hit = songs[songAlbumKey(key, songTitle)]
    if (hit) return hit
  }
  return null
}
