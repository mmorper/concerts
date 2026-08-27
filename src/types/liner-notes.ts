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
  /**
   * Derived, not authoritative. Re-resolved from `ref` on every pipeline run —
   * third-party image URLs (notably Google Places) can be revoked at any time
   * when the underlying photo is unpublished. Never hand-edit; edit `ref`.
   */
  url: string;
  alt: string;
  /**
   * `"show"` is the archive's OWN photography, from `media-index.json` — tier 1 in the
   * imagery rubric, above an artist press image or a Google Places venue photo. It is the
   * only source here that cannot be revoked by a third party.
   */
  source: "artist" | "venue" | "album" | "placeholder" | "show";
  /**
   * Source of truth for the image: the normalized venue or artist key this
   * image belongs to. Resolved against venues-metadata / artists-metadata,
   * both of which self-heal on the weekly refresh.
   */
  ref?: string;
  /** Album to match when `source` is "album"; `ref` holds the artist key. */
  albumName?: string;
  credit?: string;
  /**
   * True when the OG card was composited on a solid ground because `url`
   * could not be fetched at render time.
   *
   * The card is still written, because for the site's own `og:image` a plain
   * card beats a broken one. But it is **bare type**, which the imagery rubric
   * forbids outright — so syndication must refuse it. Without this flag
   * nothing downstream can tell: `buildPayload` classifies tier and source
   * from `url`, which still looks perfectly good, and checks only that the
   * card file exists.
   *
   * Set by Stage 8. Cleared on the next successful render.
   */
  cardFallback?: boolean;
}

/**
 * The authored social payload text (#329).
 *
 * Written on purpose by the generation step, in the archive's voice, alongside
 * the prose — never chopped out of the first paragraph. Every RSS-to-social
 * bridge in existence fails at exactly that, and it is the single most visible
 * tell that an account is automated.
 *
 * Optional because the 57 notes published before syndication existed do not
 * have it, and must never be back-filled by truncating their prose. A post
 * without it is not eligible to syndicate, which is the correct outcome — the
 * ledger seed suppresses the back catalogue anyway.
 */
export interface PostSocial {
  /** <= 120 chars. The line that earns the click. */
  hook: string;
  /** 3-5, each <= 120 chars. Consumed only by carousel adapters (Phase 3). */
  beats?: string[];
  /** The core sentence pair. Adapters append the link and the tags, nothing else. */
  caption: string;
  /** ISO timestamp of the generation run that authored it. */
  authoredAt: string;
}

export interface PostAudio {
  trackName: string;
  artistName: string;
  albumName: string;
  previewUrl: string;
  albumArt: string;
  streamingUrl: string;
  source: "itunes";
  /**
   * Why this track is the one playing (#299).
   *
   * `"subject"`    — the song the post is actually about.
   * `"best-known"` — the post names a song, that song could not be resolved,
   *                  and this is the artist's best-known track standing in.
   *                  The player must SAY so: presenting it silently is how a
   *                  post headlined *"Notorious"* came to play *Get Lucky*.
   *
   * Only ever set when the post HAS a subject song. Absent means the post is
   * about a night, an artist or a venue — there is nothing to mislabel — or
   * that it published before #299. Both render unlabelled, as they always have.
   */
  role?: "subject" | "best-known";
}

// ── Deep links ───────────────────────────────────────────────────────────────

export interface DeepLink {
  /** Display label, e.g. "Depeche Mode" or "Irvine Meadows" */
  label: string;
  /** App URL, e.g. "/?scene=artists&artist=depeche-mode" */
  url: string;
  /**
   * Members name the *destination the reader arrives at*, not the param that
   * selects it — which is why `"timeline"` covers `?scene=timeline&year=2024`
   * rather than being called `"year"`. By the same rule a link to one night's
   * setlist is `"setlist"`, even though the URL param is `show=` (#198).
   */
  type: "artist" | "venue" | "timeline" | "setlist";
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

  /** Authored social payload text. Absent on notes published before #329. */
  social?: PostSocial;

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
