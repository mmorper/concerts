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
import type { CropBox, LinerNotesPost, PostImage } from "../../src/types/liner-notes.ts";

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

/** One published asset, as `media-index.json` records it. */
export interface MediaIndexAsset {
  kind: "image" | "video";
  url: string | null;
  date: string;
  artistNormalized: string | null;
  hero?: boolean;
  /**
   * The best frame of this act ACROSS EVERY SHOW — one per artist, not one per night.
   *
   * 🔴 `hero` IS PER SHOW, AND THAT IS NOT THE SAME QUESTION. An act photographed at three
   * nights has three heroes: the best frame of each. When a post reaches for "a photograph
   * of Howard Jones" without being about one particular night — most posts — something has
   * to choose between them, and until this existed the tie-break was `date` ascending. The
   * EARLIEST show won, which nobody decided; it was just what a stable sort did.
   *
   * Marked by hand, like `hero` and `crop`, and for the same reason: every automatic guess
   * this pipeline has tried at judging a photograph has failed (#342 records three).
   */
  signature?: boolean;
  order: number;
  /**
   * Set when this still was pulled from a video clip rather than shot as a photograph.
   *
   * A stronger quality signal than the date, and the reason the default tie-break is not
   * date alone — see `getShowAsset`.
   */
  derivedFrom?: { original: string; frame?: number } | null;
  /**
   * The owner's crop, normalised 0-1, authored at 4:5 (#342).
   *
   * Carried here because it CANNOT be re-derived downstream. Tier and source are
   * recoverable from the URL path by `syndication/provenance.ts`; the crop box is a
   * judgement the owner made frame by frame in the review page, and a renderer that does
   * not receive it centre-crops instead — which is the failure #342 documents.
   */
  crop?: CropBox | null;
}

