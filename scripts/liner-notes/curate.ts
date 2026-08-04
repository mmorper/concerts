/**
 * Agentic Liner Notes — Content Curator
 *
 * Selects the best 2–3 findings from scored candidates, resolves media,
 * generates slugs, deep links, and related-post references, then emits
 * fully-formed LinerNotesPost objects ready for liner-notes.json.
 *
 * Two exported functions allow the pipeline to interleave generation:
 *
 *   1. select()     — choose 2–3 candidates from scored findings (pre-prose)
 *   2. buildPosts() — enrich selected findings (with prose) into LinerNotesPost[]
 */

import type { ContentCategory, ScoredFinding } from "./types.ts";
import type {
  DeepLink,
  LinerNotesPost,
  PostAudio,
  PostImage,
} from "../../src/types/liner-notes.ts";

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface CurateOptions {
  artistsMetadata: Record<string, { name?: string; image?: string; bio?: string; genres?: string[] }>;
  artistsTopTracks: Record<string, {
    name?: string;
    tracks: Array<{ name: string; albumName?: string; albumArt?: string; previewUrl?: string; streamingUrl?: string; durationMs?: number }>;
  }>;
  venuesMetadata: Record<string, { name?: string; photoUrls?: string[] | { thumbnail?: string; medium?: string; large?: string }; manualPhotos?: string[] }>;
  /** Published posts to dedup against and resolve related slugs. */
  existingPosts: LinerNotesPost[];
  /** ISO timestamp to stamp publishedAt on new posts. Defaults to now. */
  publishedAt?: string;
}

/** Max posts to publish per pipeline run. */
const MAX_POSTS = 3;
/** Min score to consider for standard selection. */
const STANDARD_THRESHOLD = 30;
/** Fallback score if we can't reach 2 posts at standard threshold. */
const FALLBACK_THRESHOLD = 20;
/** Months before the same artist can appear twice for the same detector. */
const RERUN_COOLDOWN_MONTHS = 6;
/** A finding whose primary artist (artists[0]) headlined any of the last N posts is skipped. */
const ARTIST_COOLDOWN_POSTS = 10;
/** Window of most-recent posts used to measure category dominance. */
const RECENT_CATEGORY_WINDOW = 10;
/** A category occupying this share (or more) of the recent window is deprioritized this run. */
const CATEGORY_DOMINANCE_THRESHOLD = 0.5;
/** In standard (non-seed) runs, no single category may exceed this many posts per run. */
const PER_CATEGORY_CAP_STANDARD = 2;

// ── Step 1: Selection ─────────────────────────────────────────────────────────

/**
 * Select candidate findings using the spec's category-diversity algorithm.
 * Applies deduplication against previously published posts.
 * Returns findings sorted by score descending — no prose yet.
 *
 * @param maxPosts Override the default cap (used by seed mode).
 */
export function select(
  findings: ScoredFinding[],
  existingPosts: LinerNotesPost[],
  maxPosts: number = MAX_POSTS
): ScoredFinding[] {
  const sorted = [...findings].sort((a, b) => b.score - a.score);
  const recentPosts = [...existingPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Filter: dedup (detector+artist, 6-month) AND primary-artist cooldown (last N posts, any detector)
  const candidates = sorted.filter(
    (f) => !isDuplicate(f, existingPosts) && !isInPrimaryArtistCooldown(f, recentPosts)
  );

  // Deprioritize any category that already owns ≥50% of the recent publishing window
  const dominant = getDominantCategories(recentPosts);
  const preferred = candidates.filter((c) => !dominant.has(c.category));
  const deprioritized = candidates.filter((c) => dominant.has(c.category));

  const isSeeding = maxPosts > MAX_POSTS;
  const standardCap = isSeeding ? Math.floor(maxPosts / 3) : PER_CATEGORY_CAP_STANDARD;
  const deepCutCap = isSeeding ? maxPosts - 2 * standardCap : PER_CATEGORY_CAP_STANDARD;
  const getCap = (cat: string): number => (cat === "deep-cut" ? deepCutCap : standardCap);

  const selected: ScoredFinding[] = [];
  const usedCategories = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  // Phase 1: category diversity from preferred pool — pick best of each new category above threshold
  for (const f of preferred) {
    if (selected.length >= maxPosts) break;
    if (f.score < STANDARD_THRESHOLD) break; // sorted descending
    if (!usedCategories.has(f.category)) {
      selected.push(f);
      usedCategories.add(f.category);
      categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
    }
  }

  // Phase 2: fill from preferred pool, respecting per-category cap
  const phase2Target = maxPosts !== MAX_POSTS ? maxPosts : 2;
  const fillFrom = (pool: ScoredFinding[], target: number) => {
    for (const f of pool) {
      if (selected.length >= target) break;
      if (f.score < FALLBACK_THRESHOLD) break;
      if (selected.includes(f)) continue;
      if ((categoryCounts[f.category] ?? 0) >= getCap(f.category)) continue;
      selected.push(f);
      categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
    }
  };
  if (selected.length < phase2Target) fillFrom(preferred, phase2Target);

  // Phase 3: last-resort fallback — dip into deprioritized (dominant-category) pool if still short
  if (selected.length < phase2Target) fillFrom(deprioritized, phase2Target);

  // Cap at maxPosts, tie-break timely > evergreen
  const capped = selected.slice(0, maxPosts).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.temporality === "timely" ? 1 : 0;
    const tb = b.temporality === "timely" ? 1 : 0;
    return tb - ta;
  });

  return capped;
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

