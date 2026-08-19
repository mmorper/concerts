import { describe, it, expect } from "vitest";
import { readerProse, pickDeterministicTool, TOOL_DEFS, TOOL_NAMES } from "./tools-bridge.js";
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

  it("routes recency questions to get_recent_shows", async () => {
    expect((await pickDeterministicTool(env, "who are the last three artists I have seen play?")).name).toBe("get_recent_shows");
    expect((await pickDeterministicTool(env, "what's the most recent concert you've been to?")).name).toBe("get_recent_shows");
    expect((await pickDeterministicTool(env, "my latest shows")).name).toBe("get_recent_shows");
  });
});

// v5.4's album-cycle join shipped on the MCP server and never reached this surface. These
// pin the wiring: the scene must offer the same questions the connector does.
describe("tool parity with the MCP server — album-cycle join", () => {
  const byName = (n: string) => TOOL_DEFS.find((t) => t.name === n);

  it("offers get_career_position", () => {
    const t = byName("get_career_position");
    expect(t).toBeDefined();
    expect(Object.keys(t!.input_schema.properties)).toEqual(["artist", "date", "concertId"]);
  });

  it("offers get_career_shape", () => {
    expect(byName("get_career_shape")).toBeDefined();
  });

  it("accepts cycleBucket on search_concerts, with the same enum the server uses", () => {
    const search = byName("search_concerts");
    const bucket = (search!.input_schema.properties as Record<string, { enum?: string[] }>).cycleBucket;
    expect(bucket?.enum).toEqual(["fresh", "current", "mature", "deep", "catalog"]);
  });

  it("declares no duplicate tool names", () => {
    // A duplicate silently shadows in dispatchTool's switch and the Anthropic tools array,
    // and the symptom is a tool that quietly stops being reachable.
    expect(TOOL_NAMES).toEqual([...new Set(TOOL_NAMES)]);
  });

  it("gives every new tool a description that says when to reach for it", () => {
    // These two overlap in subject and differ only in scope; a model picks between them
    // on the description alone, so the one-artist vs whole-archive split has to be in there.
    expect(byName("get_career_position")!.description).toMatch(/night I saw them/i);
    expect(byName("get_career_shape")!.description).toMatch(/whole archive/i);
  });
});
