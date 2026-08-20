/**
 * get_career_position + album-era enrichment (v5.4, #271).
 *
 * The invariants that matter here are about what the tools DON'T say:
 * nothing when era data is absent, and nothing about the present when there is
 * no future left. See docs/specs/future/global-discography-trajectory.md §Part 4.
 */

import { describe, it, expect } from "vitest";
import { careerPosition, careerShape, concertSetlist, artistHistory, searchConcerts, projectEras } from "./tools.js";
import type { AlbumEras, Concert } from "./types.js";

// ---------- fixtures ----------

let seq = 0;
function mk(date: string, headliner: string, venue: string): Concert {
  const [y, m, d] = date.split("-").map(Number);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    id: `concert-${++seq}`,
    date,
    headliner,
    headlinerNormalized: slug(headliner),
    genre: "New Wave",
    genreNormalized: "new-wave",
    openers: [],
    venue,
    venueNormalized: slug(venue),
    city: "Pasadena",
    state: "California",
    cityState: "Pasadena, California",
    year: y,
    month: m,
    day: d,
    dayOfWeek: "",
    decade: `${Math.floor(y / 10) * 10}s`,
    location: { lat: 0, lng: 0 },
  };
}

const roseBowl = mk("1988-06-18", "Depeche Mode", "The Rose Bowl");
const recent = mk("2023-03-28", "Depeche Mode", "Kia Forum");
const concerts = [roseBowl, recent];

const album = (title: string, releaseDate: string) => ({
  mbid: `mbid-${title.toLowerCase().replace(/\W+/g, "-")}`,
  title,
  releaseDate,
  coverAvailable: true,
});

const eras: AlbumEras = {
  version: "1.0.0",
  generatedAt: "2026-08-07T00:00:00.000Z",
  concerts: {
    [roseBowl.id]: {
      concertId: roseBowl.id,
      artistKey: "depeche-mode",
      date: "1988-06-18",
      currentAlbum: album("Music for the Masses", "1987-09-28"),
      daysSinceRelease: 264,
      cycleBucket: "current",
      albumsBefore: 2,
      albumsAfter: 2,
      careerYear: 6.7,
      yearsBeforeDebut: null,
      careerPercentile: 0.162,
      isDebutEra: false,
      definingAlbum: {
        ...album("Violator", "1990-02-05"),
        topTrackCount: 3,
        topTrackTotal: 5,
        matchTier: "exact",
      },
      definingAlbumAhead: true,
      definingAlbumMonthsAway: 20,
    },
    [recent.id]: {
      concertId: recent.id,
      artistKey: "depeche-mode",
      date: "2023-03-28",
      currentAlbum: album("Memento Mori", "2023-03-24"),
      daysSinceRelease: 4,
      cycleBucket: "fresh",
      albumsBefore: 4,
      // Nothing after — the trajectory paragraph must stay silent.
      albumsAfter: 0,
      careerYear: 41.5,
      yearsBeforeDebut: null,
      careerPercentile: 1,
      isDebutEra: false,
      definingAlbum: null,
      definingAlbumAhead: false,
      definingAlbumMonthsAway: null,
    },
  },
  artists: {
    "depeche-mode": {
      artistKey: "depeche-mode",
      displayName: "Depeche Mode",
      studioAlbumCount: 4,
      studioAlbums: [
        album("Speak & Spell", "1981-10-05"),
        album("Music for the Masses", "1987-09-28"),
        album("Violator", "1990-02-05"),
        album("Memento Mori", "2023-03-24"),
      ],
      debutAlbum: album("Speak & Spell", "1981-10-05"),
      latestAlbum: album("Memento Mori", "2023-03-24"),
      definingAlbum: {
        ...album("Violator", "1990-02-05"),
        topTrackCount: 3,
        topTrackTotal: 5,
        matchTier: "exact",
      },
      truncated: false,
      erasSeen: [
        { albumSlug: "music-for-the-masses", title: "Music for the Masses", showCount: 1, dates: ["1988-06-18"] },
        { albumSlug: "memento-mori", title: "Memento Mori", showCount: 1, dates: ["2023-03-28"] },
      ],
    },
  },
  stats: {},
};

// ---------- get_career_position ----------

