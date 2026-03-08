/**
 * Agentic Liner Notes — App-facing type definitions
 *
 * These types describe the shape of public/data/liner-notes.json
 * as consumed by the React app.
 */

// ── Content classification ──────────────────────────────────────────────────

export type PostCategory = "cultural" | "personal" | "deep-cut";

export type PostTemporality = "evergreen" | "timely";

// ── Media ───────────────────────────────────────────────────────────────────

export interface PostImage {
  url: string;
  alt: string;
  source: "artist" | "venue" | "album" | "placeholder";
  credit?: string;
}

export interface PostAudio {
  trackName: string;
  artistName: string;
  albumName: string;
  previewUrl: string;
  albumArt: string;
  streamingUrl: string;
  source: "itunes";
}

// ── Deep links ───────────────────────────────────────────────────────────────

export interface DeepLink {
  /** Display label, e.g. "Depeche Mode" or "Irvine Meadows" */
  label: string;
  /** App URL, e.g. "/?scene=artists&artist=depeche-mode" */
  url: string;
  type: "artist" | "venue" | "timeline";
}

// ── Post ─────────────────────────────────────────────────────────────────────

export interface LinerNotesPost {
  /** Deterministic ID, e.g. "longevity-social-distortion" */
  id: string;
  /** URL-safe permalink slug, e.g. "38-years-of-depeche-mode" */
  slug: string;
  category: PostCategory;
  temporality: PostTemporality;

  // Content
  headline: string;
  /** First-person editorial prose, 2–5 sentences */
  prose: string;

  // Media
  image: PostImage;
  audio?: PostAudio;

  // Cross-references
  /** Normalized artist names */
  artists: string[];
  /** Normalized venue names */
  venues: string[];
  years: number[];
  /** Auto-derived tags, e.g. ["#artist-longevity", "#multi-decade"] */
  tags: string[];
  /** At least one deep link is required per post */
  deepLinks: DeepLink[];
  /** Slugs of related posts (0–2) */
  relatedSlugs: string[];

  // Metadata
  score: number;
  detector: string;
  publishedAt: string;      // ISO timestamp
  /** When true, post covers the full archive and is excluded from artist/venue URL filters */
  aggregate?: boolean;

  // AI discoverability
  searchableNarrative?: string;
}

// ── Feed store (liner-notes.json root) ───────────────────────────────────────

export interface LinerNotesFeedMetadata {
  totalPosts: number;
  /** Lifetime candidate posts generated (including unpublished) */
  totalGenerated: number;
  averageScore: number;
  lastPipelineRun: string;  // ISO timestamp
  concertsAnalyzed: number;
  feedUrl: string;          // "/liner-notes.xml"
}

export interface LinerNotesData {
  /** ISO timestamp of last pipeline run */
  generatedAt: string;
  /** Hash of concerts.json at time of run */
  dataHash: string;
  /** All published posts, newest first */
  posts: LinerNotesPost[];
  metadata: LinerNotesFeedMetadata;
}
