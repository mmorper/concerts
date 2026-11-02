/**
 * The song index behind Ask's type-ahead. A row is a link to a real night, so the act and the date
 * have to be the ones the setlist came from.
 */

import { describe, it, expect } from "vitest";
import { buildSongIndex } from "../../scripts/aggregate-most-played-songs.ts";

const concert = (id: string, date: string, headliner = "Social Distortion") => ({
  id,
  date,
  headliner,
  headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

const setlist = (concertId: string, artistName: string, songs: string[]) => ({
  concertId,
  artistName,
  setlist: { sets: { set: [{ song: songs.map((name) => ({ name })) }] } },
});

describe("buildSongIndex", () => {
  it("keeps a song heard once, which the most-played list drops", () => {
    const { songs } = buildSongIndex([concert("a", "2020-01-01")], [setlist("a", "Social Distortion", ["Ring of Fire"])]);
    expect(songs).toEqual([{ name: "Ring of Fire", act: "Social Distortion", slug: "social-distortion", dates: ["2020-01-01"] }]);
  });

  it("counts a song once a night and keeps every night, newest first", () => {
    const concerts = [concert("b", "2020-01-01"), concert("a", "2024-01-01")];
    const entries = [
      setlist("a", "Social Distortion", ["Ring of Fire", "ring of fire!"]),
      setlist("b", "Social Distortion", ["Ring of Fire"]),
    ];
    expect(buildSongIndex(concerts, entries).songs[0].dates).toEqual(["2024-01-01", "2020-01-01"]);
  });

  it("gives each act its own row for the same song", () => {
    const concerts = [concert("a", "2024-01-01"), concert("b", "2020-01-01", "Johnny Cash")];
    const entries = [setlist("a", "Social Distortion", ["Ring of Fire"]), setlist("b", "Johnny Cash", ["Ring of Fire"])];
    expect(buildSongIndex(concerts, entries).songs.map((s) => s.slug).sort()).toEqual(["johnny-cash", "social-distortion"]);
  });

  it("prefers the headliner's setlist, and credits the act whose setlist it is", () => {
    const entries = [setlist("a", "Opener", ["Support Song"]), setlist("a", "Social Distortion", ["Ring of Fire"])];
    expect(buildSongIndex([concert("a", "2020-01-01")], entries).songs.map((s) => s.name)).toEqual(["Ring of Fire"]);

    const onlyOpener = [setlist("a", "Opener", ["Support Song"])];
    expect(buildSongIndex([concert("a", "2020-01-01")], onlyOpener).songs[0]).toMatchObject({ act: "Opener", slug: "opener" });
  });

  it("names the record a song came off, listing each record once", () => {
    const record = { albumTitle: "Ring of Fire: The Best of", mbid: "m1", releaseDate: "1963", coverAvailable: true };
    const entries = [setlist("a", "Social Distortion", ["Ring of Fire", "Ball and Chain", "Story of My Life"])];
    const index = buildSongIndex([concert("a", "2020-01-01")], entries, {
      "social-distortion::ring-of-fire": record,
      "social-distortion::ball-and-chain": record,
    });
    expect(index.albums).toEqual([{ mbid: "m1", title: "Ring of Fire: The Best of", releaseDate: "1963", coverAvailable: true }]);
    const album = Object.fromEntries(index.songs.map((s) => [s.name, s.album]));
    expect(album).toEqual({ "Ring of Fire": 0, "Ball and Chain": 0, "Story of My Life": undefined });
  });
});
