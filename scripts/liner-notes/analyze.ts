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

// Keyed on the full state name as it appears in concert data ("California"),
// matching the convention CITY_PULSE_EVENTS already documents. This map was
// originally keyed on postal codes ("CA"), which never matched a single row —
// every concert resolved to "International" and geographic-chapter emitted one
// meaningless archive-wide finding. See #232.
const STATE_REGION: Record<string, string> = {
  "california": "West Coast", "oregon": "West Coast", "washington": "West Coast",
  "nevada": "Mountain West", "arizona": "Mountain West", "utah": "Mountain West",
  "colorado": "Mountain West", "idaho": "Mountain West", "montana": "Mountain West",
  "wyoming": "Mountain West",
  "illinois": "Midwest", "ohio": "Midwest", "michigan": "Midwest", "indiana": "Midwest",
  "wisconsin": "Midwest", "minnesota": "Midwest", "iowa": "Midwest", "missouri": "Midwest",
  "kansas": "Midwest", "nebraska": "Midwest", "south dakota": "Midwest", "north dakota": "Midwest",
  "texas": "South", "louisiana": "South", "mississippi": "South", "alabama": "South",
  "georgia": "South", "florida": "South", "south carolina": "South", "north carolina": "South",
  "tennessee": "South", "arkansas": "South", "oklahoma": "South", "virginia": "South",
  "west virginia": "South", "kentucky": "South",
  "new york": "Northeast", "new jersey": "Northeast", "pennsylvania": "Northeast",
  "connecticut": "Northeast", "massachusetts": "Northeast", "rhode island": "Northeast",
  "vermont": "Northeast", "new hampshire": "Northeast", "maine": "Northeast",
  "maryland": "Northeast", "delaware": "Northeast", "district of columbia": "Northeast",
  "new mexico": "Southwest", "hawaii": "Pacific", "alaska": "Pacific",
};

/**
 * US region for a concert's state. Non-US states ("Mexico", "UK") correctly
 * fall through to "International".
 *
 * The fallback warns rather than passing silently: an unmapped US state looks
 * exactly like a foreign one to this function, and that indistinguishability is
 * what let #232 publish wrong prose for six months.
 */
export function regionOf(state: string): string {
  const key = state?.trim().toLowerCase();
  const region = STATE_REGION[key];
  if (region) return region;
  if (key && !KNOWN_NON_US.has(key)) {
    console.warn(`[analyze] regionOf: unmapped state "${state}" → International. Add it to STATE_REGION if it's a US state.`);
  }
  return "International";
}

/** States known to be outside the US — these are expected to be "International". */
export const KNOWN_NON_US = new Set(["mexico", "uk"]);

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

    // The window is anchored to the first show in the streak, not to the
    // previously added one. Measuring gap-to-previous chains transitively — each
    // hop restarts the 30 days — so a run extended without bound and produced
    // "14 Concerts in 215 Days", which is a busy stretch, not a streak (#233).
    const windowStart = new Date(streakStart.date + "T12:00:00Z").getTime();

    let j = i + 1;
    while (j < sorted.length) {
      const curr = new Date(sorted[j].date + "T12:00:00Z").getTime();
      const daysFromStart = Math.round((curr - windowStart) / 86_400_000);

      if (daysFromStart <= STREAK_WINDOW_DAYS) {
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

  // Return the top 3 streaks — densest first.
  //
  // Ranking on showCount alone leaves a 9-way tie on current data (every
  // qualifying streak has exactly 3 shows), resolved by array order, so the
  // three chronologically earliest won and "3 Concerts in 28 Days" beat
  // "3 Concerts in 10 Days". Break on density, then id, so the comparator is
  // total and never falls through to insertion order (#233).
  return findings
    .sort(
      (a, b) =>
        (b.dataPoints.showCount as number) - (a.dataPoints.showCount as number) ||
        (a.dataPoints.totalDays as number) - (b.dataPoints.totalDays as number) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, 3);
}

// ── 7. Milestone Marker Detector ──────────────────────────────────────────────

const MILESTONES = new Set([1, 25, 50, 75, 100, 150, 175, 200]);

/** Length of the window a concert streak must fit inside, in days. */
const STREAK_WINDOW_DAYS = 30;

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
        // A milestone is an accumulation, so the story is the distance back to
        // the first show. `spanYears` is what computeSpan scores (#233); the
        // firstShow block is what lets the prose say which night it counts from.
        spanYears: concert.year - sorted[0].year,
        firstShow: {
          date: sorted[0].date,
          artist: sorted[0].headliner,
          venue: sorted[0].venue,
          year: sorted[0].year,
        },
      },
      artists: [concert.headlinerNormalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      // A milestone is one specific night — it should carry a setlist deep link
      // like any other concert-scoped finding (#198).
      concertDate: concert.date,
      suggestedImage: { type: "artist", artistNormalized: concert.headlinerNormalized },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
      tags: ["#milestone"],
    });
  });

  return findings;
}

