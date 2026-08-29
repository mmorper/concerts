/**
 * Agentic Liner Notes — Content Curator
 *
 * Rotates across detectors to choose what publishes, resolves media,
 * generates slugs, deep links, and related-post references, then emits
 * fully-formed LinerNotesPost objects ready for liner-notes.json.
 *
 * Two exported functions allow the pipeline to interleave generation:
 *
 *   1. select()     — rotate across detectors to choose what publishes (pre-prose)
 *   2. buildPosts() — enrich selected findings (with prose) into LinerNotesPost[]
 */

import { MIN_SCORE } from "./score.ts";
import {
  PLACEHOLDER_IMAGE_URL,
  getAlbumArt,
  getShowAsset,
  getVenueImageUrl,
  showByline,
  upsizeAppleMusicUrl,
  type ImageSources,
} from "./image-refs.ts";
import { foldSongTitle, songAlbumKey, songIndexKeys } from "../utils/song-title.ts";
import { normalizeArtistName } from "../../src/utils/normalize.js";
import type { NormalizedTrack } from "../utils/itunes-client.ts";
import type { ScoredFinding } from "./types.ts";
import type {
  DeepLink,
  LinerNotesPost,
  PostAudio,
  PostImage,
} from "../../src/types/liner-notes.ts";

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface CurateOptions {
  artistsMetadata: Record<string, { name?: string; image?: string; bio?: string; genres?: string[] }>;
  /** The archive's own photography (#340). Absent → posts resolve exactly as before. */
  mediaIndex?: ImageSources["mediaIndex"];
  artistsTopTracks: Record<string, {
    name?: string;
    tracks: Array<{ name: string; albumName?: string; albumArt?: string; previewUrl?: string; streamingUrl?: string; durationMs?: number }>;
  }>;
  venuesMetadata: Record<string, { name?: string; photoUrls?: string[] | { thumbnail?: string; medium?: string; large?: string }; manualPhotos?: string[] }>;
  /** album-eras.json (#273) — preferred source for album art. Optional. */
  albumEras?: {
    artists: Record<string, { studioAlbums: Array<{ mbid: string; title: string; coverAvailable: boolean }> }>;
  };
  /**
   * Concert dates that actually have songs on record, from setlists-cache.json.
   * A `?show=` link to a night with no setlist opens an empty panel, so the link
   * is only emitted for nights we can actually show. Omit to emit unconditionally.
   */
  datesWithSetlists?: Set<string>;
  /** Published posts to dedup against and resolve related slugs. */
  existingPosts: LinerNotesPost[];
  /** ISO timestamp to stamp publishedAt on new posts. Defaults to now. */
  publishedAt?: string;
  /**
   * Subject songs already fetched and verified, keyed by
   * `songAlbumKey(recordedByNormalized, trackName)` (#299).
   *
   * Injected rather than fetched here so `buildPosts` stays synchronous and
   * every tier of `resolveAudio` is unit-testable without a network. The
   * pipeline fills it via `fetchSubjectTracks` immediately before building;
   * omit it and audio resolution simply falls through to the cached tiers.
   */
  subjectTracks?: Record<string, NormalizedTrack>;
}

/** Posts published per normal run. */
export const POSTS_PER_RUN = 1;
/**
 * Extra ranked candidates returned beyond the target. Only consumed if an
 * earlier candidate's prose fails validation, so a normal run still costs one
 * API call — see the generation loop in pipeline.ts.
 */
export const CANDIDATE_RESERVE = 2;
/** Months before the same artist can appear twice for the same detector. */
const RERUN_COOLDOWN_MONTHS = 6;
/** A finding whose primary artist (artists[0]) headlined any of the last N posts is skipped. */
const ARTIST_COOLDOWN_POSTS = 10;
/** In seed runs, the most posts any one category may take. Never binds at POSTS_PER_RUN = 1. */
const PER_CATEGORY_CAP_STANDARD = 2;

