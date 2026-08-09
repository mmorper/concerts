import { buildAliasIndex } from "./aliases.js";
import { describe, it, expect } from "vitest";
import {
  archiveInfo,
  searchConcerts,
  resolveArtist,
  artistHistory,
  resolveVenue,
  venueHistory,
  onThisDay,
  surpriseMe,
  concertSetlist,
  archiveTopSongs,
} from "./tools.js";
import type {
  ArtistsMetadata,
  ArtistsTopTracks,
  Concert,
  MostPlayedSongs,
  SetlistsCache,
  SongAlbums,
  VenuesMetadata,
} from "./types.js";
import DEEP_LINKS from "../../../test/fixtures/deep-link-urls.json";

// ---------- fixtures ----------

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

let seq = 0;
function mk(
  date: string,
  headliner: string,
  venue: string,
  opts: Partial<Concert> = {},
): Concert {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `concert-${++seq}`,
    date,
    headliner,
    headlinerNormalized: slug(headliner),
    genre: opts.genre ?? "New Wave",
    genreNormalized: slug(opts.genre ?? "New Wave"),
    openers: opts.openers ?? [],
    venue,
    venueNormalized: slug(venue),
    city: opts.city ?? "Los Angeles",
    state: opts.state ?? "California",
    cityState: opts.cityState ?? `${opts.city ?? "Los Angeles"}, California`,
    year: y,
    month: m,
    day: d,
    dayOfWeek: "",
    decade: `${Math.floor(y / 10) * 10}s`,
    location: { lat: 0, lng: 0 },
    ...opts,
  };
}

// Coherent archive: Pacific Amphitheatre is the repeat room; Social Distortion the
// most-seen artist (5); Adam Ant a single appearance; Peter G./Peter Hook for ambiguity.
function archive(): Concert[] {
  seq = 0;
  return [
    mk("1984-04-27", "Adam Ant", "Irvine Meadows", { city: "Irvine", openers: ["Romeo Void"] }),
    mk("1985-06-15", "Depeche Mode", "Universal Amphitheatre", { city: "Universal City" }),
    mk("1988-06-04", "Depeche Mode", "Rose Bowl", { city: "Pasadena", openers: ["OMD"] }),
    mk("1990-08-10", "Depeche Mode", "Dodger Stadium"),
    mk("1990-06-04", "Social Distortion", "Pacific Amphitheatre", { city: "Costa Mesa", genre: "Punk" }),
    mk("1995-07-10", "Social Distortion", "Pacific Amphitheatre", { city: "Costa Mesa", genre: "Punk" }),
    mk("2000-08-15", "Social Distortion", "The Roxy", { genre: "Punk" }),
    mk("2010-09-20", "Social Distortion", "Pacific Amphitheatre", { city: "Costa Mesa", genre: "Punk" }),
    mk("2024-10-25", "Social Distortion", "Pacific Amphitheatre", { city: "Costa Mesa", genre: "Punk" }),
    mk("2002-05-05", "Peter Gabriel", "Hollywood Bowl"),
    mk("2018-03-03", "Peter Hook and the Light", "The Observatory", { city: "Santa Ana" }),
  ];
}

const ARTISTS_META: ArtistsMetadata = {
  "social-distortion": { name: "Social Distortion", genres: ["Punk"], formed: "1978" },
  "adam-ant": { name: "Adam Ant", genres: ["New Wave"], formed: "1977" },
};

const TOP_TRACKS: ArtistsTopTracks = {
  "social-distortion": {
    name: "Social Distortion",
    source: "itunes",
    fetchedAt: "",
    tracks: [{ name: "Story of My Life" }, { name: "Ball and Chain" }],
  },
};

const VENUES: VenuesMetadata = {
  "pacific-amphitheatre": {
    name: "Pacific Amphitheatre",
    normalizedName: "pacific-amphitheatre",
    city: "Costa Mesa",
    state: "California",
    cityState: "Costa Mesa, California",
    status: "active",
    stats: { totalConcerts: 4, firstEvent: "1990-06-04", lastEvent: "2024-10-25", uniqueArtists: 1 },
    concerts: [
      { id: "concert-5", date: "1990-06-04", headliner: "Social Distortion" },
      { id: "concert-6", date: "1995-07-10", headliner: "Social Distortion" },
      { id: "concert-8", date: "2010-09-20", headliner: "Social Distortion" },
      { id: "concert-9", date: "2024-10-25", headliner: "Social Distortion" },
    ],
  },
  "irvine-meadows": {
    name: "Irvine Meadows",
    normalizedName: "irvine-meadows",
    city: "Irvine",
    state: "California",
    cityState: "Irvine, California",
    status: "demolished",
    closedDate: "2016-10-30",
    notes: "Demolished for residential development",
    stats: { totalConcerts: 1, firstEvent: "1984-04-27", lastEvent: "1984-04-27", uniqueArtists: 1 },
    concerts: [{ id: "concert-1", date: "1984-04-27", headliner: "Adam Ant" }],
  },
};

