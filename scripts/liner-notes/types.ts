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
  | "full-circle"
  | "guest-bridge"
  | "album-trajectory"
  | "road-tested"
  | "most-witnessed-album"
  // Implemented and tested, but NOT registered in analyze()'s dispatcher.
  // Enablement is scheduled into v5.5 (#267 §5d) — see the comment there.
  | "discography-crossref"
  // Tier 2 — stubbed for future phases
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
  /**
   * Whose best-known track to fall back to when no subject song resolves.
   * This is the artist the POST is about, which for a cover is the act that
   * played it live rather than the act that recorded it.
   */
  artistNormalized: string;
  /**
   * The song this post is about (#299). Set only by detectors whose story has
   * a single unambiguous subject song; the rest leave it undefined and keep
   * artist-level audio, which for them is not wrong.
   */
  trackName?: string;
  /**
   * Whose *recording* of `trackName` to look for — normalized, and NOT
   * interchangeable with `artistNormalized`.
   *
   * Searching the act that performed it live returns a confidently wrong
   * track: iTunes answers `Nile Rodgers` + `"Notorious"` with *Axel F*, since
   * he played on the record but Duran Duran recorded it. Required alongside
   * `trackName` — audio resolution ignores a subject song without it.
   */
  recordedByNormalized?: string;
  /** The album `trackName` comes from, when the post's subject is an album. */
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
  /**
   * The specific night this story is about, ISO YYYY-MM-DD, when it is about
   * one (#198). Detectors that are inherently concert-scoped — doubleHeader,
   * temporalPattern (#68) — should set it; the rest leave it undefined and
   * simply get no setlist link. Optional so no existing detector changes.
   */
  concertDate?: string;
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