describe("careerPosition", () => {
  it("answers the Rose Bowl with what hadn't happened yet", () => {
    const out = careerPosition(concerts, eras, { artist: "Depeche Mode", date: "1988-06-18" });
    expect(out).toContain("Music for the Masses");
    expect(out).toContain("Violator was still 20 months away");
    expect(out).toContain("3 of their 5 best-known songs");
    expect(out).toContain("2 more studio albums would follow");
  });

  it("defaults to the most recent show when no date is given", () => {
    const out = careerPosition(concerts, eras, { artist: "Depeche Mode" });
    expect(out).toContain("Memento Mori");
    expect(out).not.toContain("Music for the Masses");
  });

  it("resolves by concert id", () => {
    const out = careerPosition(concerts, eras, { concertId: roseBowl.id });
    expect(out).toContain("Music for the Masses");
  });

  it("stays silent about the present when nothing came after", () => {
    // The perishability rule: "and nothing came after" is true until it isn't,
    // and this text outlives the conversation it was generated in.
    const out = careerPosition(concerts, eras, { artist: "Depeche Mode", date: "2023-03-28" });
    expect(out).not.toMatch(/nothing came after|never made another|their last album/i);
    expect(out).not.toContain("would follow");
  });

  it("suppresses debut-album phrasing when the release list was truncated", () => {
    const truncated: AlbumEras = {
      ...eras,
      artists: { "depeche-mode": { ...eras.artists["depeche-mode"], truncated: true } },
    };
    const out = careerPosition(concerts, truncated, { artist: "Depeche Mode", date: "1988-06-18" });
    expect(out).not.toContain("Speak & Spell");
  });

  it("reports missing era data instead of crashing", () => {
    expect(careerPosition(concerts, null, { artist: "Depeche Mode" })).toMatch(/don't have album-cycle data/i);
    const empty: AlbumEras = { ...eras, concerts: {}, artists: {} };
    expect(careerPosition(concerts, empty, { artist: "Depeche Mode" })).toMatch(/don't have album-cycle data/i);
  });

  it("uses the existing resolution failure message for an unknown artist", () => {
    expect(careerPosition(concerts, eras, { artist: "Nobody At All" })).toContain("isn't in the archive");
  });

  it("asks which artist when given nothing", () => {
    expect(careerPosition(concerts, eras, {})).toMatch(/which artist/i);
  });
});

// ---------- inline enrichment: must be inert without era data ----------

describe("inline enrichment degrades to pre-v5.4 output", () => {
  const setlists = null;

  it("get_concert_setlist is byte-identical without era data", () => {
    const before = concertSetlist(concerts, setlists, { concertId: roseBowl.id }, {});
    const withNull = concertSetlist(concerts, setlists, { concertId: roseBowl.id }, {}, null);
    expect(withNull).toBe(before);
  });

  it("get_artist_history is byte-identical without era data", () => {
    const before = artistHistory(concerts, "Depeche Mode", {}, {});
    const withNull = artistHistory(concerts, "Depeche Mode", {}, {}, null, undefined, null);
    expect(withNull).toBe(before);
  });

  it("get_artist_history names the album cycles when there are 2+", () => {
    const out = artistHistory(concerts, "Depeche Mode", {}, {}, null, undefined, eras);
    expect(out).toContain("Seen across 2 album cycles");
    expect(out).toContain("Music for the Masses");
  });

  it("get_artist_history says nothing about cycles when there is only one", () => {
    const single: AlbumEras = {
      ...eras,
      artists: {
        "depeche-mode": {
          ...eras.artists["depeche-mode"],
          erasSeen: [eras.artists["depeche-mode"].erasSeen[0]],
        },
      },
    };
    expect(artistHistory(concerts, "Depeche Mode", {}, {}, null, undefined, single)).not.toContain(
      "album cycles",
    );
  });
});

// ---------- search_concerts cycleBucket ----------

describe("searchConcerts cycleBucket", () => {
  it("filters to a bucket and reports what it could not consider", () => {
    const noEra = mk("1990-01-01", "Some Band", "A Club");
    const { text, matches } = searchConcerts([...concerts, noEra], { cycleBucket: "fresh" }, eras);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(recent.id);
    expect(text).toContain("brand-new record");
    // Never a silent drop.
    expect(text).toMatch(/1 show has no album-cycle data and wasn't considered/);
  });

  it("composes with other filters rather than replacing them", () => {
    const { matches } = searchConcerts(concerts, { cycleBucket: "current", year: 1988 }, eras);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(roseBowl.id);

    expect(searchConcerts(concerts, { cycleBucket: "current", year: 2023 }, eras).matches).toHaveLength(0);
  });

  it("ignores the filter rather than erroring when era data is absent", () => {
    const withFilter = searchConcerts(concerts, { cycleBucket: "fresh" }, null);
    const without = searchConcerts(concerts, {}, null);
    expect(withFilter.matches).toEqual(without.matches);
  });
});

// ---------- get_career_shape ----------

// The archive-scale read of the same join. The invariants worth pinning are the ones a
// future data refresh could silently break: it derives from the rows (not the file's
// loosely-typed `stats` block), it counts every ahead-night while quoting only the
// well-evidenced ones, and it stays silent rather than guessing when era data is absent.
describe("careerShape", () => {
  it("says nothing at all when there is no era data", () => {
    expect(careerShape(concerts, null)).toBe("I don't have album-cycle data on hand right now.");
  });

  it("places the shows it can and names the archive total", () => {
    const out = careerShape(concerts, eras);
    expect(out).toContain("2 of my 2 nights");
    expect(out).toContain("1 inside an album's first three months"); // Memento Mori, 4 days
    expect(out).toContain("1 within its first year"); // Rose Bowl, 264 days
  });

  it("surfaces the night the defining album hadn't been made yet", () => {
    const out = careerShape(concerts, eras);
    expect(out).toContain("1 night I watched a band before the record");
    expect(out).toContain("Depeche Mode");
    expect(out).toContain("20 months before Violator");
  });

  it("counts multi-era artists and links the deepest", () => {
    const out = careerShape(concerts, eras);
    expect(out).toContain("1 artist I've caught in more than one era");
    expect(out).toContain("across 2 different records");
  });

  it("derives from the rows, not the stats block", () => {
    // A stats block that disagrees with the rows must not change the answer.
    const lying: AlbumEras = { ...eras, stats: { cycleBuckets: { fresh: 999 }, medianDaysSinceRelease: 9999 } };
    expect(careerShape(concerts, lying)).toBe(careerShape(concerts, eras));
  });

  it("prefers a well-evidenced defining album over a longer but weaker gap", () => {
    // Same shape as the real archive's worst case: the longest gap rests on the weakest
    // evidence (2 of 5 top tracks). It must still be COUNTED, just not quoted.
    const weak = mk("1988-09-19", "Ziggy Marley", "The Palace");
    const withWeak: AlbumEras = {
      ...eras,
      concerts: {
        ...eras.concerts,
        [weak.id]: {
          concertId: weak.id,
          artistKey: "ziggy-marley",
          date: "1988-09-19",
          currentAlbum: album("Conscious Party", "1988-01-01"),
          daysSinceRelease: 262,
          cycleBucket: "current",
          albumsBefore: 1,
          albumsAfter: 6,
          careerYear: 3,
          yearsBeforeDebut: null,
          careerPercentile: 0.1,
          isDebutEra: false,
          definingAlbum: {
            ...album("Love Is My Religion", "2006-01-01"),
            topTrackCount: 2,
            topTrackTotal: 5,
            matchTier: "exact",
          },
          definingAlbumAhead: true,
          definingAlbumMonthsAway: 209,
        },
      },
    };
    const out = careerShape([...concerts, weak], withWeak);
    expect(out).toContain("2 nights I watched a band"); // counted
    expect(out).not.toContain("Love Is My Religion"); // not quoted
    expect(out).toContain("20 months before Violator"); // the stronger claim is
  });

  it("falls back to quoting the weak ones rather than saying nothing", () => {
    const onlyWeak: AlbumEras = {
      ...eras,
      concerts: {
        [roseBowl.id]: {
          ...eras.concerts[roseBowl.id],
          definingAlbum: { ...album("Violator", "1990-02-05"), topTrackCount: 1, topTrackTotal: 5, matchTier: "exact" },
        },
      },
    };
    expect(careerShape(concerts, onlyWeak)).toContain("20 months before Violator");
  });
});

// ---------- query era context ----------

// `query` shipped concerts.json and nothing else, so the freeform tool was blind to the
// album-cycle join. These pin the projection's contract: the tuple order the prompt
// documents, the absent-data behaviour, and the size budget the decision rested on.
// See docs/specs/future/global-query-era-context.md.
describe("projectEras", () => {
  it("returns null when there is no era data, so the block is omitted rather than sent empty", () => {
    // An empty map would read to the model as "no album data exists for these shows" —
    // a different and false claim from "I wasn't given any."
    expect(projectEras(null)).toBeNull();
  });

  it("projects each concert to the tuple order the prompt documents", () => {
    const p = projectEras(eras)!;
    expect(p[roseBowl.id]).toEqual([
      "depeche-mode",
      "current",
      "Music for the Masses",
      264,
      "Violator",
      1, // definingAlbumAhead
      20,
    ]);
  });

  it("carries nulls through rather than inventing values", () => {
    const p = projectEras(eras)!;
    // The 2023 show has no defining album on record.
    expect(p[recent.id]).toEqual(["depeche-mode", "fresh", "Memento Mori", 4, null, 0, null]);
  });

  it("keys on concert id so the model can join back to concerts.json", () => {
    const p = projectEras(eras)!;
    expect(Object.keys(p).sort()).toEqual(concerts.map((c) => c.id).sort());
  });

  it("drops the fields that would blow the context budget", () => {
    // mbids, cover URLs, match tiers, percentiles and the entire `artists` block are the
    // difference between ~4K tokens and ~154K. If one creeps back in, this fails.
    const json = JSON.stringify(projectEras(eras));
    for (const leak of ["mbid", "coverAvailable", "matchTier", "careerPercentile", "studioAlbums"]) {
      expect(json, leak).not.toContain(leak);
    }
  });

  it("stays inside its size budget per concert", () => {
    // The whole decision rested on ~4.1K tokens for 178 concerts — about 23 tokens each,
    // measured as chars/3.6. Generous ceiling; a schema change that doubles it should
    // re-open the spec's cost question rather than land silently.
    const perConcert = JSON.stringify(projectEras(eras)!).length / 3.6 / concerts.length;
    expect(perConcert).toBeLessThan(45);
  });
});
