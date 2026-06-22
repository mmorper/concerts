import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  topTopics,
  spendWindows,
  parseCapUsd,
  gaConfigured,
  gaScalar,
  gaRecord,
  gaTopN,
  pickCounts,
  assembleMcp,
  normalizeName,
  pct,
  computeArchiveHealth,
  type GaReport,
} from "./index.js";

describe("normalizeQuery", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeQuery("  Have you seen DEPECHE Mode?? ")).toBe("have you seen depeche mode");
  });
  it("folds curly apostrophes", () => {
    expect(normalizeQuery("What’s the first concert")).toBe("whats the first concert");
  });
});

describe("topTopics", () => {
  it("clusters normalized variants and ranks by count", () => {
    const out = topTopics(
      [
        { q: "Depeche Mode?", n: 3 },
        { q: "depeche mode", n: 2 },
        { q: "Setlists", n: 4 },
      ],
      10,
    );
    expect(out[0]).toEqual({ term: "depeche mode", n: 5 }); // 3 + 2, clustered
    expect(out[1]).toEqual({ term: "setlists", n: 4 });
  });
  it("respects the limit", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ q: `q${i}`, n: i }));
    expect(topTopics(rows, 5)).toHaveLength(5);
  });
});

describe("spendWindows", () => {
  const now = Date.parse("2026-06-22T12:00:00Z");
  const series = [
    { date: "2026-05-30", costUsd: 1 }, // >30d-ish but inside list
    { date: "2026-06-01", costUsd: 2 }, // month-to-date
    { date: "2026-06-20", costUsd: 3 }, // within 7d
    { date: "2026-06-22", costUsd: 4 }, // today
  ];
  it("sums today / 7d / 30d / month-to-date correctly", () => {
    const w = spendWindows(series, now);
    expect(w.costUsdToday).toBe(4);
    expect(w.costUsd7d).toBe(7); // 06-20 + 06-22
    expect(w.costUsd30d).toBe(10); // all four are within today + 29 prior (>= 05-24)
    expect(w.costUsdMonthToDate).toBe(9); // 06-01 + 06-20 + 06-22
  });

  it("excludes rows older than 30 days (today + 29 prior) from the 30d window", () => {
    // 05-23 is 30 days before 06-22 → just outside the inclusive 30d window (since = 05-24).
    const w = spendWindows([{ date: "2026-05-23", costUsd: 99 }, ...series], now);
    expect(w.costUsd30d).toBe(10); // the 99 is excluded
  });
});

describe("parseCapUsd", () => {
  it("defaults to 25 when unset/empty", () => {
    expect(parseCapUsd(undefined)).toBe(25);
    expect(parseCapUsd("")).toBe(25);
  });
  it("honours a numeric value, including an explicit 0 cap", () => {
    expect(parseCapUsd("50")).toBe(50);
    expect(parseCapUsd("0")).toBe(0);
  });
  it("returns null (no cap) for non-numeric junk rather than coercing", () => {
    expect(parseCapUsd("abc")).toBeNull();
  });
});

// ──────────────────────────── GA helpers (Phase 3) ─────────────────────────────

// Build a GA Data API report from [dimension, metric] tuples for terse fixtures.
const report = (rows: Array<[string, string | number]>): GaReport => ({
  rows: rows.map(([dim, metric]) => ({
    dimensionValues: [{ value: dim }],
    metricValues: [{ value: String(metric) }],
  })),
});

describe("gaConfigured", () => {
  const base = {} as Parameters<typeof gaConfigured>[0];
  it("requires both GA_PROPERTY and GA_SA_KEY_JSON", () => {
    expect(gaConfigured(base)).toBe(false);
    expect(gaConfigured({ ...base, GA_PROPERTY: "123" })).toBe(false);
    expect(gaConfigured({ ...base, GA_SA_KEY_JSON: "{}" })).toBe(false);
    expect(gaConfigured({ ...base, GA_PROPERTY: "123", GA_SA_KEY_JSON: "{}" })).toBe(true);
  });
});

describe("gaScalar", () => {
  it("reads the chosen row's metric as a number (per-date-range totals)", () => {
    // No-dimension multi-date-range report: one row per range, metric only.
    const r: GaReport = {
      rows: [
        { metricValues: [{ value: "1840" }] },
        { metricValues: [{ value: "7620" }] },
        { metricValues: [{ value: "21450" }] },
      ],
    };
    expect(gaScalar(r, 0)).toBe(1840);
    expect(gaScalar(r, 2)).toBe(21450);
  });
  it("returns 0 for missing rows/reports", () => {
    expect(gaScalar(undefined)).toBe(0);
    expect(gaScalar({ rows: [] }, 5)).toBe(0);
  });
});

