import { describe, it, expect } from "vitest";
import { albumExhibit, albumInfo, type AlbumExhibitData, type AlbumInfoData } from "./album-info.js";
import { TOOL_DEFS } from "./tools-bridge.js";
import type { AlbumEras, Concert, SetlistsCache, SongAlbums } from "../../mcp-server/src/types.js";

const concert = (id: string, date: string, headliner: string, slug: string): Concert =>
  ({
    id,
    date,
    year: Number(date.slice(0, 4)),
    headliner,
    headlinerNormalized: slug,
    venue: "The Belasco",
    venueNormalized: "the-belasco",
    city: "Los Angeles",
    state: "California",
    cityState: "Los Angeles, California",
    openers: [],
  }) as unknown as Concert;

const ref = (title: string, releaseDate: string) => ({ mbid: title, title, releaseDate, coverAvailable: true });

const eras = {
  version: "1",
  generatedAt: "",
  concerts: {},
  stats: {},
  artists: {
    "social-distortion": {
      artistKey: "social-distortion",
      displayName: "Social Distortion",
      studioAlbumCount: 3,
      studioAlbums: [ref("Mommy's Little Monster", "1983"), ref("Social Distortion", "1990-03-27"), ref("Born to Kill", "2026")],
      debutAlbum: null,
      latestAlbum: null,
      definingAlbum: null,
      truncated: false,
      erasSeen: [],
    },
  },
} as unknown as AlbumEras;

const song = (songTitle: string, albumTitle: string, releaseDate: string, extra = {}) => ({
  songTitle,
  albumTitle,
  mbid: albumTitle,
  releaseDate,
  coverAvailable: true,
  matchTier: 0,
  ...extra,
});

const songAlbums: SongAlbums = {
  version: "1",
  generatedAt: "",
  songs: {
    "social-distortion::story-of-my-life": song("Story of My Life", "Social Distortion", "1990-03-27"),
    "social-distortion::ball-and-chain": song("Ball and Chain", "Social Distortion", "1990-03-27"),
    "social-distortion::wicked-game": song("Wicked Game", "Heart Shaped World", "1989-06-06", {
      isCover: true,
      originalArtistKey: "chris-isaak",
    }),
  },
};

const data: AlbumInfoData = {
  concerts: [concert("c1", "2011-06-01", "Social Distortion", "social-distortion"), concert("c2", "2012-06-01", "Sting", "sting")],
  eras,
  songAlbums,
  meta: { "chris-isaak": { name: "Chris Isaak" } } as never,
  aliasData: null,
};

