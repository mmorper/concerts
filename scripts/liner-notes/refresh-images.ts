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
  VENUE_SUBJECT_DETECTORS,
  getAlbumArt,
  getShowAsset,
  getVenueImageUrl,
  inferRef,
  postNightOf,
  resolveImageUrl,
  showByline,
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
  /** Posts promoted from a sourced image to the archive's own photography. */
  upgraded: number;
  /** Slugs whose image URL changed, so callers can regenerate derived assets. */
  changedSlugs: string[];
}

/**
 * Promote a published post to the archive's own photography when one now exists.
 *
 * 🔴 WITHOUT THIS THE ORDERING FIX ONLY REACHES FUTURE POSTS. `resolveImage` decides tier
 * at CURATE time, and nothing re-runs it: `refreshPostImages` re-resolves `url` from `ref`
 * but never revisits `source`, and its repair path offers album, artist and venue only. So
 * a post published before its show was culled keeps a press shot forever, however good the
 * photograph that arrived later. The archive gains photography retroactively — that is the
 * normal case, not the exception, with 6 of 184 shows covered so far.
 *
 * The rule is `resolveImage`'s, applied to a post rather than a finding:
 *   - never over the archive's own tier-1 image (there is nothing to upgrade)
 *   - never on a venue-subject post, where an artist photograph is the wrong subject
 *   - never when the act has no published photograph, which is most acts
 *
 * `ref` stays the ARTIST, so the choice keeps improving: mark a better hero later and the
 * post picks it up on the next run, exactly as every other source self-heals.
 */
export function upgradeToOwnPhotography(
  posts: LinerNotesPost[],
  sources: ImageSources,
  verbose = false
): string[] {
  const upgraded: string[] = [];

  for (const post of posts) {
    if (post.image?.source === "show") continue;
    if (VENUE_SUBJECT_DETECTORS.has(post.detector)) continue;

    const lead = post.artists[0];
    if (!lead) continue;

    const asset = getShowAsset(lead, sources);
    if (!asset?.url) continue;

    post.image = {
      url: asset.url,
      // The stored alt describes the SOURCE image — "Album art", or an artist name for a
      // press shot. It cannot survive a change of photograph.
      alt: sources.artistsMetadata[lead]?.name ?? post.image.alt,
      source: "show",
      ref: lead,
      credit: showByline(asset.date, postNightOf(post)),
      shotOn: asset.date,
      ...(asset.crop ? { crop: { ...asset.crop } } : {}),
    };
    upgraded.push(post.slug);
    if (verbose) console.log(`   ⬆ ${post.slug}: upgraded to our own photograph of ${lead}`);
  }

  return upgraded;
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
    upgraded: 0,
    deadUrls: [],
    changedSlugs: [],
  };

  /* Upgrade BEFORE re-resolving. An upgraded post's URL is already current, and running it
     through the re-resolve step afterwards would count it twice. Its slug still has to
     reach `changedSlugs` — the OG card is skipped when a PNG already exists, so a post that
     changed photographs would otherwise keep the card composited from the old one. */
  const upgraded = upgradeToOwnPhotography(posts, sources, verbose);
  result.upgraded = upgraded.length;
  result.changedSlugs.push(...upgraded);

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
