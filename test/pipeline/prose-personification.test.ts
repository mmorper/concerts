/**
 * "🔴 THE ROOM DID NOT DO ANYTHING" — on prose, where it was claimed and absent.
 *
 * #507 shipped this rule as an error in `checkSocial` and its commit message
 * said the same rule stayed a WARNING on prose. It did not: `venuePersonification`
 * was called in exactly one place, and `checkVoice` never referenced it. So social
 * copy saying "the venue kept pulling me back" was rejected and rewritten, while
 * prose saying it shipped — which is exactly what the live Pacific Amphitheatre
 * note does.
 *
 * The severity is the load-bearing part. A `checkVoice` error DROPS the candidate
 * (pipeline Stage 4b), and a targeted `--pick` repair run has no reserve to fall
 * back on, so an error would publish nothing rather than something imperfect.
 * That is the same trap already recorded for `unsourced-number`, whose validator
 * does not retry.
 */

import { describe, it, expect } from "vitest";
import { checkVoice } from "../../scripts/liner-notes/voice-check.ts";
import type { ScoredFinding } from "../../scripts/liner-notes/types.ts";

function finding(prose: string, over: Partial<ScoredFinding> = {}): ScoredFinding {
  return {
    id: "venue-loyalty-pacific-amphitheatre",
    detector: "venue-loyalty",
    category: "personal",
    headline: "Pacific Amphitheatre: 17 Shows Over 5 Decades",
    dataPoints: { venue: "Pacific Amphitheatre", showCount: 17 },
    artists: [], venues: ["pacific-amphitheatre"], years: [1985, 2026],
    tags: [], deepLinks: [], score: 39,
    prose,
    ...over,
  } as unknown as ScoredFinding;
}

const personification = (f: ScoredFinding) =>
  checkVoice(f).filter((i) => i.rule === "venue-personification");

describe("venue personification in prose", () => {
  /**
   * The KNOWN LIMIT, pinned so it is a decision rather than a surprise.
   *
   * This prose is published right now and it personifies the venue — but as
   * "this one amphitheater", which names no venue and is not one of the generic
   * stand-ins. Matching bare demonstratives would fire on ordinary sentences, so
   * the rule does not reach it. Asserted rather than left implicit: if someone
   * later widens the matcher, this test tells them what they changed.
   */
  it("does NOT reach an unnamed demonstrative — the documented gap", () => {
    const prose =
      "I keep coming back to Pacific Amphitheatre, seventeen times now. " +
      "In between, Run-DMC, UB40, the Art of Noise — fifteen artists total, and " +
      "somehow this one amphitheater kept pulling me back for all of them. " +
      "I never once regretted the drive.";
    // Caught via the generic stand-in path? No — "this one amphitheater" names no
    // venue and is not a stand-in, so this documents the KNOWN LIMIT rather than
    // asserting a catch. The named form below is what the rule covers.
    expect(personification(finding(prose))).toHaveLength(0);
  });

  it("flags the venue by name acting on the narrator", () => {
    const issues = personification(
      finding("Pacific Amphitheatre has watched me go from a teenager to whatever I am now.")
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("does not act");
  });

  it("flags a generic stand-in even when no venue is named", () => {
    expect(
      personification(
        finding("It was the venue itself that kept pulling me back.", { dataPoints: {} })
      )
    ).toHaveLength(1);
  });

  /** The severity is the whole point — an error here publishes nothing. */
  it("is a WARNING, never an error", () => {
    const issues = personification(
      finding("Pacific Amphitheatre started teaching me something I still can't name.")
    );
    expect(issues[0].severity).toBe("warning");
    expect(checkVoice(finding("Pacific Amphitheatre has heard me arrive."))
      .some((i) => i.severity === "error" && i.rule === "venue-personification")).toBe(false);
  });

  it("leaves a building doing building things alone", () => {
    for (const prose of [
      "Pacific Amphitheatre held 14 more shows in between, and I went to every one.",
      "Pacific Amphitheatre was my first amphitheater, back when I was sixteen.",
      "I saw Tears For Fears at Pacific Amphitheatre in 1985, and Nile Rodgers in 2026.",
    ]) {
      expect(personification(finding(prose)), prose).toHaveLength(0);
    }
  });
});
