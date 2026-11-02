import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./agent-loop.js";
import { TOOL_DEFS } from "./tools-bridge.js";
import { MEDIA_NOTE_LABEL } from "../../mcp-server/src/media.js";

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

describe("system prompt — photos and clips", () => {
  const prompt = buildSystemPrompt("2026-08-19", []);

  it("names the line the tools carry, so a missing line can mean no media", () => {
    expect(prompt).toContain(`"${MEDIA_NOTE_LABEL}" line`);
    expect(prompt).toMatch(/no such line, I have no photos or clips/);
  });

  it("keeps absence from reading as the show not happening", () => {
    expect(prompt).toContain("never imply the show didn't happen");
  });

  it("forbids describing what it cannot see", () => {
    expect(prompt).toContain("You cannot see any photo or clip");
    expect(prompt).toContain("never \"them tearing through");
  });

  it("keeps media on the nights the line names", () => {
    expect(prompt).toContain("Never say it's spread across an artist's shows");
    expect(prompt).toContain("never guess who is in a clip");
  });

  it("sends any question about seeing media to get_media", () => {
    expect(prompt).toContain("goes to get_media");
  });
});

describe("system prompt — style", () => {
  const prompt = buildSystemPrompt("2026-08-19", []);

  // The site sets the opening in large Playfair, and steps it down past 200 characters
  // (src/components/ask/prose.ts, LEDE_MAX). The prompt asks for an opening that fits.
  it("asks for a short opening the card sits under", () => {
    expect(prompt).toContain("under 200 characters together");
    expect(prompt).toContain("Never walk through the shows one by one");
  });

  // A side-by-side run dropped the Hollywood Bowl's openers once the reply got short. The
  // cards don't all show openers, so the prompt names them as what the prose should keep.
  it("keeps openers, media and the tool's caveats in the short version", () => {
    expect(prompt).toContain("who opened, the photos and clips line, or a caveat the tool gives");
  });

  it("forbids hype and the tools' closing flourishes", () => {
    expect(prompt).toContain("No praise or hype");
    expect(prompt).toContain("not their closing flourishes");
  });

  it("no longer points at the footer it tells the model to drop", () => {
    expect(prompt).not.toContain("Let the deep-link footer do the navigating");
  });
});

describe("tool definitions — owner identity", () => {
  it("points get_artist_history at the artist, not at Mike", () => {
    const artist = TOOL_DEFS.find((t) => t.name === "get_artist_history");
    expect(artist?.description).toContain('how many times has Mike seen X?');
    expect(artist?.description).toContain("not a performer");
  });
});
