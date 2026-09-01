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

import { describe, it, expect, vi } from "vitest";
import { checkSocial } from "../../scripts/liner-notes/voice-check.ts";
import { validateSocialShape, generateSocial } from "../../scripts/liner-notes/social.ts";
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

  // ── derived-copy against the prose ─────────────────────────────────────
  //
  // Every case below is real. The guard compared the hook to the HEADLINE and
  // nothing else, so copy chopped out of the paragraph was structurally
  // invisible to it — which is the one failure the social module exists to
  // prevent. Measured on the 58 published notes: 24 of 388 fields carry a run
  // of 8+ words once names are masked out.

  const ZIGGY_PROSE =
    "One show in 36 years of concert-going — just Ziggy Marley, Mesa Amphitheatre, " +
    "September 1988, and then nothing. That single 1988 date sits in the archive like " +
    "a polaroid found in a jacket pocket — vivid, a little mysterious, and making me " +
    "wonder how I let 36 years slip by without a second show.";

  it("rejects a caption paraphrased out of the prose", () => {
    const issues = checkSocial({
      ...clean,
      caption:
        "That 1988 night sits in the archive like a polaroid found in a jacket pocket — " +
        "vivid and a little mysterious.",
      prose: ZIGGY_PROSE,
      entities: ["Ziggy Marley", "Mesa Amphitheatre", "Mesa"],
      years: [1988],
    });
    expect(errors(issues)).toContain("derived-copy");
  });

  it("does not punish a beat for naming the bill", () => {
    // 🔴 THE REASON NAMES ARE MASKED. You cannot paraphrase a band, and this
    // beat shares nine words with the prose entirely because of who played.
    // Without the mask it is indistinguishable from a lift.
    const prose =
      "I saw Bad Religion with Against Me, The Bronx and Polar Bear at the Hollywood " +
      "Palladium, and the room never once stopped moving.";
    const issues = checkSocial({
      hook: "Four bands, one room, and nowhere to stand still.",
      caption: "I went for the headliner. I stayed because the openers refused to be a warm-up.",
      beats: ["The bill was Bad Religion with Against Me, The Bronx and Polar Bear."],
      prose,
      entities: ["Bad Religion", "Against Me", "The Bronx", "Polar Bear", "Hollywood Palladium"],
      years: [2013],
    });
    expect(errors(issues)).not.toContain("derived-copy");
  });

  it("allows copy that shares only short phrases with the prose", () => {
    expect(
      errors(checkSocial({ ...clean, prose: ZIGGY_PROSE, entities: ["Ziggy Marley"], years: [1988] }))
    ).not.toContain("derived-copy");
  });

  // ── perishable-count ───────────────────────────────────────────────────
  //
  // Every "N years" in the rare-sighting notes was frozen at 2024: Ziggy Marley
  // (1988) claimed 36, Run-D.M.C. (1987) 37, Blancmange and The Alarm (1986) 38.
  // All four land on 2024 and it is 2026 — true the day they were authored and
  // wrong every day since, under the owner's name.

  it("rejects a year count that can only be measured to today", () => {
    const issues = checkSocial({
      ...clean,
      hook: "One show in 36 years, and I still haven't figured out how that happened.",
      years: [1988],
      temporality: "evergreen",
    });
    expect(errors(issues)).toContain("perishable-claim");
  });

  it("allows a year count that matches a real gap between two shows", () => {
    // "35 years between shows" over 1988-2023 measures two events the archive
    // holds. It was true then, it is true now, and it is true in 2050.
    const issues = checkSocial({
      ...clean,
      caption: "I saw them in 1988 and not again for 35 years. The second night undid the first.",
      years: [1988, 2023],
      temporality: "evergreen",
    });
    expect(errors(issues)).not.toContain("perishable-claim");
  });

  it("exempts a timely post, whose whole premise is the count", () => {
    // On This Day publishes on the one day the number is true. Applying the
    // evergreen rule here would fail every post in that stream.
    const issues = checkSocial({
      ...clean,
      hook: "Forty years ago tonight, and I still know every word.",
      caption: "It has been 40 years since that night. I have not stopped playing the record.",
      years: [1986],
      temporality: "timely",
    });
    expect(errors(issues)).not.toContain("perishable-claim");
  });

  it("does not read an age as a countdown", () => {
    // "I was 15 years old" is a fact about 1986. It never changes.
    const issues = checkSocial({
      ...clean,
      caption: "I was 15 years old and had no defenses against a chorus that size.",
      years: [1986],
      temporality: "evergreen",
    });
    expect(errors(issues)).not.toContain("perishable-claim");
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

describe("generateSocial retries a voice failure", () => {
  // 🔴 THE POINT OF RUNNING THE GUARD INSIDE THE LOOP. Before this, a lift was
  // caught only by the pipeline AFTER the call was paid for: the copy was
  // dropped, the note published, and it went silently ineligible to syndicate.
  // On the published corpus that path would have taken 21 of 58 notes out of
  // the queue without ever asking for a rewrite.
  const PROSE =
    "That single 1988 date sits in the archive like a polaroid found in a jacket " +
    "pocket — vivid, a little mysterious, and I still wonder how I let it stand alone.";

  const reply = (body: object) =>
    ({ content: [{ type: "text", text: JSON.stringify(body) }] }) as never;

  const LIFTED = {
    hook: "One night that never got a second.",
    caption: "That 1988 date sits in the archive like a polaroid found in a jacket pocket.",
    beats: ["One show.", "One date.", "No second night."],
  };
  const CLEAN = {
    hook: "I bought one ticket and never got round to the second.",
    caption: "I meant to go back. Thirty-odd records later I still have not managed it.",
    beats: ["I went once.", "I meant to go again.", "I never did."],
  };

  it("feeds the lift back and keeps the rewrite", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(reply(LIFTED))
      .mockResolvedValueOnce(reply(CLEAN));

    const out = await generateSocial(
      [
        {
          post: {
            slug: "ziggy",
            headline: "Ziggy Marley: Caught Once, Never Again",
            category: "deep-cut",
            prose: PROSE,
            temporality: "evergreen",
          },
          context: {
            artists: ["Ziggy Marley"],
            venue: "Mesa Amphitheatre",
            city: "Mesa",
            date: "1988-09-19",
            years: [1988],
          },
        },
      ],
      { client: { create } }
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(out.get("ziggy")?.hook).toBe(CLEAN.hook);

    // The model is told WHAT it lifted, not merely that it failed — a bare
    // "try again" reliably produces the same sentence a second time.
    const second = create.mock.calls[1][0].messages[0].content as string;
    expect(second).toContain("lifted from the prose");
    expect(second).toContain("polaroid");
  });

  it("gives up rather than publishing a lift that survives every attempt", async () => {
    const create = vi.fn().mockResolvedValue(reply(LIFTED));
    const out = await generateSocial(
      [
        {
          post: {
            slug: "ziggy",
            headline: "Ziggy Marley: Caught Once, Never Again",
            category: "deep-cut",
            prose: PROSE,
            temporality: "evergreen",
          },
          context: {
            artists: ["Ziggy Marley"],
            venue: "Mesa Amphitheatre",
            city: "Mesa",
            date: "1988-09-19",
            years: [1988],
          },
        },
      ],
      { client: { create } }
    );

    // A missing tweet is not a reason to lose a liner note — the failure is
    // per-post and non-fatal, and the note still publishes without copy.
    expect(out.has("ziggy")).toBe(false);
  });
});