// Setlist cache keyed to archive() ids. Exercises every coverage shape: headliner set
// (concert-5), headliner-vs-opener contention (concert-3), opener-only (concert-1),
// looked-up-but-empty (concert-6 null, concert-7 empty sets). concert-9 has NO entry.
const SETLISTS: SetlistsCache = {
  version: "1",
  generatedAt: "",
  entries: [
    {
      concertId: "concert-5",
      artistName: "Social Distortion",
      date: "1990-06-04",
      venue: "Pacific Amphitheatre",
      setlist: {
        tour: { name: "Stories of Life" },
        sets: { set: [{ song: [{ name: "Story of My Life" }, { name: "Ball and Chain" }, { name: "Mommy's Little Monster" }] }] },
      },
    },
    // concert-3 has both an opener set and the headliner set — headliner must win.
    {
      concertId: "concert-3",
      artistName: "OMD",
      date: "1988-06-04",
      venue: "Rose Bowl",
      setlist: { sets: { set: [{ song: [{ name: "Enola Gay" }] }] } },
    },
    {
      concertId: "concert-3",
      artistName: "Depeche Mode",
      date: "1988-06-04",
      venue: "Rose Bowl",
      setlist: { sets: { set: [{ song: [{ name: "Everything Counts" }, { name: "Never Let Me Down Again" }] }] } },
    },
    // concert-1: headliner lookup whiffed (null), but the opener's set is on record.
    { concertId: "concert-1", artistName: "Adam Ant", date: "1984-04-27", venue: "Irvine Meadows", setlist: null },
    {
      concertId: "concert-1",
      artistName: "Romeo Void",
      date: "1984-04-27",
      venue: "Irvine Meadows",
      setlist: { sets: { set: [{ song: [{ name: "Never Say Never" }] }] } },
    },
    { concertId: "concert-6", artistName: "Social Distortion", date: "1995-07-10", venue: "Pacific Amphitheatre", setlist: null },
    { concertId: "concert-7", artistName: "Social Distortion", date: "2000-08-15", venue: "The Roxy", setlist: { sets: { set: [] } } },
  ],
};

const BANNED = ["journey", "tapestry", "legendary", "it goes without saying", "a diverse range of"];
function assertVoice(text: string) {
  expect(text.length).toBeGreaterThan(0);
  for (const phrase of BANNED) expect(text.toLowerCase()).not.toContain(phrase);
}

// ---------- get_archive_info ----------

describe("get_archive_info", () => {
  it("narrates the collection's shape", () => {
    const text = archiveInfo(archive(), null);
    assertVoice(text);
    expect(text).toContain("Social Distortion (5)");
    expect(text).toContain("Pacific Amphitheatre (4)");
    expect(text).toMatchSnapshot();
  });
});

// ---------- search_concerts ----------

describe("search_concerts", () => {
  it("single result", () => {
    const { text } = searchConcerts(archive(), { artist: "Adam Ant" });
    expect(text).toContain("[concert-1]");
    expect(text).toMatchSnapshot();
  });

  it("caps results and says so honestly", () => {
    const { text } = searchConcerts(archive(), { artist: "Social Distortion", limit: 2 });
    expect(text).toContain("That's 2 of 5 — try narrowing the search.");
    expect(text).toMatchSnapshot();
  });

  it("zero results say something real", () => {
    const { text } = searchConcerts(archive(), { artist: "Nobody At All" });
    assertVoice(text);
    expect(text).toContain("Nobody At All");
    expect(text).toMatchSnapshot();
  });
});

// ---------- get_artist_history ----------