/**
 * Returns the set of categories that occupy ≥ CATEGORY_DOMINANCE_THRESHOLD of
 * the last RECENT_CATEGORY_WINDOW posts. Those categories are deprioritized
 * (moved to a last-resort pool) during selection this run.
 *
 * `recentPosts` must be sorted newest-first.
 */
function getDominantCategories(recentPosts: LinerNotesPost[]): Set<ContentCategory> {
  const window = recentPosts.slice(0, RECENT_CATEGORY_WINDOW);
  const over = new Set<ContentCategory>();
  if (window.length === 0) return over;
  const counts: Record<string, number> = {};
  for (const p of window) counts[p.category] = (counts[p.category] ?? 0) + 1;
  for (const [cat, c] of Object.entries(counts)) {
    if (c / window.length >= CATEGORY_DOMINANCE_THRESHOLD) over.add(cat as ContentCategory);
  }
  return over;
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
  const newPosts: LinerNotesPost[] = [];

  for (const finding of selected) {
    if (!finding.prose) {
      console.warn(`[curate] Skipping "${finding.headline}" — no prose attached`);
      continue;
    }

    const slug = generateSlug(finding.headline, existingSlugSet);
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

function isDuplicate(finding: ScoredFinding, existingPosts: LinerNotesPost[]): boolean {
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
      (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < RERUN_COOLDOWN_MONTHS) return true;
  }
  return false;
}

// ── Image resolution ──────────────────────────────────────────────────────────

/**
 * Apple Music album art URLs support resolution suffixes.
 * Upsize from 100x100 (mini player thumbnail) to 600x600 for card hero images.
 */
function upsizeAppleMusicUrl(url: string): string {
  return url.replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg')
}

const PLACEHOLDER_IMAGE: PostImage = {
  url: "/images/liner-notes-placeholder.jpg",
  alt: "Concert",
  source: "placeholder",
};

function resolveImage(finding: ScoredFinding, options: CurateOptions): PostImage {
  const { suggestedImage } = finding;

  // Try suggested type first
  if (suggestedImage) {
    if (suggestedImage.type === "artist" && suggestedImage.artistNormalized) {
      const url = options.artistsMetadata[suggestedImage.artistNormalized]?.image;
      if (url) {
        return {
          url,
          alt: displayName(suggestedImage.artistNormalized, options.artistsMetadata),
          source: "artist",
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
        };
      }
    }
  }

  // Fallback chain: album → artist → venue → placeholder
  const primaryArtist = finding.artists[0];

  // Album art from primary artist's first track
  if (primaryArtist) {
    const track = options.artistsTopTracks[primaryArtist]?.tracks.find((t) => t.albumArt);
    if (track?.albumArt) {
      return { url: upsizeAppleMusicUrl(track.albumArt), alt: track.albumName ?? "Album art", source: "album" };
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
      };
    }
  }

  // Venue photo
  const primaryVenue = finding.venues[0];
  if (primaryVenue) {
    const url = getVenueImageUrl(primaryVenue, options);
    if (url) {
      return {
        url,
        alt: displayVenueName(primaryVenue, options),
        source: "venue",
      };
    }
  }

  return PLACEHOLDER_IMAGE;
}

function getVenueImageUrl(
  venueSlug: string,
  options: CurateOptions
): string | undefined {
  const venue = options.venuesMetadata[venueSlug];
  if (!venue) return undefined;

  // photoUrls is either a string[] (legacy) or { thumbnail, medium, large } object
  const photoUrls = venue.photoUrls;
  if (Array.isArray(photoUrls)) return photoUrls[0];
  if (photoUrls && typeof photoUrls === "object") {
    return photoUrls.large ?? photoUrls.medium ?? photoUrls.thumbnail;
  }

  return venue.manualPhotos?.[0];
}

function getAlbumArt(
  artistSlug: string,
  albumName: string | undefined,
  options: CurateOptions
): string | undefined {
  const tracks = options.artistsTopTracks[artistSlug]?.tracks;
  if (!tracks?.length) return undefined;
  if (albumName) {
    const match = tracks.find((t) => t.albumName === albumName && t.albumArt);
    if (match?.albumArt) return match.albumArt;
  }
  return tracks.find((t) => t.albumArt)?.albumArt;
}

// ── Audio resolution ──────────────────────────────────────────────────────────

function resolveAudio(
  finding: ScoredFinding,
  options: CurateOptions
): PostAudio | undefined {
  const { suggestedTrack } = finding;
  const artistSlug = suggestedTrack?.artistNormalized ?? finding.artists[0];
  if (!artistSlug) return undefined;

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
  };
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
  if (finding.concertDate && finding.artists.length > 0) {
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
