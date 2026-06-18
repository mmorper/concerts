// The tool layer for the agent loop. Reuses the MCP server's PURE narration fns + data
// layer verbatim (workers/mcp-server/src/{tools,data}.ts) — numbers come from these
// deterministic fns, the model only writes connective prose, so the archive's voice can't
// invent a stat (spec §"Tool-grounded truth"). The single-shot `query` tool is deliberately
// NOT exposed: the loop replaces it.
//
// v1 returns each tool's existing markdown string as the tool_result. The structured exhibit
// schema (photo/chips/map atoms) is #140 and will layer on top of these same fns.

import {
  archiveInfo,
  searchConcerts,
  artistHistory,
  resolveArtist,
  venueHistory,
  resolveVenue,
  onThisDay,
  surpriseMe,
  concertSetlist,
  archiveTopSongs,
} from "../../mcp-server/src/tools.js";
import {
  getConcerts,
  getFacts,
  getArtistsMetadata,
  getArtistsTopTracks,
  getVenuesMetadata,
  getSetlistsCache,
  getMostPlayedSongs,
  getNarration,
} from "../../mcp-server/src/data.js";
import type { Env } from "./types.js";

// The reused data fns are typed against the MCP worker's Env; they only ever read
// DATA_BASE_URL. One cast at this seam (see types.ts §DataEnv note).
type ReusedEnv = Parameters<typeof getConcerts>[0];
const asReused = (env: Env): ReusedEnv => env as unknown as ReusedEnv;

// Tool callbacks run with no per-request ExecutionContext; the data layer only uses
// ctx.waitUntil to defer a cache write, so a fire-and-forget shim is sufficient (mirrors
// the MCP worker's bgCtx).
const bgCtx = {
  waitUntil: (p: Promise<unknown>) => void Promise.resolve(p).catch(() => {}),
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const DATA_UNAVAILABLE = "My archive data is temporarily unavailable. Try again in a moment.";

// Anthropic tool definitions (JSON Schema). Descriptions are the archive offering each tool,
// matching the MCP server's voice.
export const TOOL_DEFS = [
  {
    name: "get_archive_info",
    description:
      "The front door. A sense of the collection's shape — four decades, the artists and venues that keep coming back, the rhythm of a concert life.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_concerts",
    description: "Search memory by name, by place, by year.",
    input_schema: {
      type: "object",
      properties: {
        artist: { type: "string" },
        year: { type: "integer" },
        decade: { type: "string", enum: ["1980s", "1990s", "2000s", "2010s", "2020s"] },
        city: { type: "string" },
        genre: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_artist_history",
    description: "Everything I remember about an artist — every show, every venue, every year.",
    input_schema: {
      type: "object",
      properties: { artist: { type: "string" } },
      required: ["artist"],
      additionalProperties: false,
    },
  },
  {
    name: "get_venue_history",
    description: "The rooms I've kept returning to — every show at a single venue, in order.",
    input_schema: {
      type: "object",
      properties: { venue: { type: "string" } },
      required: ["venue"],
      additionalProperties: false,
    },
  },
  {
    name: "on_this_day",
    description:
      "Concerts that share a date — across all the years, whatever's happened on this day. Omit month/day for today.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "integer", minimum: 1, maximum: 12 },
        day: { type: "integer", minimum: 1, maximum: 31 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "surprise_me",
    description: "I'll pick one. A random concert, and why it's worth remembering.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_concert_setlist",
    description:
      "The songs from a specific night — give me an artist (and a date if you have one) or a concert id, and I'll tell you what they played, if I have it on record.",
    input_schema: {
      type: "object",
      properties: {
        artist: { type: "string" },
        date: { type: "string" },
        concertId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_archive_top_songs",
    description:
      "The songs I've heard most across every setlist on record — counted honestly from the shows I have setlists for, not the whole archive.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
      additionalProperties: false,
    },
  },
] as const;

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

type Input = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | undefined =>
  typeof v === "number" ? v : v == null ? undefined : Number(v);

// Dispatch a single tool_use to the reused pure fn, returning its markdown string. Throwing
// is fine — the loop catches and feeds an error tool_result back to the model.
export async function dispatchTool(env: Env, name: string, input: Input): Promise<string> {
  const e = asReused(env);

  switch (name) {
    case "get_archive_info": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      const facts = await getFacts(e, bgCtx);
      return archiveInfo(data.concerts, facts);
    }

    case "search_concerts": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      return searchConcerts(data.concerts, {
        artist: input.artist ? str(input.artist) : undefined,
        year: num(input.year),
        decade: input.decade ? str(input.decade) : undefined,
        city: input.city ? str(input.city) : undefined,
        genre: input.genre ? str(input.genre) : undefined,
        limit: num(input.limit),
      } as Parameters<typeof searchConcerts>[1]);
    }

    case "get_artist_history": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      const query = str(input.artist);
      const [meta, tracks] = await Promise.all([
        getArtistsMetadata(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      const r = resolveArtist(data.concerts, query);
      const narration =
        r.kind === "match" ? await getNarration("artists", r.slug, e, bgCtx) : null;
      return artistHistory(data.concerts, query, meta ?? {}, tracks ?? {}, narration);
    }

    case "get_venue_history": {
      const [data, venues] = await Promise.all([
        getConcerts(e, bgCtx),
        getVenuesMetadata(e, bgCtx),
      ]);
      if (!data || !venues) return DATA_UNAVAILABLE;
      const query = str(input.venue);
      const r = resolveVenue(venues, query);
      const narration =
        r.kind === "match"
          ? await getNarration("venues", r.venue.normalizedName, e, bgCtx)
          : null;
      return venueHistory(venues, data.concerts, query, narration);
    }

    case "on_this_day": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      const now = new Date();
      const month = num(input.month) ?? now.getUTCMonth() + 1;
      const day = num(input.day) ?? now.getUTCDate();
      return onThisDay(data.concerts, month, day);
    }

    case "surprise_me": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      const [setlists, meta, tracks] = await Promise.all([
        getSetlistsCache(e, bgCtx),
        getArtistsMetadata(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      const pick = (n: number) => Math.floor(Math.random() * n);
      return surpriseMe(data.concerts, pick, setlists, meta ?? {}, tracks ?? {}).text;
    }

    case "get_concert_setlist": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return DATA_UNAVAILABLE;
      const [setlists, tracks] = await Promise.all([
        getSetlistsCache(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      return concertSetlist(
        data.concerts,
        setlists,
        {
          artist: input.artist ? str(input.artist) : undefined,
          date: input.date ? str(input.date) : undefined,
          concertId: input.concertId ? str(input.concertId) : undefined,
        },
        tracks ?? {},
      );
    }

    case "get_archive_top_songs": {
      const songs = await getMostPlayedSongs(e, bgCtx);
      if (!songs) return DATA_UNAVAILABLE;
      return archiveTopSongs(songs, num(input.limit));
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