export interface ImageSources {
  artistsMetadata: Record<string, { name?: string; image?: string }>;
  /**
   * The archive's own photography (#340). Optional: absent → `getShowImageUrl` returns
   * undefined and every post falls back exactly as it did before, which is what keeps this
   * safe to land before most shows have any media.
   */
  mediaIndex?: { assets: MediaIndexAsset[] };
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
 * The best published photograph of an act, or undefined when there is none.
 *
 * REF IS THE ARTIST, NOT THE FILE. Every other source here re-resolves a durable key on
 * every run rather than trusting a stored URL, and this follows that: the post says "a
 * photograph of Howard Jones" and the pipeline picks the best one currently published. Add
 * a better frame later and the post improves without being touched.
 *
 * Preference order, and each step is a decision the owner already made:
 *   1. the SIGNATURE — the best frame of this act across every show they were photographed at
 *   2. failing that, the HERO — the frame that leads this act at one particular night
 *   3. failing that, the lowest ordinal — `-01` is the best frame of the act by rank
 *   4. failing that, a native still before a frame pulled from video
 *   5. failing that, the NEWEST show — resolution climbed until 2018 and plateaued after
 *
 * STILLS ONLY. A render has `url: null` — video is never served from this repo — and a post
 * needs something fetchable.
 */
export function getShowAsset(
  artistNormalized: string,
  sources: ImageSources
): MediaIndexAsset | undefined {
  const assets = (sources.mediaIndex?.assets ?? []).filter(
    (a) => a.kind === "image" && a.url && a.artistNormalized === artistNormalized
  );
  if (assets.length === 0) return undefined;
  return assets.sort(
    (a, b) =>
      /* SIGNATURE FIRST — the owner's pick across every show. Then the per-show hero, then
         the ranked ordinal, then the date. The date tie-break is LAST and now only decides
         between two frames nobody has distinguished; it used to decide between three heroes
         from three different nights, silently and in favour of the oldest. */
      Number(Boolean(b.signature)) - Number(Boolean(a.signature)) ||
      Number(Boolean(b.hero)) - Number(Boolean(a.hero)) ||
      a.order - b.order ||
      /* 🔴 A NATIVE STILL BEFORE A FRAME PULLED FROM VIDEO, then the NEWEST show.
         Both are facts in the index, neither is a guess about what is in the picture.

         The date used to sort ASCENDING, so the oldest show won — not chosen, just what a
         stable sort does. Newest is the better default and the archive says why: source
         resolution climbs 4.2 MP (2012) → 8.0 (2015) → 12.2 (2018) and then PLATEAUS. So
         "a newer phone takes a better photo" is true at the old end and stops being true
         after 2018.

         Which is why `derivedFrom` sorts above it. Howard Jones 2024-08-20 — on two
         published posts right now — is six of seven frames pulled from video, median
         8.3 MP against 12.2 for every native set since 2018. It is the weakest modern
         imagery in the archive and no date rule would ever have caught it.

         Neither replaces `signature`. Whether a photograph is GOOD is about the light and
         how close you were, which no metadata records — that is a judgement, and it is
         marked by hand. */
      Number(Boolean(a.derivedFrom)) - Number(Boolean(b.derivedFrom)) ||
      b.date.localeCompare(a.date)
  )[0];
}

/**
 * The URL of that photograph.
 *
 * A URL is all `resolveImageUrl` and `inferRef` need — they re-resolve a stored reference
 * and compare it against a stored URL. Anything COMPOSING a card wants `getShowAsset`
 * instead: the crop box and the capture date do not survive the narrowing to a string, and
 * both are load-bearing. Dropping them is what made the one committed renderer centre-crop.
 */
export function getShowImageUrl(
  artistNormalized: string,
  sources: ImageSources
): string | undefined {
  return getShowAsset(artistNormalized, sources)?.url ?? undefined;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2024-08-20" -> "20 August 2024". Split rather than parsed: no timezone can slip it. */
function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}


export const OWNER_BYLINE = "Mike Morper";

/**
 * The on-image byline for a tier-1 photograph — `Mike Morper · 20 August 2024`.
 *
 * ONE STATE, ALWAYS THE FULL DATE. `PROVENANCE.md` originally specified a second variant,
 * `Mike Morper · July 2026, not the 1987 night`, for a photograph taken on a night other
 * than the one the post is about. **Removed by the owner 2026-08-28**, and the reasoning is
 * theirs: the byline already states the date the photograph was taken, so a reader given
 * "June 2026" under a headline about 2018 can connect those without being told. The negation
 * added nothing they could not see and made the card apologise for itself.
 *
 * Nothing is fabricated by dropping it. The risk `PROVENANCE.md` was guarding — implying a
 * photograph is *the* night when it is not — is already closed by printing the capture date,
 * and printing it in FULL rather than as a month is what closed the last of it: the old
 * different-night variant was month-only, so `August 2024` under a post about another August
 * night was the one genuinely ambiguous case. A full date has no such gap.
 *
 * The different-night knowledge still matters elsewhere: `render-card.ts` uses it to decide
 * whether the credit stack follows the post's night or the photograph's.
 */
export function showByline(shotOn: string): string {
  return `${OWNER_BYLINE} · ${fullDate(shotOn)}`;
}

/**
 * The single night a post is about, or undefined when it is about a span.
 *
 * 🔴 NOT `resolveAnchorConcert`. That always returns a concert — for a span post it falls
 * through to "earliest by the lead artist", which its own doc calls furniture identifying
 * *a* show rather than a claim about the story. Passing that date to the different-night
 * rule promotes a deliberate fallback into an assertion, and the byline then apologises for
 * a night the post never claimed.
 *
 * The `?show=` deep link is the durable signal, and the only one: the pipeline emits it
 * exclusively when a setlist backs that night. `concertDate` lives on the finding and does
 * not survive onto the published post, so it cannot be read here.
 */
export function postNightOf(post: Pick<LinerNotesPost, "deepLinks">): string | undefined {
  const link = post.deepLinks?.find((l) => l.type === "setlist");
  const raw = link?.url.match(/[?&]show=([^&]+)/)?.[1];
  return raw ? decodeURIComponent(raw) : undefined;
}

/**
 * Detectors whose post is about a PLACE, not an act.
 *
 * `resolveImage` gates on the detector's own `suggestedImage.type === "venue"`, which is the
 * richer signal and the right one to use where it exists. A published post does not carry
 * its finding, so this is the equivalent gate for the back catalogue — derived by reading
 * every `suggestedImage: { type: "venue" }` in analyze.ts, and 1:1 with them today.
 *
 * ⚠️ A NEW VENUE-SUBJECT DETECTOR MUST BE ADDED HERE TOO. The failure is quiet and it is
 * the one this gate exists to stop: `venue-loyalty` and `venue-ghost` carry an `artists`
 * array, so `artists[0]` is whoever sorts first — on both Universal Amphitheater posts that
 * is Howard Jones, photographed in 2024 at a venue demolished years earlier.
 */
export const VENUE_SUBJECT_DETECTORS = new Set([
  "venue-loyalty",
  "venue-ghost",
  "geographic-chapter",
  "historical-moment",
  "city-pulse",
]);

/**
 * Posts whose copy MUST NAME the venue — a third question, and a narrower answer
 * than either set below.
 *
 * 🔴 THREE QUESTIONS NOW, AND STILL ONE SET CANNOT ANSWER TWO OF THEM.
 * `VENUE_SUBJECT_DETECTORS` asks "is `artists[0]` arbitrary here?".
 * `PLACE_FORWARD_DETECTORS` asks "is the PLACE the better sourced image?".
 * This asks "is there ONE room this post is about?" — and the honest answer is
 * narrower than both, because a post can have no arbitrary artist and no single
 * venue at the same time.
 *
 * `geographic-chapter` proves it: `my-west-coast-chapter` covers SIXTEEN venues,
 * so requiring it to name `venues[0]` would force "Irvine Meadows" into a hook
 * about a region and make good copy worse to satisfy a rule aimed at a different
 * failure. `city-pulse` is about a year in a city, which is the same shape.
 *
 * What is left is the two detectors whose headline is literally the venue's name:
 * a loyalty streak and a room that no longer exists. Those cannot be written
 * without saying which room, and every one of them had been.
 */
export const VENUE_NAMED_DETECTORS = new Set(["venue-loyalty", "venue-ghost"]);

/**
 * Posts where the VENUE outranks an artist press shot — but never outranks our own
 * photography.
 *
 * 🔴 TWO DIFFERENT QUESTIONS, AND ONE SET CANNOT ANSWER BOTH.
 * `VENUE_SUBJECT_DETECTORS` answers "is `artists[0]` arbitrary here?" — on a venue-loyalty
 * post it is whoever sorts first, so no artist photograph belongs. This answers "is the
 * PLACE the better sourced image?", which is a different question with a wider answer.
 *
 * A festival bill names six to fifteen acts and a streak post names three venues in twelve
 * days; one artist's promo shot standing for either is arbitrary, and the place is what they
 * have in common. But `artists[0]` on those posts IS a real subject — the headliner, or an
 * act genuinely on the bill — so the archive's own photograph of them still wins.
 *
 * Collapsing the two sets sent `3-concerts-in-12-days` to a photo of The Belasco while we
 * hold five frames of Foals taken AT that show. Photography first, always.
 */
export const PLACE_FORWARD_DETECTORS = new Set([
  ...VENUE_SUBJECT_DETECTORS,
  "festival-mega-bill",
  "concert-streak",
]);
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
    case "show":
      return getShowImageUrl(ref, sources);
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
  if (image.source === "show") {
    const match = post.artists.find((a) => getShowImageUrl(a, sources) === image.url);
    return match ?? post.artists[0];
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