// ── 8. Rare Sighting Detector ─────────────────────────────────────────────────

function detectRareSighting(concerts: Concert[]): AnalysisFinding[] {
  const countByArtist = new Map<string, Concert[]>();

  for (const c of concerts) {
    const key = c.headlinerNormalized;
    if (!countByArtist.has(key)) countByArtist.set(key, []);
    countByArtist.get(key)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [normalized, shows] of countByArtist) {
    if (shows.length !== 1) continue;

    const concert = shows[0];
    findings.push({
      id: `rare-sighting-${normalized}`,
      detector: "rare-sighting",
      category: "deep-cut",
      temporality: "evergreen",
      headline: `${concert.headliner}: Caught Once, Never Again`,
      dataPoints: {
        artist: concert.headliner,
        venue: concert.venue,
        city: concert.cityState,
        date: concert.date,
        year: concert.year,
        openers: concert.openers,
      },
      artists: [normalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      tags: ["#rare-sighting", "#one-time-only"],
      suggestedImage: { type: "artist", artistNormalized: normalized },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
    });
  }

  // Return all — scorer ranks by span (older = more historically interesting)
  return findings;
}

// ── 9. Historical Moment Detector ─────────────────────────────────────────────

function detectHistoricalMoment(concerts: Concert[]): AnalysisFinding[] {
  const byYear = new Map<number, Concert[]>();

  for (const c of concerts) {
    if (!byYear.has(c.year)) byYear.set(c.year, []);
    byYear.get(c.year)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [year, yearConcerts] of byYear) {
    // Only include years with at least 2 concerts
    if (yearConcerts.length < 2) continue;

    // Pick the concert with the most openers; break ties by earliest date
    const sorted = [...yearConcerts].sort((a, b) => {
      const openerDiff = b.openers.length - a.openers.length;
      if (openerDiff !== 0) return openerDiff;
      return a.date.localeCompare(b.date);
    });

    const concert = sorted[0];

    findings.push({
      id: `historical-moment-${year}-${concert.headlinerNormalized}`,
      detector: "historical-moment",
      category: "deep-cut",
      temporality: "evergreen",
      headline: `${concert.headliner} in ${year}: What Was in the Air`,
      dataPoints: {
        artist: concert.headliner,
        venue: concert.venue,
        city: concert.city,
        state: concert.state,
        date: concert.date,
        year,
        month: new Date(concert.date + "T12:00:00Z").toLocaleString("en-US", { month: "long" }),
        concertsInYear: yearConcerts.length,
      },
      artists: [concert.headlinerNormalized],
      venues: [concert.venueNormalized],
      years: [year],
      tags: ["historical-context", `era-${Math.floor(year / 10) * 10}s`],
      // Prefer venue imagery — the post is about a moment at a specific place
      suggestedImage: { type: "venue", venueNormalized: concert.venueNormalized },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
    });
  }

  // Return all years — scorer ranks by span (older = higher historical interest)
  return findings;
}

// ── 10. Venue Ghost Detector ──────────────────────────────────────────────────

type VenueMetaSlim = {
  status?: string;
  closedDate?: string;
  notes?: string;
};

const GHOST_STATUSES = new Set(["demolished", "closed"]);

function detectVenueGhost(
  concerts: Concert[],
  venuesMetadata: Record<string, VenueMetaSlim>
): AnalysisFinding[] {
  const byVenue = new Map<string, Concert[]>();
  for (const c of concerts) {
    if (!byVenue.has(c.venueNormalized)) byVenue.set(c.venueNormalized, []);
    byVenue.get(c.venueNormalized)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [venueNorm, shows] of byVenue) {
    const meta = venuesMetadata[venueNorm];
    if (!meta?.status || !GHOST_STATUSES.has(meta.status)) continue;

    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const closedYear = meta.closedDate
      ? new Date(meta.closedDate + "T12:00:00Z").getFullYear()
      : null;
    const artists = [...new Set(sorted.map((s) => s.headlinerNormalized))];
    const years = sorted.map((s) => s.year);
    const statusLabel = meta.status === "demolished" ? "Demolished" : "Closed";

    findings.push({
      id: `venue-ghost-${venueNorm}`,
      detector: "venue-ghost",
      category: "deep-cut",
      temporality: "evergreen",
      headline: `${first.venue}: ${shows.length} Show${shows.length !== 1 ? "s" : ""} Before It Was ${statusLabel}`,
      dataPoints: {
        venue: first.venue,
        venueNormalized: venueNorm,
        city: first.cityState,
        showCount: shows.length,
        status: meta.status,
        closedDate: meta.closedDate,
        closedYear,
        notes: meta.notes,
        firstShow: { date: first.date, artist: first.headliner },
        lastShow: { date: last.date, artist: last.headliner },
        artistCount: artists.length,
        topArtists: artists.slice(0, 5),
      },
      artists,
      venues: [venueNorm],
      years,
      suggestedImage: { type: "venue", venueNormalized: venueNorm },
      tags: ["#venue-ghost", `#${meta.status}`],
    });
  }

  return findings.sort(
    (a, b) => (b.dataPoints.showCount as number) - (a.dataPoints.showCount as number)
  );
}

// ── 11. Festival Mega-Bill Detector ───────────────────────────────────────────

const MEGA_BILL_THRESHOLD = 4; // 4+ openers = festival-like

function detectFestivalMegaBill(concerts: Concert[]): AnalysisFinding[] {
  return concerts
    .filter((c) => (c.openers?.length ?? 0) >= MEGA_BILL_THRESHOLD)
    .sort((a, b) => b.openers.length - a.openers.length)
    .slice(0, 10)
    .map((concert) => {
      const allNorm = [
        concert.headlinerNormalized,
        ...concert.openers.map(slugify),
      ];

      return {
        id: `festival-mega-bill-${concert.id ?? slugify(concert.date + concert.headliner)}`,
        detector: "festival-mega-bill" as const,
        category: "cultural" as const,
        temporality: "evergreen" as const,
        headline: `${concert.headliner} + ${concert.openers.length} More: ${concert.year} Festival Bill`,
        dataPoints: {
          headliner: concert.headliner,
          openers: concert.openers,
          openerCount: concert.openers.length,
          totalArtists: concert.openers.length + 1,
          venue: concert.venue,
          city: concert.cityState,
          date: concert.date,
          year: concert.year,
        },
        artists: allNorm,
        venues: [concert.venueNormalized],
        years: [concert.year],
        suggestedImage: { type: "artist" as const, artistNormalized: concert.headlinerNormalized },
        suggestedTrack: { artistNormalized: concert.headlinerNormalized },
        tags: ["#festival-bill", "#mega-bill"],
      };
    });
}

// ── 12. Drought & Comeback Detector ───────────────────────────────────────────

const DROUGHT_MIN_GAP_YEARS = 5;

function detectDroughtComeback(concerts: Concert[]): AnalysisFinding[] {
  const byArtist = new Map<string, Concert[]>();
  for (const c of concerts) {
    if (!byArtist.has(c.headlinerNormalized)) byArtist.set(c.headlinerNormalized, []);
    byArtist.get(c.headlinerNormalized)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [normalized, shows] of byArtist) {
    if (shows.length < 2) continue;
    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));

    // Find the largest gap between consecutive shows
    let maxGap = 0;
    let gapStart: Concert | null = null;
    let gapEnd: Concert | null = null;

    for (let i = 1; i < sorted.length; i++) {
      const gap = spanYears(sorted[i - 1].date, sorted[i].date);
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = sorted[i - 1];
        gapEnd = sorted[i];
      }
    }

    if (maxGap < DROUGHT_MIN_GAP_YEARS || !gapStart || !gapEnd) continue;

    findings.push({
      id: `drought-comeback-${normalized}`,
      detector: "drought-comeback",
      category: "personal",
      temporality: "evergreen",
      headline: `${gapStart.headliner}: ${maxGap} Years Between Shows`,
      dataPoints: {
        artist: gapStart.headliner,
        artistNormalized: normalized,
        lastShowBefore: {
          date: gapStart.date,
          venue: gapStart.venue,
          city: gapStart.cityState,
        },
        firstShowAfter: {
          date: gapEnd.date,
          venue: gapEnd.venue,
          city: gapEnd.cityState,
        },
        gapYears: maxGap,
        totalShows: shows.length,
      },
      artists: [normalized],
      venues: [...new Set(sorted.map((s) => s.venueNormalized))],
      years: sorted.map((s) => s.year),
      suggestedImage: { type: "artist", artistNormalized: normalized },
      suggestedTrack: { artistNormalized: normalized },
      tags: ["#drought", "#comeback"],
    });
  }

  return findings
    .sort((a, b) => (b.dataPoints.gapYears as number) - (a.dataPoints.gapYears as number))
    .slice(0, 15);
}

