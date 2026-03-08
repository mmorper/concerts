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
  artistsTopTracks: Record<string, {
    name?: string;
    tracks: Array<{ name: string; albumName?: string; albumArt?: string; previewUrl?: string; streamingUrl?: string; durationMs?: number }>;
  }>;
  venuesMetadata: Record<string, { name?: string; photoUrls?: string[]; manualPhotos?: string[] }>;
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

// ── Step 1: Selection ─────────────────────────────────────────────────────────

/**
 * Select 2–3 candidate findings using the spec's category-diversity algorithm.
 * Applies deduplication against previously published posts.
 * Returns findings sorted by score descending — no prose yet.
 */
export function select(
  findings: ScoredFinding[],
  existingPosts: LinerNotesPost[]
): ScoredFinding[] {
  const sorted = [...findings].sort((a, b) => b.score - a.score);

  // Filter out deduplicated findings (same artist + same detector, within cooldown)
  const candidates = sorted.filter((f) => !isDuplicate(f, existingPosts));

  // Phase 1: category diversity — pick best from each category above threshold
  const selected: ScoredFinding[] = [];
  const usedCategories = new Set<string>();

  for (const f of candidates) {
    if (selected.length >= MAX_POSTS) break;
    if (f.score < STANDARD_THRESHOLD) break; // sorted descending, so remaining are lower
    if (!usedCategories.has(f.category)) {
      selected.push(f);
      usedCategories.add(f.category);
    }
  }

  // Phase 2: fill to at least 2 posts, lowering threshold if needed
  if (selected.length < 2) {
    for (const f of candidates) {
      if (selected.length >= MAX_POSTS) break;
      if (f.score < FALLBACK_THRESHOLD) break;
      if (!selected.includes(f)) {
        selected.push(f);
      }
    }
  }

  // Phase 3: cap at MAX_POSTS, tie-break timely > evergreen
  const capped = selected
    .slice(0, MAX_POSTS)
    .sort((a, b) => {
      // First by score
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: timely > evergreen
      const ta = a.temporality === "timely" ? 1 : 0;
      const tb = b.temporality === "timely" ? 1 : 0;
      return tb - ta;
    });

  return capped;
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

    // Same artist + same detector
    const artistOverlap = finding.artists.some((a) => post.artists.includes(a));
    if (!artistOverlap) continue;

    // Within cooldown window?
    const publishedDate = new Date(post.publishedAt);
    const monthsAgo =
      (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < RERUN_COOLDOWN_MONTHS) return true;
  }
  return false;
}

// ── Image resolution ──────────────────────────────────────────────────────────

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
          url: albumArt,
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
      return { url: track.albumArt, alt: track.albumName ?? "Album art", source: "album" };
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
  return venue.photoUrls?.[0] ?? venue.manualPhotos?.[0];
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

function buildDeepLinks(finding: ScoredFinding, options: CurateOptions): DeepLink[] {
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
      url: `/?scene=map&venue=${encodeURIComponent(venueSlug)}`,
      type: "venue",
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
