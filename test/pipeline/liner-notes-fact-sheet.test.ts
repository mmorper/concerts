/**
 * Fact sheet builder (#529) — the deterministic half of the claim verifier.
 */

import { describe, it, expect } from "vitest";
import { buildFactSheet, loadOwnerFacts, type FactSheetSources } from "../../scripts/liner-notes/fact-sheet.ts";
import type { Concert } from "../../src/types/concert.ts";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function concert(over: Partial<Concert> & { date: string; headliner: string }): Concert {
  const [y, m, d] = over.date.split("-").map(Number);
  return {
    id: over.id ?? `c-${over.date}-${slug(over.headliner)}`,
    date: over.date,
    year: y,
    month: m,
    day: d,
    dayOfWeek: "Friday",
    decade: `${Math.floor(y / 10) * 10}s`,
    headliner: over.headliner,
    headlinerNormalized: slug(over.headliner),
    openers: over.openers ?? [],
    genre: "Rock",
    genreNormalized: "rock",
    venue: over.venue ?? "The Venue",
    venueNormalized: over.venueNormalized ?? slug(over.venue ?? "The Venue"),
    city: over.city ?? "Los Angeles",
    state: over.state ?? "California",
    cityState: `${over.city ?? "Los Angeles"}, ${over.state ?? "California"}`,
    reference: "",
    location: { lat: 0, lng: 0 },
  } as Concert;
}

const baseSources: FactSheetSources = {
  concerts: [
    concert({ date: "1990-06-01", headliner: "Test Band" }),
    concert({ date: "1999-06-01", headliner: "Someone Else", openers: ["Test Band"] }),
  ],
  venuesMetadata: {},
  today: "2026-09-12",
};

describe("buildFactSheet", () => {
  it("states today's date up front, for stale-relative-time checks", () => {
    const sheet = buildFactSheet({ artists: [], venues: [] }, baseSources);
    expect(sheet).toContain("TODAY IS 2026-09-12.");
  });

  it("lists every show by an artist, headliner and opener slots both", () => {
    const sheet = buildFactSheet({ artists: ["test-band"], venues: [] }, baseSources);
    expect(sheet).toContain("EVERY SHOW BY Test Band (2 total):");
    expect(sheet).toContain("1990-06-01");
    expect(sheet).toContain("1999-06-01");
    expect(sheet).toMatch(/1999-06-01.*opening for Someone Else/);
  });

  it("reports zero shows for an artist with none, rather than omitting the section", () => {
    const sheet = buildFactSheet({ artists: ["nobody"], venues: [] }, baseSources);
    expect(sheet).toContain("EVERY SHOW BY nobody (0 total):");
    expect(sheet).toContain("(none on record)");
  });

  it("names a venue's closure status when the metadata carries one", () => {
    const sources: FactSheetSources = {
      concerts: [concert({ date: "1990-06-01", headliner: "Test Band", venue: "Gone Arena" })],
      venuesMetadata: {
        "gone-arena": { name: "Gone Arena", status: "demolished", closedDate: "2000-01-01", notes: "Torn down." },
      },
    };
    const sheet = buildFactSheet({ artists: [], venues: ["gone-arena"] }, sources);
    expect(sheet).toContain("EVERY SHOW AT Gone Arena (1 total):");
    expect(sheet).toContain("STATUS: demolished (2000-01-01) — Torn down.");
  });

  it("never states a status line for an open venue", () => {
    const sources: FactSheetSources = {
      concerts: [concert({ date: "1990-06-01", headliner: "Test Band", venue: "Open Club" })],
      venuesMetadata: { "open-club": { name: "Open Club", status: "open" } },
    };
    const sheet = buildFactSheet({ artists: [], venues: ["open-club"] }, sources);
    expect(sheet).not.toContain("STATUS:");
  });

  it("always carries the not-in-the-data disclaimer", () => {
    const sheet = buildFactSheet({ artists: [], venues: [] }, baseSources);
    expect(sheet).toContain("NOT IN THE DATA");
    expect(sheet).toContain("birth year or age at any show");
    expect(sheet).toContain("ticket stubs");
  });

  it("includes owner-confirmed facts when present, so the verifier can stop flagging them", () => {
    const sources: FactSheetSources = {
      ...baseSources,
      ownerFacts: { facts: [{ id: "oc-1992", fact: "I lived in Orange County around 1992." }] },
    };
    const sheet = buildFactSheet({ artists: [], venues: [] }, sources);
    expect(sheet).toContain("OWNER-CONFIRMED PERSONAL FACTS");
    expect(sheet).toContain("I lived in Orange County around 1992.");
  });

  it("omits the owner-facts section entirely when there are none", () => {
    // The fixed disclaimer references "OWNER-CONFIRMED PERSONAL FACTS below" by
    // name regardless, so this checks for the SECTION HEADER specifically.
    const sheet = buildFactSheet({ artists: [], venues: [] }, baseSources);
    expect(sheet).not.toContain("OWNER-CONFIRMED PERSONAL FACTS (true, and safe to state as fact):");
  });

  it("summarizes the archive: first show, total, and shows by state", () => {
    const sheet = buildFactSheet({ artists: [], venues: [] }, baseSources);
    expect(sheet).toContain("ARCHIVE SUMMARY:");
    expect(sheet).toContain("First show on record: 1990-06-01");
    expect(sheet).toContain("2 shows total");
  });
});

describe("loadOwnerFacts", () => {
  it("parses a well-formed file", () => {
    const parsed = loadOwnerFacts({ facts: [{ id: "a", fact: "True thing." }] });
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.facts[0].fact).toBe("True thing.");
  });

  it("reads absent or malformed input as empty — never an error", () => {
    expect(loadOwnerFacts(undefined).facts).toEqual([]);
    expect(loadOwnerFacts({}).facts).toEqual([]);
    expect(loadOwnerFacts({ facts: "not an array" }).facts).toEqual([]);
    expect(loadOwnerFacts({ facts: [{ id: "bad" }] }).facts).toEqual([]);
  });
});