describe("get_artist_history", () => {
  it("single show", () => {
    const text = artistHistory(archive(), "Adam Ant", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("A single show.");
    expect(text).toContain("[concert-1]");
    expect(text).toMatchSnapshot();
  });

  it("5+ shows scales the closing arc", () => {
    const text = artistHistory(archive(), "Social Distortion", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("one of the artists I've seen most");
    expect(text).toContain("Known for Story of My Life and Ball and Chain.");
    expect(text).toMatchSnapshot();
  });

  it("not found", () => {
    const text = artistHistory(archive(), "Imaginary Band", ARTISTS_META, TOP_TRACKS);
    expect(text).toBe("Imaginary Band isn't in the archive.");
  });

  it("ambiguous partial match disambiguates instead of guessing", () => {
    const text = artistHistory(archive(), "Peter", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("Peter Gabriel");
    expect(text).toContain("Peter Hook and the Light");
    expect(text).toContain("Which one did you mean?");
  });

  it("narrows to the family match when one name contains the others", () => {
    const r = resolveArtist(archive(), "Peter Hook");
    expect(r).toEqual({ kind: "match", name: "Peter Hook and the Light", slug: "peter-hook-and-the-light", slugs: ["peter-hook-and-the-light"] });
  });
});

// ---------- openers count as artists (#219) ----------

// Romeo Void and The Psychedelic Furs only ever open; The Bangles do both, which is
// what pins the precedence rule; "Yaz!" spells the 1984 bill differently on purpose.
function openerArchive(): Concert[] {
  seq = 0;
  return [
    mk("1984-04-27", "Yaz!", "Irvine Meadows", { city: "Irvine", openers: ["Romeo Void", "The Bangles"] }),
    mk("1986-05-02", "The Bangles", "The Roxy"),
    mk("2008-07-24", "Yaz", "Pacific Amphitheatre", { city: "Costa Mesa", openers: ["The Psychedelic Furs"] }),
  ];
}

describe("openers count as artists (#219)", () => {
  it("resolves an artist who has only ever opened", () => {
    expect(resolveArtist(openerArchive(), "Romeo Void")).toEqual({
      kind: "match",
      name: "Romeo Void",
      slug: "romeo-void",
      slugs: ["romeo-void"],
    });
  });

  it("returns the opening slot as a show instead of denying the artist exists", () => {
    const text = artistHistory(openerArchive(), "The Psychedelic Furs", ARTISTS_META, TOP_TRACKS);
    expect(text).not.toContain("isn't in the archive");
    expect(text).toContain("[concert-3]");
    expect(text).toContain("Pacific Amphitheatre");
  });

  it("names who they opened for rather than listing the rest of the undercard", () => {
    const text = artistHistory(openerArchive(), "The Psychedelic Furs", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("Opening for [Yaz]");
    expect(text).toContain("never a headline show of their own");
  });

  it("derives an opener slug matching the site's artist URLs", () => {
    const text = artistHistory(openerArchive(), "The Psychedelic Furs", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("?scene=artists&artist=the-psychedelic-furs");
  });

  it("counts both roles for an artist who has headlined and opened", () => {
    const text = artistHistory(openerArchive(), "The Bangles", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("2 times");
    expect(text).toContain("1 headlining, 1 opening.");
  });

  it("keeps the headline spelling and slug when a band appears in both roles", () => {
    expect(resolveArtist(openerArchive(), "The Bangles")).toEqual({
      kind: "match",
      name: "The Bangles",
      slug: "the-bangles",
      slugs: ["the-bangles"],
    });
  });

  it("folds spellings differing only in punctuation into one history", () => {
    const text = artistHistory(openerArchive(), "Yaz", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("2 times");
    expect(text).toContain("Irvine Meadows");
    expect(text).toContain("Pacific Amphitheatre");
  });

  it("still treats a leading article as a distinct artist — that split is a data fix", () => {
    const split = [
      mk("2003-09-20", "The Cure", "Hyundai Pavilion", { openers: ["Psychedelic Furs"] }),
      mk("2008-07-24", "Yaz", "Pacific Amphitheatre", { openers: ["The Psychedelic Furs"] }),
    ];
    expect(resolveArtist(split, "Psychedelic Furs")).toMatchObject({ slug: "psychedelic-furs" });
    expect(resolveArtist(split, "The Psychedelic Furs")).toMatchObject({ slug: "the-psychedelic-furs" });
  });

  it("resolves a slug lifted out of an emitted link", () => {
    expect(resolveArtist(openerArchive(), "the-psychedelic-furs")).toEqual({
      kind: "match",
      name: "The Psychedelic Furs",
      slug: "the-psychedelic-furs",
      slugs: ["the-psychedelic-furs"],
    });
    expect(resolveArtist(archive(), "peter-hook-and-the-light")).toMatchObject({
      slug: "peter-hook-and-the-light",
    });
  });

  it("still prefers an exact display name over a slug", () => {
    expect(resolveArtist(openerArchive(), "The Bangles")).toEqual({
      kind: "match",
      name: "The Bangles",
      slug: "the-bangles",
      slugs: ["the-bangles"],
    });
  });

  it("leaves ambiguity intact — a slug lookup only converts a miss into a hit", () => {
    const text = artistHistory(archive(), "Peter", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("Which one did you mean?");
  });

  it("leaves headliner-only histories untouched", () => {
    const text = artistHistory(archive(), "Adam Ant", ARTISTS_META, TOP_TRACKS);
    expect(text).toContain("With Romeo Void opening.");
    expect(text).not.toContain("Opening for");
    expect(text).not.toContain("headlining,");
  });
});

// ---------- get_venue_history ----------

describe("get_venue_history", () => {
  it("single visit pulls closure context from notes", () => {
    const text = venueHistory(VENUES, archive(), "Irvine Meadows");
    expect(text).toContain("Demolished for residential development.");
    expect(text).toContain("A single visit");
    expect(text).toMatchSnapshot();
  });

  it("repeat venue", () => {
    const text = venueHistory(VENUES, archive(), "Pacific Amphitheatre");
    expect(text).toContain("Visited 4 times");
    expect(text).toMatchSnapshot();
  });

  it("not found", () => {
    const text = venueHistory(VENUES, archive(), "Madison Square Garden");
    expect(text).toBe("Madison Square Garden isn't in the archive.");
  });

  it("resolveVenue matches by partial name", () => {
    const r = resolveVenue(VENUES, "pacific");
    expect(r.kind).toBe("match");
  });
});

// ---------- on_this_day ----------

describe("on_this_day", () => {
  it("multiple shares of a date", () => {
    const { text } = onThisDay(archive(), 6, 4);
    expect(text).toContain("On June 4, across the years:");
    expect(text).toContain("1988: [Depeche Mode](");
    expect(text).toContain("1990: [Social Distortion](");
    expect(text).toMatchSnapshot();
  });

  it("quiet date", () => {
    expect(onThisDay(archive(), 1, 2).text).toBe("Nothing in the archive on January 2. A quiet date.");
  });
});

// ---------- surprise_me ----------

describe("surprise_me", () => {
  const pickIndex = (i: number) => () => i;

  it("only appearance of an artist", () => {
    const data = archive();
    const idx = data.findIndex((c) => c.headliner === "Adam Ant");
    const { text, angle } = surpriseMe(data, pickIndex(idx), null, ARTISTS_META, TOP_TRACKS);
    expect(angle).toBe("only-artist");
    expect(text).toContain("only time Adam Ant appears");
    expect(text).toMatchSnapshot();
  });

  it("first of many", () => {
    const data = archive();
    const idx = data.findIndex((c) => c.id === "concert-5"); // SD 1990, earliest
    const { angle, text } = surpriseMe(data, pickIndex(idx), null, ARTISTS_META, TOP_TRACKS);
    expect(angle).toBe("first-of-many");
    expect(text).toContain("first of 5 times");
  });

  it("last of many", () => {
    const data = archive();
    const idx = data.findIndex((c) => c.id === "concert-9"); // SD 2024, latest
    const { angle } = surpriseMe(data, pickIndex(idx), null, ARTISTS_META, TOP_TRACKS);
    expect(angle).toBe("last-of-many");
  });

  it("only show at a venue", () => {
    const data = archive();
    const idx = data.findIndex((c) => c.id === "concert-7"); // SD @ The Roxy (unique venue, middle show)
    const { angle, text } = surpriseMe(data, pickIndex(idx), null, ARTISTS_META, TOP_TRACKS);
    expect(angle).toBe("only-venue");
    expect(text).toContain("only show I've ever seen at The Roxy");
  });

  it("setlist angle and join when nothing rarer applies", () => {
    // Artist seen 3×, all at one repeat venue, distinct single-show years → middle show
    // (2nd) is neither first/last/only/extreme; a setlist makes it the lead.
    seq = 100;
    const data = [
      mk("2000-01-01", "Filler A", "Pacific Amphitheatre"),
      mk("2001-01-01", "Filler B", "Pacific Amphitheatre"), // makes 2001 not unique-quiet
      mk("2000-05-05", "The Band", "The Echo"),
      mk("2001-05-05", "The Band", "The Echo"), // <- picked, middle
      mk("2002-05-05", "The Band", "The Echo"),
    ];
    const picked = data.findIndex((c) => c.headliner === "The Band" && c.year === 2001);
    const setlists: SetlistsCache = {
      version: "1",
      generatedAt: "",
      entries: [
        {
          concertId: data[picked].id,
          artistName: "The Band",
          date: "2001-05-05",
          venue: "The Echo",
          setlist: { sets: { set: [{ song: [{ name: "Opener" }, { name: "Closer" }] }] } },
        },
      ],
    };
    const { angle, text } = surpriseMe(data, pickIndex(picked), setlists, {}, {});
    expect(angle).toBe("has-setlist");
    expect(text).toContain("The setlist that night included Opener and Closer.");
  });

  it("always names an angle (variation test): 10 seeded picks surface ≥3 distinct angles", () => {
    const data = archive();
    // deterministic mulberry32
    let s = 0x9e3779b9;
    const rng = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const angles = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { angle, text } = surpriseMe(
        data,
        (n) => Math.floor(rng() * n),
        null,
        ARTISTS_META,
        TOP_TRACKS,
      );
      expect(text.length).toBeGreaterThan(0); // every response names an angle
      angles.add(angle);
    }
    expect(angles.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------- get_concert_setlist ----------

describe("get_concert_setlist", () => {
  it("headliner setlist by concert id, with tour and link footer", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-5" }, TOP_TRACKS);
    assertVoice(text);
    expect(text).toContain("On the Stories of Life tour.");
    expect(text).toContain("1. Story of My Life");
    expect(text).toContain("3. Mommy's Little Monster");
    expect(text).toContain("Open on the site:");
    expect(text).toMatchSnapshot();
  });

  it("prefers the headliner's set when an opener also has one", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-3" }, TOP_TRACKS);
    expect(text).toContain("Everything Counts");
    expect(text).not.toContain("opening set");
    expect(text).not.toContain("Enola Gay");
  });

  it("falls back to the opener's set, clearly labeled, when the headliner's is missing", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-1" }, TOP_TRACKS);
    expect(text).toContain("Romeo Void's opening set");
    expect(text).toContain("Never Say Never");
    expect(text).toMatchSnapshot();
  });

  it("setlist === null reads as an honest gap, not an empty list", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-6" }, TOP_TRACKS);
    expect(text).toContain("I don't have a setlist on record");
    expect(text).not.toMatch(/^1\. /m);
    assertVoice(text);
  });

  it("non-null but empty song list is treated as no setlist", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-7" }, TOP_TRACKS);
    expect(text).toContain("I don't have a setlist on record");
  });

  it("no cache entry at all → graceful gap that offers best-known tracks", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-9" }, TOP_TRACKS);
    expect(text).toContain("I don't have a setlist on record");
    expect(text).toContain("best known for Story of My Life and Ball and Chain.");
    expect(text).toMatchSnapshot();
  });

  it("resolves by artist + year", () => {
    const text = concertSetlist(archive(), SETLISTS, { artist: "Social Distortion", date: "1990" }, TOP_TRACKS);
    expect(text).toContain("1. Story of My Life");
  });

  // A night of covers used to read as a list of songs the headliner appears to have
  // written: the cache records who each song belongs to, the type discarded it, and
  // "did Nile Rodgers play any Duran Duran?" got a confident no.
  describe("per-song attribution", () => {
    const annotated: SetlistsCache = {
      version: "1",
      generatedAt: "",
      entries: [
        {
          concertId: "concert-5",
          artistName: "Social Distortion",
          date: "1990-06-04",
          venue: "Pacific Amphitheatre",
          setlist: {
            sets: {
              set: [
                {
                  song: [
                    { name: "Notorious", cover: { name: "Duran Duran" } },
                    { name: "Ball and Chain", with: { name: "Nile Rodgers" } },
                    { name: "Intro Tape", tape: true },
                    { name: "Story of My Life", info: "First time live since 1984." },
                    { name: "Plain Song" },
                  ],
                },
              ],
            },
          },
        },
      ],
    };

    it("names the original artist on a cover", () => {
      const text = concertSetlist(archive(), annotated, { concertId: "concert-5" }, TOP_TRACKS);
      expect(text).toContain("1. Notorious (Duran Duran cover)");
    });

    it("credits a guest and marks tape", () => {
      const text = concertSetlist(archive(), annotated, { concertId: "concert-5" }, TOP_TRACKS);
      expect(text).toContain("2. Ball and Chain (with Nile Rodgers)");
      expect(text).toContain("3. Intro Tape (tape)");
    });

    it("carries setlist.fm's free-text note under its song", () => {
      const text = concertSetlist(archive(), annotated, { concertId: "concert-5" }, TOP_TRACKS);
      expect(text).toContain("4. Story of My Life");
      expect(text).toContain("   First time live since 1984.");
    });

    it("leaves an unannotated song as a bare title", () => {
      const text = concertSetlist(archive(), annotated, { concertId: "concert-5" }, TOP_TRACKS);
      expect(text).toContain("5. Plain Song");
      expect(text).not.toContain("5. Plain Song (");
    });

    it("keeps surprise_me's prose free of attribution noise", () => {
      const data = [mk("2001-05-05", "The Band", "The Echo"), mk("2002-05-05", "The Band", "The Echo")];
      const picked = 0;
      const setlists: SetlistsCache = {
        version: "1",
        generatedAt: "",
        entries: [
          {
            concertId: data[picked].id,
            artistName: "The Band",
            date: "2001-05-05",
            venue: "The Echo",
            setlist: {
              sets: { set: [{ song: [{ name: "Notorious", cover: { name: "Duran Duran" } }, { name: "Closer" }] }] },
            },
          },
        ],
      };
      const { text } = surpriseMe(data, () => picked, setlists, {}, {});
      expect(text).toContain("The setlist that night included Notorious and Closer.");
    });
  });

  it("asks which night when an artist has many shows and no date", () => {
    const text = concertSetlist(archive(), SETLISTS, { artist: "Social Distortion" }, TOP_TRACKS);
    expect(text).toContain("which night?");
    expect(text).toContain("[concert-5]");
  });

  it("unknown concert id says so", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-999" });
    expect(text).toBe('I don\'t have a concert with id "concert-999" in the archive.');
  });

  it("unknown artist says so", () => {
    const text = concertSetlist(archive(), SETLISTS, { artist: "Nobody" });
    expect(text).toBe("Nobody isn't in the archive.");
  });
});

// ---------- get_archive_top_songs ----------

const MOST_PLAYED: MostPlayedSongs = {
  version: "1",
  generatedAt: "",
  coverage: { concertsWithSetlist: 117, totalConcerts: 183, distinctSongs: 1607 },
  // Pre-sorted by count desc, as the build script emits it.
  songs: [
    { name: "Ring of Fire", count: 7, artists: ["Social Distortion"] },
    { name: "Ball and Chain", count: 6, artists: ["Social Distortion"] },
    { name: "Rock This Town", count: 5, artists: ["Brian Setzer", "Stray Cats", "The Brian Setzer Orchestra"] },
  ],
};

// #200 — the show link is the whole point of this issue: get_concert_setlist
// renders a setlist for one night and, before this, had no link to it.
// URL shape is asserted against the shared fixture that the SPA, sitemap and
// exhibits also check themselves against (test/fixtures/deep-link-urls.json),
// so the surfaces cannot drift apart independently.
describe("show deep links (#200)", () => {
  const showUrl = (slugName: string, date: string) =>
    `https://concerts.morperhaus.org${DEEP_LINKS.setlist.url
      .replace(DEEP_LINKS.setlist.input.slug, slugName)
      .replace(DEEP_LINKS.setlist.input.date, date)}`;

  it("matches the shared fixture's URL shape", () => {
    expect(showUrl(DEEP_LINKS.setlist.input.slug, DEEP_LINKS.setlist.input.date)).toBe(
      `https://concerts.morperhaus.org${DEEP_LINKS.setlist.url}`,
    );
  });

  it("links the night in get_concert_setlist when a setlist exists", () => {
    const a = archive();
    const c = a.find((x) => x.id === "concert-5")!;
    const text = concertSetlist(a, SETLISTS, { concertId: "concert-5" }, TOP_TRACKS);
    expect(text).toContain(showUrl(c.headlinerNormalized, c.date));
  });

  it("never emits an id-keyed show param", () => {
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-5" }, TOP_TRACKS);
    expect(text).not.toMatch(/show=concert-/);
  });

  it("omits the show link when there is no setlist on record", () => {
    // A link offered as a setlist that opens an empty panel is worse than no
    // link — 66 of 183 concerts are in this state.
    const a = archive();
    const noSetlist = a.find((x) => x.id === "concert-1")!;
    const text = concertSetlist(a, null, { concertId: noSetlist.id }, TOP_TRACKS);
    expect(text).not.toContain("&show=");
    // ...but still links artist and venue, so the reply stays actionable.
    expect(text).toContain("?scene=artists&artist=");
  });

  it("links only the nights with setlists in on_this_day", () => {
    const a = archive();
    const c = a.find((x) => x.id === "concert-5")!;
    const withSetlists = onThisDay(a, c.month, c.day, SETLISTS).text;
    const without = onThisDay(a, c.month, c.day, null).text;
    expect(withSetlists).toContain(showUrl(c.headlinerNormalized, c.date));
    expect(without).not.toContain("&show=");
  });

  it("leaves artist and venue links untouched", () => {
    // Regression guard: `show` is additive, so the existing shapes must be
    // byte-identical to before.
    const a = archive();
    const c = a.find((x) => x.id === "concert-5")!;
    const text = concertSetlist(a, SETLISTS, { concertId: "concert-5" }, TOP_TRACKS);
    expect(text).toContain(
      `https://concerts.morperhaus.org/?scene=artists&artist=${c.headlinerNormalized}`,
    );
    expect(text).toContain(
      `https://concerts.morperhaus.org/?scene=venues&venue=${c.venueNormalized}`,
    );
  });
});

describe("get_archive_top_songs", () => {
  it("leads with the coverage caveat and counts honestly", () => {
    const text = archiveTopSongs(MOST_PLAYED);
    assertVoice(text);
    expect(text).toContain("Across the 117 of 183 shows I have setlists for");
    expect(text).toContain("leans toward the artists I've seen most");
    expect(text).toMatchSnapshot();
  });

  it("links single-artist rows and summarizes multi-artist ones", () => {
    const text = archiveTopSongs(MOST_PLAYED);
    // single artist → clickable link
    expect(text).toContain("(["); // markdown link opener inside the parens
    expect(text).toContain("Ring of Fire — 7 times");
    // multi-artist standard → counted, not linked
    expect(text).toContain("Rock This Town — 5 times (across 3 artists)");
    expect(text).toContain("Open on the site:");
  });

  it("respects the limit", () => {
    const text = archiveTopSongs(MOST_PLAYED, 1);
    expect(text).toContain("1. Ring of Fire");
    expect(text).not.toContain("2. ");
  });

  it("empty data says so honestly", () => {
    const text = archiveTopSongs({ ...MOST_PLAYED, songs: [] });
    expect(text).toContain("don't have enough setlists on record yet");
  });

  it("null data says so honestly", () => {
    expect(archiveTopSongs(null)).toContain("don't have enough setlists on record yet");
  });
});

describe("artist billing aliases (#227)", () => {
  // Four marquees, eight shows, one man — the archive's real Setzer situation.
  const setzerArchive = (): Concert[] => [
    mk("1995-12-15", "The Brian Setzer Orchestra", "The Wiltern"),
    mk("1998-08-08", "The Brian Setzer Orchestra", "The Greek Theatre"),
    mk("2000-06-10", "Brian Setzer '68 Comeback Special", "House of Blues"),
    mk("2009-04-04", "Brian Setzer and the Nashvillians", "The Canyon"),
    mk("2024-02-27", "Brian Setzer", "The Wiltern"),
  ];

  const aliases = buildAliasIndex({
    sameAct: [
      {
        canonical: "brian-setzer",
        name: "Brian Setzer",
        billings: [
          "brian-setzer",
          "the-brian-setzer-orchestra",
          "brian-setzer-and-the-nashvillians",
          "brian-setzer-68-comeback-special",
        ],
      },
    ],
  });

  it("without the map, an exact name match answers for one billing only", () => {
    // The bug: "I've seen Brian Setzer 1 time" against an archive holding five.
    const r = resolveArtist(setzerArchive(), "Brian Setzer");
    expect(r).toMatchObject({ kind: "match", slug: "brian-setzer" });
    if (r.kind !== "match") throw new Error("unreachable");
    expect(r.slugs).toEqual(["brian-setzer"]);
  });

  it("resolves any billing to the canonical act", () => {
    for (const q of [
      "The Brian Setzer Orchestra",
      "Brian Setzer '68 Comeback Special",
      "brian-setzer-and-the-nashvillians",
    ]) {
      const r = resolveArtist(setzerArchive(), q, aliases);
      expect(r, q).toMatchObject({ kind: "match", slug: "brian-setzer", name: "Brian Setzer" });
    }
  });

  it("counts every billing as the same artist's history", () => {
    const text = artistHistory(setzerArchive(), "Brian Setzer", {}, {}, null, aliases);
    expect(text).toContain("5 times");
    expect(text).toContain("1995");
    expect(text).toContain("2024");
  });

  it("leaves unmapped artists exactly as they were", () => {
    const r = resolveArtist(openerArchive(), "Romeo Void", aliases);
    expect(r).toMatchObject({ kind: "match", slug: "romeo-void" });
    if (r.kind !== "match") throw new Error("unreachable");
    expect(r.slugs).toEqual(["romeo-void"]);
  });

  it("degrades to today's behaviour when the map is unavailable", () => {
    const empty = buildAliasIndex(null);
    const text = artistHistory(setzerArchive(), "Brian Setzer", {}, {}, null, empty);
    expect(text).toContain("1 time");
  });
});

// ---------- v6.0 §6a — song → album attribution ----------

describe("get_concert_setlist — album annotations (v6.0 §6a)", () => {
  const ALBUMS: SongAlbums = {
    version: "1.0.0",
    generatedAt: "",
    songs: {
      // Social Distortion, concert-5. "Mommy's Little Monster" is deliberately
      // ABSENT so one song in the set is unattributed.
      "social-distortion::story-of-my-life": {
        songTitle: "Story of My Life",
        albumTitle: "Somewhere Between Heaven and Hell",
        mbid: "sd-1",
        releaseDate: "1992-01-14",
        coverAvailable: true,
        matchTier: 1,
      },
      "social-distortion::ball-and-chain": {
        songTitle: "Ball and Chain",
        albumTitle: "Somewhere Between Heaven and Hell",
        mbid: "sd-1",
        releaseDate: "1992-01-14",
        coverAvailable: true,
        matchTier: 1,
      },
      // Filed under the DISCOGRAPHY key, which the marquee "OMD" never spells.
      // Only reachable through hop 2.
      "orchestral-manoeuvres-in-the-dark::enola-gay": {
        songTitle: "Enola Gay",
        albumTitle: "Organisation",
        mbid: "omd-1",
        releaseDate: "1980-10-24",
        coverAvailable: true,
        matchTier: 0,
      },
    },
  };

  const ALIASES = {
    discographyKeys: [
      { act: "omd", discographyKey: "orchestral-manoeuvres-in-the-dark" },
    ],
  };

  const call = (concertId: string, albums: SongAlbums | null = ALBUMS) =>
    concertSetlist(
      archive(),
      SETLISTS,
      { concertId },
      TOP_TRACKS,
      null,
      albums,
      ARTISTS_META,
      ALIASES,
    );

  it("annotates an attributed song with its album", () => {
    const text = call("concert-5");
    expect(text).toMatch(/1\. Story of My Life\s{2,}Somewhere Between Heaven and Hell/);
  });

  it("leaves an unattributed song with NO annotation and no trailing pad", () => {
    const text = call("concert-5");
    const line = text.split("\n").find((l) => l.includes("Mommy's Little Monster"))!;
    expect(line).toBe("3. Mommy's Little Monster");
  });

  it("states identified of total, so a partial read reads as partial", () => {
    const text = call("concert-5");
    expect(text).toContain(
      "2 of 3 songs identified. 2 from Somewhere Between Heaven and Hell.",
    );
  });

  // concert-3's OMD row is the OPENER and the headliner set wins, so drop the
  // headliner row to make OMD the resolved performer.
  const OMD_ONLY: SetlistsCache = {
    ...SETLISTS,
    entries: SETLISTS.entries.filter(
      (e) => e.concertId === "concert-3" && e.artistName === "OMD",
    ),
  };

  it("reaches a discography filed under a different key than the marquee (hop 2)", () => {
    const text = concertSetlist(
      archive(), OMD_ONLY, { concertId: "concert-3" }, TOP_TRACKS, null, ALBUMS, ARTISTS_META, ALIASES,
    );
    expect(text).toMatch(/1\. Enola Gay\s{2,}Organisation/);
  });

  it("misses that discography entirely when hop 2 is skipped", () => {
    // The failure this guards is SILENT — without discographyKeys the lookup
    // returns nothing, which is indistinguishable from "we hold no discography
    // for this act". That is why hop 2 gets its own test rather than being
    // folded into the one above.
    const text = concertSetlist(
      archive(), OMD_ONLY, { concertId: "concert-3" }, TOP_TRACKS, null, ALBUMS, ARTISTS_META, null,
    );
    expect(text).toContain("1. Enola Gay");
    expect(text).not.toContain("Organisation");
  });

  it("is byte-identical to its pre-v6 output when the data file is absent", () => {
    const before = concertSetlist(archive(), SETLISTS, { concertId: "concert-5" }, TOP_TRACKS, null);
    expect(call("concert-5", null)).toBe(before);
  });

  it("is byte-identical when the data file is present but empty", () => {
    const before = concertSetlist(archive(), SETLISTS, { concertId: "concert-5" }, TOP_TRACKS, null);
    const empty: SongAlbums = { version: "1.0.0", generatedAt: "", songs: {} };
    expect(call("concert-5", empty)).toBe(before);
  });

  it("never says the count line when nothing was identified", () => {
    const empty: SongAlbums = { version: "1.0.0", generatedAt: "", songs: {} };
    expect(call("concert-5", empty)).not.toContain("identified");
  });

  // A cover and a tape, on one night, for the two rules that are easy to get wrong.
  const MIXED: SetlistsCache = {
    version: "1",
    generatedAt: "",
    entries: [
      {
        concertId: "concert-5",
        artistName: "Social Distortion",
        date: "1990-06-04",
        venue: "Pacific Amphitheatre",
        setlist: {
          sets: {
            set: [
              {
                song: [
                  { name: "Story of My Life" },
                  { name: "Ring of Fire", cover: { name: "Johnny Cash" } },
                  { name: "Intro Tape", tape: true },
                ],
              },
            ],
          },
        },
      },
    ],
  };

  const MIXED_ALBUMS: SongAlbums = {
    version: "1.0.0",
    generatedAt: "",
    songs: {
      ...ALBUMS.songs,
      "social-distortion::ring-of-fire": {
        songTitle: "Ring of Fire",
        albumTitle: "Ring of Fire",
        mbid: "jc-1",
        releaseDate: "1963-08-01",
        coverAvailable: true,
        matchTier: 1,
        isCover: true,
        originalArtistKey: "johnny-cash",
      },
    },
  };

  const mixed = () =>
    concertSetlist(
      archive(), MIXED, { concertId: "concert-5" }, TOP_TRACKS, null, MIXED_ALBUMS, ARTISTS_META, ALIASES,
    );

  it("annotates a cover with the original artist, never with an album", () => {
    // songLine already prints "(Johnny Cash cover)". Adding the album on top
    // would read as though Social Distortion played a Johnny Cash record.
    const line = mixed().split("\n").find((l) => l.includes("Ring of Fire"))!;
    expect(line).toBe("2. Ring of Fire (Johnny Cash cover)");
  });

  it("excludes tape from the identified count — walk-on music is not a performance", () => {
    // 3 rows print, but only 2 are performances and only 1 is attributed.
    expect(mixed()).toContain("1 of 2 songs identified.");
  });
});

describe("eraLine phrasing", () => {
  it("does not say 'released N months old earlier'", () => {
    const eras: any = {
      version: "1", generatedAt: "", artists: {}, stats: {},
      concerts: {
        "concert-5": {
          currentAlbum: { title: "Somewhere Between Heaven and Hell" },
          daysSinceRelease: 274,
        },
      },
    };
    const text = concertSetlist(archive(), SETLISTS, { concertId: "concert-5" }, TOP_TRACKS, eras);
    expect(text).toContain("(released 9 months earlier)");
    expect(text).not.toContain("old earlier");
  });
});
