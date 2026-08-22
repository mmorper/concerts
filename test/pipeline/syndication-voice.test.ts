/**
 * Social voice checks (#329).
 *
 * The syndication ratchet, stated once: a note deleted from the site leaves
 * its social copies standing on servers we do not control. So every rule the
 * prose checks enforce has to hold here too, and the ones about looking
 * machine-generated matter more, because DECISIONS.md §11 measured the cost —
 * 28 of 57 headlines follow one of five detector templates, and a grid of them
 * reads as robotic no matter how it is art-directed.
 */

import { describe, it, expect } from "vitest";
import { checkSocial } from "../../scripts/liner-notes/voice-check.ts";
import { validateSocialShape } from "../../scripts/liner-notes/social.ts";
import { CAPTION_MAX, HOOK_MAX } from "../../scripts/syndication/budgets.ts";

const clean = {
  hook: "Forty years to the day, in the same amphitheatre.",
  caption: "I was seventeen the first time. I have been coming back to this room ever since.",
  headline: "July 31: 40 Years Since The Art of Noise",
};

const errors = (issues: ReturnType<typeof checkSocial>) =>
  issues.filter((i) => i.severity === "error").map((i) => i.rule);

describe("checkSocial", () => {
  it("passes clean copy", () => {
    expect(checkSocial(clean)).toEqual([]);
  });

  it("rejects a hook that restates the headline", () => {
    // Not a style note: the headline templates are what make the grid robotic.
    const issues = checkSocial({ ...clean, hook: "July 31 — 40 years since The Art of Noise!" });
    expect(errors(issues)).toContain("derived-copy");
  });

  it("carries the prose bans through unchanged", () => {
    expect(errors(checkSocial({ ...clean, hook: "A journey through the years." }))).toContain(
      "banned-phrase"
    );
    expect(errors(checkSocial({ ...clean, caption: "They never made another record. I was there." }))).toContain(
      "perishable-claim"
    );
    expect(errors(checkSocial({ ...clean, caption: "Their masterpiece, and I saw it live." }))).toContain(
      "critical-verdict"
    );
    expect(errors(checkSocial({ ...clean, caption: "It peaked at #3 and I was there." }))).toContain(
      "tier-3"
    );
  });

  it("rejects furniture the adapter is supposed to add", () => {
    expect(errors(checkSocial({ ...clean, caption: "I loved it. #NewWave" }))).toContain(
      "social-furniture"
    );
    expect(
      errors(checkSocial({ ...clean, caption: "I loved it. https://concerts.morperhaus.org/x" }))
    ).toContain("social-furniture");
    expect(errors(checkSocial({ ...clean, caption: "I loved it. Link in bio." }))).toContain(
      "social-furniture"
    );
    expect(errors(checkSocial({ ...clean, hook: "Forty years 🎸" }))).toContain("social-furniture");
  });

  it("enforces the measured budgets", () => {
    expect(errors(checkSocial({ ...clean, hook: "x".repeat(HOOK_MAX + 1) }))).toContain("budget");
    expect(errors(checkSocial({ ...clean, caption: "I ".repeat(CAPTION_MAX) }))).toContain("budget");
    expect(errors(checkSocial({ ...clean, beats: ["a", "b"] }))).toContain("budget");
    expect(
      errors(checkSocial({ ...clean, beats: ["a", "b", "x".repeat(HOOK_MAX + 1)] }))
    ).toContain("budget");
  });

  it("counts graphemes, so a combining mark does not cost two", () => {
    const hook = "é".normalize("NFD").repeat(HOOK_MAX);
    expect(hook.length).toBe(HOOK_MAX * 2);
    expect(errors(checkSocial({ ...clean, hook }))).not.toContain("budget");
  });

  it("warns when the caption loses first person, but does not block the hook", () => {
    const issues = checkSocial({ ...clean, caption: "The band played for two hours." });
    expect(issues.map((i) => i.rule)).toContain("person");
    expect(errors(issues)).not.toContain("person");
  });
});

describe("validateSocialShape", () => {
  it("accepts a well-formed response", () => {
    expect(validateSocialShape({ hook: "A hook.", caption: "A caption." })).toEqual([]);
  });

  it("rejects a carousel that Phase 3 could not ship", () => {
    expect(validateSocialShape({ hook: "h", caption: "c", beats: ["a", "b"] })).toEqual([
      "2 beats (want 3–5)",
    ]);
  });

  it("rejects over-budget copy so the retry rewrites rather than truncates", () => {
    const issues = validateSocialShape({ hook: "x".repeat(HOOK_MAX + 5), caption: "c" });
    expect(issues.join()).toMatch(/hook is 125 chars/);
  });
});