// ── 13. City Pulse Detector ───────────────────────────────────────────────────

interface CityPulseEvent {
  /** Full state name as it appears in concert data (e.g. "California"), or null = any */
  state: string | null;
  /** Partial city name to match (e.g. "Los Angeles"), or null = any city in state */
  city: string | null;
  year: number;
  event: string;
  context: string;
}

const CITY_PULSE_EVENTS: CityPulseEvent[] = [
  {
    state: "California", city: null, year: 1984,
    event: "1984 Los Angeles Summer Olympics",
    context: "The city was pulsing with Olympic fever — a rare, almost disorienting civic pride for Los Angeles.",
  },
  {
    state: "California", city: null, year: 1992,
    event: "Los Angeles uprising after the Rodney King verdict",
    context: "The streets that summer were fractured and raw after the acquittal. Going out felt charged with something unresolved.",
  },
  {
    state: "California", city: null, year: 1994,
    event: "Northridge earthquake (January 1994)",
    context: "The Northridge quake hit in January and the aftershocks — literal and emotional — ran through the whole year.",
  },
  {
    state: "New York", city: null, year: 2001,
    event: "September 11 attacks",
    context: "After 9/11, New York was raw and defiant. Going out to concerts felt like a small act of communal faith.",
  },
  {
    state: "District of Columbia", city: null, year: 2001,
    event: "September 11 attacks and Pentagon strike",
    context: "Washington was a city on edge — checkpoints, fighter jets overhead, an eerie quiet between bursts of collective grief.",
  },
  {
    state: "Louisiana", city: null, year: 2005,
    event: "Hurricane Katrina",
    context: "Katrina made landfall in August 2005. The failure of the levees became a national wound that hadn't healed by year's end.",
  },
  {
    state: "Massachusetts", city: "Boston", year: 2013,
    event: "Boston Marathon bombing",
    context: "The Marathon bombing in April put the city under siege for a week. Boston came out shaken but resolute.",
  },
];

