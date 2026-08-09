/**
 * Agentic Liner Notes — Pre-Prose Quality Scorer
 *
 * Evaluates AnalysisFinding objects against a 60-point rubric and returns
 * ScoredFinding[] sorted descending by score. Drops findings below score 20.
 *
 * Input:  AnalysisFinding[]  (output of analyze.ts)
 * Output: ScoredFinding[]    sorted descending, threshold-filtered
 */

import { hasSongJoin } from "./setlists.ts";
import { normalizeAlbumTitle } from "../utils/album-title.ts";
import type { AnalysisFinding, ContentCategory, ScoreBreakdown, ScoredFinding } from "./types.ts";

// ── Public interface ──────────────────────────────────────────────────────────

export interface ScoreOptions {
  /** artists-metadata.json keyed by normalized artist name */
  artistsMetadata: Record<string, { bio?: string }>;
  /** artists-top-tracks.json keyed by normalized artist name */
  artistsTopTracks: Record<string, { tracks: Array<{ previewUrl?: string }> }>;
  /** Concert appearances per normalized artist name, derived from concerts.json */
  concertCountByArtist: Record<string, number>;
  /**
   * album-eras.json (#273). Optional: absent means no finding earns the album-art
   * point and scoring is otherwise identical.
   */
  albumEras?: {
    artists: Record<string, { studioAlbums: Array<{ title: string; coverAvailable: boolean }> }>;
  };
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
    case "venue-ghost": {
      // Span = years the venue was open before closing
      const years = f.years as number[];
      if (!years.length) return 0;
      const span = Math.max(...years) - Math.min(...years);
      return span > 20 ? 10 : span > 10 ? 7 : span > 5 ? 4 : 2;
    }
    case "festival-mega-bill": {
      const openerCount = (f.dataPoints as Record<string, unknown>).openerCount as number;
      return openerCount >= 10 ? 10 : openerCount >= 7 ? 7 : openerCount >= 5 ? 4 : 2;
    }
    case "drought-comeback": {
      const gap = (f.dataPoints as Record<string, unknown>).gapYears as number;
      return gap > 20 ? 10 : gap > 15 ? 7 : gap > 10 ? 4 : 2;
    }
    case "most-witnessed-album": {
      // Spec §5b: span from DISTINCT songs witnessed, not performances.
      const n = dp.distinctSongsWitnessed as number;
      return n >= 8 ? 10 : n >= 6 ? 7 : n >= 4 ? 4 : 0;
    }
    case "road-tested": {
      // Ladder extended DOWN to the new 7-day floor. The lower bound was
      // widened precisely to keep Royal Blood at 10 days (four songs off an
      // unreleased record); leaving the ladder at ">= 30d" would admit that
      // finding and then score it zero, which is the same as not admitting it.
      // Corroboration counts here as much as distance: songs from one future
      // album is evidence a single-song finding lacks.
      const days = dp.daysBeforeRelease as number;
      const corroboration = (dp.songCountFromSameFutureAlbum as number) ?? 1;
      const byDistance = days > 365 ? 10 : days > 180 ? 7 : days > 90 ? 4 : days > 30 ? 2 : 1;
      return Math.min(10, byDistance + (corroboration >= 3 ? 2 : corroboration >= 2 ? 1 : 0));
    }
    case "album-trajectory": {
      // How far ahead the record still was. A 17-year gap (Ziggy Marley) is a
      // different order of story from a 4-month one (Bat Fangs).
      const months = dp.monthsAway as number;
      return months >= 60 ? 10 : months >= 36 ? 7 : months >= 12 ? 4 : 2;
    }
    case "discography-crossref": {
      const eras = dp.eraCount as number;
      return eras >= 4 ? 10 : eras >= 3 ? 7 : 4;
    }
    case "city-pulse":
    case "album-context": {
      // Span = how many years ago this happened
      const year = f.years[0];
      if (!year) return 0;
      const yearsAgo = new Date().getFullYear() - year;
      return yearsAgo > 30 ? 10 : yearsAgo > 20 ? 7 : yearsAgo > 10 ? 4 : 2;
    }
    case "guest-bridge": {
      // Years between the walk-on and the nearest time you saw them headline.
      const gap = dp.gapYears as number;
      return gap > 20 ? 10 : gap > 10 ? 7 : gap > 5 ? 4 : 2;
    }
    case "full-circle": {
      // Distance between hearing the cover and hearing the original. A same-night
      // pairing has a gap of 0 but is the *most* striking version, so it is
      // scored at the top rather than the bottom — see computeSurpriseFactor.
      if (dp.sameNight === true) return 10;
      const gap = dp.gapYears as number;
      return gap > 30 ? 10 : gap > 20 ? 7 : gap > 10 ? 4 : 2;
    }
    case "genre-outlier": {
      // Span = how many years ago the show(s) happened
      const year = f.years[0];
      if (!year) return 0;
      const yearsAgo = new Date().getFullYear() - year;
      return yearsAgo > 30 ? 10 : yearsAgo > 20 ? 7 : yearsAgo > 10 ? 4 : 2;
    }
    case "rare-sighting": {
      // Older rare sightings feel more like buried history
      const year = f.years[0];
      if (!year) return 0;
      const yearsAgo = new Date().getFullYear() - year;
      return yearsAgo > 30 ? 10 : yearsAgo > 20 ? 7 : yearsAgo > 10 ? 4 : 2;
    }
    case "historical-moment": {
      const year = f.years[0];
      if (!year) return 0;
      const yearsAgo = new Date().getFullYear() - year;
      return yearsAgo > 30 ? 10 : yearsAgo > 20 ? 7 : yearsAgo > 10 ? 4 : 2;
    }
    case "milestone-marker": {
      // A milestone is inherently a span measure — the years accumulated from
      // concert #1 to concert #N. This case was missing entirely and fell
      // through to `default: 0`, which capped every milestone at 19: one point
      // under MIN_SCORE. The detector had never published a post (#233).
      const span = dp.spanYears as number;
      return span > 30 ? 10 : span > 20 ? 7 : span > 10 ? 4 : 0;
    }
    case "concert-streak":
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

