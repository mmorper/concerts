import { describe, it, expect } from "vitest";
import { normalizeQuery, topTopics, spendWindows, parseCapUsd } from "./index.js";

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