function detectCityPulse(concerts: Concert[]): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  for (const event of CITY_PULSE_EVENTS) {
    const matching = concerts.filter((c) => {
      if (c.year !== event.year) return false;
      if (event.state !== null && c.state !== event.state) return false;
      if (event.city !== null && !c.city?.includes(event.city)) return false;
      return true;
    });

    if (matching.length === 0) continue;

    // Pick the concert with the most openers (most interesting bill); break ties by date
    const sorted = [...matching].sort((a, b) => {
      const diff = (b.openers?.length ?? 0) - (a.openers?.length ?? 0);
      return diff !== 0 ? diff : a.date.localeCompare(b.date);
    });
    const concert = sorted[0];

    findings.push({
      id: `city-pulse-${slugify(event.event)}-${event.year}`,
      detector: "city-pulse",
      category: "cultural",
      temporality: "evergreen",
      headline: `${concert.headliner} in ${event.year}: The Year of ${event.event}`,
      dataPoints: {
        artist: concert.headliner,
        venue: concert.venue,
        city: concert.cityState,
        date: concert.date,
        year: concert.year,
        historicalEvent: event.event,
        historicalContext: event.context,
        matchingConcertCount: matching.length,
        allMatchingConcerts: matching.map((c) => ({
          date: c.date,
          artist: c.headliner,
          venue: c.venue,
        })),
      },
      artists: matching.map((c) => c.headlinerNormalized),
      venues: [...new Set(matching.map((c) => c.venueNormalized))],
      years: [event.year],
      suggestedImage: { type: "venue", venueNormalized: concert.venueNormalized },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
      tags: ["#city-pulse", "#historical-context"],
    });
  }

  return findings;
}

