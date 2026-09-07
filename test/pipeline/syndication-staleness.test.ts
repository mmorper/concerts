/**
 * A note that was true when it was written and is not true now.
 *
 * The drip reaches back through the archive oldest-first, so a note can be
 * syndicated months after it was generated. In that gap a show that was
 * FUTURE-DATED in `concerts.json` becomes a past show, and the note's counts
 * quietly stop matching the archive. Nothing else in the pipeline can see it:
 * the prose reads well, the card renders, every voice check passes.
 *
 * The case these tests are built from is real. `venue-loyalty-pacific-amphitheatre`
 * was generated 2026-07-20 as "16 Shows Over 5 Decades". Nile Rodgers played the
 * venue on 2026-07-31 — already in the archive, eleven days in the future. By
 * September the note said 16 where the archive said 17, and its social copy read
 * "The English Beat closed it in 2024" about a venue that had been visited since.
 */

import { describe, it, expect } from "vitest";
import { staleFacts, subjectsOf, CUMULATIVE_DETECTORS } from "../../scripts/syndication/staleness.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

function show(date: string, headliner: string, venue: string, openers: string[] = []): Concert {
  return {
    id: `c-${date}`,
    date,
    headliner,
    headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    openers,
    venue,
    venueNormalized: venue.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    city: "Costa Mesa",
    state: "California",
    year: Number(date.slice(0, 4)),
  } as unknown as Concert;
}

function note(overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    id: "venue-loyalty-pacific-amphitheatre",
    slug: "pacific-amphitheatre-16-shows-over-5-decades",
    detector: "venue-loyalty",
    headline: "Pacific Amphitheatre: 16 Shows Over 5 Decades",
    publishedAt: "2026-07-20T10:55:39.484Z",
    venues: ["pacific-amphitheatre"],
    artists: ["tears-for-fears", "the-english-beat"],
    ...overrides,
  } as unknown as LinerNotesPost;
}

const ARCHIVE = [
  show("1985-07-10", "Tears For Fears", "Pacific Amphitheatre"),
  show("2024-07-26", "The English Beat", "Pacific Amphitheatre"),
  show("2026-07-31", "Nile Rodgers", "Pacific Amphitheatre"),
];

describe("staleFacts", () => {
  it("flags the note once the future-dated show has happened", () => {
    const facts = staleFacts(note(), ARCHIVE, "2026-09-07");
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ subject: "pacific-amphitheatre", kind: "venue" });
    expect(facts[0].since).toEqual(["2026-07-31"]);
  });

  /**
   * The whole mechanism. On the day it was generated the note was correct, and a
   * guard that fired then would be wrong — the show had not happened yet.
   */
  it("does NOT flag while that show is still in the future", () => {
    expect(staleFacts(note(), ARCHIVE, "2026-07-25")).toEqual([]);
  });

  it("does not flag when nothing has happened since publication", () => {
    const quiet = ARCHIVE.filter((c) => c.date < "2026-01-01");
    expect(staleFacts(note(), quiet, "2026-09-07")).toEqual([]);
  });

  /**
   * A venue-loyalty note cross-references every act seen in the room. If the
   * subject were taken from `artists` instead of the post id, any one of those
   * playing anywhere else would suppress a note that is perfectly true.
   */
  it("ignores cross-referenced artists — only the subject counts", () => {
    const elsewhere = [...ARCHIVE.filter((c) => c.date < "2026-01-01"),
      show("2026-08-01", "Tears For Fears", "Hollywood Bowl")];
    expect(staleFacts(note(), elsewhere, "2026-09-07")).toEqual([]);
  });

  it("resolves an artist subject as well as a venue", () => {
    const n = note({
      id: "artist-longevity-depeche-mode",
      detector: "artist-longevity",
      headline: "Depeche Mode: 38 Years of Shows",
      venues: [],
      artists: ["depeche-mode"],
    });
    const archive = [show("1985-06-01", "Depeche Mode", "Irvine Meadows"),
                     show("2026-08-20", "Depeche Mode", "Kia Forum")];
    expect(staleFacts(n, archive, "2026-09-07")[0]).toMatchObject({ kind: "artist" });
  });

  /**
   * The false positive that made the detector gate necessary. A festival-bill
   * note is anchored to one night; the band playing again years later has no
   * bearing on it, and blocking the post would be pure noise.
   */
  it("does not flag a note anchored to a single night", () => {
    const n = note({
      id: "festival-mega-bill-2018-05-12-the-human-league",
      detector: "festival-mega-bill",
      headline: "The Human League + 8 More: 2018 Festival Bill",
      venues: [],
      artists: ["the-human-league"],
    });
    const archive = [show("2018-05-12", "The Human League", "Huntington State Beach"),
                     show("2026-06-04", "The Human League", "Hollywood Bowl")];
    expect(staleFacts(n, archive, "2026-09-07")).toEqual([]);
  });

  it("treats every cumulative detector as falsifiable", () => {
    // The Blancmange case named in `doNotSyndicate`: "Caught Once, Never Again"
    // is true until they play again.
    expect(CUMULATIVE_DETECTORS.has("rare-sighting")).toBe(true);
    expect(CUMULATIVE_DETECTORS.has("venue-loyalty")).toBe(true);
    expect(CUMULATIVE_DETECTORS.has("festival-mega-bill")).toBe(false);
  });

  it("returns nothing when the note has no publication date", () => {
    expect(staleFacts(note({ publishedAt: "" }), ARCHIVE, "2026-09-07")).toEqual([]);
  });
});

describe("subjectsOf", () => {
  it("takes the subject from the post id, not the cross-references", () => {
    expect(subjectsOf(note())).toEqual(["pacific-amphitheatre"]);
  });
});
