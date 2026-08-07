/**
 * get_career_position + album-era enrichment (v5.4, #271).
 *
 * The invariants that matter here are about what the tools DON'T say:
 * nothing when era data is absent, and nothing about the present when there is
 * no future left. See docs/specs/future/global-discography-trajectory.md §Part 4.
 */

import { describe, it, expect } from "vitest";
import { careerPosition, concertSetlist, artistHistory, searchConcerts } from "./tools.js";
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