// ── 14. Album Context Detector ────────────────────────────────────────────────

interface LandmarkAlbum {
  artist: string;
  album: string;
  released: string; // YYYY-MM-DD
  significance: string;
}

const LANDMARK_ALBUMS: LandmarkAlbum[] = [
  { artist: "Prince", album: "Purple Rain", released: "1984-06-25", significance: "one of the defining rock soundtracks of the decade, inescapable that summer" },
  { artist: "Madonna", album: "Like a Virgin", released: "1984-11-12", significance: "a pop statement that dominated radio into 1985 and redefined what a pop star could be" },
  { artist: "U2", album: "The Joshua Tree", released: "1987-03-09", significance: "the record that made U2 global — instantly everywhere in spring 1987" },
  { artist: "Public Enemy", album: "It Takes a Nation of Millions to Hold Us Back", released: "1988-04-10", significance: "hip-hop's first true political landmark, it landed like a manifesto" },
  { artist: "De La Soul", album: "3 Feet High and Rising", released: "1989-03-03", significance: "a complete reinvention of what hip-hop could sound like in one record" },
  { artist: "Depeche Mode", album: "Violator", released: "1990-03-19", significance: "the album that took Depeche Mode from synth cult to arena act" },
  { artist: "Nirvana", album: "Nevermind", released: "1991-09-24", significance: "the record that pivoted the entire rock conversation overnight" },
  { artist: "Massive Attack", album: "Blue Lines", released: "1991-04-08", significance: "trip-hop's founding document — a genre invented in one record" },
  { artist: "U2", album: "Achtung Baby", released: "1991-11-18", significance: "U2 reinventing themselves from the ground up — it shouldn't have worked as well as it did" },
  { artist: "Dr. Dre", album: "The Chronic", released: "1992-12-15", significance: "the record that defined West Coast hip-hop for a generation" },
  { artist: "Radiohead", album: "The Bends", released: "1995-03-13", significance: "the album that signaled Radiohead were doing something different from everyone else" },
  { artist: "Alanis Morissette", album: "Jagged Little Pill", released: "1995-06-13", significance: "a record that felt like a cultural pressure valve releasing — everywhere that summer" },
  { artist: "Radiohead", album: "OK Computer", released: "1997-05-21", significance: "the moment rock turned inward and got strange — in the best way" },
  { artist: "Lauryn Hill", album: "The Miseducation of Lauryn Hill", released: "1998-08-25", significance: "an instant cultural landmark that seemed to arrive fully formed" },
  { artist: "Eminem", album: "The Marshall Mathers LP", released: "2000-05-23", significance: "a record that divided critics and dominated every conversation" },
  { artist: "Daft Punk", album: "Discovery", released: "2001-03-13", significance: "electronic music's crossover moment — it sounded like the future" },
  { artist: "Jay-Z", album: "The Blueprint", released: "2001-09-11", significance: "released on 9/11, overshadowed then rediscovered as a generational classic" },
  { artist: "Arcade Fire", album: "Funeral", released: "2004-09-14", significance: "the indie record that reframed what guitar music could aspire to" },
  { artist: "Kanye West", album: "Late Registration", released: "2005-08-30", significance: "hip-hop's most ambitious production statement up to that point" },
  { artist: "Amy Winehouse", album: "Back to Black", released: "2006-10-27", significance: "soul and pop colliding — everyone seemed to be playing it" },
  { artist: "LCD Soundsystem", album: "Sound of Silver", released: "2007-03-12", significance: "a love letter to dance music and growing older — the year's best record" },
  { artist: "Vampire Weekend", album: "Vampire Weekend", released: "2008-01-29", significance: "indie's sharpest debut in years — it sounded like nothing else" },
  { artist: "Frank Ocean", album: "Channel Orange", released: "2012-07-10", significance: "a complete left turn in R&B that forced everyone to pay attention" },
  { artist: "Kendrick Lamar", album: "good kid, m.A.A.d city", released: "2012-10-22", significance: "hip-hop's defining narrative album of the decade" },
  { artist: "Beyoncé", album: "Beyoncé", released: "2013-12-13", significance: "dropped without warning at midnight and instantly reshaped pop" },
  { artist: "Kendrick Lamar", album: "To Pimp a Butterfly", released: "2015-03-16", significance: "a political, jazz-inflected masterpiece — hip-hop's 'What's Going On'" },
  { artist: "David Bowie", album: "Blackstar", released: "2016-01-08", significance: "released two days before Bowie died — a farewell that felt impossible to process" },
  { artist: "Beyoncé", album: "Lemonade", released: "2016-04-23", significance: "visual album as cultural reckoning — inescapable that spring" },
  { artist: "Kendrick Lamar", album: "DAMN.", released: "2017-04-14", significance: "hip-hop's first Pulitzer Prize winner, arrived without ceremony" },
  { artist: "Taylor Swift", album: "folklore", released: "2020-07-24", significance: "a surprise pandemic drop that felt like a lifeline when nothing else was happening" },
  { artist: "Beyoncé", album: "Renaissance", released: "2022-07-29", significance: "a love letter to Black queer dance culture that reclaimed the dancefloor" },
  { artist: "Taylor Swift", album: "Midnights", released: "2022-10-21", significance: "broke every streaming record in its first week — the conversation of the fall" },
];

