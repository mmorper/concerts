/**
 * An ordinal that counts past the archive.
 *
 * Repairing `venue-loyalty-pacific-amphitheatre` from data saying
 * `showCount: 17`, Sonnet 5 returned a payload containing both
 * "1985: Tears For Fears, the first of seventeen nights" and
 * "2026: Nile Rodgers, already on the books, already the eighteenth" —
 * contradicting itself inside one post.
 *
 * Every existing check passed it. `unsourcedYears` matches `(19|20)\d{2}` and
 * saw no year; `WORD_NUMBERS` has never held an ordinal, so as far as the code
 * was concerned that sentence contained no number at all.
 *
 * Ordinals ONLY, and the narrowness is measured rather than chosen — see
 * `assertedOrdinals`. Gating on every distinctive number flags 17 of the 54
 * published notes ("maybe 300 people", a "6,000-seat amphitheater"); gating on
 * ordinals flags none of them and still catches this.
 */

import { describe, it, expect } from "vitest";
import { assertedOrdinals, statedNumbers } from "../../scripts/liner-notes/voice-check.ts";

describe("assertedOrdinals", () => {
  it("reads the ordinal that shipped past every other check", () => {
    expect(assertedOrdinals("2026: Nile Rodgers, already on the books, already the eighteenth."))
      .toEqual([18]);
  });

  it("reads word and digit ordinals alike", () => {
    expect(assertedOrdinals("the eighteenth night")).toEqual([18]);
    expect(assertedOrdinals("the 18th night")).toEqual([18]);
    expect(assertedOrdinals("my 21st show")).toEqual([21]);
  });

  /** Small ordinals are ambient — "the third song" is not a claim about the archive. */
  it("ignores small ordinals", () => {
    expect(assertedOrdinals("somewhere in the third song")).toEqual([]);
  });

  /**
   * The false positives that ruled out a broader gate. All three are real copy
   * from published notes.
   */
  it("does not read cardinals, capacities or comparisons as ordinals", () => {
    expect(assertedOrdinals("The Black Cat in D.C., maybe 300 people")).toEqual([]);
    expect(assertedOrdinals("a 6,000-seat amphitheater in 1985")).toEqual([]);
    expect(assertedOrdinals("the second one was in a room ten times the size")).toEqual([]);
  });
});

describe("statedNumbers", () => {
  it("collects anything the note supplies as backing", () => {
    const known = statedNumbers("Seventeen shows since 1985. Pacific Amphitheatre: 17 Shows Over 5 Decades");
    expect(known).toContain(17);
    expect(known).toContain(1985);
  });

  it("backs a legitimate ordinal and not an invented one", () => {
    const known = new Set(statedNumbers("Seventeen shows since 1985, fifteen artists."));
    expect(assertedOrdinals("the seventeenth night").every((n) => known.has(n))).toBe(true);
    expect(assertedOrdinals("already the eighteenth").every((n) => known.has(n))).toBe(false);
  });
});
