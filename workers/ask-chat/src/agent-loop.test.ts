import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./agent-loop.js";
import { TOOL_DEFS } from "./tools-bridge.js";

describe("system prompt — owner identity", () => {
  const prompt = buildSystemPrompt("2026-08-19", []);

  // "How many times has Mike seen X?" is the phrasing people actually use, in the
  // scene and through the connector alike. Without this the model either says it
  // doesn't know who Mike is, or looks him up as a band.
  it("tells the model that Mike is the archive's own first person", () => {
    expect(prompt).toContain("Mike Morper");
    expect(prompt).toMatch(/"Mike".*mean the same person as your own "I"/s);
  });

  it("routes a question naming Mike to the artist in it", () => {
    expect(prompt).toContain("How many times has Mike seen Depeche Mode?");
    expect(prompt).toMatch(/never look mike up as a performer/i);
  });

  it("keeps the rules it already had", () => {
    expect(prompt).toContain("TODAY'S DATE is 2026-08-19");
    expect(prompt).toContain("GROUNDING");
  });
});

describe("tool definitions — owner identity", () => {
  it("points get_artist_history at the artist, not at Mike", () => {
    const artist = TOOL_DEFS.find((t) => t.name === "get_artist_history");
    expect(artist?.description).toContain('how many times has Mike seen X?');
    expect(artist?.description).toContain("not a performer");
  });
});
