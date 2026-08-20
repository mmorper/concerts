/**
 * The `query` daily budget, measured against the REAL data files.
 *
 * Unlike every other test in this worker, this one deliberately reads
 * `public/data/*.json` rather than a fixture — a budget guard that runs against a
 * two-concert fixture guards nothing. The archive grows; this is what notices.
 *
 * Context: `query` now ships an album-era projection alongside concerts.json
 * (docs/specs/future/global-query-era-context.md). The decision to do that rested on a
 * cost measurement, and this is that measurement, pinned so it can't quietly stop being
 * true. If one of these fails, the answer is not to loosen the assertion — it is to
 * re-open the spec's open question about raising QUERY_DAILY_TOKEN_CAP.
 */

import { describe, it, expect } from "vitest";
import { projectEras } from "./tools.js";
import { QUERY_DAILY_CALL_CAP, QUERY_DAILY_TOKEN_CAP } from "./types.js";
import concertsData from "../../../public/data/concerts.json";
import eras from "../../../public/data/album-eras.json";

// The ratio this repo's cost estimates use throughout.
const CHARS_PER_TOKEN = 3.6;
const tokens = (s: string) => s.length / CHARS_PER_TOKEN;

// Mirrors runQuery: the model gets `JSON.stringify(data.concerts)` — minified, and the
// array only. Measuring the pretty-printed file on disk overstates it by ~40%.
const concertsTokens = tokens(JSON.stringify(concertsData.concerts));
const projectionTokens = tokens(JSON.stringify(projectEras(eras as never)));

// max_tokens on the Messages call; usage counts input + output against the same ceiling.
const MAX_OUTPUT_TOKENS = 1024;
const perCall = concertsTokens + projectionTokens + MAX_OUTPUT_TOKENS;

describe("query daily budget, against real data", () => {
  it("keeps the era projection a small fraction of the concert payload", () => {
    expect(projectionTokens).toBeLessThan(concertsTokens * 0.25);
  });

  it("still fits a full day of calls under the token cap", () => {
    // The finding that settled the spec: the CALL cap (8) binds before the TOKEN cap, so
    // adding the projection costs zero queries per day. That only holds while a full day
    // of worst-case calls fits under the token ceiling.
    expect(perCall * QUERY_DAILY_CALL_CAP).toBeLessThan(QUERY_DAILY_TOKEN_CAP);
  });

  it("has not eaten so far into the margin that growth goes unnoticed", () => {
    // Adding the projection took the per-call headroom from ~19% to ~3%. That is the real
    // cost of this change, and it is small but finite: the archive cannot grow much before
    // the token cap starts cutting off the last call of the day. Fail while there is still
    // room to act rather than at the moment users start getting refused.
    const budgetPerCall = QUERY_DAILY_TOKEN_CAP / QUERY_DAILY_CALL_CAP;
    expect(
      perCall,
      `per-call ${Math.round(perCall)} tokens vs ${Math.round(budgetPerCall)} budget — ` +
        "the archive has outgrown the query budget. Raise QUERY_DAILY_TOKEN_CAP (see " +
        "docs/specs/future/global-query-era-context.md §Open question) rather than relaxing this.",
    ).toBeLessThan(budgetPerCall);
  });
});
