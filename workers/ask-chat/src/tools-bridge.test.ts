import { describe, it, expect } from "vitest";
import { readerProse, pickDeterministicTool, showExhibit, actsExhibit, noMediaExhibit, RANKED_ACTS, TOOL_DEFS, TOOL_NAMES } from "./tools-bridge.js";
import { EMPTY_ALIAS_INDEX } from "../../mcp-server/src/aliases.js";
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

describe("showExhibit (#593) — a resolved night becomes the night card", () => {
  const sel = {
    concert: { id: "concert-173", date: "2024-08-20", headliner: "Howard Jones", headlinerNormalized: "howard-jones", venue: "YouTube Theatre", venueNormalized: "youtube-theatre" },
    performer: "Howard Jones",
    isOpener: false,
    songs: [
      { title: "New Song", album: { songTitle: "New Song", albumTitle: "Human's Lib", mbid: "hl", releaseDate: "1984-03-17", coverAvailable: true, matchTier: 0 } },
      { title: "Too Shy", coverOf: "Kajagoogoo", album: null },
    ],
    touring: { mbid: "dl", title: "Dialogue", releaseDate: "2022-07-02", coverAvailable: false },
  } as unknown as Parameters<typeof showExhibit>[0];

  it("maps both album shapes to one identity and keeps deep links on the shared builders", () => {
    expect(showExhibit(sel)).toEqual({
      kind: "show",
      concertId: "concert-173",
      date: "2024-08-20",
      headliner: { entity: "artist", slug: "howard-jones", name: "Howard Jones", deepLink: "/?scene=artists&artist=howard-jones" },
      venue: { entity: "venue", slug: "youtube-theatre", name: "YouTube Theatre", deepLink: "/?scene=venues&venue=youtube-theatre" },
      performer: "Howard Jones",
      isOpener: false,
      songs: [
        { title: "New Song", album: { mbid: "hl", title: "Human's Lib", releaseDate: "1984-03-17", coverAvailable: true } },
        { title: "Too Shy", coverOf: "Kajagoogoo", album: null },
      ],
      touring: { mbid: "dl", title: "Dialogue", releaseDate: "2022-07-02", coverAvailable: false },
    });
  });
});

describe("noMediaExhibit — a media question with no media lists the shows instead", () => {
  const show = { id: "concert-30", date: "1987-06-30", headliner: "Oingo Boingo", headlinerNormalized: "oingo-boingo", venue: "Caliente Racetrack", venueNormalized: "caliente-racetrack" };

  it("lists each show under a title that says there is nothing to see", () => {
    expect(noMediaExhibit([show])).toEqual({
      kind: "list",
      title: "No photos or clips · 1 show",
      rows: [
        {
          concertId: "concert-30",
          date: "1987-06-30",
          artist: { entity: "artist", slug: "oingo-boingo", name: "Oingo Boingo", deepLink: "/?scene=artists&artist=oingo-boingo" },
          venue: { entity: "venue", slug: "caliente-racetrack", name: "Caliente Racetrack", deepLink: "/?scene=venues&venue=caliente-racetrack" },
        },
      ],
    });
  });

  it("has no card when the question named no show", () => {
    expect(noMediaExhibit([])).toBeUndefined();
  });
});

describe("actsExhibit — the collection overall becomes the seen-most ranking", () => {
  const night = (date: string, headliner: string, openers: string[] = []) =>
    ({ id: date, date, year: Number(date.slice(0, 4)), headliner, headlinerNormalized: headliner.toLowerCase().replace(/[^a-z0-9]+/g, "-"), openers }) as never;

  it("ranks acts across headlining and opening, with each one's years and link", () => {
    const shows = [night("2003-08-24", "The Human League", ["The English Beat"]), night("2024-01-01", "The English Beat"), night("2010-01-01", "Solo")];
    const ex = actsExhibit(shows, EMPTY_ALIAS_INDEX, "2026-11-02");
    const acts = ex && ex.kind === "acts" ? ex.acts : [];
    expect(acts[0]).toEqual({
      artist: { entity: "artist", slug: "the-english-beat", name: "The English Beat", deepLink: "/?scene=artists&artist=the-english-beat" },
      count: 2,
      headlined: 1,
      firstYear: 2003,
      lastYear: 2024,
    });
  });

  it("leaves out shows that haven't happened, and stops at five", () => {
    const shows = ["A", "B", "C", "D", "E", "F"].map((a, i) => night(`2020-01-0${i + 1}`, a));
    const future = night("2030-01-01", "Future");
    const ex = actsExhibit([...shows, future, future], EMPTY_ALIAS_INDEX, "2026-11-02");
    const slugs = ex && ex.kind === "acts" ? ex.acts.map((a) => a.artist.slug) : [];
    expect(slugs).toHaveLength(RANKED_ACTS);
    expect(slugs).not.toContain("future");
  });

  it("has no card for an empty archive", () => {
    expect(actsExhibit([], EMPTY_ALIAS_INDEX, "2026-11-02")).toBeUndefined();
  });
});
