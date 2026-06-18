import { describe, it, expect } from "vitest";
import { readerProse, pickDeterministicTool } from "./tools-bridge.js";
import type { Env } from "./types.js";

// A dummy env is fine for the explicit-intent routes — they return before any data fetch.
const env = {} as Env;

describe("readerProse — strips model-only scaffolding for a human reader", () => {
  it("drops the 'Open on the site' footer", () => {
    const raw = "I've seen the Cure 6 times.\n\n---\n**Open on the site:** [The Cure](https://x/a)";
    expect(readerProse(raw)).toBe("I've seen the Cure 6 times.");
  });

  it("drops the authoritative timing note (an instruction to the model)", () => {
    const raw = "Three shows in June.\n\n(Timing — authoritative, do not re-judge: every show above has ALREADY HAPPENED.)";
    expect(readerProse(raw)).toBe("Three shows in June.");
  });

  it("flattens inline deep-links to their label and removes concert-id tags", () => {
    const raw = "1. April 27, 1998 — [9:30 Club](https://x/v), DC [1998-04-27-the-cure]";
    expect(readerProse(raw)).toBe("1. April 27, 1998 — 9:30 Club, DC");
  });

  it("handles footer + timing together (timing trails the footer)", () => {
    const raw = "Body.\n\n---\n**Open on the site:** [a](https://x/a)\n\n(Timing — authoritative: past.)";
    expect(readerProse(raw)).toBe("Body.");
  });
});

describe("pickDeterministicTool — explicit intents (no LLM, no data fetch)", () => {
  it("routes 'surprise me' to surprise_me", async () => {
    expect((await pickDeterministicTool(env, "surprise me")).name).toBe("surprise_me");
    expect((await pickDeterministicTool(env, "pick one for me")).name).toBe("surprise_me");
  });

  it("routes most-played questions to get_archive_top_songs", async () => {
    expect((await pickDeterministicTool(env, "what are the top songs?")).name).toBe("get_archive_top_songs");
    expect((await pickDeterministicTool(env, "songs you've heard most")).name).toBe("get_archive_top_songs");
  });

  it("routes 'on this day' to on_this_day", async () => {
    expect((await pickDeterministicTool(env, "anything on this day?")).name).toBe("on_this_day");
  });
});
