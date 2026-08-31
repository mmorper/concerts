/**
 * The material an anniversary post is written from (#333 follow-up).
 *
 * An On This Day post has no prose behind it. It used to be handed five credit
 * fields and an instruction not to invent anything — the correct instruction,
 * which leaves nothing to say. So all four pending posts wrote about the filing
 * instead of the night: "now 23 years in the archive", "the full entry is on the
 * site", "still in the log", "the entry still stands".
 *
 * The cure is material, not a rule forbidding filler. Every fact below is
 * computed from concerts.json or the setlist cache, so the model chooses among
 * true sentences instead of reaching for boilerplate. That makes the truth of
 * these sentences load-bearing, which is what these assert.
 */
import { describe, it, expect } from "vitest";
import { narrativeFacts, type BuildSources } from "../../scripts/on-this-day/build.ts";
import type { Concert } from "../../src/types/concert.ts";

function concert(over: Partial<Concert> = {}): Concert {
  return {
    id: "c1",
    date: "1985-08-23",
    headliner: "New Order",
    headlinerNormalized: "new-order",
    genre: "New Wave",
    genreNormalized: "new-wave",
    openers: [],
    venue: "Irvine Meadows",
    venueNormalized: "irvine-meadows",
    city: "Irvine",
    state: "California",
    cityState: "Irvine, California",
    reference: "",
    year: Number((over.date ?? "1985-08-23").slice(0, 4)),
    month: 8,
    day: 23,
    dayOfWeek: "Friday",
    decade: "1980s",
    location: { lat: 0, lng: 0 },
    ...over,
  } as Concert;
}

const candidate = (date = "1985-08-23") =>
  ({ shows: [concert({ date })], ages: [41], day: "08-23", publishYear: 2026, score: 22, reasons: [] }) as never;

function sources(concerts: Concert[], setlists?: Map<string, { songs: string[] }>): BuildSources {
  return {
    artistsMetadata: {},
    venuesMetadata: {},
    linerNotes: [],
    concerts,
    setlists,
    datesWithSetlists: new Set(),
  };
}

describe("narrativeFacts", () => {
  it("returns nothing without concerts, rather than guessing", () => {
    expect(narrativeFacts(candidate(), sources([]))).toEqual([]);
  });

  it("says so when this is the only time", () => {
    const facts = narrativeFacts(candidate(), sources([concert()]));
    expect(facts.join(" ")).toContain("ONLY time");
  });

  it("places the night in the artist's run", () => {
    const facts = narrativeFacts(
      candidate(),
      sources([concert(), concert({ id: "c2", date: "2022-10-01" })])
    );
    expect(facts.join(" ")).toContain("2 times; this was number 1");
  });

  // Both branches used to fire on a first show, so the same silence was stated
  // twice — which reads as two facts and is one.
  it("states a gap once, not twice", () => {
    const facts = narrativeFacts(
      candidate(),
      sources([concert(), concert({ id: "c2", date: "2022-10-01" })])
    );
    const mentions = facts.filter((f) => f.includes("37 years"));
    expect(mentions).toHaveLength(1);
  });

  it("names the openers when the archive has them", () => {
    const facts = narrativeFacts(
      candidate(),
      sources([concert({ openers: ["A Certain Ratio", "Abecedarians"] })])
    );
    expect(facts.join(" ")).toContain("A Certain Ratio and Abecedarians opened");
  });

  it("quotes the setlist's ends when there is a real setlist", () => {
    const setlists = new Map([
      ["1985-08-23", { songs: ["State of the Nation", "Sub-culture", "Love Will Tear Us Apart"] }],
    ]);
    const facts = narrativeFacts(candidate(), sources([concert()], setlists));
    expect(facts.join(" ")).toContain('opened with "State of the Nation"');
    expect(facts.join(" ")).toContain('closed with "Love Will Tear Us Apart"');
  });

  // 🔴 A short setlist is MISSING DATA, not a short night. The Smithereens at
  // the Birchmere has one song on file, which produced "opened with X and closed
  // with X" and "1 songs on the setlist" — true of the record, false of the night.
  it("ignores a setlist too short to have two ends", () => {
    const setlists = new Map([["1985-08-23", { songs: ["Behind the Wall of Sleep"] }]]);
    const facts = narrativeFacts(candidate(), sources([concert()], setlists));
    expect(facts.join(" ")).not.toContain("opened with");
    expect(facts.join(" ")).not.toContain("1 songs");
  });
});
