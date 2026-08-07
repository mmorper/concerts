/**
 * Image reference resolution for liner notes.
 *
 * Posts store a *reference* (`image.ref` — a normalized venue or artist key)
 * as the source of truth, and a derived `image.url` for consumers that need a
 * concrete URL at build time (RSS, OG images, the React components).
 *
 * The derived URL is deliberately re-resolved on every pipeline run. Google
 * Places photo URLs are revoked without warning when the underlying photo is
 * unpublished from a place listing — this is a content event, not an
 * expiry clock, so it cannot be avoided by tuning a TTL. venues-metadata and
 * artists-metadata already self-heal on the weekly refresh; resolving through
 * them lets published posts inherit that healing instead of holding a snapshot
 * that silently rots.
 *
 * See: https://github.com/mmorper/concerts/issues/252
 */

import { normalizeAlbumTitle } from "../utils/album-title.ts";
import type { PostImage } from "../../src/types/liner-notes.ts";

export const VENUE_PHOTO_PLACEHOLDER = "/images/venues/fallback.jpg";

/**
 * Local asset used when a reference resolves to nothing.
 *
 * Note this is `venues/fallback-active.jpg`, not the `liner-notes-placeholder.jpg`
 * curate.ts named until #252 — that file has never existed in `public/images/`.
 * It went unnoticed because no post had ever reached the placeholder branch;
 * the refresh stage makes that branch reachable, so it now points at a real
 * asset (the same generic image `enrich-venues` falls back to).
 */
export const PLACEHOLDER_IMAGE_URL = "/images/venues/fallback-active.jpg";

/**
 * Cover Art Archive URL for a release-group. Deterministic from the MBID —
 * verified across all 11,382 covers in discography.json, zero exceptions.
 */
export function coverArtUrl(mbid: string): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-500.jpg`;
}

export interface ImageSources {
  artistsMetadata: Record<string, { name?: string; image?: string }>;
  artistsTopTracks: Record<
    string,
    { tracks: Array<{ albumName?: string; albumArt?: string }> }
  >;
  venuesMetadata: Record<
    string,
    {
      name?: string;
      photoUrls?: string[] | { thumbnail?: string; medium?: string; large?: string };
      manualPhotos?: string[];
    }
  >;
  /** album-eras.json (#273). Absent → album art falls back to iTunes as before. */
  albumEras?: {
    artists: Record<
      string,
      { studioAlbums: Array<{ mbid: string; title: string; coverAvailable: boolean }> }
    >;
  };
}

/**
 * A venue photo that is a real Google Places photo rather than one of our own
 * bundled fallbacks. Fallbacks are legitimate to serve but must not be treated
 * as a resolved photo, or a venue would never be retried once it fell back.
 */
export function isRealVenuePhoto(url: string | undefined): url is string {
  return !!url && !url.endsWith(VENUE_PHOTO_PLACEHOLDER);
}

export function upsizeAppleMusicUrl(url: string): string {
  return url.replace(/\/\d+x\d+bb\.jpg$/, "/600x600bb.jpg");
}

export function getVenueImageUrl(
  venueSlug: string,
  sources: ImageSources
): string | undefined {
  const venue = sources.venuesMetadata[venueSlug];
  if (!venue) return undefined;

  // photoUrls is either a string[] (legacy) or { thumbnail, medium, large }
  const photoUrls = venue.photoUrls;
  if (Array.isArray(photoUrls)) return photoUrls.find(isRealVenuePhoto);
  if (photoUrls && typeof photoUrls === "object") {
    return [photoUrls.large, photoUrls.medium, photoUrls.thumbnail].find(
      isRealVenuePhoto
    );
  }

  return venue.manualPhotos?.find(isRealVenuePhoto);
}

/**
 * Album art for a named album, preferring the real record over a store listing.
 *
 * Fallback chain (#273):
 *   1. Cover Art Archive via album-eras.json — the actual release-group cover
 *   2. iTunes top-track art, matched on normalized title
 *   3. any iTunes art for the artist
 *
 * Tier 1 exists because iTunes returns store editions: posts were carrying
 * covers captioned "Garbage (20th Anniversary Edition) [2015 Remaster]" when
 * the subject was the 1995 album. `SuggestedImage.type: "album"` has been in
 * the types since v4.4 with only tier 2 wired behind it — a socket with
 * nothing good plugged into it.
 */
export function getAlbumArt(
  artistSlug: string,
  albumName: string | undefined,
  sources: ImageSources
): string | undefined {
  if (albumName) {
    const spine = sources.albumEras?.artists[artistSlug]?.studioAlbums;
    if (spine?.length) {
      const wanted = normalizeAlbumTitle(albumName);
      const hit = spine.find((a) => a.coverAvailable && normalizeAlbumTitle(a.title) === wanted);
      if (hit) return coverArtUrl(hit.mbid);
    }
  }

  const tracks = sources.artistsTopTracks[artistSlug]?.tracks;
  if (!tracks?.length) return undefined;

  if (albumName) {
    // Normalized rather than exact (#268): iTunes says "Violator (Deluxe)".
    const wanted = normalizeAlbumTitle(albumName);
    const match = tracks.find(
      (t) => t.albumName && normalizeAlbumTitle(t.albumName) === wanted && t.albumArt
    );
    if (match?.albumArt) return match.albumArt;
  }

  return tracks.find((t) => t.albumArt)?.albumArt;
}

/**
 * Resolve a post image's current URL from its reference.
 *
 * Returns undefined when the reference cannot be resolved, which callers should
 * treat as "fall back", not as "keep the old URL" — a stale URL that resolves to
 * nothing is exactly the failure this module exists to prevent.
 */
export function resolveImageUrl(
  image: Pick<PostImage, "source" | "ref" | "albumName">,
  sources: ImageSources
): string | undefined {
  const { source, ref, albumName } = image;
  if (!ref) return undefined;

  switch (source) {
    case "venue":
      return getVenueImageUrl(ref, sources);
    case "artist":
      return sources.artistsMetadata[ref]?.image;
    case "album": {
      const art = getAlbumArt(ref, albumName, sources);
      return art ? upsizeAppleMusicUrl(art) : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Infer a reference for a post written before `image.ref` existed, using the
 * post's own cross-reference arrays. Only used by the one-time backfill; new
 * posts get their ref set at curate time.
 */
export function inferRef(
  image: Pick<PostImage, "source" | "url">,
  post: { artists: string[]; venues: string[] },
  sources: ImageSources
): string | undefined {
  if (image.source === "venue") {
    // Match on the URL where possible — a post can reference several venues.
    const match = post.venues.find(
      (v) => getVenueImageUrl(v, sources) === image.url
    );
    return match ?? post.venues[0];
  }
  if (image.source === "artist") {
    const match = post.artists.find(
      (a) => sources.artistsMetadata[a]?.image === image.url
    );
    return match ?? post.artists[0];
  }
  if (image.source === "album") {
    const match = post.artists.find((a) =>
      sources.artistsTopTracks[a]?.tracks?.some(
        (t) => t.albumArt && upsizeAppleMusicUrl(t.albumArt) === image.url
      )
    );
    return match ?? post.artists[0];
  }
  return undefined;
}
