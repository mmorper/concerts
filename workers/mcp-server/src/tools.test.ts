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
} from "./tools.js";
import type {
  ArtistsMetadata,
  ArtistsTopTracks,
  Concert,
  SetlistsCache,
  VenuesMetadata,
} from "./types.js";

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
    const text = searchConcerts(archive(), { artist: "Adam Ant" });
    expect(text).toContain("[concert-1]");
    expect(text).toMatchSnapshot();
  });

  it("caps results and says so honestly", () => {
    const text = searchConcerts(archive(), { artist: "Social Distortion", limit: 2 });
    expect(text).toContain("That's 2 of 5 — try narrowing the search.");
    expect(text).toMatchSnapshot();
  });

  it("zero results say something real", () => {
    const text = searchConcerts(archive(), { artist: "Nobody At All" });
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
    expect(r).toEqual({ kind: "match", name: "Peter Hook and the Light", slug: "peter-hook-and-the-light" });
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
    const text = onThisDay(archive(), 6, 4);
    expect(text).toContain("On June 4, across the years:");
    expect(text).toContain("1988: [Depeche Mode](");
    expect(text).toContain("1990: [Social Distortion](");
    expect(text).toMatchSnapshot();
  });

  it("quiet date", () => {
    expect(onThisDay(archive(), 1, 2)).toBe("Nothing in the archive on January 2. A quiet date.");
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
