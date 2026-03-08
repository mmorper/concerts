/**
 * Agentic Liner Notes — Analysis Engine
 *
 * Deterministic pattern detectors. No AI, no API calls — pure computation
 * over the concert dataset. Returns structured AnalysisFinding objects for
 * the story generator to use.
 *
 * Key constraint: only past concerts are analyzed (date <= today).
 */

import type { Concert } from "../../src/types/concert.ts";
import type { AnalysisFinding, ContentCategory, DetectorName } from "./types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function spanYears(dateA: string, dateB: string): number {
  return Math.abs(
    new Date(dateB).getFullYear() - new Date(dateA).getFullYear()
  );
}

function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function uniqueDecades(years: number[]): string[] {
  return [...new Set(years.map(decadeOf))].sort();
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

// Returns the number of days between two month/day combos (circular, 0–182)
function anniversaryDistance(a: Date, b: Date): number {
  const doy = (d: Date) => dayOfYear(d);
  const diff = Math.abs(doy(a) - doy(b));
  return Math.min(diff, 365 - diff);
}

const STATE_REGION: Record<string, string> = {
  CA: "West Coast", OR: "West Coast", WA: "West Coast",
  NV: "Mountain West", AZ: "Mountain West", UT: "Mountain West",
  CO: "Mountain West", ID: "Mountain West", MT: "Mountain West", WY: "Mountain West",
  IL: "Midwest", OH: "Midwest", MI: "Midwest", IN: "Midwest",
  WI: "Midwest", MN: "Midwest", IA: "Midwest", MO: "Midwest",
  KS: "Midwest", NE: "Midwest", SD: "Midwest", ND: "Midwest",
  TX: "South", LA: "South", MS: "South", AL: "South",
  GA: "South", FL: "South", SC: "South", NC: "South",
  TN: "South", AR: "South", OK: "South", VA: "South",
  WV: "South", KY: "South",
  NY: "Northeast", NJ: "Northeast", PA: "Northeast", CT: "Northeast",
  MA: "Northeast", RI: "Northeast", VT: "Northeast", NH: "Northeast",
  ME: "Northeast", MD: "Northeast", DE: "Northeast", DC: "Northeast",
  NM: "Southwest", HI: "Pacific", AK: "Pacific",
};

function regionOf(state: string): string {
  return STATE_REGION[state?.toUpperCase()] ?? "International";
}

// ── Filter: past concerts only ────────────────────────────────────────────────

function pastConcerts(concerts: Concert[], today: Date): Concert[] {
  const todayStr = today.toISOString().slice(0, 10);
  return concerts.filter((c) => c.date <= todayStr);
}

// ── 1. Artist Longevity Detector ─────────────────────────────────────────────

function detectArtistLongevity(concerts: Concert[]): AnalysisFinding[] {
  const byArtist = new Map<string, Concert[]>();

  for (const c of concerts) {
    const key = c.headlinerNormalized;
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [normalized, shows] of byArtist) {
    if (shows.length < 2) continue;

    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = spanYears(first.date, last.date);

    if (span < 5) continue;

    const years = sorted.map((s) => s.year);
    const decades = uniqueDecades(years);
    const venues = [...new Set(sorted.map((s) => s.venueNormalized))];

    const tags = ["#artist-longevity"];
    if (decades.length >= 3) tags.push("#multi-decade");

    findings.push({
      id: `longevity-${normalized}`,
      detector: "artist-longevity",
      category: "personal",
      temporality: "evergreen",
      headline: `${first.headliner}: ${span} Years of Shows`,
      dataPoints: {
        artist: first.headliner,
        artistNormalized: normalized,
        firstShow: { date: first.date, venue: first.venue, city: first.cityState },
        lastShow: { date: last.date, venue: last.venue, city: last.cityState },
        spanYears: span,
        showCount: shows.length,
        decades,
        venueCount: venues.length,
      },
      artists: [normalized],
      venues,
      years,
      suggestedImage: { type: "artist", artistNormalized: normalized },
      suggestedTrack: { artistNormalized: normalized },
      tags,
    });
  }

  return findings;
}

// ── 2. Opener-to-Headliner Detector ──────────────────────────────────────────

function detectOpenerToHeadliner(concerts: Concert[]): AnalysisFinding[] {
  // Build set of normalized headliner names
  const headlinerSlugs = new Set(concerts.map((c) => c.headlinerNormalized));

  // Find all concerts where an artist appeared as opener
  const openerShows = new Map<string, Concert[]>(); // normalized opener name → concerts
  const openerNames = new Map<string, string>();     // normalized → display name

  for (const c of concerts) {
    for (const opener of c.openers) {
      const norm = slugify(opener);
      if (!openerShows.has(norm)) openerShows.set(norm, []);
      openerShows.get(norm)!.push(c);
      openerNames.set(norm, opener);
    }
  }

  const findings: AnalysisFinding[] = [];

  for (const [norm, openerConcerts] of openerShows) {
    if (!headlinerSlugs.has(norm)) continue;

    // Find their headliner shows
    const headlinerShows = concerts.filter((c) => c.headlinerNormalized === norm);

    const earliestOpener = [...openerConcerts].sort((a, b) =>
      a.date.localeCompare(b.date)
    )[0];
    const firstHeadline = [...headlinerShows].sort((a, b) =>
      a.date.localeCompare(b.date)
    )[0];

    // Only valid if opener appearance came before headlining
    if (earliestOpener.date >= firstHeadline.date) continue;

    const gap = spanYears(earliestOpener.date, firstHeadline.date);
    const artistName = openerNames.get(norm) ?? norm;

    findings.push({
      id: `opener-to-headliner-${norm}`,
      detector: "opener-to-headliner",
      category: "cultural",
      temporality: "evergreen",
      headline: `${artistName}: From Opener to Headliner`,
      dataPoints: {
        artist: artistName,
        artistNormalized: norm,
        openerShow: {
          date: earliestOpener.date,
          headliner: earliestOpener.headliner,
          venue: earliestOpener.venue,
          city: earliestOpener.cityState,
        },
        headlinerShow: {
          date: firstHeadline.date,
          venue: firstHeadline.venue,
          city: firstHeadline.cityState,
        },
        gapYears: gap,
        openerShowCount: openerConcerts.length,
        headlinerShowCount: headlinerShows.length,
      },
      artists: [norm],
      venues: [
        ...new Set([
          earliestOpener.venueNormalized,
          firstHeadline.venueNormalized,
        ]),
      ],
      years: [earliestOpener.year, firstHeadline.year],
      suggestedImage: { type: "artist", artistNormalized: norm },
      suggestedTrack: { artistNormalized: norm },
      tags: ["#opener-to-headliner", "#career-arc"],
    });
  }

  return findings;
}

// ── 3. Venue Loyalty Detector ─────────────────────────────────────────────────

function detectVenueLoyalty(concerts: Concert[]): AnalysisFinding[] {
  const byVenue = new Map<string, Concert[]>();

  for (const c of concerts) {
    const key = c.venueNormalized;
    if (!byVenue.has(key)) byVenue.set(key, []);
    byVenue.get(key)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [normalized, shows] of byVenue) {
    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const decades = uniqueDecades(sorted.map((s) => s.year));
    const qualifies = shows.length >= 5 || decades.length >= 3;
    if (!qualifies) continue;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const artists = [...new Set(sorted.map((s) => s.headlinerNormalized))];

    const tags = ["#venue-loyalty"];
    if (shows.length >= 10) tags.push("#home-venue");

    findings.push({
      id: `venue-loyalty-${normalized}`,
      detector: "venue-loyalty",
      category: "personal",
      temporality: "evergreen",
      headline: `${first.venue}: ${shows.length} Shows Over ${decades.length} Decade${decades.length !== 1 ? "s" : ""}`,
      dataPoints: {
        venue: first.venue,
        venueNormalized: normalized,
        city: first.cityState,
        showCount: shows.length,
        firstShow: { date: first.date, artist: first.headliner },
        lastShow: { date: last.date, artist: last.headliner },
        decades,
        artistCount: artists.length,
        topArtists: artists.slice(0, 5),
      },
      artists,
      venues: [normalized],
      years: sorted.map((s) => s.year),
      suggestedImage: { type: "venue", venueNormalized: normalized },
      tags,
    });
  }

  return findings;
}

// ── 4. Calendar Anniversary Detector ─────────────────────────────────────────

function detectCalendarAnniversary(
  concerts: Concert[],
  today: Date
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const seen = new Set<string>(); // deduplicate by artist+date

  for (const c of concerts) {
    const concertDate = new Date(c.date + "T12:00:00Z");
    const dist = anniversaryDistance(today, concertDate);
    if (dist > 7) continue;

    // Skip if we already have a finding for this artist+date
    const key = `${c.headlinerNormalized}-${c.date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const yearsAgo = today.getFullYear() - concertDate.getFullYear();
    if (yearsAgo < 1) continue;

    const isMilestone = [10, 15, 20, 25, 30, 35, 40].includes(yearsAgo);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[concertDate.getMonth()];
    const dayNum = concertDate.getDate();

    const tags = ["#anniversary", "#on-this-day"];

    findings.push({
      id: `anniversary-${c.headlinerNormalized}-${c.date}`,
      detector: "calendar-anniversary",
      category: "personal",
      temporality: "timely",
      timeliness: {
        relevantDate: today.toISOString().slice(0, 10),
        windowStart: new Date(today.getTime() - 7 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        windowEnd: new Date(today.getTime() + 7 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      },
      headline: `${monthName} ${dayNum}: ${yearsAgo} Years Since ${c.headliner}`,
      dataPoints: {
        artist: c.headliner,
        artistNormalized: c.headlinerNormalized,
        venue: c.venue,
        venueNormalized: c.venueNormalized,
        city: c.cityState,
        concertDate: c.date,
        yearsAgo,
        isMilestone,
        openers: c.openers,
      },
      artists: [c.headlinerNormalized],
      venues: [c.venueNormalized],
      years: [c.year],
      suggestedImage: { type: "artist", artistNormalized: c.headlinerNormalized },
      suggestedTrack: { artistNormalized: c.headlinerNormalized },
      tags,
    });
  }

  // Return at most 3 anniversary findings per run (most recent first)
  return findings
    .sort((a, b) => {
      const aYears = a.dataPoints.yearsAgo as number;
      const bYears = b.dataPoints.yearsAgo as number;
      // Milestone anniversaries rank first, then by proximity to today
      if ((a.dataPoints.isMilestone as boolean) !== (b.dataPoints.isMilestone as boolean)) {
        return (a.dataPoints.isMilestone as boolean) ? -1 : 1;
      }
      return aYears - bYears;
    })
    .slice(0, 3);
}

// ── 5. Geographic Chapter Detector ───────────────────────────────────────────

function detectGeographicChapter(concerts: Concert[]): AnalysisFinding[] {
  if (concerts.length < 6) return [];

  const sorted = [...concerts].sort((a, b) => a.date.localeCompare(b.date));

  // Assign region to each concert
  const withRegion = sorted.map((c) => ({
    concert: c,
    region: regionOf(c.state),
  }));

  // Identify chapters: runs of 3+ consecutive concerts in the same region
  const chapters: Array<{
    region: string;
    shows: Concert[];
  }> = [];

  let i = 0;
  while (i < withRegion.length) {
    const region = withRegion[i].region;
    const run: Concert[] = [];

    while (i < withRegion.length && withRegion[i].region === region) {
      run.push(withRegion[i].concert);
      i++;
    }

    if (run.length >= 3) {
      chapters.push({ region, shows: run });
    }
  }

  if (chapters.length === 0) return [];

  const findings: AnalysisFinding[] = [];

  // Return up to 3 most significant chapters (most shows)
  const topChapters = [...chapters]
    .sort((a, b) => b.shows.length - a.shows.length)
    .slice(0, 3);

  for (const chapter of topChapters) {
    const { region, shows } = chapter;
    const sortedShows = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const first = sortedShows[0];
    const last = sortedShows[sortedShows.length - 1];
    const span = spanYears(first.date, last.date);
    const venues = [...new Set(sortedShows.map((s) => s.venueNormalized))];
    const artists = [...new Set(sortedShows.map((s) => s.headlinerNormalized))];
    const years = sortedShows.map((s) => s.year);
    const decades = uniqueDecades(years);

    const tags = ["#geographic"];
    // Check if the full dataset has shows on multiple coasts
    const allRegions = new Set(concerts.map((c) => regionOf(c.state)));
    if (allRegions.has("West Coast") && allRegions.has("Northeast")) {
      tags.push("#two-coasts");
    }

    findings.push({
      id: `geographic-${slugify(region)}-${first.year}`,
      detector: "geographic-chapter",
      category: "personal",
      temporality: "evergreen",
      headline: `My ${region} Chapter: ${shows.length} Concerts${span > 0 ? ` Over ${span} Year${span !== 1 ? "s" : ""}` : ""}`,
      dataPoints: {
        region,
        showCount: shows.length,
        firstShow: { date: first.date, artist: first.headliner, venue: first.venue, city: first.cityState },
        lastShow: { date: last.date, artist: last.headliner, venue: last.venue, city: last.cityState },
        spanYears: span,
        venueCount: venues.length,
        artistCount: artists.length,
        decades,
      },
      artists,
      venues,
      years,
      suggestedImage: { type: "venue", venueNormalized: first.venueNormalized },
      tags,
    });
  }

  return findings;
}

// ── 6. Concert Streak Detector ────────────────────────────────────────────────

function detectConcertStreak(concerts: Concert[]): AnalysisFinding[] {
  if (concerts.length < 3) return [];

  const sorted = [...concerts].sort((a, b) => a.date.localeCompare(b.date));
  const findings: AnalysisFinding[] = [];
  const usedDates = new Set<string>();

  let i = 0;
  while (i < sorted.length) {
    const streakStart = sorted[i];
    const streakShows: Concert[] = [streakStart];

    let j = i + 1;
    while (j < sorted.length) {
      const prev = new Date(streakShows[streakShows.length - 1].date + "T12:00:00Z");
      const curr = new Date(sorted[j].date + "T12:00:00Z");
      const dayGap = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);

      if (dayGap <= 30) {
        streakShows.push(sorted[j]);
        j++;
      } else {
        break;
      }
    }

    if (streakShows.length >= 3) {
      const streakKey = streakShows.map((s) => s.date).join(",");
      if (!usedDates.has(streakKey)) {
        usedDates.add(streakKey);

        const first = streakShows[0];
        const last = streakShows[streakShows.length - 1];
        const totalDays = Math.round(
          (new Date(last.date + "T12:00:00Z").getTime() -
            new Date(first.date + "T12:00:00Z").getTime()) /
            86_400_000
        );

        const hasBackToBack = streakShows.some((s, idx) => {
          if (idx === 0) return false;
          const prev = new Date(streakShows[idx - 1].date + "T12:00:00Z");
          const curr = new Date(s.date + "T12:00:00Z");
          return Math.round((curr.getTime() - prev.getTime()) / 86_400_000) === 1;
        });

        const genres = [...new Set(streakShows.map((s) => s.genre))];
        const venues = [...new Set(streakShows.map((s) => s.venueNormalized))];
        const artists = [...new Set(streakShows.map((s) => s.headlinerNormalized))];

        const tags = ["#hot-streak"];
        if (hasBackToBack) tags.push("#back-to-back");

        findings.push({
          id: `streak-${slugify(first.date)}-${streakShows.length}shows`,
          detector: "concert-streak",
          category: "personal",
          temporality: "evergreen",
          headline: `${streakShows.length} Concerts in ${totalDays} Days`,
          dataPoints: {
            showCount: streakShows.length,
            totalDays,
            hasBackToBack,
            genreCount: genres.length,
            shows: streakShows.map((s) => ({
              date: s.date,
              artist: s.headliner,
              venue: s.venue,
              city: s.cityState,
            })),
          },
          artists,
          venues,
          years: [...new Set(streakShows.map((s) => s.year))],
          suggestedImage: {
            type: "artist",
            artistNormalized: streakShows[0].headlinerNormalized,
          },
          tags,
        });
      }
    }

    i = j > i + 1 ? j : i + 1;
  }

  // Return the top 3 longest streaks
  return findings
    .sort((a, b) => (b.dataPoints.showCount as number) - (a.dataPoints.showCount as number))
    .slice(0, 3);
}

// ── 7. Milestone Marker Detector ──────────────────────────────────────────────

const MILESTONES = new Set([1, 25, 50, 75, 100, 150, 175, 200]);

function detectMilestoneMarker(concerts: Concert[]): AnalysisFinding[] {
  const sorted = [...concerts].sort((a, b) => a.date.localeCompare(b.date));
  const findings: AnalysisFinding[] = [];

  sorted.forEach((concert, index) => {
    const concertNumber = index + 1;
    if (!MILESTONES.has(concertNumber)) return;

    const ordinal = (n: number): string => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
    };

    findings.push({
      id: `milestone-${concertNumber}-${concert.headlinerNormalized}`,
      detector: "milestone-marker",
      category: "personal",
      temporality: "evergreen",
      headline: `Concert #${concertNumber}: My ${ordinal(concertNumber)} Show`,
      dataPoints: {
        milestoneNumber: concertNumber,
        artist: concert.headliner,
        artistNormalized: concert.headlinerNormalized,
        venue: concert.venue,
        venueNormalized: concert.venueNormalized,
        city: concert.cityState,
        date: concert.date,
        year: concert.year,
        openers: concert.openers,
      },
      artists: [concert.headlinerNormalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      suggestedImage: { type: "artist", artistNormalized: concert.headlinerNormalized },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
      tags: ["#milestone"],
    });
  });

  return findings;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface AnalysisResult {
  findings: AnalysisFinding[];
  stats: {
    concertsAnalyzed: number;
    findingsByDetector: Record<DetectorName | string, number>;
    findingsByCategory: Record<ContentCategory, number>;
  };
}

export function analyze(concerts: Concert[], today: Date = new Date()): AnalysisResult {
  const past = pastConcerts(concerts, today);

  const allFindings: AnalysisFinding[] = [
    ...detectArtistLongevity(past),
    ...detectOpenerToHeadliner(past),
    ...detectVenueLoyalty(past),
    ...detectCalendarAnniversary(past, today),
    ...detectGeographicChapter(past),
    ...detectConcertStreak(past),
    ...detectMilestoneMarker(past),
  ];

  const findingsByDetector: Record<string, number> = {};
  const findingsByCategory: Record<ContentCategory, number> = {
    cultural: 0,
    personal: 0,
    "deep-cut": 0,
  };

  for (const f of allFindings) {
    findingsByDetector[f.detector] = (findingsByDetector[f.detector] ?? 0) + 1;
    findingsByCategory[f.category] = (findingsByCategory[f.category] ?? 0) + 1;
  }

  return {
    findings: allFindings,
    stats: {
      concertsAnalyzed: past.length,
      findingsByDetector,
      findingsByCategory,
    },
  };
}