  // 2 pts: the finding carries a song join from the setlist corpus (#229).
  //
  // Without this the enrichment mostly wouldn't surface: selection publishes each
  // detector's highest-scoring finding, and rare-sighting's and venue-ghost's
  // champions were both findings with no setlist on record — so 42 of 68 enriched
  // rare-sightings would have sat unpublished behind one that had nothing to say.
  // Only ranks findings against others from the same detector, which is all the
  // score is for (#231).
  if (hasSongJoin(f.tags)) pts += 2;

  // 1 pt: a real album cover will resolve for this post (#273).
  //
  // Same reasoning as the song-join point above (#229): selection publishes
  // each detector's highest-scoring finding, so a finding that renders with the
  // actual record should outrank one that falls back to a press photo. Only
  // ranks findings against others from the same detector, which is all the
  // score is for.
  if (resolvesAlbumArt(f, options)) pts += 1;

  return Math.min(pts, 10);
}

/**
 * Whether this finding's suggested album image will actually resolve to a
 * Cover Art Archive cover. Title comparison is normalized because the finding
 * carries a display title and the spine carries MusicBrainz's.
 */
function resolvesAlbumArt(f: AnalysisFinding, options: ScoreOptions): boolean {
  const image = f.suggestedImage;
  if (image?.type !== "album" || !image.albumName || !image.artistNormalized) return false;

  const spine = options.albumEras?.artists[image.artistNormalized]?.studioAlbums;
  if (!spine?.length) return false;

  const wanted = normalizeAlbumTitle(image.albumName);
  return spine.some((a) => a.coverAvailable && normalizeAlbumTitle(a.title) === wanted);
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
    case "most-witnessed-album":
      return 6; // Spec §5b fixes this at 6
    case "road-tested":
      return 9; // Hearing a record before it existed — spec §5a fixes this at 9
    case "venue-ghost":
      return 9; // A room you knew is gone — inherently powerful
    case "festival-mega-bill": {
      const openerCount = (f.dataPoints as Record<string, unknown>).openerCount as number;
      return openerCount >= 10 ? 10 : openerCount >= 7 ? 8 : openerCount >= 5 ? 6 : 4;
    }
    case "drought-comeback": {
      const gap = (f.dataPoints as Record<string, unknown>).gapYears as number;
      return gap >= 20 ? 9 : gap >= 15 ? 7 : gap >= 10 ? 5 : 3;
    }
    case "city-pulse":
      return 8; // Historical context is compelling
    case "album-context": {
      // Split widened (#272). Selection publishes each detector's top finding,
      // so this guarantees a real same-artist join outranks a coincidence
      // whenever both exist — the window bar removes the worst cross-artist
      // findings, this demotes the rest.
      const isSameArtist = (f.dataPoints as Record<string, unknown>).isSameArtist as boolean;
      return isSameArtist ? 9 : 5;
    }
    case "album-trajectory":
      // The highest-tension finding the pipeline can produce: the only one
      // where the narrator does not know how the story ends.
      return 10;
    case "discography-crossref":
      return 7;
    case "guest-bridge":
      // Someone stepping onto a stage that isn't theirs, whom you also saw
      // headline, is a strong join — but a shade below full-circle, because it
      // is one night connecting to a career rather than two performances of the
      // same song across decades.
      return 8;
    case "full-circle": {
      // Two acts on one bill playing the same song is the strongest version there
      // is (#230). Two acts sharing a member is the weakest — Brian Setzer playing
      // a Stray Cats song is a man playing his own back catalogue, where Dropkick
      // Murphys playing Springsteen is a genuine stranger-to-stranger join.
      if (dp.sameNight === true) return 10;
      return dp.sharedMember ? 6 : 9;
    }
    case "genre-outlier":
      return 8; // A genuine anomaly in an otherwise coherent archive
    case "rare-sighting":
      return 9; // You caught them once — and never again
    case "historical-moment":
      return 7; // Grounded in web search; context is specific
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
