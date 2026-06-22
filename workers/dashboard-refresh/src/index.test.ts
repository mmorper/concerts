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
