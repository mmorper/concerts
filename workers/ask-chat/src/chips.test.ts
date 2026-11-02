import { describe, it, expect, beforeAll } from "vitest";
// The real archive, imported as JSON the way the MCP server's query-budget test does. The Worker's
// tsconfig has no Node types, so no fs.
import concerts from "../../../public/data/concerts.json";
import setlists from "../../../public/data/setlists-cache.json";
import albumEras from "../../../public/data/album-eras.json";
import songAlbums from "../../../public/data/song-albums.json";
import artistsMetadata from "../../../public/data/artists-metadata.json";
import artistAliases from "../../../public/data/artist-aliases.json";
import mediaIndex from "../../../public/data/media-index.json";
import venuesMetadata from "../../../public/data/venues-metadata.json";
import topTracks from "../../../public/data/artists-top-tracks.json";
import facts from "../../../public/data/facts.json";
import mostPlayed from "../../../public/data/most-played-songs.json";
import artistNarrations from "../../../public/data/narrations/artists.json";
import venueNarrations from "../../../public/data/narrations/venues.json";
import { CHIP_TOOLS, MAX_CHIPS, SETLIST_FLOOR, offerChips, readChip, type Chip, type ChipData } from "./chips.js";
import { dispatchTool, loadChipData, type ToolResult } from "./tools-bridge.js";
import type { Exhibit } from "./exhibits.js";
import type { Env } from "./types.js";

// Served to the shared data layer through a stand-in for caches.default, already parsed, so
// walking every act, room and night costs lookups, not megabytes of JSON per tool call. A file
// not listed falls through to a fetch that 404s, which the data layer reads as "absent", as it
// would live.
const BASE = "https://test.invalid/data";
const env = { DATA_BASE_URL: BASE } as Env;
const FILES: Record<string, unknown> = {
  "concerts.json": concerts,
  "setlists-cache.json": setlists,
  "album-eras.json": albumEras,
  "song-albums.json": songAlbums,
  "artists-metadata.json": artistsMetadata,
  "artist-aliases.json": artistAliases,
  "media-index.json": mediaIndex,
  "venues-metadata.json": venuesMetadata,
  "artists-top-tracks.json": topTracks,
  "facts.json": facts,
  "most-played-songs.json": mostPlayed,
  "narrations/artists.json": artistNarrations,
  "narrations/venues.json": venueNarrations,
};

beforeAll(() => {
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (req: Request) => {
        const file = req.url.startsWith(`${BASE}/`) ? FILES[req.url.slice(BASE.length + 1)] : undefined;
        return file === undefined ? undefined : { json: async () => file };
      },
      put: async () => {},
    },
  };
  globalThis.fetch = (async () => new Response("not found", { status: 404 })) as typeof fetch;
});

let data: ChipData;
beforeAll(async () => {
  const d = await loadChipData(env);
  if (!d) throw new Error("concerts.json did not load");
  data = d;
});

/** Whether a chip's tool came back with what its label promised. */
function answers(chip: Chip, r: ToolResult): boolean {
  const ex = r.exhibit;
  if (!ex) return false;
  if (chip.tool === "get_media") return ex.kind === "gallery" && ex.items.length > 0;
  if (chip.tool === "get_artist_history") return ex.kind === "artist";
  if (ex.kind !== "show") return false;
  return chip.label === "The setlist" ? ex.songs.length >= SETLIST_FLOOR : true;
}

const past = () => data.concerts.filter((c) => c.date <= data.today);

describe("readChip — a chip off the wire is trusted only as far as its rules", () => {
  it("accepts each tool with its own inputs", () => {
    expect(readChip({ tool: "get_concert_setlist", input: { artist: "The Cure", date: "1986-08-21" } })).toEqual({
      tool: "get_concert_setlist",
      input: { artist: "The Cure", date: "1986-08-21" },
    });
    expect(readChip({ tool: "get_artist_history", input: { artist: "The Cure" } })?.tool).toBe("get_artist_history");
    expect(readChip({ tool: "get_media", input: { venue: "The Forum", kind: "clip" } })?.tool).toBe("get_media");
  });

  it("refuses a tool no chip offers", () => {
    expect(readChip({ tool: "query", input: { q: "anything" } })).toBeNull();
    expect(readChip({ tool: "get_archive_info", input: { x: "1" } })).toBeNull();
  });

  it("refuses an input key the tool doesn't take, a bad date, a bad kind or a non-string", () => {
    expect(readChip({ tool: "get_artist_history", input: { artist: "X", year: "1999" } })).toBeNull();
    expect(readChip({ tool: "get_concert_setlist", input: { artist: "X", date: "21 Aug 1986" } })).toBeNull();
    expect(readChip({ tool: "get_media", input: { artist: "X", kind: "audio" } })).toBeNull();
    expect(readChip({ tool: "get_artist_history", input: { artist: 7 } })).toBeNull();
    expect(readChip({ tool: "get_artist_history", input: { artist: "a\nb" } })).toBeNull();
  });

  it("refuses an empty or missing input, and junk", () => {
    expect(readChip({ tool: "get_artist_history", input: {} })).toBeNull();
    expect(readChip({ tool: "get_artist_history" })).toBeNull();
    expect(readChip("get_artist_history")).toBeNull();
    expect(readChip(undefined)).toBeNull();
  });

  it("names only tools the dispatcher knows", () => {
    for (const t of CHIP_TOOLS) expect(["get_concert_setlist", "get_artist_history", "get_media"]).toContain(t);
  });
});

