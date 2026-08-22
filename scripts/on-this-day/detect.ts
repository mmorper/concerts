/**
 * On This Day — detection and anniversary scoring (#333).
 *
 * The second content stream. Liner notes publish once a week
 * (`POSTS_PER_RUN = 1`); On This Day fills the gaps between them with posts
 * that are short, dated, and always genuine.
 *
 * ── THE RULE THAT SHAPES EVERYTHING ────────────────────────────────────────
 *
 * **Post only on days that hit.** 145 of 366 calendar days carry a show, so
 * the cadence is irregular — roughly 2.8 posts a week, clustered. The spec is
 * blunt about the alternative: widening the window to "this week in" to
 * manufacture a daily rhythm makes every post weaker and turns the account
 * into a content mill. Irregular-but-real is the correct trade for an archive,
 * and this module never widens the window.
 *
 * ── SCORING IS ITS OWN MODULE, NOT score.ts ────────────────────────────────
 *
 * §"Questions for Review" left this open: reuse `score.ts` or write a new one.
 * New one. `score.ts` grades a *detector finding* on specificity, span, data
 * richness, surprise and category balance — properties of a story someone
 * already decided was worth telling. An On This Day candidate has no story
 * yet; it is a date and the shows that happened on it. The only real question
 * is "does this anniversary deserve a post", which none of those six axes
 * measures. Forcing it through `ScoreBreakdown` would mean six fields, four of
 * them constant.
 */

import type { Concert } from "../../src/types/concert.ts";

/** Round anniversaries. 5-year steps, per the spec's weighting. */
export const ROUND_YEARS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

/**
 * Below this, a hit is real but not worth a post.
 *
 * Calibrated against the spec's own worked example rather than picked: "a
 * one-off show from 7 years ago scores lowest and should usually not publish."
 * Such a day scores 6 (`long-ago` 7/4 plus `only-sighting` 4), so the
 * threshold sits one point above it.
 *
 * The resulting yield is ~75 posts a year from the 114 single-show days in a
 * rolling year — close to the spec's "145 slots and only ~100 need filling",
 * with the shortfall being exactly the 28 multi-show days deferred pending
 * tier-3 artwork. Re-check this number if the archive grows substantially;
 * `scripts/on-this-day/index.ts --survey` prints the distribution.
 */
export const PUBLISH_THRESHOLD = 7;

export interface AnniversaryReason {
  /** Machine-readable, for tests and the run log. Never published. */
  code:
    | "round-anniversary"
    | "first-sighting"
    | "first-at-venue"
    | "only-sighting"
    | "long-ago";
  points: number;
  /** Human-readable, for the run log. Never published either. */
  detail: string;
}

export interface OnThisDayCandidate {
  /** `MM-DD` the post is for. */
  day: string;
  /** The calendar year the post publishes in. */
  publishYear: number;
  /** Every show on this day, oldest first. */
  shows: Concert[];
  /** Years elapsed for each show, index-aligned with `shows`. */
  ages: number[];
  score: number;
  reasons: AnniversaryReason[];
  /**
   * Why this candidate cannot publish yet, if it cannot.
   *
   * Multi-show days are the whole of this today. DECISIONS.md §10 found the
   * structural reason: a date with four shows has no single subject, so no
   * tier-1 or tier-2 image can be routed to it and it falls to tier 3 by
   * construction — and tier 3 artwork does not exist yet. Rather than drop
   * these days, they are scored and reported as deferred, so they light up
   * with no scoring change once the artwork lands.
   */
  deferred?: string;
}

export interface DetectOptions {
  /** Publications already made, so an artist is not repeated too soon. */
  recentArtists?: Set<string>;
}

// ── Detection ────────────────────────────────────────────────────────────────

