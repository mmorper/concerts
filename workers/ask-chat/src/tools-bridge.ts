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

// The genuinely-upcoming shows (date strictly after `today`). Haiku can't reliably compare dates
// (it treats same-month shows as "upcoming"), so instead of asking it to do the math we hand it
// the short, explicit list of future shows and tell it everything else is past. Deterministic.
export async function getUpcomingShows(env: Env, today: string): Promise<string[]> {
  const data = await getConcerts(asReused(env), bgCtx);
  if (!data) return [];
  return data.concerts
    .filter((c) => c.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => `${c.headliner} at ${c.venue} (${c.date})`);
}

// Haiku can't reliably judge past-vs-upcoming from dates, so we hand it the verdict inline in the
// tool result (right next to the dates it's reading) — far more reliable than asking it to infer.
function timingNote(shows: { date: string }[], today: string): string {
  const upcoming = shows.filter((c) => c.date > today);
  if (!upcoming.length) return "\n\n(Timing — authoritative, do not re-judge: every show above has ALREADY HAPPENED.)";
  return `\n\n(Timing — authoritative, do not re-judge: of the shows above, only ${upcoming
    .map((c) => c.date)
    .join(", ")} ${upcoming.length === 1 ? "is" : "are"} still UPCOMING; every other show has ALREADY HAPPENED.)`;
}
const todayISO = () => new Date().toISOString().slice(0, 10);

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
        limit: num(input.limit) ?? 25, // chat list-exhibit wants the full set; MCP default stays 10
      } as Parameters<typeof searchConcerts>[1]);
      if (!matches.length) return { text }; // plain ("nothing matching")
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const m = num(input.month);
      const monthName = m && m >= 1 && m <= 12 ? MONTHS[m - 1] : undefined;
      const filters = [input.artist, input.genre, input.city, monthName, input.year, input.decade].filter(Boolean).map(str);
      const title = `${matches.length} ${matches.length === 1 ? "concert" : "concerts"}${filters.length ? ` · ${filters.join(", ")}` : ""}`;
      return { text: text + timingNote(matches, todayISO()), exhibit: { kind: "list", title, rows: matches.map(concertRow) } };
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
      let text = artistHistory(data.concerts, query, meta ?? {}, tracks ?? {}, narration);

      let exhibit: Exhibit | undefined;
      if (r.kind === "match") {
        exhibit = { kind: "artist", entity: "artist", slug: r.slug, name: r.name, deepLink: artistDeepLink(r.slug) };
        text += timingNote(data.concerts.filter((c) => c.headlinerNormalized === r.slug), todayISO());
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
      let text = venueHistory(venues, data.concerts, query, narration);

      let exhibit: Exhibit | undefined;
      if (r.kind === "match") {
        const v = r.venue;
        exhibit = { kind: "venue", entity: "venue", slug: v.normalizedName, name: v.name, deepLink: venueDeepLink(v.normalizedName) };
        text += timingNote(data.concerts.filter((c) => c.venueNormalized === v.normalizedName), todayISO());
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
      return { text: text + timingNote(matches, todayISO()), exhibit: { kind: "list", title: `On this day · ${matches.length} ${matches.length === 1 ? "show" : "shows"}`, rows: matches.map(concertRow) } };
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

// ---------------------------------------------------------------------------------------------
// Deterministic ("no-LLM") path — the kill switch's middle tier (`ask:mode = deterministic-only`).
// When the LLM agent loop is suppressed during an incident, we still answer from the cheap tools:
// route the question to ONE tool by keyword + a substring scan over the known artist/venue
// vocabulary (safe — an exact-substring hit can't mismatch the way a fuzzy guess could), then show
// the tool's own grounded answer + the rich exhibit card. No Anthropic call, no spend.
// ---------------------------------------------------------------------------------------------

const DECADES: Array<[RegExp, string]> = [
  [/\b(1980s|'80s|80s)\b/, "1980s"],
  [/\b(1990s|'90s|90s)\b/, "1990s"],
  [/\b(2000s|'00s|00s)\b/, "2000s"],
  [/\b(2010s|'10s|10s)\b/, "2010s"],
  [/\b(2020s|'20s|20s)\b/, "2020s"],
];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The longest known name that appears in the question as a whole token-run (word-bounded so a
// 2-char name like "U2" can't match mid-word). Returns the display name, or null.
function longestNameInText(q: string, names: Iterable<string>): string | null {
  let best: string | null = null;
  for (const name of names) {
    const lc = name.toLowerCase();
    if (lc.length < 2) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(lc)}([^a-z0-9]|$)`);
    if (re.test(q) && (!best || lc.length > best.length)) best = name;
  }
  return best;
}

// Choose the single best tool for a question without an LLM. Order: explicit intents → known
// entity (artist, then venue) → year/decade → archive overview as the graceful fallback.
export async function pickDeterministicTool(env: Env, question: string): Promise<{ name: string; input: Input }> {
  const q = question.toLowerCase();
  if (/\b(surprise|random|pick (one|something|a show))\b/.test(q)) return { name: "surprise_me", input: {} };
  if (/\b(top songs|most[ -]played|songs (you'?ve |i'?ve )?heard most)\b/.test(q)) return { name: "get_archive_top_songs", input: {} };
  if (/\bon this day\b|\btoday\b/.test(q)) return { name: "on_this_day", input: {} };

  const e = asReused(env);
  const data = await getConcerts(e, bgCtx);
  if (data) {
    const artist = longestNameInText(q, new Set(data.concerts.map((c) => c.headliner)));
    if (artist) return { name: "get_artist_history", input: { artist } };
  }
  const venues = await getVenuesMetadata(e, bgCtx);
  if (venues) {
    const venue = longestNameInText(q, Object.values(venues).map((v) => v.name));
    if (venue) return { name: "get_venue_history", input: { venue } };
  }

  const year = q.match(/\b(19[89]\d|20[0-4]\d)\b/);
  if (year) return { name: "search_concerts", input: { year: Number(year[1]) } };
  for (const [re, decade] of DECADES) if (re.test(q)) return { name: "search_concerts", input: { decade } };

  return { name: "get_archive_info", input: {} };
}

// Strip the model-only scaffolding from a tool's markdown so the raw text reads as a direct
// answer to a person: the "Open on the site" footer (the frontend renders its own nav), the
// authoritative timing note (an instruction to the model), inline deep-links (→ their label),
// and the bracketed concert-id tags.
export function readerProse(raw: string): string {
  let t = raw;
  const cut = t.indexOf("\n\n---\n**Open on the site:");
  if (cut !== -1) t = t.slice(0, cut);
  t = t.replace(/\n\n\(Timing —[\s\S]*$/m, "");
  t = t.replace(/\[([^\]]+)\]\((?:https?:)?\/\/[^)]*\)/g, "$1"); // [label](url) → label
  t = t.replace(/\s*\[[0-9]{4}-[0-9]{2}-[0-9]{2}[^\]]*\]/g, ""); // " [1998-04-27-...]" id tags
  return t.trim();
}
