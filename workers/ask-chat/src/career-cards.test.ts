import { describe, it, expect } from "vitest";
import { eraExhibit, shapeExhibit, songsExhibit } from "./career-cards.js";
import { pickPrimaryExhibit, type Exhibit } from "./exhibits.js";
import type { AlbumEras, ArtistEra, Concert, ConcertEra, MostPlayedSongs, SetlistsCache, SongAlbums } from "../../mcp-server/src/types.js";

const concert = (id: string, date: string, headliner: string, slug: string, openers: string[] = []): Concert =>
  ({
    id,
    date,
    year: Number(date.slice(0, 4)),
    headliner,
    headlinerNormalized: slug,
    venue: "The Belasco",
    venueNormalized: "the-belasco",
    city: "Los Angeles",
    openers,
  }) as unknown as Concert;

const ref = (title: string, releaseDate: string) => ({ mbid: title.toLowerCase(), title, releaseDate, coverAvailable: true });
const defining = (title: string, releaseDate: string, count: number, total: number) => ({
  ...ref(title, releaseDate),
  topTrackCount: count,
  topTrackTotal: total,
  matchTier: "exact",
});

const era = (over: Partial<ConcertEra>): ConcertEra =>
  ({
    concertId: "c1",
    artistKey: "depeche-mode",
    date: "1988-06-18",
    currentAlbum: null,
    daysSinceRelease: null,
    cycleBucket: null,
    albumsBefore: 0,
    albumsAfter: 0,
    careerYear: null,
    yearsBeforeDebut: null,
    careerPercentile: null,
    isDebutEra: false,
    definingAlbum: null,
    definingAlbumAhead: false,
    definingAlbumMonthsAway: null,
    ...over,
  }) as ConcertEra;

describe("eraExhibit (#593) — get_career_position's night as a card", () => {
  const dm: ArtistEra = {
    artistKey: "depeche-mode",
    displayName: "Depeche Mode",
    studioAlbumCount: 4,
    // The duplicate is real data shape: MusicBrainz lists a few records twice.
    studioAlbums: [ref("Speak & Spell", "1981"), ref("Music for the Masses", "1987"), ref("Music for the Masses", "1987"), ref("Violator", "1990")],
    debutAlbum: null,
    latestAlbum: null,
    definingAlbum: null,
    truncated: false,
    erasSeen: [],
  } as unknown as ArtistEra;

  it("flags the records already out by albumsBefore, before deduping, so a duplicate can't move the marker", () => {
    const e = eraExhibit(
      concert("c1", "1988-06-18", "Depeche Mode", "depeche-mode"),
      era({
        albumsBefore: 3,
        albumsAfter: 1,
        currentAlbum: ref("Music for the Masses", "1987"),
        daysSinceRelease: 270,
        definingAlbum: defining("Violator", "1990", 4, 5),
        definingAlbumAhead: true,
        definingAlbumMonthsAway: 21,
      }),
      dm,
    );
    expect(e.shelf.map((a) => [a.title, a.before])).toEqual([
      ["Speak & Spell", true],
      ["Music for the Masses", true],
      ["Violator", false],
    ]);
    expect(e).toMatchObject({
      kind: "era",
      artist: { slug: "depeche-mode", deepLink: "/?scene=artists&artist=depeche-mode" },
      venue: { slug: "the-belasco" },
      touring: { title: "Music for the Masses" },
      defining: { title: "Violator", ahead: true, monthsAway: 21 },
    });
  });

  it("has no touring record for a night before their first album", () => {
    const e = eraExhibit(concert("c1", "1980-01-01", "Depeche Mode", "depeche-mode"), era({ albumsAfter: 3 }), dm);
    expect(e.touring).toBeNull();
    expect(e.shelf.every((a) => !a.before)).toBe(true);
  });

  it("outranks the artist card when both land in one turn", () => {
    const e = eraExhibit(concert("c1", "1988-06-18", "Depeche Mode", "depeche-mode"), era({}), dm);
    const artist: Exhibit = { kind: "artist", entity: "artist", slug: "depeche-mode", name: "Depeche Mode", deepLink: "/?scene=artists&artist=depeche-mode" };
    expect(pickPrimaryExhibit([artist, e])).toBe(e);
  });
});

