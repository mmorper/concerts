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
import type { Exhibit, EntityRef } from "./exhibits.js";
import { artistDeepLink, venueDeepLink } from "./exhibits.js";

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
        month: { type: "integer", minimum: 1, maximum: 12, description: "Calendar month across all years, e.g. 6 for every June show." },
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

// A tool result: the markdown the model reads (grounding) + an OPTIONAL structured exhibit
// descriptor the frontend renders (#140). Most numbers/atoms are hydrated client-side from the
// SPA's local data, so the descriptor carries only identity + selection (see exhibits.ts).
export interface ToolResult {
  text: string;
  exhibit?: Exhibit;
}

// Build an EntityRef for an artist, resolving the display name to its data-layer slug. Returns
// null if the name doesn't resolve to a single artist (so disambiguation candidates stay clean).
function artistRef(concerts: Parameters<typeof resolveArtist>[0], name: string): EntityRef | null {
  const r = resolveArtist(concerts, name);
  if (r.kind !== "match") return null;
  return { entity: "artist", slug: r.slug, name: r.name, deepLink: artistDeepLink(r.slug) };
}

function venueRef(venues: Parameters<typeof resolveVenue>[0], name: string): EntityRef | null {
  const r = resolveVenue(venues, name);
  if (r.kind !== "match") return null;
  const v = r.venue;
  return { entity: "venue", slug: v.normalizedName, name: v.name, deepLink: venueDeepLink(v.normalizedName) };
}

// A concert carries its own slugs, so a list row needs no resolver — just shape it.
type ConcertLike = {
  id: string;
  date: string;
  headliner: string;
  headlinerNormalized: string;
  venue: string;
  venueNormalized: string;
};
function concertRow(c: ConcertLike) {
  return {
    concertId: c.id,
    date: c.date,
    artist: { entity: "artist" as const, slug: c.headlinerNormalized, name: c.headliner, deepLink: artistDeepLink(c.headlinerNormalized) },
    venue: { entity: "venue" as const, slug: c.venueNormalized, name: c.venue, deepLink: venueDeepLink(c.venueNormalized) },
  };
}

// Dispatch a single tool_use to the reused pure fn. Returns the markdown for the model plus, when
// the tool resolved to something entity-shaped, a structured exhibit descriptor. Throwing is fine
// — the loop catches and feeds an error tool_result back to the model.
export async function dispatchTool(env: Env, name: string, input: Input): Promise<ToolResult> {
  const e = asReused(env);

  switch (name) {
    case "get_archive_info": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const facts = await getFacts(e, bgCtx);
      return { text: archiveInfo(data.concerts, facts) }; // plain
    }

    case "search_concerts": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const { text, matches } = searchConcerts(data.concerts, {
        artist: input.artist ? str(input.artist) : undefined,
        year: num(input.year),
        month: num(input.month),
        decade: input.decade ? str(input.decade) : undefined,
        city: input.city ? str(input.city) : undefined,
        genre: input.genre ? str(input.genre) : undefined,
        limit: num(input.limit),
      } as Parameters<typeof searchConcerts>[1]);
      if (!matches.length) return { text }; // plain ("nothing matching")
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const m = num(input.month);
      const monthName = m && m >= 1 && m <= 12 ? MONTHS[m - 1] : undefined;
      const filters = [input.artist, input.genre, input.city, monthName, input.year, input.decade].filter(Boolean).map(str);
      const title = `${matches.length} ${matches.length === 1 ? "concert" : "concerts"}${filters.length ? ` · ${filters.join(", ")}` : ""}`;
      return { text, exhibit: { kind: "list", title, rows: matches.map(concertRow) } };
    }

    case "get_artist_history": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const query = str(input.artist);
      const [meta, tracks] = await Promise.all([
        getArtistsMetadata(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      const r = resolveArtist(data.concerts, query);
      const narration = r.kind === "match" ? await getNarration("artists", r.slug, e, bgCtx) : null;
      const text = artistHistory(data.concerts, query, meta ?? {}, tracks ?? {}, narration);

      let exhibit: Exhibit | undefined;
      if (r.kind === "match") {
        exhibit = { kind: "artist", entity: "artist", slug: r.slug, name: r.name, deepLink: artistDeepLink(r.slug) };
      } else if (r.kind === "ambiguous") {
        const candidates = r.options.map((o) => artistRef(data.concerts, o)).filter((x): x is EntityRef => x !== null);
        if (candidates.length) exhibit = { kind: "disambiguation", entity: "artist", candidates };
      }
      return { text, exhibit };
    }

    case "get_venue_history": {
      const [data, venues] = await Promise.all([getConcerts(e, bgCtx), getVenuesMetadata(e, bgCtx)]);
      if (!data || !venues) return { text: DATA_UNAVAILABLE };
      const query = str(input.venue);
      const r = resolveVenue(venues, query);
      const narration =
        r.kind === "match" ? await getNarration("venues", r.venue.normalizedName, e, bgCtx) : null;
      const text = venueHistory(venues, data.concerts, query, narration);

      let exhibit: Exhibit | undefined;
      if (r.kind === "match") {
        const v = r.venue;
        exhibit = { kind: "venue", entity: "venue", slug: v.normalizedName, name: v.name, deepLink: venueDeepLink(v.normalizedName) };
      } else if (r.kind === "ambiguous") {
        const candidates = r.options.map((o) => venueRef(venues, o)).filter((x): x is EntityRef => x !== null);
        if (candidates.length) exhibit = { kind: "disambiguation", entity: "venue", candidates };
      }
      return { text, exhibit };
    }

    case "on_this_day": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const now = new Date();
      const month = num(input.month) ?? now.getUTCMonth() + 1;
      const day = num(input.day) ?? now.getUTCDate();
      const { text, matches } = onThisDay(data.concerts, month, day);
      if (!matches.length) return { text }; // plain ("a quiet date")
      return { text, exhibit: { kind: "list", title: `On this day · ${matches.length} ${matches.length === 1 ? "show" : "shows"}`, rows: matches.map(concertRow) } };
    }

    case "surprise_me": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const [setlists, meta, tracks] = await Promise.all([
        getSetlistsCache(e, bgCtx),
        getArtistsMetadata(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      const pick = (n: number) => Math.floor(Math.random() * n);
      const r = surpriseMe(data.concerts, pick, setlists, meta ?? {}, tracks ?? {});
      const c = r.concert;
      const exhibit: Exhibit = {
        kind: "serendipity",
        concertId: c.id,
        artist: { entity: "artist", slug: c.headlinerNormalized, name: c.headliner, deepLink: artistDeepLink(c.headlinerNormalized) },
      };
      return { text: r.text, exhibit };
    }

    case "get_concert_setlist": {
      const data = await getConcerts(e, bgCtx);
      if (!data) return { text: DATA_UNAVAILABLE };
      const [setlists, tracks] = await Promise.all([
        getSetlistsCache(e, bgCtx),
        getArtistsTopTracks(e, bgCtx),
      ]);
      const text = concertSetlist(
        data.concerts,
        setlists,
        {
          artist: input.artist ? str(input.artist) : undefined,
          date: input.date ? str(input.date) : undefined,
          concertId: input.concertId ? str(input.concertId) : undefined,
        },
        tracks ?? {},
      );
      return { text }; // plain (songs, not an entity card) in v1
    }

    case "get_archive_top_songs": {
      const songs = await getMostPlayedSongs(e, bgCtx);
      if (!songs) return { text: DATA_UNAVAILABLE };
      return { text: archiveTopSongs(songs, num(input.limit)) }; // plain
    }

    default:
      return { text: `Unknown tool: ${name}` };
  }
}
