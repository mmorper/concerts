/**
 * Agentic Liner Notes — Image refresh & validation
 *
 * Published posts used to hold a frozen third-party image URL. Google Places
 * photo URLs are revoked without warning when the underlying photo is
 * unpublished from a place listing, so a post could render a broken image
 * indefinitely with nothing to detect or repair it (#252).
 *
 * This stage runs over *every* post on every pipeline run and:
 *
 *   1. Backfills `image.ref` on posts written before the field existed.
 *   2. Re-resolves `image.url` from `image.ref` against the current
 *      venues/artists metadata, which self-heal on the weekly data refresh.
 *   3. Validates remote URLs with a HEAD request and, if one is definitively
 *      dead, walks the post's own artists/venues for a live alternative before
 *      settling for the local placeholder.
 *
 * Step 3 hits the image CDNs directly, not the Google Places API — no API key,
 * no quota, no billing.
 */

import type { LinerNotesPost, PostImage } from "../../src/types/liner-notes.ts";
import {
  PLACEHOLDER_IMAGE_URL,
  getAlbumArt,
  getVenueImageUrl,
  inferRef,
  resolveImageUrl,
  upsizeAppleMusicUrl,
  type ImageSources,
} from "./image-refs.ts";
import { checkUrl } from "../utils/url-health.ts";

const HEAD_CONCURRENCY = 8;

export interface RefreshOptions {
  /** HEAD-check remote URLs. Disable for offline/dry runs. */
  validate?: boolean;
  /** Emit per-post detail rather than just the summary. */
  verbose?: boolean;
}

export interface RefreshResult {
  posts: number;
  backfilled: number;
  reresolved: number;
  repaired: number;
  fellBack: number;
  /** Definitively-dead URLs found, as `slug: url` — surfaced in the run log. */
  deadUrls: string[];
  /** Slugs whose image URL changed, so callers can regenerate derived assets. */
  changedSlugs: string[];
}

/** Candidate images for a post, best first, used when its own ref goes dead. */
function candidates(post: LinerNotesPost, sources: ImageSources): PostImage[] {
  const out: PostImage[] = [];
  const primaryArtist = post.artists[0];

  if (primaryArtist) {
    const art = getAlbumArt(primaryArtist, undefined, sources);
    if (art) {
      out.push({
        url: upsizeAppleMusicUrl(art),
        alt: post.image.alt,
        source: "album",
        ref: primaryArtist,
      });
    }
  }
  for (const artist of post.artists) {
    const url = sources.artistsMetadata[artist]?.image;
    if (url) out.push({ url, alt: post.image.alt, source: "artist", ref: artist });
  }
  for (const venue of post.venues) {
    const url = getVenueImageUrl(venue, sources);
    if (url) out.push({ url, alt: post.image.alt, source: "venue", ref: venue });
  }
  return out;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Refresh every post's image in place. Returns counters for the run log.
 */
export async function refreshPostImages(
  posts: LinerNotesPost[],
  sources: ImageSources,
  options: RefreshOptions = {}
): Promise<RefreshResult> {
  const { validate = true, verbose = false } = options;
  const result: RefreshResult = {
    posts: posts.length,
    backfilled: 0,
    reresolved: 0,
    repaired: 0,
    fellBack: 0,
    deadUrls: [],
    changedSlugs: [],
  };

  // ── Steps 1 & 2: backfill refs, then re-resolve URLs (local, no network) ──
  for (const post of posts) {
    const image = post.image;
    if (!image || image.source === "placeholder") continue;

    if (!image.ref) {
      const ref = inferRef(image, post, sources);
      if (ref) {
        image.ref = ref;
        result.backfilled++;
      }
    }

    const fresh = resolveImageUrl(image, sources);
    if (fresh && fresh !== image.url) {
      if (verbose) console.log(`   ↻ ${post.slug}: re-resolved ${image.source} image`);
      image.url = fresh;
      result.reresolved++;
      result.changedSlugs.push(post.slug);
    }
  }

  if (!validate) return result;

  // ── Step 3: validate, and repair anything definitively dead ──────────────
  const checkable = posts.filter((p) => p.image?.url);
  const health = await mapLimit(checkable, HEAD_CONCURRENCY, (p) => checkUrl(p.image.url));

  const broken = checkable.filter((_, i) => health[i] === "dead");
  for (const post of broken) {
    result.deadUrls.push(`${post.slug}: ${post.image.url}`);

    let repaired = false;
    for (const candidate of candidates(post, sources)) {
      if (candidate.url === post.image.url) continue;
      if ((await checkUrl(candidate.url)) !== "ok") continue;
      post.image = { ...candidate, alt: post.image.alt };
      result.repaired++;
      result.changedSlugs.push(post.slug);
      repaired = true;
      if (verbose) {
        console.log(`   ✓ ${post.slug}: repaired via ${candidate.source} "${candidate.ref}"`);
      }
      break;
    }

    if (!repaired) {
      post.image = { url: PLACEHOLDER_IMAGE_URL, alt: post.image.alt, source: "placeholder" };
      result.fellBack++;
      result.changedSlugs.push(post.slug);
      if (verbose) console.log(`   ⚠ ${post.slug}: no live image, using placeholder`);
    }
  }

  return result;
}
