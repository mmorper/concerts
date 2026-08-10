/**
 * The archive's headline numbers — one derivation, one set of definitions (#295).
 *
 * These counts appear on three scene footers, the OG card, the meta tags,
 * `llm.txt`, the README and the MCP. Before this they were derived independently
 * at each site, which is a subtler hazard than staleness: two surfaces can
 * disagree while each is internally correct, because they are quietly answering
 * different questions. Nothing fires, because nothing is wrong.
 *
 * That was not hypothetical. `concerts.json`'s own `metadata.uniqueArtists`
 * says **107** while every visible surface says **257** — the block counts
 * distinct headliners, the surfaces count everyone who played. Both are
 * defensible; only one is the number this archive means by "artists". Reading
 * that block as a source of truth, which is the obvious-looking fix, would have
 * silently rewritten the site's most quoted figure.
 *
 * So the definitions are written down here, next to the code that applies them.
 *
 * ── The definitions ────────────────────────────────────────────────────────
 *
 * **artists** — headliners ∪ openers, counted as BILLINGS. Someone you watched
 * play is an artist you saw, whether or not they were the reason you bought the
 * ticket. Openers are roughly 60% of the roster, so this is not a rounding
 * decision.
 *
 * ⚠️ **There is a second live definition, and this function does not implement
 * it.** The Artists scene counts ACTS: `useArtistData` collapses aliases, so
 * Brian Setzer is one card rather than the four billings the archive holds
 * (#227). That is **254** against the **257** the README, ROADMAP, `CLAUDE.md`,
 * the OG card and the meta tags all quote. Today the gap is exactly that one
 * artist.
 *
 * Both are correct answers to different questions, which is the whole subject
 * of #295 — and unifying them is a product decision, not a refactor. Choosing
 * 254 rewrites every published surface; choosing 257 makes the Artists scene
 * footer disagree with the mosaic beneath it. So the split is recorded here
 * rather than quietly resolved, and the scene keeps its own count on purpose.
 * A test pins both numbers so this stays a decision instead of a surprise.
 *
 * **venues** — distinct `venueNormalized`, not the display name. Identical
 * today (79 either way), and deliberately the normalized key so a re-spelling
 * upstream cannot split one room into two. Renames collapse; a venue that
 * changed name is one venue.
 *
 * **cities** — distinct `cityState`. Two rooms in one city are one city.
 *
 * **concerts** — every row in the archive, INCLUDING dated-but-unplayed shows.
 * Three are in the future as of this writing. This differs on purpose from the
 * liner-notes pipeline, which filters to past concerts only: a post cannot
 * describe a night that has not happened, but the archive is a diary that also
 * looks forward, and "184 shows" has always included them.
 *
 * **yearSpan** — first to last year present, `1984–2026`, an EN DASH. Not a
 * count of distinct years (39) and not a duration.
 *
 * ── Songs ──────────────────────────────────────────────────────────────────
 *
 * `countSetlistSongs` is separate because it reads a different file. It is
 * exported from here anyway so that the OG card's `2,697 songs` has a shared
 * definition the moment a second surface wants it — the issue's open question
 * was whether songs become first-class, and this makes that a one-line change
 * rather than a second implementation.
 */

/** Only the fields the counts read, so callers need not import the full Concert. */
export interface ArchiveConcert {
  year?: number;
  headliner?: string;
  openers?: string[];
  venueNormalized?: string;
  venue?: string;
  cityState?: string;
}

export interface ArchiveStats {
  concerts: number;
  /** Headliners ∪ openers. */
  artists: number;
  venues: number;
  cities: number;
  firstYear: number | null;
  lastYear: number | null;
  /** `"1984–2026"`, en dash. Empty when the archive has no dated concerts. */
  yearSpan: string;
}

export function deriveArchiveStats(concerts: readonly ArchiveConcert[]): ArchiveStats {
  const artists = new Set<string>();
  const venues = new Set<string>();
  const cities = new Set<string>();
  const years: number[] = [];

  for (const c of concerts) {
    if (c.headliner) artists.add(c.headliner);
    for (const opener of c.openers ?? []) if (opener) artists.add(opener);

    // Fall back to the display name only when the normalized key is absent, so
    // a record written before normalization still counts as a venue rather
    // than vanishing.
    const venue = c.venueNormalized || c.venue;
    if (venue) venues.add(venue);

    if (c.cityState) cities.add(c.cityState);
    if (typeof c.year === "number") years.push(c.year);
  }

  const firstYear = years.length ? Math.min(...years) : null;
  const lastYear = years.length ? Math.max(...years) : null;

  return {
    concerts: concerts.length,
    artists: artists.size,
    venues: venues.size,
    cities: cities.size,
    firstYear,
    lastYear,
    yearSpan: firstYear !== null && lastYear !== null ? `${firstYear}–${lastYear}` : "",
  };
}

/** The shape `setlists-cache.json` exposes, narrowed to what the count reads. */
export interface SetlistsCache {
  entries?: Record<string, { setlist?: { sets?: { set?: Array<{ song?: Array<{ name?: string; tape?: boolean }> }> } } }>;
}

/**
 * Songs actually watched being played.
 *
 * Tape is walk-on music rather than a performance, and is excluded here exactly
 * as it is everywhere else in the pipeline.
 */
export function countSetlistSongs(cache: SetlistsCache | null | undefined): number {
  let songs = 0;
  for (const entry of Object.values(cache?.entries ?? {})) {
    for (const set of entry?.setlist?.sets?.set ?? []) {
      for (const song of set?.song ?? []) {
        if (song?.name && !song.tape) songs++;
      }
    }
  }
  return songs;
}