describe("shapeExhibit (#593) — the archive-wide card", () => {
  const concerts = [
    concert("c1", "1985-05-01", "Depeche Mode", "depeche-mode"),
    concert("c2", "1988-03-04", "No Doubt", "no-doubt"),
    concert("c3", "2017-01-01", "Bat Fangs", "bat-fangs"),
    concert("c4", "2024-08-20", "Howard Jones", "howard-jones"),
  ];
  const eras = {
    version: "1",
    generatedAt: "",
    stats: {},
    artists: {},
    concerts: {
      c1: era({ concertId: "c1", cycleBucket: "current", daysSinceRelease: 200, definingAlbum: defining("Violator", "1990", 4, 5), definingAlbumAhead: true, definingAlbumMonthsAway: 60 }),
      c2: era({ concertId: "c2", artistKey: "no-doubt", cycleBucket: null, daysSinceRelease: null, definingAlbum: defining("Tragic Kingdom", "1995", 4, 5), definingAlbumAhead: true, definingAlbumMonthsAway: 91 }),
      // Weakly evidenced (2 of 5): counted, never quoted — the prose's evidence bar.
      c3: era({ concertId: "c3", artistKey: "bat-fangs", cycleBucket: "fresh", daysSinceRelease: 30, definingAlbum: defining("Queen", "2021", 2, 5), definingAlbumAhead: true, definingAlbumMonthsAway: 200 }),
      c4: era({ concertId: "c4", artistKey: "howard-jones", cycleBucket: "mature", daysSinceRelease: 780 }),
    },
  } as unknown as AlbumEras;

  it("carries the buckets and the quoted nights, in the prose's order", () => {
    const s = shapeExhibit(concerts, eras)!;
    expect(s).toMatchObject({ kind: "shape", placed: 3, total: 4, aheadCount: 3 });
    expect(s.buckets).toEqual({ fresh: 1, current: 1, mature: 1, deep: 0, catalog: 0 });
    expect(s.ahead.map((a) => [a.artist.name, a.album.title, a.monthsAway])).toEqual([
      ["No Doubt", "Tragic Kingdom", 91],
      ["Depeche Mode", "Violator", 60],
    ]);
  });

  it("has no card when nothing can be placed", () => {
    expect(shapeExhibit(concerts, { ...eras, concerts: {} } as AlbumEras)).toBeUndefined();
  });
});

describe("songsExhibit (#593) — the most-heard songs with their records", () => {
  const most: MostPlayedSongs = {
    version: "1",
    generatedAt: "",
    coverage: { concertsWithSetlist: 120, totalConcerts: 185, distinctSongs: 900 },
    songs: [
      { name: "Ring of Fire", count: 6, artists: ["Social Distortion"] },
      { name: "Story of My Life", count: 5, artists: ["Social Distortion"] },
      { name: "Just Can't Get Enough", count: 5, artists: ["Depeche Mode", "Thompson Twins"] },
      { name: "Mystery", count: 4, artists: ["Somebody I Never Saw"] },
    ],
  } as unknown as MostPlayedSongs;
  const songAlbums: SongAlbums = {
    version: "1",
    generatedAt: "",
    songs: {
      "social-distortion::ring-of-fire": { songTitle: "Ring of Fire", albumTitle: "Ring of Fire", mbid: "rof", releaseDate: "1963", coverAvailable: true, matchTier: 0, isCover: true, originalArtistKey: "johnny-cash" },
      "social-distortion::story-of-my-life": { songTitle: "Story of My Life", albumTitle: "Social Distortion", mbid: "sd", releaseDate: "1990", coverAvailable: true, matchTier: 0 },
      // The cover band first, the original second: the card takes the original's record.
      "thompson-twins::just-cant-get-enough": { songTitle: "Just Can't Get Enough", albumTitle: "Speak & Spell", mbid: "ss", releaseDate: "1981", coverAvailable: true, matchTier: 0 },
    },
  };
  const data = {
    concerts: [concert("c1", "2011-06-01", "Social Distortion", "social-distortion", ["Thompson Twins"]), concert("c2", "1988-06-18", "Depeche Mode", "depeche-mode")],
    songAlbums,
    meta: {},
    aliasData: null,
  };

  it("pairs each song with its record, names a cover's original act, links only acts in the archive", () => {
    const s = songsExhibit(most, undefined, data)!;
    expect(s).toMatchObject({ kind: "songs", withSetlist: 120, totalConcerts: 185 });
    expect(s.songs.map((x) => [x.title, x.album?.title ?? null, x.coverOf ?? null, x.artist?.slug ?? null])).toEqual([
      ["Ring of Fire", null, "Johnny Cash", "social-distortion"],
      ["Story of My Life", "Social Distortion", null, "social-distortion"],
      ["Just Can't Get Enough", "Speak & Spell", null, null], // two acts: no single link
      ["Mystery", null, null, null], // not an archive act: no link to a page that doesn't exist
    ]);
  });

  it("falls back to setlist.fm's cover credit when the song isn't in song-albums at all", () => {
    // The real shape of "Ring of Fire": no song-albums entry, a cover credit in every setlist.
    const { "social-distortion::ring-of-fire": _, ...rest } = songAlbums.songs;
    const setlists = {
      version: "1",
      generatedAt: "",
      entries: [{ concertId: "c1", artistName: "Social Distortion", date: "2011-06-01", venue: "x", setlist: { sets: { set: [{ song: [{ name: "Ring of Fire", cover: { name: "Merle Kilgore" } }] }] } } }],
    } as unknown as SetlistsCache;
    const s = songsExhibit(most, 1, { ...data, songAlbums: { ...songAlbums, songs: rest }, setlists })!;
    expect(s.songs[0]).toMatchObject({ title: "Ring of Fire", album: null, coverOf: "Merle Kilgore" });
  });

  it("uses the prose's clamp on how many songs, and has no card without data", () => {
    expect(songsExhibit(most, 2, data)!.songs).toHaveLength(2);
    expect(songsExhibit(most, 0, data)!.songs).toHaveLength(1);
    expect(songsExhibit(null, 10, data)).toBeUndefined();
  });
});