const ALBUM_WINDOW_DAYS = 42; // 6 weeks

function detectAlbumContext(concerts: Concert[]): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const usedConcertIds = new Set<string>(); // one finding per concert max

  for (const album of LANDMARK_ALBUMS) {
    const albumDate = new Date(album.released + "T12:00:00Z");

    const nearby = concerts.filter((c) => {
      const concertDate = new Date(c.date + "T12:00:00Z");
      const diffDays = Math.abs(concertDate.getTime() - albumDate.getTime()) / 86_400_000;
      return diffDays <= ALBUM_WINDOW_DAYS;
    });

    if (nearby.length === 0) continue;

    // Prefer concert by the same artist; otherwise pick chronologically closest
    const byArtist = nearby.filter(
      (c) => c.headlinerNormalized === slugify(album.artist)
    );
    const pool = byArtist.length > 0 ? byArtist : nearby;
    const anchor = pool.sort((a, b) => {
      const dA = Math.abs(new Date(a.date + "T12:00:00Z").getTime() - albumDate.getTime());
      const dB = Math.abs(new Date(b.date + "T12:00:00Z").getTime() - albumDate.getTime());
      return dA - dB;
    })[0];

    if (usedConcertIds.has(anchor.id + album.album)) continue;
    usedConcertIds.add(anchor.id + album.album);

    const concertDate = new Date(anchor.date + "T12:00:00Z");
    const daysApart = Math.round(
      (concertDate.getTime() - albumDate.getTime()) / 86_400_000
    );
    const timing =
      daysApart < 0
        ? `${Math.abs(daysApart)} days before it dropped`
        : daysApart === 0
        ? "the same day it dropped"
        : `${daysApart} days after it dropped`;

    findings.push({
      id: `album-context-${slugify(album.album)}-${anchor.headlinerNormalized}`,
      detector: "album-context",
      category: "cultural",
      temporality: "evergreen",
      headline: `${anchor.headliner} — ${timing.includes("before") ? "Days Before" : "Days After"} ${album.album} Dropped`,
      dataPoints: {
        concertArtist: anchor.headliner,
        concertVenue: anchor.venue,
        concertCity: anchor.cityState,
        concertDate: anchor.date,
        concertYear: anchor.year,
        album: album.album,
        albumArtist: album.artist,
        albumReleased: album.released,
        albumSignificance: album.significance,
        daysApart: Math.abs(daysApart),
        timing,
        isSameArtist: byArtist.length > 0,
      },
      artists: [anchor.headlinerNormalized],
      venues: [anchor.venueNormalized],
      years: [anchor.year],
      suggestedImage: { type: "artist", artistNormalized: anchor.headlinerNormalized },
      suggestedTrack: { artistNormalized: anchor.headlinerNormalized },
      tags: ["#album-context", "#cultural-moment"],
    });
  }

  return findings;
}

