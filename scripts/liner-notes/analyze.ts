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
import { lookupSongAlbum } from "../utils/song-album-lookup.ts";
import type { AnalysisFinding, ContentCategory, DetectorName } from "./types.ts";
import {
  EMPTY_ALIAS_MAP,
  canonicalOf,
  displayNameOf,
  relatedActs,
  sharedMemberOf,
  type AliasMap,
} from "./artist-aliases.ts";
import {
  describeSong,
  guestAppearances,
  songsAtEveryShow,
  songsFor,
  songsInCommon,
  type SetlistIndex,
} from "./setlists.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Display names for everyone who appears on a bill, openers included. The
 * concert record only names the headliner, and a slug is not presentable —
 * detectors that surface openers or setlist guests need this or they print
 * "pennywise" at the reader.
 */
function buildDisplayNames(concerts: Concert[]): (slug: string) => string {
  const names = new Map<string, string>();
  for (const concert of concerts) {
    names.set(concert.headlinerNormalized, concert.headliner);
    for (const opener of concert.openers) {
      if (!names.has(slugify(opener))) names.set(slugify(opener), opener);
    }
  }
  return (slug: string) => names.get(slug) ?? slug;
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

function detectArtistLongevity(concerts: Concert[], setlists?: SetlistIndex): AnalysisFinding[] {
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

    // The song that survived every show on record (#229, absorbing `never-left`
    // from #228). A stronger fact than the first/last pair: "Everything Counts
    // at all five Depeche Mode shows, 1985 to 2023" is a streak, not a
    // coincidence. Empty when fewer than three of the shows have a setlist.
    const constants = songsAtEveryShow(setlists, sorted, normalized);
    if (constants.length) tags.push("#never-left");

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
        // Present only when there is one — the prose must not reach for a song
        // that isn't there (#229).
        ...(constants.length ? { songsAtEveryShow: constants } : {}),
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

function detectOpenerToHeadliner(concerts: Concert[], setlists?: SetlistIndex): AnalysisFinding[] {
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

    // Songs they played in both roles (#229). Compared against the same
    // headlining night the rest of the finding describes, so the numbers and
    // the songs agree; no shared songs simply means no song detail.
    const bothRoles = songsInCommon(setlists, earliestOpener, firstHeadline, norm);

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
        ...(bothRoles.length ? { songsInBothRoles: bothRoles } : {}),
      },
      // The headlining night — the one the song join lands on.
      ...(bothRoles.length ? { concertDate: firstHeadline.date } : {}),
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
      tags: bothRoles.length
        ? ["#opener-to-headliner", "#career-arc", "#same-song"]
        : ["#opener-to-headliner", "#career-arc"],
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
      // The one night this story is about, so the post carries a ?show= setlist
      // deep link (#198). Pairs with artists[0] in buildDeepLinks.
      concertDate: c.date,
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

function detectRareSighting(concerts: Concert[], setlists?: SetlistIndex): AnalysisFinding[] {
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
    // The only time you saw them — so what they opened and closed with is the
    // whole shape of that night (#229). 41 of the 68 one-timers have a setlist;
    // the rest simply carry no song detail.
    const songs = songsFor(setlists, concert.date, normalized);
    const openedWith = describeSong(songs[0]);
    const closedWith = describeSong(songs[songs.length - 1]);

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
        ...(songs.length
          ? { songCount: songs.length, openedWith, closedWith }
          : {}),
      },
      // The one night this story is about, so the post carries a ?show= setlist
      // deep link (#198). Pairs with artists[0] in buildDeepLinks.
      concertDate: concert.date,
      artists: [normalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      tags: songs.length
        ? ["#rare-sighting", "#one-time-only", "#only-setlist"]
        : ["#rare-sighting", "#one-time-only"],
      suggestedImage: { type: "artist", artistNormalized: normalized },
      // Deliberately artist-level, though #299 lists this detector as one that
      // "knows the song". It knows TWO — an opener and a closer — and the story
      // is the night, not either of them. `openedWith`/`closedWith` are also
      // `describeSong` output, so a cover arrives as "Song (X cover)" and would
      // be searched verbatim. Nothing here is a wrong song waiting to happen.
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
      // The one night this story is about, so the post carries a ?show= setlist
      // deep link (#198). Pairs with artists[0] in buildDeepLinks.
      concertDate: concert.date,
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
  venuesMetadata: Record<string, VenueMetaSlim>,
  setlists?: SetlistIndex
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
    // 🔴 A CLOSING DATE THE ARCHIVE ITSELF CONTRADICTS IS NOT A FACT TO WRITE FROM.
    //
    // `closedDate` is hand-maintained in data/venue-status.csv, and Universal
    // Amphitheater carried 1999-12-31 beside shows this archive records in 2002
    // and 2005. The detector handed that contradiction to the generator as a
    // data point, and the generator did the reasonable thing with it — it wrote
    // a story: "my last show technically happened at a completely different
    // building on the same site, six years after the original was torn down."
    // That note is published. Nothing in it is true, and every number in it came
    // from the data.
    //
    // Dropped rather than corrected: the right closing date is not derivable
    // from anything here, and guessing one is the same failure wearing a
    // different hat. Without it the post is still written — as a room that is
    // gone, which IS supported — just never with a year attached.
    const closedAfterLastShow = meta.closedDate ? meta.closedDate >= last.date : true;
    if (meta.closedDate && !closedAfterLastShow) {
      console.warn(
        `   ⚠️  ${first.venue}: closedDate ${meta.closedDate} precedes its own last show ` +
          `(${last.date}). Dropping the date — fix data/venue-status.csv.`
      );
    }
    const closedDate = closedAfterLastShow ? meta.closedDate : undefined;
    const closedYear = closedDate
      ? new Date(closedDate + "T12:00:00Z").getFullYear()
      : null;
    const artists = [...new Set(sorted.map((s) => s.headlinerNormalized))];
    const years = sorted.map((s) => s.year);
    const statusLabel = meta.status === "demolished" ? "Demolished" : "Closed";

    // The last thing played in a room that no longer exists (#229, absorbing
    // `last-song-standing` from #228). venue-ghost already knew which venues
    // died; it never knew what was played. Resolved to the closing night's
    // headliner, which is also what stops a festival bill returning several
    // competing "last songs". Tape entries are filtered upstream, so this is the
    // last thing performed — not the record the fireworks went off to.
    const finalSongs = songsFor(setlists, last.date, last.headlinerNormalized);
    const lastSongEver = describeSong(finalSongs[finalSongs.length - 1]);

    // The closing night's headliner leads. artists[0] is what the setlist link
    // pairs with concertDate, and pairing the *first* night's artist with the
    // *last* night's date is exactly the mismatch #239 was about — this detector
    // would have reintroduced it the moment it started emitting a link.
    const orderedArtists = lastSongEver
      ? [last.headlinerNormalized, ...artists.filter((a) => a !== last.headlinerNormalized)]
      : artists;

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
        closedDate,
        closedYear,
        notes: meta.notes,
        firstShow: { date: first.date, artist: first.headliner },
        lastShow: { date: last.date, artist: last.headliner },
        ...(lastSongEver ? { lastSongEver } : {}),
        artistCount: artists.length,
        topArtists: artists.slice(0, 5),
      },
      // The final night. venue-ghost is venue-scoped, but the last song happened
      // on one specific evening — and artists[0] is that night's headliner, so
      // the setlist link resolves.
      ...(lastSongEver ? { concertDate: last.date } : {}),
      artists: orderedArtists,
      venues: [venueNorm],
      years,
      suggestedImage: { type: "venue", venueNormalized: venueNorm },
      tags: lastSongEver
        ? ["#venue-ghost", `#${meta.status}`, "#last-song"]
        : ["#venue-ghost", `#${meta.status}`],
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
        // Keyed on date + headliner, never concert.id. Row ids are re-import
        // artifacts, and finding ids are load-bearing: mergePosts deduplicates on
        // them, and slug preservation looks the previous post up by id. A sheet
        // re-import that renumbered rows would silently duplicate every
        // festival-mega-bill post and break its URL (#242). Four of them had
        // already drifted out of reach by the time this was found.
        id: `festival-mega-bill-${slugify(`${concert.date}-${concert.headliner}`)}`,
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
        // The one night this story is about (#198). allNorm[0] is the headliner.
        concertDate: concert.date,
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

function detectDroughtComeback(concerts: Concert[], setlists?: SetlistIndex): AnalysisFinding[] {
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

    // What they opened the comeback show with (#229). The first song after a
    // decades-long silence is the join; a bare gap count is just arithmetic.
    // Tape entries are excluded upstream, so this is the first thing actually
    // played, not the walk-on music.
    const returnedWith = describeSong(songsFor(setlists, gapEnd.date, normalized)[0]);

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
        ...(returnedWith ? { returnedWith } : {}),
      },
      // The comeback night — the one the song lands on.
      ...(returnedWith ? { concertDate: gapEnd.date } : {}),
      artists: [normalized],
      venues: [...new Set(sorted.map((s) => s.venueNormalized))],
      years: sorted.map((s) => s.year),
      suggestedImage: { type: "artist", artistNormalized: normalized },
      suggestedTrack: { artistNormalized: normalized },
      tags: returnedWith ? ["#drought", "#comeback", "#first-song-back"] : ["#drought", "#comeback"],
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
      // The one night this story is about, so the post carries a ?show= setlist
      // deep link (#198). Pairs with artists[0] in buildDeepLinks.
      concertDate: concert.date,
      // The headlined concert's artist must lead: artists[0] drives the setlist
      // deep link, the image, the audio and the dedup key. Listing every matching
      // year's artist chronologically put a different artist first (#239).
      artists: [
        concert.headlinerNormalized,
        ...matching
          .map((c) => c.headlinerNormalized)
          .filter((a) => a !== concert.headlinerNormalized),
      ],
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

const ALBUM_WINDOW_DAYS = 42; // 6 weeks — same-artist findings only

/**
 * Cross-artist proximity bar, tightened from 42 days (#272).
 *
 * Measured: at 42 days this detector produced 17 findings of which ZERO were
 * same-artist — the byArtist preference branch below had never once fired, so
 * every album-context post ever published was a cross-artist coincidence. That
 * is why the prose strains ("across town, Kanye was putting finishing touches
 * on an album that would blend hip-hop with string arrangements...").
 *
 * 21 days costs 6 of those 17. The detector simultaneously gains ~25
 * same-artist findings from the discography join, so net supply roughly
 * doubles while the weakest third of the old supply retires.
 */
const CROSS_ARTIST_WINDOW_DAYS = 21;

function detectAlbumContext(
  concerts: Concert[],
  aliases: AliasMap = EMPTY_ALIAS_MAP,
  eras?: AlbumErasSlim
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const usedConcertIds = new Set<string>(); // one finding per concert max

  // ── Same-artist findings from the discography join ────────────────────────
  //
  // The 31 hand-curated LANDMARK_ALBUMS below produce ZERO same-artist
  // findings — measured, not assumed. The `byArtist` preference branch had
  // never once fired, which is why every album-context post ever published was
  // a cross-artist coincidence and why the prose strained to justify itself.
  //
  // These are the real thing: a night that actually sat inside a release week.
  // No `albumSignificance` — that string is editorial and the corpus cannot
  // supply it. For a same-artist finding the significance IS the personal
  // fact ("I was there four days after it came out"), not a cultural claim.
  if (eras) {
    for (const concert of concerts) {
      const era = eras.concerts[concert.id];
      if (!era) continue;

      const artist = eras.artists[era.artistKey];
      const previous = era.currentAlbum;
      const next = artist?.studioAlbums[era.albumsBefore];

      const concertMs = new Date(concert.date + "T12:00:00Z").getTime();
      const daysFrom = (release: string) =>
        Math.round((concertMs - new Date(release + "T12:00:00Z").getTime()) / 86_400_000);

      // Nearest release in either direction, inside the window.
      const candidates: Array<{ album: { title: string; releaseDate: string; mbid: string }; days: number }> = [];
      if (previous) {
        const d = daysFrom(previous.releaseDate);
        if (d >= 0 && d <= ALBUM_WINDOW_DAYS) candidates.push({ album: previous, days: d });
      }
      if (next) {
        const d = daysFrom(next.releaseDate);
        if (d < 0 && Math.abs(d) <= ALBUM_WINDOW_DAYS) candidates.push({ album: next, days: d });
      }
      if (!candidates.length) continue;

      const best = candidates.sort((a, b) => Math.abs(a.days) - Math.abs(b.days))[0];
      const timing =
        best.days < 0
          ? `${Math.abs(best.days)} days before it dropped`
          : best.days === 0
          ? "the same day it dropped"
          : `${best.days} days after it dropped`;

      usedConcertIds.add(concert.id + best.album.title);

      findings.push({
        id: `album-context-own-${concert.headlinerNormalized}-${concert.date}`,
        detector: "album-context",
        category: "cultural",
        temporality: "evergreen",
        headline: `${concert.headliner} — ${best.days < 0 ? "Days Before" : "Days After"} ${best.album.title} Dropped`,
        dataPoints: {
          concertArtist: concert.headliner,
          concertVenue: concert.venue,
          concertCity: concert.cityState,
          concertDate: concert.date,
          concertYear: concert.year,
          album: best.album.title,
          albumArtist: concert.headliner,
          albumReleased: best.album.releaseDate,
          daysApart: Math.abs(best.days),
          timing,
          isSameArtist: true,
          albumMbid: best.album.mbid,
          albumSlug: slugify(best.album.title),
        },
        concertDate: concert.date,
        artists: [concert.headlinerNormalized],
        venues: [concert.venueNormalized],
        years: [concert.year],
        suggestedImage: {
          type: "album",
          artistNormalized: concert.headlinerNormalized,
          albumName: best.album.title,
        },
        suggestedTrack: { artistNormalized: concert.headlinerNormalized },
        tags: ["#album-context", "#cultural-moment", "#release-week"],
      });
    }
  }

  for (const album of LANDMARK_ALBUMS) {
    const albumDate = new Date(album.released + "T12:00:00Z");

    // Alias-aware, consistent with full-circle and guest-bridge (#227): a
    // landmark credited to one billing still matches a show under another.
    const albumArtistCanon = canonicalOf(aliases, slugify(album.artist));
    const isAlbumArtist = (c: Concert) =>
      canonicalOf(aliases, c.headlinerNormalized) === albumArtistCanon;

    const withinDays = (c: Concert, limit: number) => {
      const concertDate = new Date(c.date + "T12:00:00Z");
      return Math.abs(concertDate.getTime() - albumDate.getTime()) / 86_400_000 <= limit;
    };

    // Same-artist gets the full 6 weeks; a stranger coincidence must be much
    // tighter to earn a post at all.
    const byArtist = concerts.filter((c) => isAlbumArtist(c) && withinDays(c, ALBUM_WINDOW_DAYS));
    const nearby = byArtist.length
      ? byArtist
      : concerts.filter((c) => withinDays(c, CROSS_ARTIST_WINDOW_DAYS));

    if (nearby.length === 0) continue;

    const pool = nearby;
    const anchor = pool.sort((a, b) => {
      const dA = Math.abs(new Date(a.date + "T12:00:00Z").getTime() - albumDate.getTime());
      const dB = Math.abs(new Date(b.date + "T12:00:00Z").getTime() - albumDate.getTime());
      return dA - dB;
    })[0];

    // Safe use of a row id: this set is built and discarded inside this call, so it
    // never outlives the numbering it depends on. Unlike a finding id (#242).
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
      // The one night this story is about, so the post carries a ?show= setlist
      // deep link (#198). Pairs with artists[0] in buildDeepLinks.
      concertDate: anchor.date,
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
      // Only a single-show outlier is about one night; a multi-show one isn't.
      ...(sorted.length === 1 ? { concertDate: sorted[0].date } : {}),
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
  /**
   * `name` is read alongside `genres`: the song-albums lookup needs the DISPLAY
   * name, because the discography is keyed by its slug and the two disagree
   * about ampersands (`Echo & The Bunnymen` -> `echo-the-bunnymen`).
   */
  artistsMetadata?: Record<string, { genres?: string[]; name?: string }>;
  /** Artist billing aliases (#227). Absent means every billing is its own act. */
  aliases?: AliasMap;
  /**
   * Setlist lookup (#229). Optional: without it every detector behaves exactly
   * as before and simply carries no song detail, which is how concerts with no
   * setlist degrade — silently, never with a stub sentence.
   */
  setlists?: SetlistIndex;
  /**
   * Album-era join (#270). Absent means the three discography detectors return
   * [] and every other detector behaves exactly as before — the same graceful
   * degradation the setlist index uses.
   */
  eras?: AlbumErasSlim;
  /**
   * Song → album attribution (#277). Absent means `road-tested` returns [] and
   * every other detector is untouched — the same graceful degradation `eras`
   * and the setlist index use.
   */
  songAlbums?: SongAlbumsSlim;
  /** `artist-aliases.json`'s discographyKeys relation, for the song-albums lookup. */
  discographyKeys?: ReadonlyArray<{ act: string; discographyKey: string }>;
  /** album mbid → track count. Absent means most-witnessed-album reports null. */
  albumTrackCounts?: Record<string, number>;
}

/** The slice of song-albums.json the detectors read. */
export interface SongAlbumsSlim {
  songs: Record<string, {
    songTitle: string;
    albumTitle: string;
    mbid: string;
    releaseDate: string;
    coverAvailable: boolean;
    matchTier: number;
    isCover?: boolean;
    originalArtistKey?: string;
  }>;
}

/** The slice of album-eras.json the detectors read. */
export interface AlbumErasSlim {
  concerts: Record<string, {
    artistKey: string;
    currentAlbum: { title: string; mbid: string; releaseDate: string } | null;
    albumsBefore: number;
    albumsAfter: number;
    careerYear: number | null;
    yearsBeforeDebut: number | null;
    definingAlbum:
      | { mbid: string; title: string; releaseDate: string; topTrackCount: number; topTrackTotal: number }
      | null;
    definingAlbumAhead: boolean;
    definingAlbumMonthsAway: number | null;
  }>;
  artists: Record<string, {
    displayName: string;
    studioAlbumCount: number;
    studioAlbums: Array<{ mbid: string; title: string; releaseDate: string; coverAvailable: boolean }>;
    erasSeen: Array<{ albumSlug: string; title: string; showCount: number; dates: string[] }>;
  }>;
}


// ── 18. Album Trajectory Detector ────────────────────────────────────────────

/**
 * A night when the record they'd be remembered for did not exist yet.
 *
 * This is the first detector in the pipeline where the narrator is WRONG about
 * the future, and that is the entire point. Every other detector tells a
 * pattern story from now, looking backwards at a shape — longevity, loyalty,
 * gaps. Here the reader knows something the person in the seat does not.
 *
 * Depeche Mode at the Rose Bowl, June 1988: Violator was twenty months away.
 *
 * "Defining album" is the record carrying a plurality of the artist's still-
 * streamed top tracks — a proxy for what ENDURED, not for critical canon. The
 * finding carries topTrackCount/topTrackTotal so prose can cite that evidence
 * rather than assert a judgment the data cannot support.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §5a
 */

/** Below this the gap is a release-schedule accident, not a story. */
const TRAJECTORY_MIN_MONTHS = 3;

export function detectAlbumTrajectory(
  concerts: Concert[],
  eras?: AlbumErasSlim
): AnalysisFinding[] {
  if (!eras) return [];
  const findings: AnalysisFinding[] = [];

  for (const concert of concerts) {
    const era = eras.concerts[concert.id];
    if (!era?.definingAlbumAhead || !era.definingAlbum) continue;
    if ((era.definingAlbumMonthsAway ?? 0) < TRAJECTORY_MIN_MONTHS) continue;

    const artist = eras.artists[era.artistKey];
    const defining = era.definingAlbum;
    const monthsAway = era.definingAlbumMonthsAway as number;
    const years = Math.round((monthsAway / 12) * 10) / 10;
    const away =
      monthsAway >= 24 ? `${years} Years` : `${monthsAway} Months`;

    // Self-titled records collide with the artist name: "Bat Fangs — 4 Months
    // Before Bat Fangs" reads like a typo. Name the relationship instead.
    const selfTitled = slugify(defining.title) === slugify(concert.headliner);
    const target = selfTitled
      ? era.albumsBefore === 0
        ? "Their First Record"
        : "The Album That Shares Their Name"
      : defining.title;

    findings.push({
      id: `album-trajectory-${concert.headlinerNormalized}-${concert.date}`,
      detector: "album-trajectory",
      category: "cultural",
      temporality: "evergreen",
      headline: `${concert.headliner} — ${away} Before ${target}`,
      dataPoints: {
        artist: concert.headliner,
        venue: concert.venue,
        city: concert.cityState,
        date: concert.date,
        year: concert.year,
        definingAlbumTitle: defining.title,
        definingAlbumReleaseDate: defining.releaseDate,
        monthsAway,
        // The evidence, so prose cites rather than asserts (voice rule §6b).
        topTrackCount: defining.topTrackCount,
        topTrackTotal: defining.topTrackTotal,
        albumsAfter: era.albumsAfter,
        albumsBefore: era.albumsBefore,
        currentAlbumTitle: era.currentAlbum?.title ?? null,
        careerYear: era.careerYear,
        yearsBeforeDebut: era.yearsBeforeDebut,
        // Album identity rides along inert (spec §Part 7): the future
        // discography deep link becomes a rendering change, not a migration.
        definingAlbumMbid: defining.mbid,
        definingAlbumSlug: slugify(defining.title),
        albumsAheadIdentity: (artist?.studioAlbums ?? [])
          .slice(era.albumsBefore)
          .slice(0, 5)
          .map((a) => ({ mbid: a.mbid, slug: slugify(a.title), title: a.title, releaseDate: a.releaseDate })),
      },
      concertDate: concert.date,
      artists: [concert.headlinerNormalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      // The record that did not exist yet is the right image for the post.
      suggestedImage: {
        type: "album",
        artistNormalized: concert.headlinerNormalized,
        albumName: defining.title,
      },
      suggestedTrack: { artistNormalized: concert.headlinerNormalized },
      tags: ["#album-trajectory", "#before-the-breakthrough"],
    });
  }

  return findings.sort(
    (a, b) => (b.dataPoints.monthsAway as number) - (a.dataPoints.monthsAway as number)
  );
}

// ── 18b. Road-Tested Detector ────────────────────────────────────────────────

/**
 * A song heard live before the album carrying it existed.
 *
 * The exact inverse of `album-trajectory`: there the RECORD was ahead, here the
 * SONG was. Wham! playing "The Edge of Heaven" ten months early; Royal Blood
 * playing four songs off an unreleased record ten days out.
 *
 * ── CLAIM THE ALBUM, NEVER THE SONG'S EXISTENCE ──────────────────────────────
 * This detector knows one thing: the album we attribute the song to came out
 * after the night. It does NOT know the song was unwritten or unreleased.
 * Garbage's "No Horses" was a standalone 2017 single that only reached an album
 * in 2021 — the song existed the night it was heard. Prose must say "before the
 * record came out", never "before the song existed". See §5e.
 *
 * ── BOTH BOUNDS ARE MEASURED, NOT CHOSEN ─────────────────────────────────────
 * Upper: 1,095 days. Past three years the population turns into re-recordings
 * and reissues — James' "Sit Down" at 10,856 days resolves to a 2023 orchestral
 * re-recording. Settled by reading all 71 findings by hand.
 *
 * Lower: the release date's OWN precision window, not a flat floor. A 14-day
 * test against a `YYYY-MM` date is not strict or lenient, it is undefined —
 * Crowded House's "In My Command" (`1993-10`) reads as 13 days only because the
 * earliest possible date was assumed; the truth is somewhere in 13–43. And a
 * flat 14-day floor deleted the Royal Blood finding outright.
 *
 * These bounds are a PERMANENCE guarantee, not a quality filter. Enrichment
 * re-runs Mondays 07:00 UTC and liner notes publish unreviewed at 08:00 UTC,
 * permalinked and never revisited, while release dates are contributor-edited
 * upstream. A finding sitting near a threshold is one edit from being false
 * forever, with nothing to re-check it.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §5a
 */

/** Past this the album is a re-recording or a reissue, not the record they were touring toward. */
const ROAD_TESTED_MAX_DAYS = 1095;

/**
 * Minimum gap by release-date precision. The gap must clear the width of the
 * date's own uncertainty, so the claim survives a Monday refresh.
 */
const ROAD_TESTED_MIN_DAYS: Record<"day" | "month" | "year", number | null> = {
  day: 7,
  month: 31,
  year: null, // never fires — a bare year cannot support any gap claim
};

type DatePrecision = "day" | "month" | "year";

function releaseDatePrecision(releaseDate: string): DatePrecision | null {
  const parts = String(releaseDate ?? "").split("-");
  if (parts.length === 3) return "day";
  if (parts.length === 2) return "month";
  if (parts.length === 1 && parts[0].length === 4) return "year";
  return null;
}

/**
 * Days between a concert and a release, measuring to the EARLIEST instant the
 * release date can mean. Generous to the album on purpose: an imprecise date is
 * never allowed to inflate the gap, and the precision floor above then discards
 * anything the width could have swallowed.
 */
function daysBeforeRelease(concertDate: string, releaseDate: string): number | null {
  const precision = releaseDatePrecision(releaseDate);
  if (!precision) return null;
  const earliest =
    precision === "day"
      ? releaseDate
      : precision === "month"
        ? `${releaseDate}-01`
        : `${releaseDate}-01-01`;
  const release = Date.parse(`${earliest}T12:00:00Z`);
  const concert = Date.parse(`${concertDate}T12:00:00Z`);
  if (Number.isNaN(release) || Number.isNaN(concert)) return null;
  return Math.round((release - concert) / 86_400_000);
}

export function detectRoadTested(
  concerts: Concert[],
  setlists?: SetlistIndex,
  songAlbums?: SongAlbumsSlim,
  ctx: {
    artistsMetadata?: Record<string, { name?: string } | undefined>;
    discographyKeys?: ReadonlyArray<{ act: string; discographyKey: string }>;
  } = {}
): AnalysisFinding[] {
  if (!songAlbums || !setlists) return [];
  const findings: AnalysisFinding[] = [];

  for (const concert of concerts) {
    const songs = songsFor(setlists, concert.date, concert.headlinerNormalized);
    if (!songs.length) continue;

    const early: Array<{ song: string; album: string; releaseDate: string; days: number }> = [];

    for (const song of songs) {
      const rec = lookupSongAlbum(songAlbums.songs, concert.headliner, song.name, {
        artistsMetadata: ctx.artistsMetadata,
        discographyKeys: ctx.discographyKeys,
      });
      // A cover's album belongs to the original act, so "they played it before
      // the record existed" is not a claim about this night's performers.
      if (!rec || rec.isCover) continue;

      const precision = releaseDatePrecision(rec.releaseDate);
      if (!precision) continue;
      const floor = ROAD_TESTED_MIN_DAYS[precision];
      if (floor === null) continue;

      const days = daysBeforeRelease(concert.date, rec.releaseDate);
      if (days === null || days <= floor || days > ROAD_TESTED_MAX_DAYS) continue;

      early.push({ song: song.name, album: rec.albumTitle, releaseDate: rec.releaseDate, days });
    }

    if (!early.length) continue;

    // One finding per night, anchored on the album most of the early songs came
    // from — a night with four songs off one unreleased record is one story.
    const byAlbum = new Map<string, typeof early>();
    for (const e of early) {
      const list = byAlbum.get(e.album) ?? [];
      list.push(e);
      byAlbum.set(e.album, list);
    }
    const [albumTitle, songsFromAlbum] = [...byAlbum.entries()].sort(
      (a, b) => b[1].length - a[1].length || b[1][0].days - a[1][0].days
    )[0];

    const days = Math.max(...songsFromAlbum.map((e) => e.days));

    // The song heard furthest ahead of the record is the one the story is
    // built on, so it is the one the footer should play (#299). Ties break on
    // title: this is written into a permalinked post, and a rerun that picked
    // a different song each time would be a silent inconsistency.
    const earliestHeard = [...songsFromAlbum].sort(
      (a, b) => b.days - a.days || a.song.localeCompare(b.song)
    )[0].song;

    // Sub-month gaps must read in days. The lower bound now admits findings as
    // close as 8 days, and "0 Months Before" is how Royal Blood rendered before
    // this branch existed.
    let away: string;
    if (days < 45) {
      away = `${days} Days`;
    } else if (days < 365) {
      away = `${Math.round(days / 30.44)} Months`;
    } else {
      const years = Math.round((days / 365.25) * 10) / 10;
      away = `${years} ${years === 1 ? "Year" : "Years"}`;
    }

    // Self-titled records collide with the artist name — "Bat Fangs — 4 Months
    // Before Bat Fangs" reads like a typo. Same problem album-trajectory solves,
    // same solution: name the relationship instead of repeating the word.
    const target =
      slugify(albumTitle) === slugify(concert.headliner)
        ? "The Album That Shares Their Name"
        : albumTitle;

    findings.push({
      id: `road-tested-${concert.headlinerNormalized}-${concert.date}`,
      detector: "road-tested",
      category: "cultural",
      temporality: "evergreen",
      headline: `${concert.headliner} — ${away} Before ${target}`,
      dataPoints: {
        artist: concert.headliner,
        venue: concert.venue,
        city: concert.cityState,
        date: concert.date,
        year: concert.year,
        albumTitle,
        albumReleaseDate: songsFromAlbum[0].releaseDate,
        daysBeforeRelease: days,
        // The corroboration: four songs off one unreleased record is evidence a
        // single-song finding does not have.
        songCountFromSameFutureAlbum: songsFromAlbum.length,
        songsHeardEarly: songsFromAlbum.map((e) => e.song),
        releaseDatePrecision: releaseDatePrecision(songsFromAlbum[0].releaseDate),
        setlistLength: songs.length,
      },
      concertDate: concert.date,
      artists: [concert.headlinerNormalized],
      venues: [concert.venueNormalized],
      years: [concert.year],
      suggestedImage: {
        type: "album",
        artistNormalized: concert.headlinerNormalized,
        albumName: albumTitle,
      },
      suggestedTrack: {
        artistNormalized: concert.headlinerNormalized,
        trackName: earliestHeard,
        // The headliner played it live AND recorded it — the two roles that
        // diverge for full-circle and guest-bridge coincide here.
        recordedByNormalized: concert.headlinerNormalized,
        albumName: albumTitle,
      },
      tags: ["#road-tested", "#before-the-record"],
    });
  }

  return findings.sort(
    (a, b) => (b.dataPoints.daysBeforeRelease as number) - (a.dataPoints.daysBeforeRelease as number)
  );
}

// ── 18c. Most-Witnessed Album Detector ───────────────────────────────────────

/**
 * The record you have heard the most of, live — across every show, not one night.
 *
 * The interesting part is that it is usually NOT the album you played most at
 * home. Attendance is a different sampling of a catalogue than listening is: it
 * favours whatever an act leaned on live across the years you happened to catch
 * them.
 *
 * Ranked by DISTINCT songs witnessed, not by performances. Hearing "Story of My
 * Life" at five shows is one song five times; hearing eleven different songs off
 * one record is knowing the record. Performances ride along so prose can say
 * both.
 *
 * Covers are excluded. A cover's album belongs to the original act, so counting
 * Social Distortion's "Ring of Fire" toward Johnny Cash's record would conflate
 * what you witnessed with who you witnessed.
 *
 * ── SUPPLY CAUTION (spec §5b, carried from v5.4 §5f) ─────────────────────────
 * This detector favours repeat artists by construction and will land on Social
 * Distortion, Depeche Mode or Howard Jones — already the most-covered artists in
 * the feed. The spec says ship it and expect rotation pressure. It is worth
 * being explicit that §5d, the per-artist cap that would relieve that pressure,
 * is NOT in this window: its prerequisite (album-trajectory published >= 2
 * posts) is unmet at zero.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §5b
 */

export function detectMostWitnessedAlbum(
  concerts: Concert[],
  setlists?: SetlistIndex,
  songAlbums?: SongAlbumsSlim,
  ctx: {
    artistsMetadata?: Record<string, { name?: string } | undefined>;
    discographyKeys?: ReadonlyArray<{ act: string; discographyKey: string }>;
    /** album mbid → track count, when the MusicBrainz cache is on disk. */
    albumTrackCounts?: Record<string, number>;
  } = {}
): AnalysisFinding[] {
  if (!songAlbums || !setlists) return [];

  interface Agg {
    albumTitle: string;
    artist: string;
    artistNormalized: string;
    mbid: string;
    songs: Set<string>;
    performances: number;
    dates: string[];
    /** date → songs from this album heard that night, for the anchor show. */
    perShow: Map<string, number>;
    venueByDate: Map<string, { venue: string; venueNormalized: string; year: number }>;
  }

  const byAlbum = new Map<string, Agg>();

  for (const concert of concerts) {
    const songs = songsFor(setlists, concert.date, concert.headlinerNormalized);
    if (!songs.length) continue;

    for (const song of songs) {
      const rec = lookupSongAlbum(songAlbums.songs, concert.headliner, song.name, {
        artistsMetadata: ctx.artistsMetadata,
        discographyKeys: ctx.discographyKeys,
      });
      if (!rec || rec.isCover) continue;

      // Keyed by mbid: two artists can title a record the same thing.
      const key = rec.mbid || `${concert.headlinerNormalized}::${rec.albumTitle}`;
      let agg = byAlbum.get(key);
      if (!agg) {
        agg = {
          albumTitle: rec.albumTitle,
          artist: concert.headliner,
          artistNormalized: concert.headlinerNormalized,
          mbid: rec.mbid,
          songs: new Set(),
          performances: 0,
          dates: [],
          perShow: new Map(),
          venueByDate: new Map(),
        };
        byAlbum.set(key, agg);
      }
      agg.songs.add(rec.songTitle);
      agg.performances++;
      if (!agg.perShow.has(concert.date)) {
        agg.dates.push(concert.date);
        agg.venueByDate.set(concert.date, {
          venue: concert.venue,
          venueNormalized: concert.venueNormalized,
          year: concert.year,
        });
      }
      agg.perShow.set(concert.date, (agg.perShow.get(concert.date) ?? 0) + 1);
    }
  }

  if (!byAlbum.size) return [];

  const top = [...byAlbum.values()].sort(
    (a, b) => b.songs.size - a.songs.size || b.performances - a.performances
  )[0];

  // One song off one record is not "the album you've heard most of".
  if (top.songs.size < 2) return [];

  // Anchor on the night that supplied the most of it — a concrete room and date
  // for prose to stand in, rather than an abstraction over the whole archive.
  const anchorDate = [...top.perShow.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)
  )[0][0];
  const anchor = top.venueByDate.get(anchorDate)!;
  const dates = [...top.dates].sort();
  // The cached track list describes ONE release; the resolver indexes the whole
  // release-group, so B-sides and expanded editions can push the witnessed count
  // ABOVE it — Garbage's debut counts 17 witnessed against a cached 12. A
  // fraction is only reported when it is self-consistent, because "17 of 12" in
  // a permalinked post is worse than saying nothing.
  const rawTrackCount = ctx.albumTrackCounts?.[top.mbid] ?? null;
  const trackCount =
    rawTrackCount !== null && rawTrackCount >= top.songs.size ? rawTrackCount : null;

  return [
    {
      id: `most-witnessed-album-${top.artistNormalized}-${slugify(top.albumTitle)}`,
      detector: "most-witnessed-album",
      category: "personal",
      temporality: "evergreen",
      headline: `${top.artist} — ${top.songs.size} Songs From ${
        slugify(top.albumTitle) === slugify(top.artist)
          ? "The Album That Shares Their Name"
          : top.albumTitle
      }, Live`,
      dataPoints: {
        albumTitle: top.albumTitle,
        albumMbid: top.mbid,
        artist: top.artist,
        distinctSongsWitnessed: top.songs.size,
        songsWitnessed: [...top.songs].sort(),
        totalPerformances: top.performances,
        showsSpanned: top.dates.length,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
        // Null when the cache is absent OR when it disagrees with what we
        // counted. Prose must NOT claim a fraction ("11 of 12") unless this is
        // a number.
        albumTrackCount: trackCount,
        venue: anchor.venue,
        city: null,
        date: anchorDate,
        year: anchor.year,
      },
      concertDate: anchorDate,
      artists: [top.artistNormalized],
      venues: [...new Set([...top.venueByDate.values()].map((v) => v.venueNormalized))],
      years: [...new Set([...top.venueByDate.values()].map((v) => v.year))].sort(),
      suggestedImage: {
        type: "album",
        artistNormalized: top.artistNormalized,
        albumName: top.albumTitle,
      },
      // Also artist-level, and also deliberate (#299). The subject is a record,
      // not a song, and `songs` is a Set with no per-song counts — so there is
      // no principled "the one to play", only an alphabetical accident. Add
      // counts to the aggregate first if this should ever play an album track.
      suggestedTrack: { artistNormalized: top.artistNormalized },
      tags: ["#most-witnessed", "#album-eras"],
    },
  ];
}

// ── 19. Discography Crossref Detector ────────────────────────────────────────

/**
 * An artist seen across two or more distinct album cycles (#68).
 *
 * The angle is the COMEDY OF TIMING, not the fact of longevity — otherwise this
 * is `artist-longevity` with extra steps. "Six shows, six records" is the
 * story; "forty years of Howard Jones" is already a post we've published.
 *
 * NOTE: this detector was unblocked by v3.5.0 and the deferral note in
 * LINER_NOTES_PIPELINE.md went stale for two minor versions. It is scoped to
 * ship DISABLED — see the dispatcher in analyze(), and spec §5f for why.
 */
export function detectDiscographyCrossref(
  concerts: Concert[],
  eras?: AlbumErasSlim
): AnalysisFinding[] {
  if (!eras) return [];
  const findings: AnalysisFinding[] = [];

  const nameOf = buildDisplayNames(concerts);
  const slugForKey = new Map<string, string>();
  for (const c of concerts) {
    const era = eras.concerts[c.id];
    if (era && !slugForKey.has(era.artistKey)) slugForKey.set(era.artistKey, c.headlinerNormalized);
  }

  for (const [artistKey, artist] of Object.entries(eras.artists)) {
    if (artist.erasSeen.length < 2) continue;

    const slug = slugForKey.get(artistKey);
    if (!slug) continue;

    const shows = concerts
      .filter((c) => c.headlinerNormalized === slug)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (shows.length < 2) continue;

    const display = nameOf(slug) || artist.displayName;
    const eraCount = artist.erasSeen.length;
    const headline =
      shows.length === eraCount
        ? `${display}: ${shows.length} Shows, ${eraCount} Records`
        : `${display} Across ${eraCount} Album Eras`;

    findings.push({
      id: `discography-crossref-${slug}`,
      detector: "discography-crossref",
      category: "cultural",
      temporality: "evergreen",
      headline,
      dataPoints: {
        artist: display,
        showCount: shows.length,
        eraCount,
        eras: artist.erasSeen.map((e) => ({
          album: e.title,
          showCount: e.showCount,
          dates: e.dates,
        })),
        firstShow: shows[0].date,
        lastShow: shows[shows.length - 1].date,
        spanYears: spanYears(shows[0].date, shows[shows.length - 1].date),
        // Never the same set twice — the comedy this detector is actually about.
        neverRepeated: shows.length === eraCount,
        studioAlbumCount: artist.studioAlbumCount,
      },
      artists: [slug],
      venues: [...new Set(shows.map((c) => c.venueNormalized))].slice(0, 3),
      years: [...new Set(shows.map((c) => c.year))],
      suggestedImage: { type: "artist", artistNormalized: slug },
      suggestedTrack: { artistNormalized: slug },
      tags: ["#discography-crossref", "#album-eras"],
    });
  }

  return findings.sort(
    (a, b) => (b.dataPoints.eraCount as number) - (a.dataPoints.eraCount as number)
  );
}

export function analyze(
  concerts: Concert[],
  today: Date = new Date(),
  options: AnalyzeOptions = {}
): AnalysisResult {
  const past = pastConcerts(concerts, today);

  const allFindings: AnalysisFinding[] = [
    ...detectArtistLongevity(past, options.setlists),
    ...detectOpenerToHeadliner(past, options.setlists),
    ...detectVenueLoyalty(past),
    ...detectCalendarAnniversary(past, today),
    ...detectGeographicChapter(past),
    ...detectConcertStreak(past),
    ...detectMilestoneMarker(past),
    ...detectRareSighting(past, options.setlists),
    ...detectHistoricalMoment(past),
    ...detectVenueGhost(past, options.venuesMetadata ?? {}, options.setlists),
    ...detectFestivalMegaBill(past),
    ...detectDroughtComeback(past, options.setlists),
    ...detectCityPulse(past),
    ...detectAlbumContext(past, options.aliases, options.eras),
    ...detectGenreOutlier(past, options.artistsMetadata ?? {}),
    ...detectFullCircle(past, options.setlists, options.aliases),
    ...detectGuestBridge(past, options.setlists, options.aliases),
    ...detectAlbumTrajectory(past, options.eras),
    ...detectRoadTested(past, options.setlists, options.songAlbums, {
      artistsMetadata: options.artistsMetadata,
      discographyKeys: options.discographyKeys,
    }),
    ...detectMostWitnessedAlbum(past, options.setlists, options.songAlbums, {
      artistsMetadata: options.artistsMetadata,
      discographyKeys: options.discographyKeys,
      albumTrackCounts: options.albumTrackCounts,
    }),
    // detectDiscographyCrossref is DELIBERATELY NOT REGISTERED here.
    //
    // It has 3.5x the supply of album-trajectory and is the simpler build, so
    // shipping it would be the safe engineering choice. But the feed's
    // constraint is distinctiveness, not volume: its supply concentrates on
    // Howard Jones, Tears For Fears, Brian Setzer and Social Distortion, who
    // already hold 13 of 55 published posts. Enabling it now deepens the same
    // well and fights rotation.
    //
    // Enablement is scheduled into v5.5 (#267 §5d) so ONE rotation judgement
    // gets made with the full detector pool visible, after >= 2 publication
    // cycles of album-trajectory. The function is exported and tested; flipping
    // it on is a one-line change here.
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

// ── 16. Full Circle Detector ─────────────────────────────────────────────────

/**
 * You watched someone play a song, and you also watched the artist whose song it
 * is play it themselves (#228).
 *
 * This is a join, not an aggregation — two records that have no business knowing
 * about each other, connected across decades. "Ring of Fire, 7 times" is a
 * spreadsheet; "you saw Nile Rodgers play Notorious in 2026, and you saw Duran
 * Duran play it in 1987, and he produced the record" is a story.
 *
 * Alias-aware in two directions (#227):
 *
 *   - the original artist is matched on canonical identity, so a cover credited
 *     to one billing still finds a performance under another;
 *   - a performer covering their own act is not a finding. Without this,
 *     "you've heard Rock This Town from four different artists" is about one man.
 *
 * Same-act billings are also collapsed when deduplicating, so Brian Setzer
 * playing a Stray Cats song does not publish three times — once for each of his
 * marquees — which is what the raw data does.
 *
 * Absorbs #230: two acts playing the same song on the *same bill* is not a
 * separate detector with one instance in it, it is the most extreme full circle
 * there is. Living Colour covered "Welcome to the Terrordome" on a night Public
 * Enemy played it themselves.
 */
function detectFullCircle(
  concerts: Concert[],
  setlists?: SetlistIndex,
  aliases: AliasMap = EMPTY_ALIAS_MAP
): AnalysisFinding[] {
  if (!setlists) return [];

  interface Performance {
    song: string;
    by: string;
    concert: Concert;
    /** Canonical slug of whoever's song it is, when it's a cover. */
    original?: string;
  }

  const nameOf = buildDisplayNames(concerts);

  const performances: Performance[] = [];
  for (const concert of concerts) {
    const onBill = [concert.headlinerNormalized, ...concert.openers.map(slugify)];
    for (const artist of onBill) {
      for (const song of songsFor(setlists, concert.date, artist)) {
        performances.push({
          song: song.name,
          by: artist,
          concert,
          original: song.cover ? canonicalOf(aliases, slugify(song.cover.name)) : undefined,
        });
      }
    }
  }

  // Songs performed by the act that owns them, keyed for lookup by the covers.
  const owned = new Map<string, Performance[]>();
  for (const p of performances) {
    if (p.original) continue;
    const key = `${p.song.toLowerCase()}::${canonicalOf(aliases, p.by)}`;
    if (!owned.has(key)) owned.set(key, []);
    owned.get(key)!.push(p);
  }

  const findings: AnalysisFinding[] = [];
  const seen = new Set<string>();

  for (const cover of performances) {
    if (!cover.original) continue;

    const coverAct = canonicalOf(aliases, cover.by);
    // Playing your own act's song is not a full circle.
    if (coverAct === cover.original) continue;

    const originals = owned.get(`${cover.song.toLowerCase()}::${cover.original}`);
    if (!originals?.length) continue;

    // The *first* time the original act played it, not the nearest. "I'd seen
    // Duran Duran play Notorious back in 1987" is the anchor the story wants;
    // picking the closest performance would quietly shrink a 39-year span to 18.
    const original = [...originals].sort((a, b) =>
      a.concert.date.localeCompare(b.concert.date)
    )[0];

    // One story per song per pair of acts, regardless of how many billings or
    // nights it turns up under.
    const key = `${cover.song.toLowerCase()}::${coverAct}::${cover.original}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const gap = spanYears(original.concert.date, cover.concert.date);
    const sameNight = original.concert.date === cover.concert.date;
    // Two acts who share a person is a weaker surprise than two unrelated ones —
    // still a story (Danny Elfman playing Oingo Boingo songs 35 years on), but it
    // shouldn't outrank a genuine stranger-to-stranger join.
    const member = sharedMemberOf(aliases, coverAct, cover.original);

    const coverName = nameOf(cover.by);
    const originalName = nameOf(original.by);

    const tags = ["#full-circle", "#cover"];
    if (sameNight) tags.push("#same-night");
    if (member) tags.push("#shares-member");

    findings.push({
      id: `full-circle-${slugify(cover.song)}-${coverAct}-${cover.original}`,
      detector: "full-circle",
      category: "cultural",
      temporality: "evergreen",
      headline: sameNight
        ? `"${cover.song}": Twice in One Night`
        : `"${cover.song}": ${coverName} and ${originalName}, ${gap} Years Apart`,
      dataPoints: {
        song: cover.song,
        coverArtist: coverName,
        coverDate: cover.concert.date,
        coverVenue: cover.concert.venue,
        originalArtist: originalName,
        originalDate: original.concert.date,
        originalVenue: original.concert.venue,
        gapYears: gap,
        sameNight,
        ...(member ? { sharedMember: member } : {}),
      },
      // The night the circle closed.
      concertDate: cover.concert.date,
      artists: [...new Set([cover.by, original.by])],
      venues: [...new Set([cover.concert.venueNormalized, original.concert.venueNormalized])],
      years: [...new Set([original.concert.year, cover.concert.year])],
      suggestedImage: { type: "artist", artistNormalized: cover.by },
      // The post IS the song, so the footer should play it (#299). The cover
      // act is only the fallback: they played it, the original act recorded it,
      // and it is the recording we want to hear.
      suggestedTrack: {
        artistNormalized: cover.by,
        trackName: cover.song,
        recordedByNormalized: cover.original,
      },
      tags,
    });
  }

  return findings;
}

// ── 17. Guest Bridge Detector ────────────────────────────────────────────────

/**
 * Someone walked on stage during another act's set — and you also saw them
 * perform in their own right (#228).
 *
 * The "in their own right" half is the entire detector. Gorillaz alone account
 * for 10 of the 27 guest walk-ons in the corpus; they are a guest-heavy act by
 * design, and without the join this becomes The Gorillaz Show. With it, the
 * Gorillaz guests who are strangers to the archive drop out on their own and no
 * special-casing is needed.
 *
 * Alias-aware (#227), and that is not a nicety: three of the eight bridges exist
 * only because the map links a guest to an act billed under another name — Terri
 * Nunn to Berlin, Gwen Stefani to No Doubt, Brian Baker to Bad Religion. Without
 * it the detector has five findings instead of eight.
 */
function detectGuestBridge(
  concerts: Concert[],
  setlists?: SetlistIndex,
  aliases: AliasMap = EMPTY_ALIAS_MAP
): AnalysisFinding[] {
  if (!setlists) return [];

  // Everyone who performed under their own billing, and when.
  const ownShows = new Map<string, Concert[]>();
  for (const concert of concerts) {
    for (const slug of [concert.headlinerNormalized, ...concert.openers.map(slugify)]) {
      const act = canonicalOf(aliases, slug);
      if (!ownShows.has(act)) ownShows.set(act, []);
      ownShows.get(act)!.push(concert);
    }
  }

  const byDate = new Map(concerts.map((c) => [c.date, c]));
  const nameOf = buildDisplayNames(concerts);
  const findings: AnalysisFinding[] = [];
  const seen = new Set<string>();

  for (const appearance of guestAppearances(setlists)) {
    const guestAct = canonicalOf(aliases, appearance.guest);
    const hostAct = canonicalOf(aliases, appearance.host);

    // Walking on with your own act is not a bridge.
    if (guestAct === hostAct) continue;

    // The act they front, when the guest is a person billed under a band name.
    const candidates = [guestAct, ...relatedActs(aliases, appearance.guest)];
    const ownAct = candidates.find((act) => ownShows.has(act) && act !== hostAct);
    if (!ownAct) continue;

    const guestNight = byDate.get(appearance.date);
    if (!guestNight) continue;

    // Their own shows, and how far the nearest sits from the walk-on.
    const own = [...ownShows.get(ownAct)!].sort((a, b) => a.date.localeCompare(b.date));
    const nearest = own.reduce((best, show) =>
      Math.abs(Date.parse(show.date) - Date.parse(appearance.date)) <
      Math.abs(Date.parse(best.date) - Date.parse(appearance.date))
        ? show
        : best
    );

    const key = `${guestAct}::${hostAct}::${appearance.song.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const viaAlias = ownAct !== guestAct;
    const hostName = nameOf(appearance.host);
    const ownName = displayNameOf(aliases, ownAct) ?? nameOf(ownAct);
    const gap = spanYears(nearest.date, appearance.date);

    const tags = ["#guest-bridge", "#walk-on"];
    if (viaAlias) tags.push("#shares-member");

    findings.push({
      id: `guest-bridge-${guestAct}-${hostAct}-${slugify(appearance.song)}`,
      detector: "guest-bridge",
      category: "cultural",
      temporality: "evergreen",
      headline: `${appearance.guestName} Walked On for ${hostName}`,
      dataPoints: {
        guest: appearance.guestName,
        host: hostName,
        song: appearance.song,
        guestDate: appearance.date,
        guestVenue: guestNight.venue,
        ownAct: ownName,
        ownShowCount: own.length,
        nearestOwnShow: { date: nearest.date, venue: nearest.venue },
        gapYears: gap,
        // Present when the guest is in the archive under a different marquee —
        // Terri Nunn seen as Berlin, Gwen Stefani as No Doubt.
        ...(viaAlias ? { seenAs: ownName } : {}),
      },
      // The night they walked on.
      concertDate: appearance.date,
      // The host leads. artists[0] is what the setlist link pairs with the date,
      // and the guest walked on without being billed — a link naming them would
      // point at a night they don't appear on. The image and audio still come
      // from the guest's own act via suggestedImage/suggestedTrack.
      artists: [...new Set([guestNight.headlinerNormalized, appearance.guest])],
      venues: [...new Set([guestNight.venueNormalized, nearest.venueNormalized])],
      years: [...new Set([guestNight.year, nearest.year])],
      suggestedImage: { type: "artist", artistNormalized: ownAct },
      // The song they walked on for — the host's record, not the guest's own
      // act, which stays the fallback exactly as the comment above describes.
      suggestedTrack: {
        artistNormalized: ownAct,
        trackName: appearance.song,
        recordedByNormalized: hostAct,
      },
      tags,
    });
  }

  return findings;
}
