/**
 * On This Day — the published record (#333).
 *
 * Deliberately NOT a `LinerNotesPost`. The two streams share a syndication
 * payload and nothing else: a liner note has prose, a detector, a score out of
 * 60, related posts and a page on the site; an On This Day post has a date, a
 * show, and authored social copy. Forcing them into one type would mean a
 * dozen optional fields and a reader who cannot tell which are real for which.
 */

import type { PostSocial } from "../../src/types/liner-notes.ts";
import type { MediaSource, MediaTier } from "../syndication/types.ts";

export interface OnThisDayPost {
  /** `otd-YYYY-MM-DD`, unique per publishing day and stable forever. */
  slug: string;
  /** `MM-DD` — the calendar day this is the anniversary of. */
  day: string;
  /** ISO date of the show itself. */
  showDate: string;
  /** Years elapsed, as the card states it. */
  age: number;

  artist: string;
  artistNormalized: string;
  venue: string;
  venueNormalized: string;
  city: string;

  /** Anniversary score at generation time, for the run log and for debugging. */
  score: number;

  /** Repo-relative path to the rendered date-forward card. */
  cardPath: string;
  /** The image the card was composited over, for provenance. */
  imageUrl?: string;
  tier: MediaTier;
  source: MediaSource;

  /**
   * Where the post points.
   *
   * Normally a deep link into the archive. When a liner note already covers
   * this show it becomes that note's permalink instead — the spec's
   * cross-linking rule, which recycles evergreen content into fresh
   * impressions and makes the two streams feed each other rather than compete.
   */
  url: string;
  /** Set when `url` is a liner note rather than a deep link. */
  linerNoteSlug?: string;

  /** Authored by the same generateSocial/checkSocial path a liner note uses. */
  social?: PostSocial;

  publishedAt: string;
}

export interface OnThisDayData {
  generatedAt: string;
  posts: OnThisDayPost[];
}

/** `otd-2026-06-04`. One post per calendar day, so the day IS the identity. */
export function otdSlug(publishYear: number, day: string): string {
  return `otd-${publishYear}-${day}`;
}