describe("offerChips — the rules", () => {
  const artist = (name: string, slug: string): Exhibit => ({ kind: "artist", entity: "artist", slug, name, deepLink: `/?scene=artists&artist=${slug}` });

  it("offers an act seen twice or more its first night", () => {
    const chips = offerChips(artist("Depeche Mode", "depeche-mode"), data, ["Depeche Mode"]);
    expect(chips[0]).toMatchObject({ label: "Your first Depeche Mode show", tool: "get_concert_setlist" });
  });

  it("drops a leading The from the label, never from the tool's input", () => {
    const [chip] = offerChips(artist("The Human League", "the-human-league"), data, []);
    expect(chip).toMatchObject({ label: "Your first Human League show", input: { artist: "The Human League" } });
  });

  it("never offers more than two, or one already asked", () => {
    const ex = artist("Depeche Mode", "depeche-mode");
    expect(offerChips(ex, data, []).length).toBeLessThanOrEqual(MAX_CHIPS);
    const again = offerChips(ex, data, ["Depeche Mode", "your first depeche mode show"]);
    expect(again.map((c) => c.label)).not.toContain("Your first Depeche Mode show");
  });

  it("offers nothing on a plain answer, a refusal or a question back", () => {
    expect(offerChips({ kind: "plain" }, data, [])).toEqual([]);
    expect(offerChips({ kind: "refusal" }, data, [])).toEqual([]);
    expect(offerChips({ kind: "disambiguation", entity: "artist", candidates: [] }, data, [])).toEqual([]);
  });

  it("offers a list's setlist only when the list is one night", () => {
    const rows = past().slice(0, 2).map((c) => ({
      concertId: c.id,
      date: c.date,
      artist: { entity: "artist" as const, slug: c.headlinerNormalized, name: c.headliner, deepLink: "" },
      venue: { entity: "venue" as const, slug: c.venueNormalized, name: c.venue, deepLink: "" },
    }));
    expect(offerChips({ kind: "list", title: "two", rows }, data, [])).toEqual([]);
  });
});

// The spec's guard 3: every chip the archive could offer, run for real. An empty answer fails.
describe("every chip offered leads somewhere", () => {
  async function walk(exhibits: Exhibit[]): Promise<{ offered: number; failures: string[] }> {
    let offered = 0;
    const failures: string[] = [];
    for (const ex of exhibits) {
      for (const chip of offerChips(ex, data, [])) {
        offered++;
        const r = await dispatchTool(env, chip.tool, chip.input);
        if (!answers(chip, r)) failures.push(`${ex.kind} → "${chip.label}" ${JSON.stringify(chip.input)} → ${r.exhibit?.kind ?? "no card"}`);
      }
    }
    return { offered, failures };
  }

  it("for every act", async () => {
    const exhibits: Exhibit[] = [];
    for (const name of new Set([...data.concerts.map((c) => c.headliner), ...data.concerts.flatMap((c) => c.openers)])) {
      const r = await dispatchTool(env, "get_artist_history", { artist: name });
      if (r.exhibit?.kind === "artist") exhibits.push(r.exhibit);
    }
    const { offered, failures } = await walk(exhibits);
    expect(failures).toEqual([]);
    expect(offered).toBeGreaterThan(50); // a walk that offers nothing proves nothing
  });

  it("for every venue", async () => {
    const exhibits: Exhibit[] = [];
    for (const name of new Set(data.concerts.map((c) => c.venue))) {
      const r = await dispatchTool(env, "get_venue_history", { venue: name });
      if (r.exhibit?.kind === "venue") exhibits.push(r.exhibit);
    }
    const { offered, failures } = await walk(exhibits);
    expect(failures).toEqual([]);
    expect(offered).toBeGreaterThan(20);
  });

  it("for every night, as a night card, a surprise pick and a one-row list", async () => {
    const exhibits: Exhibit[] = [];
    for (const c of past()) {
      const r = await dispatchTool(env, "get_concert_setlist", { artist: c.headliner, date: c.date });
      if (r.exhibit) exhibits.push(r.exhibit);
      const artist = { entity: "artist" as const, slug: c.headlinerNormalized, name: c.headliner, deepLink: "" };
      exhibits.push({ kind: "serendipity", concertId: c.id, artist });
      exhibits.push({
        kind: "list",
        title: "one",
        rows: [{ concertId: c.id, date: c.date, artist, venue: { entity: "venue", slug: c.venueNormalized, name: c.venue, deepLink: "" } }],
      });
    }
    const { offered, failures } = await walk(exhibits);
    expect(failures).toEqual([]);
    expect(offered).toBeGreaterThan(100);
  });

  it("for the seen-most ranking and every gallery of one night", async () => {
    const exhibits: Exhibit[] = [];
    const info = await dispatchTool(env, "get_archive_info", {});
    if (info.exhibit) exhibits.push(info.exhibit);
    for (const date of new Set(past().map((c) => c.date))) {
      const r = await dispatchTool(env, "get_media", { date });
      if (r.exhibit?.kind === "gallery") exhibits.push(r.exhibit);
    }
    const { failures } = await walk(exhibits);
    expect(failures).toEqual([]);
  });
});
