/**
 * Agentic Liner Notes — Pre-Prose Quality Scorer
 *
 * Evaluates AnalysisFinding objects against a 60-point rubric and returns
 * ScoredFinding[] sorted descending by score. Drops findings below score 20.
 *
 * Input:  AnalysisFinding[]  (output of analyze.ts)
 * Output: ScoredFinding[]    sorted descending, threshold-filtered
 */

import type { AnalysisFinding, ContentCategory, ScoreBreakdown, ScoredFinding } from "./types.ts";

// ── Public interface ──────────────────────────────────────────────────────────

export interface ScoreOptions {
  /** artists-metadata.json keyed by normalized artist name */
  artistsMetadata: Record<string, { bio?: string }>;
  /** artists-top-tracks.json keyed by normalized artist name */
  artistsTopTracks: Record<string, { tracks: Array<{ previewUrl?: string }> }>;
  /** Concert appearances per normalized artist name, derived from concerts.json */
  concertCountByArtist: Record<string, number>;
}

/** Findings scoring below this threshold are discarded before prose generation. */
export const MIN_SCORE = 20;

/**
 * Score a batch of findings. Returns only findings that meet the minimum
 * threshold, sorted by score descending.
 */
export function score(
  findings: AnalysisFinding[],
  options: ScoreOptions,
  today: Date = new Date()
): ScoredFinding[] {
  // Pre-compute category distribution for Category Balance scoring
  const categoryCounts: Record<ContentCategory, number> = {
    cultural: 0,
    personal: 0,
    "deep-cut": 0,
  };
  for (const f of findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }
  const avgPerCategory = findings.length / 3;

  const scored: ScoredFinding[] = [];

  for (const finding of findings) {
    const breakdown = computeBreakdown(finding, options, categoryCounts, avgPerCategory, today);
    if (breakdown.total >= MIN_SCORE) {
      scored.push({ ...finding, score: breakdown.total, scoreBreakdown: breakdown });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ── Rubric implementation ─────────────────────────────────────────────────────

function computeBreakdown(
  f: AnalysisFinding,
  options: ScoreOptions,
  categoryCounts: Record<ContentCategory, number>,
  avgPerCategory: number,
  today: Date
): ScoreBreakdown {
  const specificity    = computeSpecificity(f);
  const span           = computeSpan(f);
  const dataRichness   = computeDataRichness(f, options);
  const surpriseFactor = computeSurpriseFactor(f);
  const timelinessBonus = computeTimelinessBonus(f, today);
  const categoryBalance = computeCategoryBalance(f, categoryCounts, avgPerCategory);
  const total = specificity + span + dataRichness + surpriseFactor + timelinessBonus + categoryBalance;

  return { specificity, span, dataRichness, surpriseFactor, timelinessBonus, categoryBalance, total };
}

/**
 * Specificity (0–15)
 * 3 points per named artist or venue, max 15.
 */
function computeSpecificity(f: AnalysisFinding): number {
  return Math.min((f.artists.length + f.venues.length) * 3, 15);
}

/**
 * Span / Scale (0–10)
 * Rewards findings that span long time periods or wide scales.
 */
function computeSpan(f: AnalysisFinding): number {
  const dp = f.dataPoints as Record<string, unknown>;

  switch (f.detector) {
    case "artist-longevity": {
      const span = dp.spanYears as number;
      return span > 30 ? 10 : span > 20 ? 7 : span > 10 ? 4 : 0;
    }
    case "opener-to-headliner": {
      const gap = dp.gapYears as number;
      return gap > 30 ? 10 : gap > 20 ? 7 : gap > 10 ? 4 : 0;
    }
    case "venue-loyalty": {
      const decades = dp.decades as string[];
      return decades.length >= 4 ? 10 : decades.length >= 3 ? 7 : decades.length >= 2 ? 4 : 0;
    }
    case "calendar-anniversary": {
      const yearsAgo = dp.yearsAgo as number;
      return yearsAgo > 30 ? 10 : yearsAgo > 20 ? 7 : yearsAgo > 10 ? 4 : 0;
    }
    case "geographic-chapter": {
      const span = dp.spanYears as number;
      return span > 30 ? 10 : span > 20 ? 7 : span > 10 ? 4 : 0;
    }
    case "concert-streak":
    case "milestone-marker":
    default:
      return 0;
  }
}

/**
 * Data Richness (0–10)
 * Rewards findings with rich supporting metadata (bio, audio previews, archive depth).
 * Applies to the primary (first) artist in the finding.
 */
function computeDataRichness(f: AnalysisFinding, options: ScoreOptions): number {
  const primaryArtist = f.artists[0];
  if (!primaryArtist) return 0;

  let pts = 0;

  // 5 pts: artist has a bio in artists-metadata.json
  if (options.artistsMetadata[primaryArtist]?.bio) pts += 5;

  // 3 pts: artist has at least one audio preview in artists-top-tracks.json
  const topTracks = options.artistsTopTracks[primaryArtist];
  if (topTracks?.tracks?.some((t) => t.previewUrl)) pts += 3;

  // 2 pts: artist has 3+ concert appearances in the archive
  const count = options.concertCountByArtist[primaryArtist] ?? 0;
  if (count >= 3) pts += 2;

  return Math.min(pts, 10);
}

/**
 * Surprise Factor (0–10)
 * Subjective wow-factor of the finding's core insight.
 * Calendar coincidences, large opener-to-headliner gaps, and geographic
 * chapters score highest; routine longevity facts score lowest.
 */
function computeSurpriseFactor(f: AnalysisFinding): number {
  const dp = f.dataPoints as Record<string, unknown>;

  switch (f.detector) {
    case "calendar-anniversary":
      return 8;
    case "opener-to-headliner": {
      const gap = dp.gapYears as number;
      return gap >= 20 ? 9 : gap >= 15 ? 7 : gap >= 10 ? 5 : 3;
    }
    case "geographic-chapter":
      return 6;
    case "concert-streak":
      return 5;
    case "venue-loyalty":
      return 4;
    case "artist-longevity":
      return 4;
    case "milestone-marker":
      return 3;
    default:
      return 0;
  }
}

/**
 * Timeliness Bonus (0–10)
 * Only applies to findings with a timeliness window.
 * ±3 days from today = 10, ±7 days = 5.
 * If the anniversary is a milestone year (isMilestone), add +5, capped at 10.
 */
function computeTimelinessBonus(f: AnalysisFinding, today: Date): number {
  if (!f.timeliness) return 0;

  const relevantDate = new Date(f.timeliness.relevantDate);
  const daysApart = Math.abs(
    (today.getTime() - relevantDate.getTime()) / 86_400_000
  );

  let bonus = daysApart <= 3 ? 10 : daysApart <= 7 ? 5 : 0;

  // Milestone anniversary year bonus (+5, capped at 10 total)
  const dp = f.dataPoints as Record<string, unknown>;
  if (dp.isMilestone === true) {
    bonus = Math.min(bonus + 5, 10);
  }

  return bonus;
}

/**
 * Category Balance (0–5)
 * Rewards findings whose category is underrepresented in the current batch.
 */
function computeCategoryBalance(
  f: AnalysisFinding,
  categoryCounts: Record<ContentCategory, number>,
  avgPerCategory: number
): number {
  return (categoryCounts[f.category] ?? 0) < avgPerCategory ? 5 : 0;
}
