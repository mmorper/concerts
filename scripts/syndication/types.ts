/**
 * Social Syndication — canonical payload types (#329).
 *
 * ONE canonical payload, N dumb adapters. Adapters **truncate and format
 * only** — they never make content decisions. That is what keeps the voice
 * consistent without auditing N prompt variants, makes a new channel a
 * formatting function rather than a content pipeline, and means one
 * voice-check failure blocks syndication everywhere by construction.
 *
 * `SyndicationPayload` is FROZEN — see §"Canonical Payload" in
 * docs/specs/future/global-social-syndication.md and the exit-criteria record
 * in docs/specs/future/mocks-social-syndication/DECISIONS.md. Every field was
 * decided by rendering it with real archive data. Do not reopen it here.
 */

// ── Channels ────────────────────────────────────────────────────────────────

/**
 * Every channel the epic names, not just the two Phase 1 ships. The ledger is
 * keyed `slug × platform` and is committed, so the *set of keys* is a data
 * contract that outlives this phase — a channel added in Phase 3 must not
 * change the meaning of a row written in Phase 1.
 */
export const CHANNELS = ["bluesky", "mastodon", "instagram", "x"] as const;
export type Channel = (typeof CHANNELS)[number];

/** The channels with adapters today. Phase 3 adds instagram and x (#334/#335). */
export const IMPLEMENTED_CHANNELS: readonly Channel[] = ["bluesky", "mastodon"];

// ── Media ───────────────────────────────────────────────────────────────────

export type MediaTier = 1 | 2 | 3;

/**
 * Where the pixels came from — per host, not per category.
 *
 * The point of this union is that a content-ID or DMCA strike against a young
 * account has a **greppable blast radius**: "every post that shipped a
 * TheAudioDB press shot" has to be one filter, which it is not if AudioDB and
 * Deezer are lumped together as "artist".
 *
 * `album-itunes` and `site-fallback` extend the union frozen in the spec.
 * Both are additive — nothing switches on `source`, so no adapter changes —
 * and both name imagery the frozen list could not:
 *
 * - `album-itunes`: 10 of the 57 published notes carry Apple/mzstatic album
 *   art (via `audio.albumArt`). PROVENANCE.md's own table lists it as a
 *   distinct tier-2 source; the union simply had no member for it, and
 *   folding it into `cover-art` would merge two hosts under one name and
 *   defeat the paragraph above.
 * - `site-fallback`: the bundled `/images/venues/fallback-active.jpg` that
 *   `PLACEHOLDER_IMAGE_URL` resolves to. It is ours, so it raises no
 *   provenance question — but it is a generic photograph of nowhere in
 *   particular, so it is never *published*. See `isPublishableTier`.
 */
export type MediaSource =
  | "personal"
  | "cover-art"
  | "album-itunes"
  | "venue-places"
  /**
   * Hand-placed archival photographs in `/images/venues/`, for rooms Places cannot
   * photograph because they no longer exist under that name. Distinct from `venue-places`
   * for the reason the union exists at all: these did not come from Google, and a takedown
   * against one source must not read as a takedown against the other.
   */
  | "venue-archival"
  | "artist-audiodb"
  | "artist-deezer"
  | "wikimedia"
  | "generative"
  | "material"
  | "site-fallback";

export interface MediaAsset {
  role: "card" | "panel" | "video";
  aspect: "1.91:1" | "4:5" | "1:1" | "9:16";
  /** Repo-relative path to the rendered asset. */
  path: string;
  /** Required, never optional. Every asset, every channel. */
  alt: string;
  /** 1 personal, 2 sourced, 3 derived. */
  tier: MediaTier;
  source: MediaSource;
  /**
   * Tier 1 ONLY. "Mike Morper · 31 July 2026", or
   * "Mike Morper · July 2026, not the 1987 night".
   *
   * The absence on tiers 2 and 3 is the point: it is what makes personal
   * imagery visibly outrank a press shot. It rides *in* the image, because a
   * card gets screenshotted without its caption.
   */
  byline?: string;
  /**
   * Where the photograph comes FROM — a repo path or a third-party URL.
   *
   * 🔴 `path` IS THE OUTPUT, THIS IS THE INPUT, AND THE RENDERER NEEDS BOTH.
   * Without it the renderer had to re-derive its own image from the post, which is how it
   * came to disagree with the payload about tier, about which night the card was for, and
   * about what the alt text described. The payload decides; the renderer draws.
   */
  sourceUrl: string;
  /**
   * The owner's crop box, tier 1 only. Normalised, authored at 4:5 (#342).
   *
   * The one thing on a card that cannot be re-derived from anything else — a per-frame
   * judgement made by hand — so it has to travel with the asset rather than be looked up.
   */
  crop?: { x: number; y: number; w: number; h: number };
  /**
   * ~~0–1. Computed at ingest (#352).~~ Superseded by `crop`: a point says *where* the
   * subject is, a box says where **and how tight**. Nothing sets or reads this.
   */
  focalPoint?: { x: number; y: number };
}

// ── Payload ─────────────────────────────────────────────────────────────────

/**
 * Credit — structured, off the record, never prose the generator is trusted to
 * include. Rendered as furniture on the card, one line each.
 *
 * Withholding names for an open loop was mocked and rejected: it makes posts
 * unfindable by search, gives a scrolling fan no reason to stop, and on
 * Instagram — where captions carry no clickable link — teases a reveal the
 * reader cannot reach. *Withhold the interpretation; never the identification.*
 */