// ── Step 1: Selection ─────────────────────────────────────────────────────────

export interface SelectOptions {
  /** Posts this run should publish. Seed mode passes 10. */
  maxPosts?: number;
  /**
   * `--force`: bypass both the 6-month rerun cooldown and the primary-artist
   * cooldown, so a recently-covered artist can be regenerated. Publication
   * history is still read for rotation staleness — the old code passed an empty
   * history to achieve this, which also blanked staleness and would have
   * collapsed rotation back into score ranking.
   */
  force?: boolean;
  /**
   * "Now" for the rerun cooldown. Defaults to the wall clock. Threaded through
   * so `--date` and forward simulations age cooldowns correctly — measuring
   * against `Date.now()` meant a cooldown could never expire in either.
   * Identical to the wall clock in a normal run.
   */
  today?: Date;
}

/**
 * Select what to publish, by rotating across detectors (#226 → #231).
 *
 * The old algorithm ranked all ~196 scored findings by score and took the top
 * few, diversifying only on category — three buckets for fifteen detectors.
 * That ranked the *detectors*, not the findings, and it did so in near-identical
 * order every week: two of the six rubric dimensions are properties of the
 * detector rather than the finding (`surpriseFactor` is a hardcoded constant per
 * detector, `specificity` counts how many entities a detector chose to put in
 * its arrays). Anything below the tallest detector in its category starved
 * indefinitely — `historical-moment` produced 27 viable findings and published
 * nothing across 56 posts, and `venue-ghost` was next in line.
 *
 * So: the score ranks findings *within* a detector, and rotation decides
 * *between* detectors.
 *
 *   1. Filter  — dedup and artist cooldown, unchanged. These work.
 *   2. Champion — each detector's single best eligible finding. 15, not 196.
 *   3. Pass    — a detector whose champion sits on the floor sits this one out
 *                rather than publishing its worst finding just because its turn
 *                came up. It stays stale and returns when it has more to say.
 *   4. Rank    — staleness desc, then score desc, then id asc. Staleness is how
 *                many posts have published since that detector last appeared;
 *                never-published sorts first.
 *   5. Fill    — take the target plus a small reserve, honouring the category cap.
 *
 * The comparator is total: it can never fall through to array order, which is
 * what let a stable sort and two adjacent lines in `analyze.ts` decide
 * publication between two detectors tied at 28.
 *
 * Returns `maxPosts + CANDIDATE_RESERVE` candidates in publish order. The
 * caller publishes the first `maxPosts` whose prose validates; the reserve
 * exists only so a validation failure doesn't cost the whole run.
 */