// ── 15. Genre Outlier Detector ────────────────────────────────────────────────
//
// Finds headliner artists whose genre is significantly outside the user's
// dominant genre pattern. E.g., in a rock/electronic archive, catching a
// reggae or country act stands out as a memorable anomaly.

/** Maps raw genre strings (lowercased) to broad genre families. */
const GENRE_FAMILY_MAP: Record<string, string> = {
  // Rock
  "rock": "Rock", "rock/pop": "Rock", "alternative rock": "Rock",
  "indie rock": "Rock", "hard rock": "Rock", "punk rock": "Rock",
  "punk": "Rock", "classic rock": "Rock", "progressive rock": "Rock",
  "garage rock": "Rock", "folk rock": "Rock", "psychedelic rock": "Rock",
  "grunge": "Rock", "new wave": "Rock",
  // Electronic / Synth
  "electronic": "Electronic", "synthpop": "Electronic", "electronica": "Electronic",
  "dance": "Electronic", "techno": "Electronic", "house": "Electronic",
  "ambient": "Electronic", "industrial": "Electronic", "edm": "Electronic",
  "synth pop": "Electronic",
  // Pop
  "pop": "Pop", "pop rock": "Pop", "teen pop": "Pop", "dance pop": "Pop",
  // Hip-Hop
  "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", "rap": "Hip-Hop",
  "hip-hop/rap": "Hip-Hop",
  // R&B / Soul
  "r&b": "R&B/Soul", "soul": "R&B/Soul", "funk": "R&B/Soul",
  "motown": "R&B/Soul", "neo soul": "R&B/Soul",
  // Reggae / Ska
  "reggae": "Reggae", "ska": "Reggae", "dancehall": "Reggae",
  // Metal
  "metal": "Metal", "heavy metal": "Metal", "thrash metal": "Metal",
  "glam metal": "Metal",
  // Jazz / Blues
  "jazz": "Jazz/Blues", "blues": "Jazz/Blues", "soul blues": "Jazz/Blues",
  // Country / Folk
  "country": "Country/Folk", "folk": "Country/Folk", "americana": "Country/Folk",
  // Latin
  "latin": "Latin", "salsa": "Latin",
  // Classical
  "classical": "Classical",
};

function genreFamily(genre: string): string {
  return GENRE_FAMILY_MAP[genre.toLowerCase()] ?? "Other";
}

/** Minimum shows for genre distribution to be meaningful. */
const GENRE_OUTLIER_MIN_SHOWS = 15;
/** An artist's genre family must fall outside the top N dominant families. */
const GENRE_DOMINANT_TOP_N = 3;