/** `MM-DD` for a Date, in the archive's local calendar terms. */
export function calendarDay(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${m}-${d}`;
}

/**
 * Every show that happened on `today`'s calendar day in a previous year.
 *
 * A show from earlier the *same* year is not an anniversary of anything, so
 * `age > 0` is required rather than `>= 0`. Without it, a show from January
 * would produce an "0 years ago today" post in the same December.
 */
export function showsOnDay(concerts: Concert[], today: Date): Concert[] {
  const day = calendarDay(today);
  const year = today.getUTCFullYear();
  return concerts
    .filter((c) => c.date.slice(5) === day && Number(c.date.slice(0, 4)) < year)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Grade the day, not the show.
 *
 * The spec's weighting, in its own order: round anniversaries highest, then a
 * first sighting of an artist since seen many times, then a first show at a
 * venue that became a regular. A one-off from seven years ago scores lowest
 * and should usually not publish — which is what `PUBLISH_THRESHOLD` enforces
 * rather than a hand-maintained blocklist.
 */
export function scoreDay(
  candidate: Omit<OnThisDayCandidate, "score" | "reasons">,
  concerts: Concert[]
): { score: number; reasons: AnniversaryReason[] } {
  const reasons: AnniversaryReason[] = [];

  const countsByArtist = groupBy(concerts, (c) => c.headlinerNormalized);
  const countsByVenue = groupBy(concerts, (c) => c.venueNormalized);

  for (const [i, show] of candidate.shows.entries()) {
    const age = candidate.ages[i];

    // Round anniversary. Weighted by size: a 40th is a bigger deal than a 5th,
    // and the archive has enough 40ths for that to matter.
    if (ROUND_YEARS.includes(age as (typeof ROUND_YEARS)[number])) {
      const points = 30 + Math.min(age, 40) / 2;
      reasons.push({
        code: "round-anniversary",
        points,
        detail: `${age} years since ${show.headliner}`,
      });
    }

    const byArtist = countsByArtist.get(show.headlinerNormalized) ?? [];
    // A first sighting only means something if there were more. "The first of
    // one" is just "one", and the spec scores a one-off lowest deliberately.
    if (byArtist.length > 1 && byArtist[0].id === show.id) {
      reasons.push({
        code: "first-sighting",
        points: 10 + Math.min(byArtist.length, 10),
        detail: `first of ${byArtist.length} times seeing ${show.headliner}`,
      });
    }
    if (byArtist.length === 1) {
      reasons.push({
        code: "only-sighting",
        points: 4,
        detail: `only time seeing ${show.headliner}`,
      });
    }

    const byVenue = countsByVenue.get(show.venueNormalized) ?? [];
    if (byVenue.length > 2 && byVenue[0].id === show.id) {
      reasons.push({
        code: "first-at-venue",
        points: 8 + Math.min(byVenue.length, 8),
        detail: `first of ${byVenue.length} shows at ${show.venue}`,
      });
    }

    // Depth is worth something on its own — a 1984 show is interesting for
    // being from 1984 — but it must not out-score a round anniversary, so it
    // is deliberately small and capped.
    reasons.push({
      code: "long-ago",
      points: Math.min(age, 40) / 4,
      detail: `${age} years ago`,
    });
  }

  const score = Math.round(reasons.reduce((sum, r) => sum + r.points, 0));
  return { score, reasons };
}

/** Grouped and date-sorted once, so "was this the first?" is a lookup. */
function groupBy(concerts: Concert[], key: (c: Concert) => string): Map<string, Concert[]> {
  const out = new Map<string, Concert[]>();
  for (const c of concerts) {
    const k = key(c);
    const bucket = out.get(k);
    if (bucket) bucket.push(c);
    else out.set(k, [c]);
  }
  for (const bucket of out.values()) bucket.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ── Candidate assembly ───────────────────────────────────────────────────────

/**
 * The candidate for one calendar day, scored, or undefined if nothing happened.
 *
 * Returns the candidate even when it scores below threshold or is deferred —
 * deciding not to publish is the caller's job, and the run log is more useful
 * when it can say *why* a day produced nothing.
 */
export function candidateForDay(
  concerts: Concert[],
  today: Date,
  options: DetectOptions = {}
): OnThisDayCandidate | undefined {
  const shows = showsOnDay(concerts, today);
  if (!shows.length) return undefined;

  const publishYear = today.getUTCFullYear();
  const ages = shows.map((s) => publishYear - Number(s.date.slice(0, 4)));

  const base = { day: calendarDay(today), publishYear, shows, ages };
  const { score, reasons } = scoreDay(base, concerts);

  const candidate: OnThisDayCandidate = { ...base, score, reasons };

  // Multi-show days are held back, not dropped. See OnThisDayCandidate.deferred.
  if (shows.length > 1) {
    candidate.deferred = `${shows.length} shows on this date — no single subject, needs tier-3 artwork`;
    return candidate;
  }

  // Don't post the same artist twice in quick succession. The archive is
  // 257 artists deep; there is no reason for the feed to repeat one.
  if (options.recentArtists?.has(shows[0].headlinerNormalized)) {
    candidate.deferred = `${shows[0].headliner} was posted recently`;
  }

  return candidate;
}

/** Publishable = scored high enough, and nothing holding it back. */
export function isPublishable(candidate: OnThisDayCandidate): boolean {
  return !candidate.deferred && candidate.score >= PUBLISH_THRESHOLD;
}
