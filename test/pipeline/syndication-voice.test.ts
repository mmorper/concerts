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

// ── The venue is the subject, not furniture ──────────────────────────────────
//
// Measured on the queue before the rule existed: 10 of 10 venue-subject hooks
// named no venue, and every one had written around it — "the same bowl", "one
// room", "one outdoor room", "the same venue". The prompt forbade repeating the
// credit stack, which is right for an artist post and exactly backwards here.
describe("checkSocial — venue-subject posts", () => {
  const IRVINE = { name: "Irvine Meadows", city: "Irvine" };

  it("rejects a hook that writes around the venue", () => {
    const issues = checkSocial({
      hook: "16 shows at one outdoor room, 19 years apart, and none of it was planned.",
      caption: "I first walked into Irvine Meadows in 1984 for Adam Ant, and kept coming back.",
      venue: IRVINE,
    });
    expect(errors(issues)).toContain("venue-unnamed");
  });

  it("rejects a caption that ships without the name", () => {
    const issues = checkSocial({
      hook: "Sixteen nights at Irvine Meadows, none of them planned.",
      caption: "Five shows at the same venue across three decades, and I never planned any of it.",
      venue: IRVINE,
    });
    expect(errors(issues)).toContain("venue-unnamed");
  });

  it("accepts copy that names it in both", () => {
    const issues = checkSocial({
      hook: "Tract housing stands where 16 Irvine Meadows summer nights used to echo.",
      caption: "I saw thirteen artists at Irvine Meadows before it came down. The records outlasted the amphitheatre.",
      venue: IRVINE,
    });
    expect(errors(issues)).not.toContain("venue-unnamed");
  });

  // The best sentence in the corpus calls a room by the name it had that night.
  // A check demanding the current legal name would reject it to accept worse copy.
  it("accepts the name the room had at the time", () => {
    const issues = checkSocial({
      hook: "Five shows at the Forum, 33 years, and the synthesizers still sound like the future.",
      caption: "I first walked into the Forum at 19 for Erasure in 1990. I have been loyal to that room longer than some friendships.",
      venue: { name: "Kia Forum", city: "Inglewood" },
    });
    expect(errors(issues)).not.toContain("venue-unnamed");
  });

  // The word a model reaches for when told not to name the venue is the city,
  // and the city is often IN the venue's name. It must not count.
  it("does not accept the city standing in for the venue", () => {
    const issues = checkSocial({
      hook: "Five artists, almost nothing in common, one room that kept pulling me back.",
      caption: "Six shows at the same Anaheim club across three decades, starting in August 2003.",
      venue: { name: "House of Blues Anaheim", city: "Anaheim" },
    });
    expect(errors(issues).filter((r) => r === "venue-unnamed")).toHaveLength(2);
  });

  it("says nothing about the venue on an ordinary artist post", () => {
    // No `venue` passed — the anti-repetition rule is the correct one there, and
    // this check must not quietly invert it for every post in the archive.
    expect(errors(checkSocial(clean))).not.toContain("venue-unnamed");
  });
});

describe("checkSocial — the caption borrowing the hook's device", () => {
  it("flags a reused image as a warning, never an error", () => {
    const issues = checkSocial({
      hook: "Five shows. Sixteen years. I didn't know it was a pattern until I found the stubs.",
      caption: "Howard Jones to Tears for Fears, and I never planned any of it. The ticket stubs told me the story before I did.",
    });
    expect(issues.map((i) => i.rule)).toContain("hook-echo");
    expect(errors(issues)).not.toContain("hook-echo");
  });

  it("leaves the prompt's own worked GOOD example alone", () => {
    // hook and caption here share "years" and a proper noun, which is what the
    // caption is FOR. A check that fires on this is measuring vocabulary, not echo.
    const issues = checkSocial({
      hook: "39 years between ticket stubs, same song, same authority",
      caption:
        "Duran Duran wrote 'Notorious'; Nile Rodgers produced it. I heard them play it at Irvine Meadows in 1987, then watched him take it back thirty-nine years later.",
    });
    expect(issues.map((i) => i.rule)).not.toContain("hook-echo");
  });
});

describe("checkSocial — one framing per post", () => {
  it("flags calendar decades against elapsed years", () => {
    // Both numbers are true. 1988, 1997 and 2004 touch three calendar decades
    // and span sixteen years — and a reader gets both in two seconds and
    // concludes nobody read it back.
    const issues = checkSocial({
      headline: "Universal Amphitheater: 5 Shows Over 3 Decades",
      hook: "Five shows. Sixteen years. I didn't know it was a pattern.",
      caption: "Howard Jones to Tears for Fears at Universal Amphitheater, and I never planned it.",
    });
    expect(issues.map((i) => i.rule)).toContain("mixed-framing");
  });

  it("does not read 'thirty-nine years' as a nine-year span", () => {
    // The regex artefact that made half the first run's findings imaginary.
    const issues = checkSocial({
      headline: "Howard Jones: 39 Years of Shows",
      hook: "Six shows. Thirty-nine years. The same keyboard melodies.",
      caption: "I first saw Howard Jones in 1985 and came back five more times over thirty-nine years.",
    });
    expect(issues.map((i) => i.rule)).not.toContain("mixed-framing");
  });
});

// ── A year the archive does not record ───────────────────────────────────────
//
// The worst thing this pipeline can produce, per its own prompt: a number that
// sounds right and is wrong. Measured — asked three times for copy about
// Universal Amphitheater, the model wrote "demolished in 2013" every time. That
// is true of Gibson Amphitheatre and false of this archive, which records no
// such year anywhere in the note, the headline or the credit.
describe("checkSocial — unsourced years", () => {
  const source = "I first walked into Universal Amphitheater in 1989 for Howard Jones. 2005-11-23";

  it("rejects a year that appears nowhere in the post's data", () => {
    const issues = checkSocial({
      hook: "Universal Amphitheater was demolished in 2013. I didn't notice until 2024.",
      caption: "Five shows there across 16 years, and I never planned any of them.",
      sourceText: source,
    });
    expect(errors(issues)).toContain("unsourced-year");
  });

  it("accepts years the post actually records", () => {
    const issues = checkSocial({
      hook: "Universal Amphitheater is gone now. I didn't notice until I counted the stubs.",
      caption: "Howard Jones in 1989, Tears for Fears in 2005, and three more in between.",
      sourceText: source,
    });
    expect(errors(issues)).not.toContain("unsourced-year");
  });

  it("says nothing when no source text is supplied", () => {
    // An On This Day post has no prose to check against. Silence, never a guess.
    expect(errors(checkSocial({ hook: "Forty years ago in 1986.", caption: "I was there." })))
      .not.toContain("unsourced-year");
  });
});
