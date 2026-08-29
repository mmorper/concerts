/**
 * Image provenance — resolved URL → tier and source (#327).
 *
 * `docs/specs/future/mocks-social-syndication/PROVENANCE.md` is the prose
 * policy and the owner's decision that it is **a record, not a gate**. This
 * module is that record in code: it names the host every published image came
 * from so the ledger can carry it per post.
 *
 * Classification is on the HOST, not on `PostImage.source`. `PostImage.source`
 * says what the image is *of* ("artist"); provenance needs to know who served
 * it, because TheAudioDB and Deezer both answer "artist" and a strike against
 * one is not a strike against the other.
 */

import type { MediaSource, MediaTier } from "./types.ts";

export interface Provenance {
  tier: MediaTier;
  source: MediaSource;
}

/**
 * Host suffix → provenance. Ordered, first match wins; `endsWith` on the
 * hostname so a CDN shard (`is1-ssl.mzstatic.com`, `r2.theaudiodb.com`) is
 * covered without enumerating shards.
 */
const HOSTS: Array<[string, Provenance]> = [
  ["coverartarchive.org", { tier: 2, source: "cover-art" }],
  ["mzstatic.com", { tier: 2, source: "album-itunes" }],
  ["theaudiodb.com", { tier: 2, source: "artist-audiodb" }],
  ["dzcdn.net", { tier: 2, source: "artist-deezer" }],
  ["deezer.com", { tier: 2, source: "artist-deezer" }],
  ["googleapis.com", { tier: 2, source: "venue-places" }],
  ["ggpht.com", { tier: 2, source: "venue-places" }],
  /* 🔴 THE HOST PLACES ACTUALLY SERVES FROM TODAY. `venues-metadata.json` stores
     `lh3.googleusercontent.com/place-photos/…`, and only `googleapis.com` and `ggpht.com`
     were listed — so every real venue photograph classified as UNKNOWN and its post became
     ineligible with "unclassified image host". Invisible until now because no published post
     had ever carried one: the venue branch always fell through to album art, which is the
     bug `upgradeVenuePosts` fixes. The two land together or neither works. */
  ["googleusercontent.com", { tier: 2, source: "venue-places" }],
  ["wikimedia.org", { tier: 2, source: "wikimedia" }],
  ["wikipedia.org", { tier: 2, source: "wikimedia" }],
];

/**
 * Site-relative paths. A leading `/` means the file is committed in this repo,
 * so it is ours — but "ours" splits three ways and only two of them publish.
 */
const LOCAL_PATHS: Array<[RegExp, Provenance]> = [
  // `/images/shows/` is the path #340's media-index schema names —
  // `/images/shows/2026-07-31-nile-rodgers-01.jpg`. It has to be here BEFORE
  // that work lands, not after: an unrecognised local path used to fall
  // through to `site-fallback`, which would have classified the archive's own
  // photography as an unpublishable generic image and silently suppressed
  // every post carrying one. That is the imagery rubric exactly inverted.
  [/^\/images\/shows\//, { tier: 1, source: "personal" }],
  [/^\/images\/personal\//, { tier: 1, source: "personal" }],
  [/^\/images\/generative\//, { tier: 3, source: "generative" }],
  [/^\/images\/material\//, { tier: 3, source: "material" }],
  // The one bundled image a post can actually reach today: the generic venue
  // photograph `PLACEHOLDER_IMAGE_URL` resolves to. Named explicitly rather
  // than matched as a catch-all — see below.
  [/^\/images\/venues\/fallback/, { tier: 3, source: "site-fallback" }],
];

/**
 * Unknown hosts classify as tier 2 with no source rather than throwing.
 *
 * A new third-party host appearing is a thing to notice, not a thing to crash
 * the weekly run over — but it must not be silently promoted, so it returns
 * `undefined` and the caller records the post as ineligible with the host
 * named. That way an unclassified image is visible in the run log instead of
 * shipping under a guessed label.
 */
export function classifyImageUrl(url: string | undefined): Provenance | undefined {
  if (!url) return undefined;

  if (url.startsWith("/")) {
    for (const [pattern, provenance] of LOCAL_PATHS) {
      if (pattern.test(url)) return provenance;
    }
    // An unrecognised local path is UNCLASSIFIED, not a fallback.
    //
    // Treating it as `site-fallback` reads as the cautious choice and is the
    // opposite: `site-fallback` never publishes, so a new directory of our own
    // imagery would be silently suppressed with no reason an operator could
    // see. Returning undefined puts the path in the run log as "unclassified"
    // — the same treatment an unknown remote host gets, and for the same
    // reason. Suppression is fine; silent suppression is not.
    return undefined;
  }

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  for (const [suffix, provenance] of HOSTS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return provenance;
  }
  return undefined;
}

/** For the run log and the ineligibility reason — never sent to a platform. */
export function hostOf(url: string | undefined): string {
  if (!url) return "(none)";
  if (url.startsWith("/")) return url;
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 60);
  }
}
