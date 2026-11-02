/**
 * The facts a narration is written from, and hashed on. Pure, so a test can hold them to
 * concerts.json without a model.
 *
 * 🔴 EVERY SHOW, NOT A SUMMARY OF THE HEADLINING ONES. These inputs used to group on
 * `headlinerNormalized` alone, so an act's opening slots did not exist: The English Beat read
 * as 5 shows rather than 10, and "I didn't see them again until" was wrong for anyone who
 * opened in between. A summary also invited invention, because a model given a first year and
 * a last year has to guess the middle. The 2026-11 audit found 70 false fields, most of them
 * from this. The show list is the fix: there is nothing left to guess.
 *
 * PAST AND UPCOMING ARE SEPARATE, AND `today` IS PART OF THE HASH. A show that passes changes
 * the input, so its narration regenerates by itself rather than saying "coming up" forever.
 */

import { normalizeArtistName } from "../../src/utils/normalize.js";

export interface NarrationConcert {
  date: string;
  year: number;
  headliner: string;
  headlinerNormalized: string;
  openers?: string[];
  venue: string;
  venueNormalized: string;
  city: string;
}

export interface NarrationVenueMeta {
  name: string;
  cityState: string;
  status?: string;
  closedDate?: string;
  notes?: string;
}

export interface NarrationAliases {
  sameAct?: Array<{ billings?: string[] }>;
}

export type EntityInput = Record<string, unknown>;

export interface Entity {
  slug: string;
  input: EntityInput;
}

function topN(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

const byDate = (a: NarrationConcert, b: NarrationConcert) => a.date.localeCompare(b.date);
const isPast = (c: NarrationConcert, today: string) => c.date < today;

/** Every billing of one act, or just this one. The same merge the site's artist cards make. */
function billingsOf(slug: string, aliases: NarrationAliases | null): string[] {
  const entry = aliases?.sameAct?.find((a) => a.billings?.includes(slug));
  return entry?.billings ?? [slug];
}

/** How the act appeared that night, or null when it wasn't on the bill. */
function roleOn(c: NarrationConcert, billings: string[]): "headliner" | "opener" | null {
  if (billings.includes(c.headlinerNormalized)) return "headliner";
  const opened = (c.openers ?? []).some((o) => billings.includes(normalizeArtistName(o)));
  return opened ? "opener" : null;
}

export function buildArtistInputs(
  concerts: NarrationConcert[],
  aliases: NarrationAliases | null,
  today: string,
): Entity[] {
  const names = new Map<string, string>();
  for (const c of concerts) {
    if (!names.has(c.headlinerNormalized)) names.set(c.headlinerNormalized, c.headliner);
  }

  return [...names.entries()].map(([slug, name]) => {
    const billings = billingsOf(slug, aliases);
    const appearances = concerts
      .flatMap((c) => {
        const role = roleOn(c, billings);
        return role ? [{ c, role }] : [];
      })
      .sort((a, b) => byDate(a.c, b.c));
    const past = appearances.filter(({ c }) => isPast(c, today));

    const venueCounts = new Map<string, number>();
    const yearCounts = new Map<string, number>();
    for (const { c } of past) {
      venueCounts.set(c.venue, (venueCounts.get(c.venue) ?? 0) + 1);
      yearCounts.set(String(c.year), (yearCounts.get(String(c.year)) ?? 0) + 1);
    }
    const topVenue = topN(venueCounts, 1)[0] ?? null;
    const row = ({ c, role }: (typeof appearances)[number]) => ({
      date: c.date,
      venue: c.venue,
      city: c.city,
      role,
      headliner: c.headliner,
    });

    return {
      slug,
      input: {
        name,
        count: past.length,
        headlined: past.filter((a) => a.role === "headliner").length,
        opened: past.filter((a) => a.role === "opener").length,
        firstYear: past[0]?.c.year ?? null,
        lastYear: past[past.length - 1]?.c.year ?? null,
        topVenue,
        topVenueCount: topVenue ? venueCounts.get(topVenue) : 0,
        shows: past.map(row),
        upcoming: appearances.filter(({ c }) => !isPast(c, today)).map(row),
      },
    };
  });
}

export function buildVenueInputs(
  venues: Record<string, NarrationVenueMeta>,
  concerts: NarrationConcert[],
  today: string,
): Entity[] {
  return Object.entries(venues).map(([slug, v]) => {
    const here = concerts.filter((c) => c.venueNormalized === slug).sort(byDate);
    const past = here.filter((c) => isPast(c, today));
    const headliners = new Map<string, number>();
    for (const c of past) headliners.set(c.headliner, (headliners.get(c.headliner) ?? 0) + 1);
    const acts = new Set(past.flatMap((c) => [c.headliner, ...(c.openers ?? [])]));
    const row = (c: NarrationConcert) => ({ date: c.date, headliner: c.headliner, openers: c.openers ?? [] });

    return {
      slug,
      input: {
        name: v.name,
        cityState: v.cityState,
        status: v.status ?? null,
        closedDate: v.closedDate ?? null,
        notes: v.notes ?? null,
        totalConcerts: past.length,
        uniqueHeadliners: headliners.size,
        uniqueArtists: acts.size,
        topHeadliners: topN(headliners, 3),
        shows: past.map(row),
        upcoming: here.filter((c) => !isPast(c, today)).map(row),
      },
    };
  });
}
