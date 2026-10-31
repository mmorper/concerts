import { describe, it, expect } from "vitest";
import { albumInfo, type AlbumInfoData } from "./album-info.js";
import { TOOL_DEFS } from "./tools-bridge.js";
import type { AlbumEras, Concert, SongAlbums } from "../../mcp-server/src/types.js";

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
