/**
 * Agentic Liner Notes — Pipeline-internal type definitions
 *
 * These types are used only within the scripts/liner-notes/ pipeline.
 * App-facing types live in src/types/liner-notes.ts.
 */

// ── Content classification ──────────────────────────────────────────────────

export type ContentCategory = "cultural" | "personal" | "deep-cut";

export type Temporality = "evergreen" | "timely";

export type DetectorName =
  // Tier 1 — implemented
  | "artist-longevity"
  | "opener-to-headliner"
  | "venue-loyalty"
  | "calendar-anniversary"
  | "geographic-chapter"
  | "concert-streak"
  | "milestone-marker"
  | "rare-sighting"
  | "historical-moment"
  | "venue-ghost"
  | "festival-mega-bill"
  | "drought-comeback"
  | "city-pulse"
  | "album-context"
  | "genre-outlier"
  // Tier 2 — stubbed for future phases
  | "discography-crossref"
  | "temporal-pattern"
  | "double-header";

// ── Image + audio media ─────────────────────────────────────────────────────

export interface SuggestedImage {
  type: "artist" | "venue" | "album";
  artistNormalized?: string;
  albumName?: string;
  venueNormalized?: string;
}

export interface SuggestedTrack {
  artistNormalized: string;
  trackName?: string;
  albumName?: string;
}

// ── Analysis finding (output of analyze.ts) ─────────────────────────────────

export interface AnalysisFinding {
  /** Deterministic ID, e.g. "longevity-social-distortion" */
  id: string;
  detector: DetectorName;
  category: ContentCategory;
  temporality: Temporality;
  timeliness?: {
    relevantDate: string;   // ISO date
    windowStart: string;
    windowEnd: string;
  };
  /** Short headline, 5–12 words */
  headline: string;
  /** Structured data passed to the story generator */
  dataPoints: Record<string, unknown>;
  artists: string[];        // Normalized artist names
  venues: string[];         // Normalized venue names
  years: number[];
  suggestedImage?: SuggestedImage;
  suggestedTrack?: SuggestedTrack;
  /** Auto-derived tags, e.g. ["#artist-longevity", "#multi-decade"] */
  tags: string[];
  /** Populated by scorer */
  score?: number;
  /** Populated by generator */
  prose?: string;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  specificity: number;       // 0–15
  span: number;              // 0–10
  dataRichness: number;      // 0–10
  surpriseFactor: number;    // 0–10
  timelinessBonus: number;   // 0–10
  categoryBalance: number;   // 0–5
  total: number;             // 0–60
}

export interface ScoredFinding extends AnalysisFinding {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

// ── Deduplication store ──────────────────────────────────────────────────────

export interface DeduplicationEntry {
  /** Normalized artist slug */
  artistSlug: string;
  detector: DetectorName;
  /** ISO timestamp of first publication */
  publishedAt: string;
}

// ── Pipeline run context ─────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Only analyze; do not generate or write output */
  analyzeOnly: boolean;
  /** Run full pipeline but do not write any files */
  dryRun: boolean;
  /** Generate ~10 posts for first-run seeding */
  seed: boolean;
  /** Force re-generation even for deduplicated artists */
  force: boolean;
  /** Override today's date for testing (YYYY-MM-DD) */
  date?: string;
}
