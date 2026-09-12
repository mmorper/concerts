/**
 * Opener-aware drought-comeback and most-witnessed-album (#529).
 *
 * Both detectors used to group appearances by `headlinerNormalized` alone, the
 * same bug `appearancesByArtist` documents and `detectRareSighting` was fixed
 * against: an act on someone else's bill is a real sighting, and treating it
 * as absent understates a gap or a witnessed-song count.
 */

import { describe, it, expect } from "vitest";
import { detectDroughtComeback, detectMostWitnessedAlbum, type SongAlbumsSlim } from "../../scripts/liner-notes/analyze.ts";
import { buildSetlistIndex } from "../../scripts/liner-notes/setlists.ts";
import { songAlbumKey } from "../../scripts/utils/song-title.ts";
import type { Concert } from "../../src/types/concert.ts";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Minimal but complete-enough Concert for driving a detector directly. */
function concert(over: Partial<Concert> & { date: string; headliner: string }): Concert {
  const [y, m, d] = over.date.split("-").map(Number);
  return {
    id: over.id ?? `c-${over.date}-${slug(over.headliner)}`,
    date: over.date,
    year: y,
    month: m,
    day: d,
    dayOfWeek: "Monday",
    decade: `${Math.floor(y / 10) * 10}s`,
    headliner: over.headliner,
    headlinerNormalized: slug(over.headliner),
    openers: over.openers ?? [],
    genre: "Rock",
    genreNormalized: "rock",
    venue: over.venue ?? "The Venue",
    venueNormalized: slug(over.venue ?? "The Venue"),
    city: "Los Angeles",
    state: "California",
    cityState: "Los Angeles, California",
    reference: "",
    location: { lat: 0, lng: 0 },
  } as Concert;
}

describe("drought-comeback — opener appearances count (#529)", () => {
  it("finds no gap for an artist with a single headline show and no other appearance", () => {
    const concerts = [concert({ date: "1990-06-01", headliner: "Solo Artist" })];
    expect(detectDroughtComeback(concerts)).toEqual([]);
  });

  it("counts an opener slot as a real sighting, shrinking the gap it would otherwise report", () => {
    const concerts = [
      concert({ date: "1990-06-01", headliner: "Echo Test" }),
      // Opened for someone else 30 years later — a real sighting the archive
      // records, even though "Echo Test" never headlines again.
      concert({ date: "2020-06-01", headliner: "The Cure Test", openers: ["Echo Test"] }),
    ];
    const findings = detectDroughtComeback(concerts);
    const finding = findings.find((f) => f.dataPoints.artistNormalized === "echo-test");
    expect(finding).toBeDefined();
    expect(finding!.dataPoints.gapYears).toBe(30);
    // The display name comes off the artist's OWN headline show, not the bill
    // they opened — "The Cure Test" must never appear as the subject.
    expect(finding!.dataPoints.artist).toBe("Echo Test");
    expect(finding!.headline).toContain("Echo Test");
    expect(finding!.headline).not.toContain("The Cure Test");
  });

  it("names an opener-only artist using the exact billing string, absent any headline show", () => {
    const concerts = [
      concert({ date: "1990-06-01", headliner: "Someone Else", openers: ["Opener Only"] }),
      concert({ date: "2000-06-01", headliner: "Another Headliner", openers: ["Opener Only"] }),
    ];
    const finding = detectDroughtComeback(concerts).find(
      (f) => f.dataPoints.artistNormalized === "opener-only"
    );
    expect(finding).toBeDefined();
    expect(finding!.dataPoints.artist).toBe("Opener Only");
  });
});

describe("most-witnessed-album — opener appearances count (#529)", () => {
  const songAlbums: SongAlbumsSlim = {
    songs: Object.fromEntries(
      ["Song One", "Song Two", "Song Three"].map((title) => [
        songAlbumKey("test-band", title),
        {
          songTitle: title,
          albumTitle: "Test Album",
          mbid: "mbid-1",
          releaseDate: "2000-01-01",
          coverAvailable: false,
          matchTier: 1,
          isCover: false,
        },
      ])
    ),
  };

  function setlistCache(entries: Array<{ date: string; artistName: string; songs: string[] }>) {
    return {
      entries: Object.fromEntries(
        entries.map((e, i) => [
          `entry-${i}`,
          {
            date: e.date,
            artistName: e.artistName,
            setlist: { sets: { set: [{ song: e.songs.map((name) => ({ name })) }] } },
          },
        ])
      ),
    };
  }

  it("counts songs played in an opening slot toward the artist's total", () => {
    const concerts = [
      concert({ date: "2010-01-01", headliner: "Test Band", openers: [] }),
      // Two more nights opening for someone else, playing more of the same album.
      concert({ date: "2011-01-01", headliner: "Someone Else", openers: ["Test Band"] }),
      concert({ date: "2012-01-01", headliner: "Another Act", openers: ["Test Band"] }),
    ];
    const setlists = buildSetlistIndex(
      setlistCache([
        { date: "2010-01-01", artistName: "Test Band", songs: ["Song One"] },
        { date: "2011-01-01", artistName: "Test Band", songs: ["Song Two"] },
        { date: "2012-01-01", artistName: "Test Band", songs: ["Song Three"] },
      ])
    );

    const findings = detectMostWitnessedAlbum(concerts, setlists, songAlbums, {});
    expect(findings).toHaveLength(1);
    const dp = findings[0].dataPoints as Record<string, unknown>;
    // All three songs found — two of them from nights "Test Band" only opened.
    expect(dp.distinctSongsWitnessed).toBe(3);
    expect(dp.showsSpanned).toBe(3);
    expect(dp.artist).toBe("Test Band");
  });
});
