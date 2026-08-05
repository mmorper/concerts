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

export function getAlbumArt(
  artistSlug: string,
  albumName: string | undefined,
  sources: ImageSources
): string | undefined {
  const tracks = sources.artistsTopTracks[artistSlug]?.tracks;
  if (!tracks?.length) return undefined;
  if (albumName) {
    const match = tracks.find((t) => t.albumName === albumName && t.albumArt);
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