function detectGenreOutlier(
  concerts: Concert[],
  artistsMetadata: Record<string, { genres?: string[] }>
): AnalysisFinding[] {
  if (concerts.length < GENRE_OUTLIER_MIN_SHOWS) return [];

  // Step 1: Build concert-weighted genre family distribution over headliners
  const familyConcertCount: Record<string, number> = {};
  const artistFamilies: Record<string, string[]> = {}; // normalized → unique families

  for (const c of concerts) {
    const meta = artistsMetadata[c.headlinerNormalized];
    if (!meta?.genres?.length) continue;

    const families = [...new Set(meta.genres.map(genreFamily).filter((f) => f !== "Other"))];
    if (families.length === 0) continue;

    artistFamilies[c.headlinerNormalized] = families;
    for (const fam of families) {
      familyConcertCount[fam] = (familyConcertCount[fam] ?? 0) + 1;
    }
  }

  // Step 2: Identify dominant families
  const ranked = Object.entries(familyConcertCount)
    .sort(([, a], [, b]) => b - a);
  const dominantFamilies = new Set(ranked.slice(0, GENRE_DOMINANT_TOP_N).map(([f]) => f));
  const totalConcertsWithGenre = Object.values(familyConcertCount).reduce((a, b) => a + b, 0);
  const dominantPct = ranked
    .slice(0, GENRE_DOMINANT_TOP_N)
    .reduce((sum, [, n]) => sum + n, 0) / totalConcertsWithGenre;

  // Only fire if the archive is genuinely genre-concentrated (top 3 ≥ 55%)
  if (dominantPct < 0.55) return [];

  // Step 3: Find artists whose families don't overlap with dominant
  const byArtist = new Map<string, Concert[]>();
  for (const c of concerts) {
    if (!byArtist.has(c.headlinerNormalized)) byArtist.set(c.headlinerNormalized, []);
    byArtist.get(c.headlinerNormalized)!.push(c);
  }

  const findings: AnalysisFinding[] = [];

  for (const [normalized, shows] of byArtist) {
    const families = artistFamilies[normalized];
    if (!families || families.length === 0) continue;

    // Outlier = no genre family overlaps with dominant set
    const isOutlier = !families.some((f) => dominantFamilies.has(f));
    if (!isOutlier) continue;

    // Skip artists with many shows — they're not really outliers
    if (shows.length > 4) continue;

    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const firstShow = sorted[0];
    const outlierFamily = families[0]; // Primary genre family of the outlier
    const dominantList = [...dominantFamilies].join(" / ");

    findings.push({
      id: `genre-outlier-${normalized}`,
      detector: "genre-outlier",
      category: "deep-cut",
      temporality: "evergreen",
      headline: `${firstShow.headliner}: A ${outlierFamily} Outlier in a ${dominantList} Archive`,
      dataPoints: {
        artist: firstShow.headliner,
        artistNormalized: normalized,
        artistGenres: artistsMetadata[normalized]?.genres ?? [],
        artistGenreFamily: outlierFamily,
        dominantFamilies: [...dominantFamilies],
        dominantFamilyPercent: Math.round(dominantPct * 100),
        showCount: shows.length,
        shows: sorted.map((s) => ({ date: s.date, venue: s.venue, city: s.cityState })),
      },
      artists: [normalized],
      venues: [...new Set(sorted.map((s) => s.venueNormalized))],
      years: sorted.map((s) => s.year),
      suggestedImage: { type: "artist", artistNormalized: normalized },
      suggestedTrack: { artistNormalized: normalized },
      tags: ["#genre-outlier", `#${slugify(outlierFamily)}`],
    });
  }

  // Sort by show count ascending (rarest appearances = most surprising)
  return findings.sort((a, b) =>
    (a.dataPoints.showCount as number) - (b.dataPoints.showCount as number)
  );
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

export interface AnalyzeOptions {
  venuesMetadata?: Record<string, VenueMetaSlim>;
  artistsMetadata?: Record<string, { genres?: string[] }>;
}

export function analyze(
  concerts: Concert[],
  today: Date = new Date(),
  options: AnalyzeOptions = {}
): AnalysisResult {
  const past = pastConcerts(concerts, today);

  const allFindings: AnalysisFinding[] = [
    ...detectArtistLongevity(past),
    ...detectOpenerToHeadliner(past),
    ...detectVenueLoyalty(past),
    ...detectCalendarAnniversary(past, today),
    ...detectGeographicChapter(past),
    ...detectConcertStreak(past),
    ...detectMilestoneMarker(past),
    ...detectRareSighting(past),
    ...detectHistoricalMoment(past),
    ...detectVenueGhost(past, options.venuesMetadata ?? {}),
    ...detectFestivalMegaBill(past),
    ...detectDroughtComeback(past),
    ...detectCityPulse(past),
    ...detectAlbumContext(past),
    ...detectGenreOutlier(past, options.artistsMetadata ?? {}),
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