export interface PayloadCredit {
  /** Display names, in billing order. */
  artists: string[];
  /** Absent on most posts; the meta stack then renders two lines, not three. */
  song?: string;
  venue: string;
  city: string;
  /**
   * The state or country that follows the city — `MD`, `DC`, `UK`.
   *
   * `venuesMetadata.state` already holds both: eight US states plus `District of Columbia`,
   * and `Mexico` and `UK` in the same field. `region.ts` abbreviates the states and leaves
   * countries spelled, because a postal code reads as a place and an ISO code reads as a
   * form field.
   */
  region?: string;
  /** ISO YYYY-MM-DD. */
  date: string;
}

/**
 * The authored text. Written on purpose by the generation step in the
 * archive's voice — never chopped out of the first paragraph of the prose.
 * Every RSS-to-social bridge in existence fails here, and it is the single
 * most visible tell that an account is automated.
 */
export interface SocialText {
  /** ≤ 120 chars. Always present. */
  hook: string;
  /** 3–5, each ≤ 120 chars. Carousel adapters only (Phase 3). */
  beats?: string[];
  /** The core sentence pair; adapters append the link and tags, nothing else. */
  caption: string;
}

export interface SyndicationPayload {
  slug: string;
  kind: "liner-note" | "on-this-day";
  /**
   * `cultural` | `personal` | `deep-cut`, and the card's act pill takes its colour from it.
   *
   * #361 removed the category LABEL in favour of the artist name and kept its colour — so
   * this is the only thing carrying that signal. On the payload rather than looked up by the
   * renderer, for the same reason as everything else here: one place decides.
   */
  category?: string;

  // TEXT — authored by the generation step, never derived from the headline.
  hook: string;
  beats?: string[];
  caption: string;

  credit: PayloadCredit;

  /**
   * Normalized slugs for the same entities `credit` names in display form.
   *
   * Additive, like `album-itunes` and `site-fallback` on `MediaSource`, and on
   * the same terms: nothing renders it, no adapter branches on it, and it
   * reopens none of the creative decisions the freeze protects. It exists
   * because a display name cannot be turned back into a slug.
   *
   * That is measured, not assumed. `normalizeArtistName()` round-trips 234 of
   * 257 artists; the 23 failures include `echo-and-the-bunnymen` (the record
   * spells it `Echo & The Bunnymen`, which normalizes to `echo-the-bunnymen`),
   * `yaz` (`Yazoo`), `the-english-beat` (`The Beat`) and `bangles` (`The
   * Bangles`). Worse than the misses, **both Brian Setzer entries collapse
   * onto one key** — `brian-setzer-68-comeback-special` and
   * `brian-setzer-and-the-nashvillians` are distinct artists in the archive
   * and normalize identically. A handle lookup keyed on the display name would
   * miss 9% of artists and resolve two of them to one account.
   *
   * Venues round-trip cleanly, all 79 of them, but they ride here too rather
   * than being derived by a rule that happens to hold today.
   */
  refs: { artists: string[]; venue?: string };

  /** Permalink. Per-channel UTM applied by the adapter. */
  url: string;
  media: MediaAsset[];
  /** ENTITY tags only. Detector tags never publish. */
  tags: string[];
  /** false blocks syndication entirely. */
  eligible: boolean;
  /**
   * Why `eligible` is false, for the operator. Never sent to a platform.
   * Empty when the payload is eligible.
   */
  ineligibleReasons: string[];
}

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * `seeded`   — deliberately suppressed back catalogue. Never posted, never will be.
 * `posted`   — live on the platform; `uri`/`postId` are the retraction index.
 * `retracted`— was live, deleted by `--retract`. The row survives so the post
 *              can never be resyndicated by a later run.
 */
export type LedgerStatus = "seeded" | "posted" | "retracted";

export interface LedgerEntry {
  slug: string;
  platform: Channel;
  status: LedgerStatus;
  /** Platform-native identifier used to delete: `at://…` on Bluesky, a status id on Mastodon. */
  uri?: string;
  /** Bluesky needs the record key as well as the at:// URI to delete. */
  rkey?: string;
  postedAt?: string;
  retractedAt?: string;
  seededAt?: string;
  /** Which tier actually shipped. This is the greppable blast radius. */
  tier?: MediaTier;
  source?: MediaSource;
}

export interface SyndicationLedger {
  version: 1;
  updatedAt: string;
  entries: LedgerEntry[];
}

/** Ledger rows are keyed on the pair, so a partial fan-out resumes only what failed. */
export function ledgerKey(slug: string, platform: Channel): string {
  return `${slug}::${platform}`;
}

// ── Provenance ──────────────────────────────────────────────────────────────

/**
 * "Never bare type" as a testable predicate.
 *
 * A generic bundled photograph clears "has an image" on a technicality while
 * failing what the rubric is actually for: it is a picture of nowhere in
 * particular, attached to a post about somewhere specific. That is the
 * fabricated-memory failure the voice rules exist to prevent, moved into the
 * image. Tier 3 derived artwork is the floor; a stock fallback is below it.
 */
export function isPublishableTier(asset: MediaAsset): boolean {
  return asset.source !== "site-fallback";
}