export function select(
  findings: ScoredFinding[],
  existingPosts: LinerNotesPost[],
  options: SelectOptions = {}
): ScoredFinding[] {
  const maxPosts = options.maxPosts ?? POSTS_PER_RUN;
  const now = (options.today ?? new Date()).getTime();

  const recentPosts = [...existingPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const eligible = findings.filter(
    (f) =>
      options.force ||
      (!isDuplicate(f, existingPosts, now) && !isInPrimaryArtistCooldown(f, recentPosts))
  );

  // Each detector nominates its best eligible finding. This is where the score
  // does its real work — comparing findings that are actually comparable.
  const champions = new Map<string, ScoredFinding>();
  for (const f of eligible) {
    const held = champions.get(f.detector);
    if (!held || f.score > held.score || (f.score === held.score && f.id < held.id)) {
      champions.set(f.detector, f);
    }
  }

  // A detector may pass its turn. If its best available finding is sitting on
  // the absolute floor, publishing it just because rotation reached that
  // detector produces posts like "Club Caprice: 1 Show Before It Was Closed" —
  // venue-ghost's stronger findings were inside the dedup window, so its
  // champion really was a one-visit room.
  //
  // Deliberately NOT a global threshold. It never removes a detector from
  // rotation and never excludes a whole category the way STANDARD_THRESHOLD=30
  // did — the detector simply stays stale and comes back the moment it has
  // something better to say.
  for (const [detector, champion] of champions) {
    if (champion.score <= MIN_SCORE) champions.delete(detector);
  }

  const ranked = [...champions.values()].sort((a, b) => {
    const sa = stalenessOf(a.detector, recentPosts);
    const sb = stalenessOf(b.detector, recentPosts);
    if (sa !== sb) return sb - sa;
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  // Category cap only bites in seed mode; at one post per run it cannot.
  const cap =
    maxPosts > POSTS_PER_RUN
      ? Math.max(PER_CATEGORY_CAP_STANDARD, Math.ceil(maxPosts / 3))
      : Number.POSITIVE_INFINITY;

  const limit = maxPosts + CANDIDATE_RESERVE;
  const selected: ScoredFinding[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const f of ranked) {
    if (selected.length >= limit) break;
    if ((categoryCounts[f.category] ?? 0) >= cap) continue;
    selected.push(f);
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  return selected;
}

/**
 * Posts published since this detector last appeared. `Infinity` if it never has,
 * so a detector that has never published sorts ahead of every detector that has.
 *
 * `recentPosts` must be sorted newest-first.
 */
function stalenessOf(detector: string, recentPosts: LinerNotesPost[]): number {
  const index = recentPosts.findIndex((p) => p.detector === detector);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/**
 * True if this finding's primary (headliner) artist headlined any of the last
 * ARTIST_COOLDOWN_POSTS published posts. Exempt for `venue-ghost`, which is a
 * venue-centric story — we don't want a recent post about an artist who happened
 * to play at a now-demolished venue to block the venue's own story.
 *
 * `recentPosts` must be sorted newest-first.
 */
function isInPrimaryArtistCooldown(
  finding: ScoredFinding,
  recentPosts: LinerNotesPost[]
): boolean {
  if (finding.detector === "venue-ghost") return false;
  const primary = finding.artists[0];
  if (!primary) return false;
  const window = recentPosts.slice(0, ARTIST_COOLDOWN_POSTS);
  return window.some((p) => p.artists[0] === primary);
}

// ── Step 2: Post building ─────────────────────────────────────────────────────

/**
 * Transform selected ScoredFinding[] (with prose already attached) into
 * LinerNotesPost[] ready to merge into liner-notes.json.
 * Findings without prose are skipped with a console warning.
 */
export function buildPosts(
  selected: ScoredFinding[],
  options: CurateOptions
): LinerNotesPost[] {
  const publishedAt = options.publishedAt ?? new Date().toISOString();
  const existingSlugSet = new Set(options.existingPosts.map((p) => p.slug));
  const previousById = new Map(options.existingPosts.map((p) => [p.id, p]));
  const newPosts: LinerNotesPost[] = [];

  for (const finding of selected) {
    if (!finding.prose) {
      console.warn(`[curate] Skipping "${finding.headline}" — no prose attached`);
      continue;
    }

    // Regenerating a post keeps its slug. `mergePosts` deduplicates by id, so
    // the previous post is about to be overwritten — but it was still in the
    // collision set, so `generateSlug` would dodge it with a "-2" suffix and
    // then the un-suffixed original would vanish from the feed. Every other
    // post's `relatedSlugs` pointing at that base slug went dangling, and the
    // post's own URL 404'd. The URL is the longest-lived thing a post emits
    // (#234).
    const previous = previousById.get(finding.id);
    const slug = previous?.slug ?? generateSlug(finding.headline, existingSlugSet);
    existingSlugSet.add(slug); // prevent collision within this batch

    const image = resolveImage(finding, options);
    const audio = resolveAudio(finding, options);
    const deepLinks = buildDeepLinks(finding, options);
    const relatedSlugs = findRelatedSlugs(finding, options.existingPosts, slug);

    const post: LinerNotesPost = {
      id: finding.id,
      slug,
      category: finding.category,
      temporality: finding.temporality,
      headline: finding.headline,
      prose: finding.prose,
      image,
      ...(audio ? { audio } : {}),
      artists: finding.artists,
      venues: finding.venues,
      years: finding.years,
      tags: finding.tags,
      deepLinks,
      relatedSlugs,
      score: finding.score,
      detector: finding.detector,
      publishedAt,
    };

    newPosts.push(post);
  }

  return newPosts;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function isDuplicate(
  finding: ScoredFinding,
  existingPosts: LinerNotesPost[],
  now: number
): boolean {
  for (const post of existingPosts) {
    if (post.detector !== finding.detector) continue;

    // venue-ghost is about a specific room — deduplicate by venue, not artist
    if (finding.detector === "venue-ghost") {
      const venueOverlap = finding.venues.some((v) => post.venues?.includes(v));
      if (!venueOverlap) continue;
    } else {
      // Same artist + same detector
      const artistOverlap = finding.artists.some((a) => post.artists.includes(a));
      if (!artistOverlap) continue;
    }

    // Within cooldown window?
    const publishedDate = new Date(post.publishedAt);
    const monthsAgo =
      (now - publishedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < RERUN_COOLDOWN_MONTHS) return true;
  }
  return false;
}

// ── Image resolution ──────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGE: PostImage = {
  url: PLACEHOLDER_IMAGE_URL,
  alt: "Concert",
  source: "placeholder",
};

/**
 * Every non-placeholder branch sets `ref` alongside `url`. `ref` is the durable
 * part — the pipeline re-resolves `url` from it on every run, so a revoked
 * third-party URL heals instead of stranding the post (#252).
 */
function resolveImage(finding: ScoredFinding, options: CurateOptions): PostImage {
  const { suggestedImage } = finding;

  /* OUR OWN PHOTOGRAPH BEATS A SOURCED ONE, which is the imagery rubric applied rather than
     restated: tier 1 is the archive's photography, tier 2 is a third-party artist, album or
     venue image. A frame the owner took at the show is the more honest illustration of a
     post about that show, and it is the only image here that cannot be revoked by someone
     else.

     🔴 THIS RUNS FIRST, AND THAT PLACEMENT IS THE WHOLE POINT. It used to sit below the
     detector's `suggestedImage` and below the top-tracks album-art fallback — both tier 2 —
     which made it unreachable in practice rather than merely deprioritised: every act with
     published photography also has album art AND an artist image, so one of the two earlier
     branches always returned first. The rubric was stated in the comment and inverted by
     the ordering, and the evidence was in the output — 58 published posts, not one of them
     `source: "show"`, while `getShowImageUrl` sat correct and tested.

     Falls through silently when there is no photograph of this act — which is most acts,
     most of the time.

     🔴 EXCEPT ON A VENUE POST, where a photograph of an ARTIST is the wrong subject however
     good its provenance. `venue-loyalty` and `venue-ghost` are venue-scoped but still carry
     an `artists` array, so `artists[0]` is whoever happens to sort first — on both Universal
     Amphitheater posts that is Howard Jones, whose only published frames were taken in 2024
     at a different venue, years after Universal was demolished. Publishing one there is the
     different-venue twin of the fabricated-attribution failure the media skill names.

     The archive DOES have its own venue photography — `2026-06-04-venue-01.jpg`, tier 1,
     `subject: "venue"` — but `media-index.json` records no venue key for it, so nothing can
     look it up. Until it does, a venue post's own photograph is unreachable and the sourced
     venue image is the best available. That is a gap in the index, not a reason to publish
     the wrong subject. */
  const primary = finding.artists[0];
  if (primary && finding.suggestedImage?.type !== "venue") {
    const asset = getShowAsset(primary, options);
    if (asset?.url) {
      const image: PostImage = {
        url: asset.url,
        alt: displayName(primary, options.artistsMetadata),
        source: "show",
        ref: primary,
        credit: showByline(asset.date),
        shotOn: asset.date,
      };
      // Only when the owner actually drew one. An absent box is not `{0,0,1,1}`: the
      // renderer has to be able to tell "uncropped" from "cropped to the full frame", or
      // an unreviewed asset silently claims a judgement nobody made.
      if (asset.crop) image.crop = { ...asset.crop };
      return image;
    }
  }

  // Try suggested type first
  if (suggestedImage) {
    if (suggestedImage.type === "artist" && suggestedImage.artistNormalized) {
      const url = options.artistsMetadata[suggestedImage.artistNormalized]?.image;
      if (url) {
        return {
          url,
          alt: displayName(suggestedImage.artistNormalized, options.artistsMetadata),
          source: "artist",
          ref: suggestedImage.artistNormalized,
        };
      }
    }
    if (suggestedImage.type === "venue" && suggestedImage.venueNormalized) {
      const url = getVenueImageUrl(suggestedImage.venueNormalized, options);
      if (url) {
        return {
          url,
          alt: displayVenueName(suggestedImage.venueNormalized, options),
          source: "venue",
          ref: suggestedImage.venueNormalized,
        };
      }
    }
    if (suggestedImage.type === "album" && suggestedImage.artistNormalized) {
      const albumArt = getAlbumArt(
        suggestedImage.artistNormalized,
        suggestedImage.albumName,
        options
      );
      if (albumArt) {
        return {
          url: upsizeAppleMusicUrl(albumArt),
          alt: suggestedImage.albumName ?? "Album art",
          source: "album",
          ref: suggestedImage.artistNormalized,
          albumName: suggestedImage.albumName,
        };
      }
    }
  }

  /* 🔴 THE FALLBACK ORDER IS THE OWNER'S RUBRIC, 2026-08-29: photography, then the venue,
     then the artist. It ran album → artist → venue, so a real photograph of a real room the
     owner stood in lost to a promo shot AND to a piece of cover artwork.

     The ranking is about what the image IS. Our own photograph is irreplaceable. A Places
     photo is a real photograph of a real place on the ticket. An artist press shot is a
     promo image from a third party, often from the wrong decade. Album art is not a
     photograph of anything that happened.

     Tier 1 is handled above, before `suggestedImage`, so this chain starts at the venue. */
  const primaryArtist = finding.artists[0];

  // Venue photo
  const primaryVenue = finding.venues[0];
  if (primaryVenue) {
    const url = getVenueImageUrl(primaryVenue, options);
    if (url) {
      return {
        url,
        alt: displayVenueName(primaryVenue, options),
        source: "venue",
        ref: primaryVenue,
      };
    }
  }

  // Artist photo
  if (primaryArtist) {
    const url = options.artistsMetadata[primaryArtist]?.image;
    if (url) {
      return {
        url,
        alt: displayName(primaryArtist, options.artistsMetadata),
        source: "artist",
        ref: primaryArtist,
      };
    }
  }

  // Album art from primary artist's first track
  if (primaryArtist) {
    const track = options.artistsTopTracks[primaryArtist]?.tracks.find((t) => t.albumArt);
    if (track?.albumArt) {
      return {
        url: upsizeAppleMusicUrl(track.albumArt),
        alt: track.albumName ?? "Album art",
        source: "album",
        ref: primaryArtist,
        albumName: track.albumName,
      };
    }
  }

  return PLACEHOLDER_IMAGE;
}

/**
 * Venue photo, album art and artist photo resolution live in `image-refs.ts`,
 * shared with the pipeline's re-resolve stage so a published post's image is
 * recomputed the same way it was first computed (#252).
 *
 * Note on the venue placeholder: `venues-metadata.json` stores the generic
 * fallback *as* the photo for 11 of 79 venues, so a missing photo is
 * indistinguishable from a present one unless the chain checks for it — which
 * meant `resolveImage` short-circuited on the placeholder and never reached
 * album art or an artist photo further down the chain (#235).
 */

// ── Audio resolution ──────────────────────────────────────────────────────────

/**
 * The track that plays in a post's footer, in descending order of preference
 * (#299):
 *
 *   1. The subject song itself, fetched from iTunes and title-verified ahead
 *      of the build by `fetchSubjectTracks`.
 *   2. The subject song, if it happens to be in the cached top tracks — the
 *      recording artist's list first, then the post's own artist.
 *   3. The artist's best-known track, LABELLED `"best-known"` so the player
 *      can say it is not the song the post names.
 *   4. Nothing.
 *
 * Tier 3 is the old behaviour and remains correct for the ~15 detectors whose
 * story is a night, an artist or a venue. The bug was reaching it silently on
 * the handful whose story is one specific song.
 */
function resolveAudio(
  finding: ScoredFinding,
  options: CurateOptions
): PostAudio | undefined {
  const { suggestedTrack } = finding;
  const artistSlug = suggestedTrack?.artistNormalized ?? finding.artists[0];
  if (!artistSlug) return undefined;

  const wanted = suggestedTrack?.trackName;
  // A subject song without a recording artist is unresolvable, not merely
  // harder — see the field comment on SuggestedTrack.recordedByNormalized.
  const recordedBy = wanted ? suggestedTrack?.recordedByNormalized : undefined;

  // ── Tier 1: the real song, fetched and verified ──────────────────────────
  if (wanted && recordedBy) {
    const fetched = options.subjectTracks?.[songAlbumKey(recordedBy, wanted)];
    if (fetched?.previewUrl) {
      return {
        trackName: fetched.name,
        artistName:
          fetched.artistName || displayName(recordedBy, options.artistsMetadata),
        albumName: fetched.albumName ?? "",
        previewUrl: fetched.previewUrl,
        albumArt: fetched.albumArt ?? "",
        streamingUrl: fetched.streamingUrl ?? "",
        source: "itunes",
        role: "subject",
      };
    }
  }

  // ── Tier 2: the real song, already in the cache ──────────────────────────
  if (wanted) {
    // Recording artist first: for a cover, their list is the one that can hold
    // the song, and the performing act's list is where *Get Lucky* came from.
    for (const slug of [recordedBy, artistSlug]) {
      if (!slug) continue;
      const entry = options.artistsTopTracks[slug];
      const hit = entry?.tracks.find(
        (t) => t.previewUrl && titleMatches(t.name, wanted)
      );
      if (hit?.previewUrl) {
        return {
          trackName: hit.name,
          artistName: entry?.name ?? displayName(slug, options.artistsMetadata),
          albumName: hit.albumName ?? "",
          previewUrl: hit.previewUrl,
          albumArt: hit.albumArt ?? "",
          streamingUrl: hit.streamingUrl ?? "",
          source: "itunes",
          role: "subject",
        };
      }
    }
  }

  // ── Tier 3: best-known track, labelled when the post named a song ────────
  const entry = options.artistsTopTracks[artistSlug];
  if (!entry) return undefined;

  const track = entry.tracks.find((t) => t.previewUrl);
  if (!track?.previewUrl) return undefined;

  return {
    trackName: track.name,
    artistName: entry.name ?? displayName(artistSlug, options.artistsMetadata),
    albumName: track.albumName ?? "",
    previewUrl: track.previewUrl,
    albumArt: track.albumArt ?? "",
    streamingUrl: track.streamingUrl ?? "",
    source: "itunes",
    // Only when there was a song to miss. A post about a night has nothing to
    // apologise for, and labelling it would be noise on ~15 detectors.
    ...(wanted ? { role: "best-known" as const } : {}),
  };
}

// ── Subject-song lookup (network) ─────────────────────────────────────────────

/** The one method of `iTunesClient` this module needs, so tests can stub it. */
export interface SongSearch {
  searchSong(
    artistName: string,
    songTitle: string,
    limit?: number
  ): Promise<NormalizedTrack[]>;
}

/**
 * True when an iTunes result is the song we asked for.
 *
 * Folded on both sides via the project's canonical key, so
 * "Notorious (Deluxe Edition)" matches "Notorious" and *Axel F* does not.
 * `songIndexKeys` rather than a bare `foldSongTitle` so a merged pressing —
 * "Enjoy the Silence / Interlude #2" — still matches its own components.
 */
function titleMatches(candidate: string, wanted: string): boolean {
  const key = foldSongTitle(wanted);
  if (!key) return false;
  return songIndexKeys(candidate).includes(key);
}

/**
 * True when an iTunes result is by the artist we asked for.
 *
 * Token containment, not string containment: iTunes bills the same recording
 * as "Chic", "Nile Rodgers & Chic" and "CHIC feat. Nile Rodgers", so an exact
 * compare rejects real matches — while a substring compare would accept
 * *Chicago* for *Chic*.
 *
 * A title match alone is not enough to trust a result. "Notorious" is also a
 * song by four other acts, and the search term is a plain keyword query that
 * has already been observed answering with the wrong artist entirely (#275).
 */
function artistMatches(candidate: string, wanted: string): boolean {
  const a = normalizeArtistName(candidate).split("-").filter(Boolean);
  const b = normalizeArtistName(wanted).split("-").filter(Boolean);
  if (!a.length || !b.length) return false;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const set = new Set(longer);
  return shorter.every((token) => set.has(token));
}

/**
 * Fetch the subject song for every finding that names one (#299).
 *
 * One iTunes call per finding that carries a subject song, deduplicated by
 * artist+song. At one published post a week this is a single request per run,
 * which is negligible against the budget that constrains the artist sweep —
 * but the run must survive that request failing, so nothing here throws.
 *
 * A 403 STOPS the sweep rather than continuing: it means the client is blocked
 * and every subsequent request will fail the same way. Remaining findings fall
 * back to their best-known track, labelled, which is the designed behaviour
 * rather than a degradation.
 */
export async function fetchSubjectTracks(
  findings: ScoredFinding[],
  artistsMetadata: CurateOptions["artistsMetadata"],
  client: SongSearch
): Promise<Record<string, NormalizedTrack>> {
  const resolved: Record<string, NormalizedTrack> = {};
  const attempted = new Set<string>();

  for (const finding of findings) {
    const wanted = finding.suggestedTrack?.trackName;
    const recordedBy = finding.suggestedTrack?.recordedByNormalized;
    if (!wanted || !recordedBy) continue;

    const key = songAlbumKey(recordedBy, wanted);
    if (attempted.has(key)) continue;
    attempted.add(key);

    const artistName = displayName(recordedBy, artistsMetadata);

    let candidates: NormalizedTrack[];
    try {
      candidates = await client.searchSong(artistName, wanted, 5);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      console.warn(`   ⚠️  Subject song lookup failed — ${artistName} — "${wanted}": ${message}`);
      if ((err as Error).name === "ITunesBlockedError") {
        console.warn("   ⚠️  iTunes is blocking this client — remaining lookups skipped.");
        break;
      }
      continue;
    }

    // Both guards, or nothing. Whatever is chosen here is written into
    // liner-notes.json and permalinked, so an unverified result is permanent —
    // and a wrong song nobody asked for is worse than an honest fallback.
    const hit = candidates.find(
      (c) =>
        c.previewUrl &&
        titleMatches(c.name, wanted) &&
        artistMatches(c.artistName, artistName)
    );

    if (hit) {
      resolved[key] = hit;
      console.log(`   ♪ "${hit.name}" — ${hit.artistName}`);
    } else {
      console.log(
        `   ♪ No verified match for "${wanted}" by ${artistName} — ` +
          `falling back to their best-known track`
      );
    }
  }

  return resolved;
}

// ── Slug generation ───────────────────────────────────────────────────────────

function generateSlug(headline: string, existingSlugSet: Set<string>): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!existingSlugSet.has(base)) return base;

  // Collision: append suffix
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!existingSlugSet.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ── Deep link generation ──────────────────────────────────────────────────────


// "2026-07-31" -> "July 31, 2026". Parsed at UTC midnight so the label can't
// slip a day west of Greenwich.
function formatConcertDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildDeepLinks(finding: ScoredFinding, options: CurateOptions): DeepLink[] {
  const links: DeepLink[] = [];

  // Artist links (up to 3)
  for (const artistSlug of finding.artists.slice(0, 3)) {
    links.push({
      label: displayName(artistSlug, options.artistsMetadata),
      url: `/?scene=artists&artist=${encodeURIComponent(artistSlug)}`,
      type: "artist",
    });
  }

  // Venue links (up to 2)
  for (const venueSlug of finding.venues.slice(0, 2)) {
    links.push({
      label: displayVenueName(venueSlug, options),
      url: `/?scene=venues&venue=${encodeURIComponent(venueSlug)}`,
      type: "venue",
    });
  }

  // Setlist link — one night, when the finding is about a specific one (#198).
  // Needs an artist too, since the URL is the artist deep link plus `show=`.
  // Keyed on the concert date, never the concert id: those are row-order
  // artifacts and a data re-import that renumbers rows would break every link
  // in every published post. See docs/DEEP_LINKING.md v1.2.
  // Only when that night has songs on record — a link promising a setlist and
  // opening an empty panel is worse than no link.
  const nightHasSetlist =
    !options.datesWithSetlists || options.datesWithSetlists.has(finding.concertDate ?? "");
  if (finding.concertDate && finding.artists.length > 0 && nightHasSetlist) {
    const artistSlug = finding.artists[0];
    links.push({
      // A date reads well in a link row and, unlike an artist or venue name,
      // won't collide with the other labels when linkifyProse matches them
      // inside the prose.
      label: formatConcertDate(finding.concertDate),
      url: `/?scene=artists&artist=${encodeURIComponent(artistSlug)}&show=${finding.concertDate}`,
      type: "setlist",
    });
  }

  // Timeline link — one link for the primary year (first year)
  if (finding.years.length > 0) {
    const year = finding.years[0];
    links.push({
      label: String(year),
      url: `/?scene=timeline&year=${year}`,
      type: "timeline",
    });
  }

  return links;
}

// ── Related posts ─────────────────────────────────────────────────────────────

function findRelatedSlugs(
  finding: ScoredFinding,
  existingPosts: LinerNotesPost[],
  currentSlug: string
): string[] {
  type Scored = { slug: string; score: number };
  const candidates: Scored[] = [];

  for (const post of existingPosts) {
    if (post.slug === currentSlug) continue;

    let relevance = 0;

    // Same artist
    const artistOverlap = finding.artists.some((a) => post.artists.includes(a));
    if (artistOverlap) relevance += 4;

    // Same venue
    const venueOverlap = finding.venues.some((v) => post.venues.includes(v));
    if (venueOverlap) relevance += 3;

    // Shared tag
    const tagOverlap = finding.tags.some((t) => post.tags.includes(t));
    if (tagOverlap) relevance += 2;

    // Same decade
    const findingDecades = new Set(finding.years.map((y) => Math.floor(y / 10) * 10));
    const postDecades = post.years.map((y) => Math.floor(y / 10) * 10);
    const decadeOverlap = postDecades.some((d) => findingDecades.has(d));
    if (decadeOverlap) relevance += 1;

    if (relevance > 0) candidates.push({ slug: post.slug, score: relevance });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((c) => c.slug);
}

// ── Display name helpers ──────────────────────────────────────────────────────

function displayName(
  slug: string,
  artistsMetadata: CurateOptions["artistsMetadata"]
): string {
  return artistsMetadata[slug]?.name ?? unslugify(slug);
}

function displayVenueName(slug: string, options: CurateOptions): string {
  return options.venuesMetadata[slug]?.name ?? unslugify(slug);
}

function unslugify(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