describe("gaRecord", () => {
  it("folds dimension → metric into a Record, skipping empty keys", () => {
    const r = report([
      ["Organic Search", 3980],
      ["Direct", 2110],
      ["", 99],
    ]);
    expect(gaRecord(r)).toEqual({ "Organic Search": 3980, Direct: 2110 });
  });
  it("sums duplicate keys", () => {
    expect(gaRecord(report([["mobile", 30], ["mobile", 28]]))).toEqual({ mobile: 58 });
  });
});

describe("gaTopN", () => {
  it("maps to {name,n}, drops empty names, sorts desc, and limits", () => {
    const r = report([
      ["The Cure", 244],
      ["", 5],
      ["Depeche Mode", 312],
      ["Morrissey", 141],
    ]);
    expect(gaTopN(r, 2)).toEqual([
      { name: "Depeche Mode", n: 312 },
      { name: "The Cure", n: 244 },
    ]);
  });
});

describe("pickCounts", () => {
  it("keeps only present keys in the requested set", () => {
    const all = { ask_opened: 2210, ask_question_sent: 1604, scene_view: 9 };
    expect(pickCounts(all, ["ask_opened", "ask_question_sent", "ask_refused"])).toEqual({
      ask_opened: 2210,
      ask_question_sent: 1604,
    });
  });
});

// ──────────────────────────── MCP & Ask (Phase 4) ─────────────────────────────

describe("assembleMcp", () => {
  const now = Date.parse("2026-06-22T12:00:00Z");

  it("unions the two planes per day, totals windows, and slices byTool (external-only)", () => {
    const external = [
      { day: "2026-06-22", tool: "query", n: 4 },
      { day: "2026-06-22", tool: "search_concerts", n: 2 },
      { day: "2026-06-20", tool: "query", n: 3 },
    ];
    const spa = [
      { day: "2026-06-22", n: 10 },
      { day: "2026-06-20", n: 5 },
    ];
    const m = assembleMcp(external, spa, [], now, true);

    expect(m.bySource).toEqual({ spa: 15, external: 9 });
    expect(m.externalLive).toBe(true);
    expect(m.queries30d).toBe(24); // 15 spa + 9 external
    expect(m.queries7d).toBe(24); // all four days are within today + 6 prior
    expect(m.byTool).toEqual({ query: 7, search_concerts: 2 }); // external only, summed across days
    // One row per day with both planes folded in, sorted ascending.
    expect(m.series).toEqual([
      { date: "2026-06-20", spa: 5, external: 3 },
      { date: "2026-06-22", spa: 10, external: 6 },
    ]);
  });

  it("renders the in-SPA side alone when external is empty (instrumentation pending)", () => {
    // externalLive=false models the mcp_queries dataset not existing yet (query rejected).
    const m = assembleMcp([], [{ day: "2026-06-22", n: 12 }], [], now, false);
    expect(m.bySource).toEqual({ spa: 12, external: 0 });
    expect(m.externalLive).toBe(false);
    expect(m.byTool).toEqual({});
    expect(m.series).toEqual([{ date: "2026-06-22", spa: 12, external: 0 }]);
  });

  it("marks external live with zero rows (deployed but a quiet window) distinctly from pending", () => {
    // The dataset responded (live) but had no external calls in range — must NOT read as pending.
    const m = assembleMcp([], [{ day: "2026-06-22", n: 12 }], [], now, true);
    expect(m.bySource.external).toBe(0);
    expect(m.externalLive).toBe(true);
  });

  it("excludes rows older than the 30d window (today + 29 prior) from both planes", () => {
    // 2026-05-23 is 30 days before 06-22 → just outside the inclusive window (since = 05-24).
    const m = assembleMcp(
      [{ day: "2026-05-23", tool: "query", n: 99 }],
      [{ day: "2026-05-23", n: 99 }],
      [],
      now,
      true,
    );
    expect(m.bySource).toEqual({ spa: 0, external: 0 });
    expect(m.byTool).toEqual({});
    expect(m.series).toEqual([]);
  });

  it("only counts the last 7 days toward queries7d", () => {
    const m = assembleMcp(
      [{ day: "2026-06-10", tool: "query", n: 5 }], // >7d ago, within 30d
      [{ day: "2026-06-22", n: 3 }], // today
      [],
      now,
      true,
    );
    expect(m.queries7d).toBe(3); // only today's spa turn
    expect(m.queries30d).toBe(8); // both
  });

  it("folds exhibit-kind rows for the outcomes legend", () => {
    const m = assembleMcp([], [], [
      { kind: "artist", n: 856 },
      { kind: "venue", n: 337 },
      { kind: "", n: 9 }, // empty kind dropped
    ], now, true);
    expect(m.askExhibitKinds).toEqual({ artist: 856, venue: 337 });
  });
});