describe("get_album_info (#317)", () => {
  it("is offered to the model", () => {
    const t = TOOL_DEFS.find((d) => d.name === "get_album_info");
    expect(t).toBeTruthy();
    expect(Object.keys(t!.input_schema.properties)).toEqual(["song", "artist", "album"]);
  });

  it("names the album a song came from", () => {
    expect(albumInfo({ song: "Story of My Life" }, data)).toBe(
      '"Story of My Life" (Social Distortion, heard live) is from *Social Distortion* (1990).',
    );
  });

  it("folds the song title the way the attribution keys do", () => {
    expect(albumInfo({ song: "story of my life (live)" }, data)).toContain("*Social Distortion* (1990)");
  });

  it("says a cover's record belongs to the original act", () => {
    expect(albumInfo({ song: "Wicked Game" }, data)).toContain("a cover; the record is Chris Isaak's");
  });

  it("is honest about coverage when a song is missing", () => {
    const text = albumInfo({ song: "Nonexistent Song" }, data);
    expect(text).toMatch(/don't have "Nonexistent Song" matched to an album/);
    expect(text).toMatch(/isn't proof it wasn't played/);
  });

  it("lists an artist's studio albums and the records my setlists drew on", () => {
    const text = albumInfo({ artist: "Social Distortion" }, data);
    expect(text).toContain("3 studio albums: *Mommy's Little Monster* (1983), *Social Distortion* (1990), *Born to Kill* (2026)");
    expect(text).toContain("*Social Distortion* (1990) — 2");
    expect(text).toContain("*Heart Shaped World* (1989) — Chris Isaak's, a cover — 1");
  });

  it("answers 'did they play anything off X' both ways", () => {
    expect(albumInfo({ artist: "Social Distortion", album: "Social Distortion" }, data)).toContain(
      '2 songs from it in my setlists: "Ball and Chain", "Story of My Life"',
    );
    expect(albumInfo({ artist: "Social Distortion", album: "Born to Kill" }, data)).toContain(
      "*Born to Kill* (2026) by Social Distortion — none of the songs in my setlists of theirs came off it.",
    );
    expect(albumInfo({ artist: "Social Distortion", album: "Nebraska" }, data)).toBe(
      "I don't have a record called *Nebraska* for Social Distortion.",
    );
  });

  it("says when it has no discography for an artist that is in the archive", () => {
    expect(albumInfo({ artist: "Sting" }, data)).toBe("I don't have a studio discography on file for Sting.");
  });

  it("does not answer for an artist the archive doesn't hold", () => {
    expect(albumInfo({ artist: "Bruce Springsteen" }, data)).toBe('"Bruce Springsteen" isn\'t in the archive.');
  });

  it("asks for something when given nothing, and degrades when data is missing", () => {
    expect(albumInfo({}, data)).toMatch(/Name a song, an album, or an artist/);
    expect(albumInfo({ song: "x" }, { ...data, songAlbums: null, eras: null })).toMatch(/temporarily unavailable/);
  });
});

// #593 — the card side of the same lookups. Every case here mirrors a prose case above:
// the card must name the record the text names, and say nothing where the text hedges.
describe("albumExhibit (#593)", () => {
  const setlist = (concertId: string, date: string, artistName: string, songs: Array<{ name: string; tape?: boolean; cover?: { name: string } }>) => ({
    concertId,
    artistName,
    date,
    venue: "The Belasco",
    setlist: { sets: { set: [{ song: songs }] } },
  });
  const setlists = {
    version: "1",
    generatedAt: "",
    entries: [
      setlist("c1", "2011-06-01", "Social Distortion", [
        { name: "Intro", tape: true },
        { name: "Story of My Life" },
        { name: "Wicked Game", cover: { name: "Chris Isaak" } },
        { name: "Mystery Song" },
      ]),
    ],
  } as unknown as SetlistsCache;
  const withDefining = {
    ...eras,
    artists: {
      "social-distortion": {
        ...eras.artists["social-distortion"],
        // The duplicate is real: MusicBrainz lists a few records twice (Blancmange's Big Fat Head).
        studioAlbums: [...eras.artists["social-distortion"].studioAlbums, ref("Born to Kill", "2026")],
        definingAlbum: { ...ref("Social Distortion", "1990-03-27"), topTrackCount: 3, topTrackTotal: 5, matchTier: "exact" },
        erasSeen: [{ albumSlug: "social-distortion", title: "Social Distortion", showCount: 1, dates: ["2011-06-01"] }],
      },
    },
  } as unknown as AlbumEras;
  const full: AlbumExhibitData = { ...data, eras: withDefining, setlists };

  it("a song question becomes the album card, with no artist named — the old plain-card gap", () => {
    const ex = albumExhibit({ song: "Story of My Life" }, full);
    expect(ex).toMatchObject({
      kind: "album",
      album: { mbid: "Social Distortion", title: "Social Distortion", releaseDate: "1990-03-27", coverAvailable: true },
      artist: { slug: "social-distortion", deepLink: "/?scene=artists&artist=social-distortion" },
      artistName: "Social Distortion",
      song: "Story of My Life",
      position: { index: 2, total: 3 },
      defining: true,
    });
  });

  it("carries the night it was heard, the whole set, tapes dropped and covers without an album", () => {
    const ex = albumExhibit({ song: "Story of My Life" }, full);
    if (ex?.kind !== "album") throw new Error("expected an album card");
    expect(ex.heardLive).toMatchObject({
      concertId: "c1",
      date: "2011-06-01",
      venue: { slug: "the-belasco" },
      performer: "Social Distortion",
    });
    expect(ex.heardLive!.songs.map((s) => [s.title, s.album?.title ?? null, s.coverOf ?? null])).toEqual([
      ["Story of My Life", "Social Distortion", null],
      ["Wicked Game", null, "Chris Isaak"],
      ["Mystery Song", null, null],
    ]);
  });

  it("gives a cover's card to the original act, who may not be in the archive", () => {
    const ex = albumExhibit({ song: "Wicked Game" }, full);
    expect(ex).toMatchObject({ kind: "album", album: { title: "Heart Shaped World" }, artist: null, artistName: "Chris Isaak" });
  });

  it("has no live block without setlists, and no card when the song isn't matched", () => {
    const ex = albumExhibit({ song: "Story of My Life" }, { ...full, setlists: null });
    expect(ex && "heardLive" in ex).toBe(false);
    expect(albumExhibit({ song: "Nonexistent Song" }, full)).toBeUndefined();
  });

  it("an album question becomes that album's card", () => {
    expect(albumExhibit({ artist: "Social Distortion", album: "Born to Kill" }, full)).toMatchObject({
      kind: "album",
      album: { title: "Born to Kill" },
      position: { index: 3, total: 3 },
    });
    expect(albumExhibit({ artist: "Social Distortion", album: "Nebraska" }, full)).toBeUndefined();
  });

  it("an artist question becomes the discography wall: deduped, seen cycles and the defining record marked", () => {
    const ex = albumExhibit({ artist: "Social Distortion" }, full);
    if (ex?.kind !== "discography") throw new Error("expected a discography card");
    expect(ex.artist.slug).toBe("social-distortion");
    expect(ex.albums.map((a) => [a.title, a.seen, a.defining])).toEqual([
      ["Mommy's Little Monster", [], false],
      ["Social Distortion", ["2011-06-01"], true],
      ["Born to Kill", [], false],
    ]);
  });

  it("falls back to no card where the prose hedges or has nothing", () => {
    expect(albumExhibit({ artist: "Sting" }, full)).toBeUndefined(); // no discography on file
    expect(albumExhibit({ artist: "Bruce Springsteen" }, full)).toBeUndefined(); // not in the archive
    expect(albumExhibit({}, full)).toBeUndefined();
    expect(albumExhibit({ song: "Story of My Life" }, { ...full, songAlbums: null, eras: null })).toBeUndefined();
  });
});