// ──────────────────────────── Archive Health (Phase 5) ─────────────────────────────

describe("normalizeName", () => {
  it("slugifies to the data files' key convention", () => {
    expect(normalizeName("Depeche Mode")).toBe("depeche-mode");
    expect(normalizeName("R.E.M.")).toBe("r-e-m");
    expect(normalizeName("9:30 Club")).toBe("9-30-club");
    expect(normalizeName("  Guns N' Roses  ")).toBe("guns-n-roses");
  });
});

describe("pct", () => {
  it("rounds, and returns 0 for an empty denominator", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(117, 183)).toBe(64);
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 10)).toBe(0);
  });
});

describe("computeArchiveHealth", () => {
  // Two headliners (depeche-mode, the-cure) + one opener-only (some-opener).
  const data = {
    concerts: {
      metadata: { lastUpdated: "2026-06-16T20:18:07.436Z" },
      concerts: [
        { id: "concert-1", date: "1988-01-01", headliner: "Depeche Mode", venue: "The Forum", openers: ["Some Opener"] },
        { id: "concert-2", date: "1989-01-01", headliner: "The Cure", venue: "The Roxy", openers: [] },
        { id: "concert-3", headliner: "The Cure", venue: "The Roxy", openers: [] }, // missing date → invalid
      ],
    },
    "artists-metadata": {
      "depeche-mode": { image: "x", genres: ["synth-pop"] },
      "the-cure": { image: "y", genres: [] }, // photo yes, genre no
      "some-opener": {}, // nothing
    },
    "artists-top-tracks": {
      "depeche-mode": { tracks: [{ previewUrl: "a" }, { previewUrl: "b" }] }, // ≥2
      "the-cure": { tracks: [{ previewUrl: "a" }] }, // <2
    },
    "venues-metadata": {
      "the-forum": { photoUrls: { large: "https://x/forum.jpg" }, location: { lat: 34 } }, // real photo + geo
      "the-roxy": { photoUrls: {}, location: {} }, // no photo, no geo
      "the-greek": { photoUrls: { large: "/images/venues/fallback.jpg" }, location: { lat: 40 } }, // placeholder only
    },
    "setlists-cache": {
      generatedAt: "2026-06-16T20:22:15.975Z",
      entries: [
        { concertId: "concert-1", setlist: { sets: { set: [{ song: [{}, {}] }] } } }, // has songs
        { concertId: "concert-2", setlist: { sets: { set: [{ song: [] }] } } }, // entry, no songs
      ],
    },
    discography: {
      "depeche-mode": { albums: [{ coverUrl: "c" }, { coverUrl: "" }] },
      "the-cure": { albums: [] },
    },
    "liner-notes": {
      generatedAt: "2026-06-16T20:30:00.000Z",
      metadata: { totalPosts: 2, totalGenerated: 5, lastPipelineRun: "2026-06-16T20:31:24.271Z" },
    },
  };

  const h = computeArchiveHealth(data as Parameters<typeof computeArchiveHealth>[0]);
  const byStage = Object.fromEntries(h.stages.map((s) => [s.stage, s]));

  it("counts the artist universe (headliners ∪ openers) and headline entities", () => {
    expect(h.concerts).toBe(3);
    expect(h.artists).toBe(3); // depeche-mode, the-cure, some-opener
    expect(h.venues).toBe(3);
  });

  it("scores concert metadata on required fields", () => {
    expect(byStage["Concert metadata"]).toMatchObject({ covered: 2, total: 3 }); // concert-3 missing date
  });

  it("scores genres with the headliner/opener split in the note", () => {
    expect(byStage["Genres"]).toMatchObject({ covered: 1, total: 3 }); // only depeche-mode has a genre
    expect(byStage["Genres"].note).toBe("headliners 50% · openers 0%");
  });

  it("counts only setlists with ≥1 logged song", () => {
    expect(byStage["Setlists"]).toMatchObject({ covered: 1, total: 3 }); // concert-2's empty set excluded
  });

  it("audio previews require ≥2 preview URLs", () => {
    expect(byStage["Audio previews"]).toMatchObject({ covered: 1, total: 3 });
  });

  it("venue photos exclude placeholders and note geocode share", () => {
    // the-forum has a real photo; the-roxy has none; the-greek has only the fallback placeholder.
    expect(byStage["Venue photos"]).toMatchObject({ covered: 1, total: 3 });
    expect(byStage["Venue photos"].note).toBe("geocoded 67%"); // forum + greek geocoded, roxy not
  });

  it("liner notes use published/analyzed and picks the newest build timestamp", () => {
    expect(byStage["Liner notes"]).toMatchObject({ covered: 2, total: 5 });
    expect(h.lastBuildAt).toBe("2026-06-16T20:31:24.271Z");
  });
});
