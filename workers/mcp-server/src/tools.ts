// The six Phase-1 tools. Narration is inline and first-person — see
// `.claude/skills/liner-notes-voice/SKILL.md` (the source of truth) and
// docs/specs/future/global-mcp-server.md §"The 6 Tools".
//
// Pure narration functions (archiveInfo, searchConcerts, artistHistory, …) take
// already-loaded data and return text, so tools.test.ts can snapshot them without a
// network. registerTools() is the I/O seam: it fetches via the data layer, then narrates.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  ArtistsMetadata,
  ArtistsTopTracks,
  Concert,
  Env,
  FactsData,
  Narration,
  SetlistsCache,
  VenueMetadata,
  VenuesMetadata,
} from "./types.js";
import {
  getArtistsMetadata,
  getArtistsTopTracks,
  getConcerts,
  getFacts,
  getNarration,
  getSetlistsCache,
  getVenuesMetadata,
  isQueryUsageOverCap,
  readQueryUsage,
  recordQueryUsage,
} from "./data.js";
import QUERY_PROMPT from "../prompts/query.md";

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

// Spec Error Handling §5 — every tool handler runs inside this wrapper. A thrown
// runtime exception is logged (surfaces in `wrangler tail`) and turned into a narrated
// apology rather than bubbling up as a 500.
export function wrapTool(
  name: string,
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>,
): (args: Record<string, unknown>) => Promise<CallToolResult> {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args ?? {});
    } catch (e) {
      console.error(`Tool ${name} threw:`, e);
      return textResult(
        "Something went wrong answering that — try again or ask something else.",
        true,
      );
    }
  };
}

// Spec Error Handling §1 (HTTP failure) + §2 (malformed JSON). cachedJsonFetch collapses
// both to a logged null; tools turn that null into this narrated result instead of a 500.
export function dataUnavailableResult(): CallToolResult {
  return textResult(
    "My archive data is temporarily unavailable. Try again in a moment.",
    true,
  );
}

// Tool callbacks run inside the Durable Object, where there's no per-request
// ExecutionContext. cachedJsonFetch only uses ctx.waitUntil to defer the cache write, so
// a fire-and-forget shim is sufficient — the fetch itself is still awaited.
const bgCtx = {
  waitUntil: (p: Promise<unknown>) => {
    void Promise.resolve(p).catch(() => {});
  },
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

// ---------- formatting helpers ----------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseISO(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

function fullDate(d: string): string {
  const { y, m, day } = parseISO(d);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

function monYear(d: string): string {
  const { y, m } = parseISO(d);
  return `${MONTHS_ABBR[m - 1]} ${y}`;
}

function byDate(a: { date: string }, b: { date: string }): number {
  return a.date.localeCompare(b.date);
}

function joinList(items: string[]): string {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function openerLine(openers: string[], indent: string): string | null {
  if (!openers || openers.length === 0) return null;
  return `${indent}With ${joinList(openers)} opening.`;
}

// ---------- deep links back to the site (#132) ----------
// The Artists and Venues scenes are both generated from the same concerts these tools
// read, so any headlinerNormalized / venueNormalized slug resolves to a real card — no
// lookup needed. URL shape per docs/DEEP_LINKING.md. Markdown renders as a clickable link
// in MCP clients; clients that don't render markdown still show readable text.
//
// Note: the model paraphrases tool output before the user sees it, so SERVER_INSTRUCTIONS
// and the explore_archive prompt tell it to preserve these links (see index.ts).
const SITE_BASE_URL = "https://concerts.morperhaus.org";

function artistLink(name: string, slug: string): string {
  return `[${name}](${SITE_BASE_URL}/?scene=artists&artist=${slug})`;
}

function venueLink(name: string, slug: string): string {
  return `[${name}](${SITE_BASE_URL}/?scene=venues&venue=${slug})`;
}

// Count occurrences keyed by a selector, returned as [label, count] sorted desc.
function tally(concerts: Concert[], key: (c: Concert) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of concerts) {
    const k = key(c);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ===================================================================
// 1. get_archive_info
// ===================================================================

export function archiveInfo(concerts: Concert[], facts: FactsData | null): string {
  const sorted = [...concerts].sort(byDate);
  const total = sorted.length;
  if (total === 0) return "The archive is empty right now.";

  const first = sorted[0];
  const last = sorted[total - 1];
  const venues = new Set(concerts.map((c) => c.venueNormalized)).size;
  const cities = new Set(concerts.map((c) => c.cityState)).size;

  const topArtists = tally(concerts, (c) => c.headliner).slice(0, 5);
  const topVenues = tally(concerts, (c) => c.venue).slice(0, 5);
  const topDecade = tally(concerts, (c) => c.decade)[0];

  // longest gap between consecutive shows
  let maxGap = 0;
  let gapA = first;
  let gapB = sorted[1] ?? first;
  for (let i = 1; i < total; i++) {
    const days = Math.round(
      (Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / 86_400_000,
    );
    if (days > maxGap) {
      maxGap = days;
      gapA = sorted[i - 1];
      gapB = sorted[i];
    }
  }

  // top genre — prefer the pre-computed fact, fall back to computing
  let genreLine = "";
  const genreFact = facts?.facts.find((f) => f.id === "top-genre");
  if (genreFact?.headline.includes(":")) {
    const [g, rest] = genreFact.headline.split(":");
    const num = rest.match(/\d+/)?.[0];
    if (num) genreLine = `More ${g.trim()} than anything else — ${num} shows.`;
  }
  if (!genreLine) {
    const topGenre = tally(
      concerts.filter((c) => c.genre),
      (c) => c.genre,
    )[0];
    if (topGenre) genreLine = `More ${topGenre[0]} than anything else — ${topGenre[1]} shows.`;
  }

  const span = last.year - first.year;
  const fmtCount = ([name, n]: [string, number]) => `${name} (${n})`;

  const lines = [
    `I've been to ${total} concerts across ${span} years, from ${first.year} to ${last.year} — ${venues} venues in ${cities} cities.`,
    "",
    `The artists I've seen most: ${topArtists.map(fmtCount).join(", ")}.`,
    `The rooms I keep returning to: ${topVenues.map(fmtCount).join(", ")}.`,
    `My busiest decade was the ${topDecade[0]}, with ${topDecade[1]} shows.`,
  ];
  if (genreLine) lines.push(genreLine);
  lines.push(
    "",
    `The longest I went without a show was ${maxGap} days, between ${gapA.headliner} in ${monYear(gapA.date)} and ${gapB.headliner} in ${monYear(gapB.date)}.`,
  );
  return lines.join("\n");
}

// ===================================================================
// 2. search_concerts
// ===================================================================

export interface SearchParams {
  artist?: string;
  year?: number;
  decade?: string;
  city?: string;
  genre?: string;
  limit?: number;
}

export function searchConcerts(concerts: Concert[], params: SearchParams): string {
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 25);

  const matches = concerts
    .filter((c) => {
      if (params.artist) {
        const q = params.artist.toLowerCase();
        const inHeadliner = c.headliner.toLowerCase().includes(q);
        const inOpeners = c.openers.some((o) => o.toLowerCase().includes(q));
        if (!inHeadliner && !inOpeners) return false;
      }
      if (params.year && c.year !== params.year) return false;
      if (params.decade && c.decade.toLowerCase() !== params.decade.toLowerCase()) return false;
      if (params.city) {
        const q = params.city.toLowerCase();
        if (!c.city.toLowerCase().includes(q) && !c.cityState.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (params.genre && !c.genre.toLowerCase().includes(params.genre.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort(byDate);

  const bits: string[] = [];
  if (params.artist) bits.push(`"${params.artist}"`);
  if (params.genre) bits.push(params.genre);
  if (params.city) bits.push(params.city);
  if (params.year) bits.push(String(params.year));
  else if (params.decade) bits.push(`the ${params.decade}`);
  const summary = bits.length ? bits.join(", ") : "everything";

  const total = matches.length;
  if (total === 0) {
    return `I don't have anything matching ${summary} in the archive.`;
  }

  const shown = matches.slice(0, limit);
  const lines: string[] = [`${total} ${total === 1 ? "concert" : "concerts"} matching ${summary}:`, ""];
  for (const c of shown) {
    lines.push(
      `${artistLink(c.headliner, c.headlinerNormalized)} — ${venueLink(c.venue, c.venueNormalized)}, ${c.city} (${monYear(c.date)}) [${c.id}]`,
    );
    const opener = openerLine(c.openers, "  ");
    if (opener) lines.push(opener);
  }
  if (total > limit) {
    lines.push("", `That's ${limit} of ${total} — try narrowing the search.`);
  }
  return lines.join("\n");
}

// ===================================================================
// 3. get_artist_history (+ shared artist resolution, Error Handling §4)
// ===================================================================

export type ArtistResolution =
  | { kind: "match"; name: string; slug: string }
  | { kind: "ambiguous"; options: string[] }
  | { kind: "none" };

export function resolveArtist(concerts: Concert[], query: string): ArtistResolution {
  const q = query.trim().toLowerCase();
  const byName = new Map<string, { display: string; slug: string }>();
  for (const c of concerts) {
    const key = c.headliner.toLowerCase();
    if (!byName.has(key)) byName.set(key, { display: c.headliner, slug: c.headlinerNormalized });
  }

  const exact = byName.get(q);
  if (exact) return { kind: "match", name: exact.display, slug: exact.slug };

  const partials = [...byName.entries()].filter(([name]) => name.includes(q));
  if (partials.length === 0) return { kind: "none" };
  if (partials.length === 1) {
    const [, v] = partials[0];
    return { kind: "match", name: v.display, slug: v.slug };
  }

  // Multiple partials. If the shortest is contained in all the others, they're one family
  // (e.g. "Peter Hook" ⊂ "Peter Hook and the Light") — prefer it. Otherwise disambiguate.
  const sorted = [...partials].sort((a, b) => a[0].length - b[0].length);
  const [shortestName, shortestVal] = sorted[0];
  if (sorted.every(([name]) => name.includes(shortestName))) {
    return { kind: "match", name: shortestVal.display, slug: shortestVal.slug };
  }
  return { kind: "ambiguous", options: sorted.map(([, v]) => v.display).sort() };
}

export function artistHistory(
  concerts: Concert[],
  query: string,
  artistsMeta: ArtistsMetadata,
  topTracks: ArtistsTopTracks,
  narration: Narration | null = null,
): string {
  const r = resolveArtist(concerts, query);
  if (r.kind === "none") return `${query.trim()} isn't in the archive.`;
  if (r.kind === "ambiguous") {
    return [
      `I have a few artists matching "${query.trim()}":`,
      ...r.options.map((o) => `- ${o}`),
      "",
      "Which one did you mean?",
    ].join("\n");
  }

  const shows = concerts.filter((c) => c.headliner === r.name).sort(byDate);
  const n = shows.length;
  const firstY = shows[0].year;
  const lastY = shows[n - 1].year;

  let header = `I've seen ${artistLink(r.name, r.slug)} ${n} ${n === 1 ? "time" : "times"}`;
  if (n > 1) header += lastY > firstY ? `, across ${lastY - firstY} years (${firstY}–${lastY})` : `, all in ${firstY}`;
  header += ".";

  const lines = [header];

  const meta = artistsMeta[r.slug];
  const formedGenre: string[] = [];
  if (meta?.formed) formedGenre.push(`Formed ${meta.formed}`);
  if (meta?.genres?.length) formedGenre.push(meta.genres[0]);
  if (formedGenre.length) lines.push(`${formedGenre.join(", ")}.`);

  if (narration?.context) lines.push(narration.context);

  lines.push("");
  shows.forEach((c, i) => {
    lines.push(`${i + 1}. ${fullDate(c.date)} — ${venueLink(c.venue, c.venueNormalized)}, ${c.city} [${c.id}]`);
    const opener = openerLine(c.openers, "   ");
    if (opener) lines.push(opener);
  });

  const tracks = topTracks[r.slug]?.tracks;
  if (tracks?.length) {
    lines.push("", `Known for ${joinList(tracks.slice(0, 2).map((t) => t.name))}.`);
  }

  let arc: string;
  if (narration?.closingArc) arc = narration.closingArc;
  else if (n === 1) arc = `A single show. ${r.name} appears in the archive once.`;
  else if (n <= 4) arc = `Seen ${n} times, ${firstY} to ${lastY}.`;
  else arc = `${r.name} is one of the artists I've seen most — ${n} times over ${lastY - firstY} years.`;
  lines.push("", arc);

  return lines.join("\n");
}

// ===================================================================
// 4. get_venue_history
// ===================================================================

export type VenueResolution =
  | { kind: "match"; venue: VenueMetadata }
  | { kind: "ambiguous"; options: string[] }
  | { kind: "none" };

export function resolveVenue(venues: VenuesMetadata, query: string): VenueResolution {
  const q = query.trim().toLowerCase();
  const entries = Object.values(venues);

  const exact = entries.find((v) => v.name.toLowerCase() === q || v.normalizedName === q);
  if (exact) return { kind: "match", venue: exact };

  const partials = entries.filter(
    (v) => v.name.toLowerCase().includes(q) || v.cityState.toLowerCase().includes(q),
  );
  if (partials.length === 0) return { kind: "none" };
  if (partials.length === 1) return { kind: "match", venue: partials[0] };

  const sorted = [...partials].sort((a, b) => a.name.length - b.name.length);
  const shortest = sorted[0];
  if (sorted.every((v) => v.name.toLowerCase().includes(shortest.name.toLowerCase()))) {
    return { kind: "match", venue: shortest };
  }
  return { kind: "ambiguous", options: sorted.map((v) => v.name).sort() };
}

export function venueHistory(
  venues: VenuesMetadata,
  concerts: Concert[],
  query: string,
  narration: Narration | null = null,
): string {
  const r = resolveVenue(venues, query);
  if (r.kind === "none") return `${query.trim()} isn't in the archive.`;
  if (r.kind === "ambiguous") {
    return [
      `I have a few venues matching "${query.trim()}":`,
      ...r.options.map((o) => `- ${o}`),
      "",
      "Which one did you mean?",
    ].join("\n");
  }

  const v = r.venue;
  const shows = [...(v.concerts ?? [])].sort(byDate);
  const n = v.stats?.totalConcerts ?? shows.length;
  const firstY = parseISO(v.stats?.firstEvent ?? shows[0]?.date ?? "0-0-0").y;
  const lastY = parseISO(v.stats?.lastEvent ?? shows[shows.length - 1]?.date ?? "0-0-0").y;

  const openersById = new Map(concerts.map((c) => [c.id, c.openers]));
  const slugById = new Map(concerts.map((c) => [c.id, c.headlinerNormalized]));

  const lines = [
    `${venueLink(v.name, v.normalizedName)}, ${v.cityState} — ${n} ${n === 1 ? "show" : "shows"} in the archive.`,
  ];

  let ctx = "";
  if (narration?.context) ctx = narration.context;
  else if (v.notes) ctx = `${v.notes.replace(/\.$/, "")}.`;
  else if (v.status && v.status !== "active") {
    ctx = `${cap(v.status)}${v.closedDate ? ` as of ${monYear(v.closedDate)}` : ""}.`;
  }
  if (ctx) lines.push(ctx);

  lines.push("");
  shows.forEach((s, i) => {
    const slug = slugById.get(s.id);
    const headliner = slug ? artistLink(s.headliner, slug) : s.headliner;
    lines.push(`${i + 1}. ${fullDate(s.date)} — ${headliner} [${s.id}]`);
    const opener = openerLine(openersById.get(s.id) ?? [], "   ");
    if (opener) lines.push(opener);
  });

  let note: string;
  if (narration?.closingArc) note = narration.closingArc;
  else if (n === 1) note = `A single visit — ${fullDate(shows[0].date)}, ${shows[0].headliner}.`;
  else if (n <= 4) note = `Visited ${n} times, ${firstY} to ${lastY}.`;
  else note = `One of the venues I've returned to most — ${n} times across ${lastY - firstY} years.`;
  lines.push("", note);

  return lines.join("\n");
}

// ===================================================================
// 5. on_this_day
// ===================================================================

export function onThisDay(concerts: Concert[], month: number, day: number): string {
  const matches = concerts
    .filter((c) => c.month === month && c.day === day)
    .sort((a, b) => a.year - b.year);
  const mName = MONTHS[month - 1];

  if (matches.length === 0) {
    return `Nothing in the archive on ${mName} ${day}. A quiet date.`;
  }

  const lines = [`On ${mName} ${day}, across the years:`, ""];
  for (const c of matches) {
    lines.push(
      `${c.year}: ${artistLink(c.headliner, c.headlinerNormalized)} at ${venueLink(c.venue, c.venueNormalized)}, ${c.city} [${c.id}]`,
    );
  }
  if (matches.length === 1) {
    lines.push("", `One show on this date — ${matches[0].headliner}, ${matches[0].year}.`);
  }
  return lines.join("\n");
}

// ===================================================================
// 6. surprise_me
// ===================================================================

export type SurpriseAngle =
  | "only-artist"
  | "only-venue"
  | "first-of-many"
  | "last-of-many"
  | "extreme-year"
  | "has-setlist"
  | "one-of-many";

function setlistSongs(setlists: SetlistsCache | null, concertId: string): string[] {
  const entry = setlists?.entries.find((e) => e.concertId === concertId);
  const sets = entry?.setlist?.sets?.set ?? [];
  const songs: string[] = [];
  for (const s of sets) for (const song of s.song ?? []) if (song.name) songs.push(song.name);
  return songs;
}

export function surpriseMe(
  concerts: Concert[],
  pick: (n: number) => number,
  setlists: SetlistsCache | null,
  artistsMeta: ArtistsMetadata,
  topTracks: ArtistsTopTracks,
): { text: string; angle: SurpriseAngle } {
  const c = concerts[pick(concerts.length)];

  const sameArtist = concerts.filter((x) => x.headlinerNormalized === c.headlinerNormalized).sort(byDate);
  const artistCount = sameArtist.length;
  const venueCount = concerts.filter((x) => x.venueNormalized === c.venueNormalized).length;
  const isFirst = sameArtist[0].id === c.id;
  const isLast = sameArtist[sameArtist.length - 1].id === c.id;

  const yearCounts = tally(concerts, (x) => String(x.year));
  const busiestYear = Number(yearCounts[0][0]);
  const quietestYear = Number(yearCounts[yearCounts.length - 1][0]);

  const songs = setlistSongs(setlists, c.id);

  let angle: SurpriseAngle;
  let why: string;
  if (artistCount === 1) {
    angle = "only-artist";
    why = `I'm surfacing this one because it's the only time ${c.headliner} appears in the archive.`;
  } else if (venueCount === 1) {
    angle = "only-venue";
    why = `I'm picking this because it's the only show I've ever seen at ${c.venue}.`;
  } else if (isFirst) {
    angle = "first-of-many";
    why = `I'm picking this because it's the first of ${artistCount} times I'd see ${c.headliner}.`;
  } else if (isLast) {
    angle = "last-of-many";
    why = `I'm picking this because it's the most recent of ${artistCount} times I've seen ${c.headliner}.`;
  } else if (c.year === quietestYear || c.year === busiestYear) {
    angle = "extreme-year";
    why =
      c.year === busiestYear
        ? `This one stood out — ${c.year} was the busiest year in the archive.`
        : `This one stood out — ${c.year} was the quietest year in the archive.`;
  } else if (songs.length) {
    angle = "has-setlist";
    why = `I picked this because I have the setlist.`;
  } else {
    angle = "one-of-many";
    why = `I'm pulling this from the ${artistCount} times I've seen ${c.headliner}.`;
  }

  const lines = [
    why,
    "",
    `${artistLink(c.headliner, c.headlinerNormalized)} at ${venueLink(c.venue, c.venueNormalized)}, ${c.city}`,
    `${fullDate(c.date)} [${c.id}]`,
  ];

  const meta = artistsMeta[c.headlinerNormalized];
  const enrich: string[] = [];
  if (meta?.genres?.length) enrich.push(meta.genres[0]);
  if (meta?.formed) enrich.push(`Formed ${meta.formed}`);
  if (enrich.length) lines.push(enrich.join(" • "));

  const opener = openerLine(c.openers, "");
  if (opener) lines.push(opener);

  if (songs.length) {
    lines.push("", `The setlist that night included ${joinList(songs.slice(0, 2))}.`);
  }
  const tracks = topTracks[c.headlinerNormalized]?.tracks;
  if (tracks?.length) {
    lines.push(`Known for ${joinList(tracks.slice(0, 2).map((t) => t.name))}.`);
  }

  return { text: lines.join("\n"), angle };
}

// ===================================================================
// Registration — the I/O seam
// ===================================================================

// Tool descriptions read as the archive offering them (spec §"The 6 Tools").
const DESC = {
  archive: "The front door. A sense of the collection's shape — four decades, the artists and venues that keep coming back, the rhythm of a concert life.",
  search: "Search memory by name, by place, by year.",
  artist: "Everything I remember about an artist — every show, every venue, every year.",
  venue: "The rooms I've kept returning to — every show at a single venue, in order.",
  onThisDay: "Concerts that share a date — across all the years, whatever's happened on this day.",
  surprise: "I'll pick one. A random concert, and why it's worth remembering.",
  query: "When none of my other tools fit, ask me anything about the shows and I'll reason over the whole archive. I count these by hand, so I'll hedge when I'm unsure.",
};

// ---------- query: runtime LLM escape hatch ----------
// Addendum 2026-05-17 §"Decision: runtime `query` escape hatch". Build-time Haiku pricing
// verified $1/$5 per MTok (2026-06-16). Raw fetch — the Anthropic SDK is overkill in a
// Worker for a single Messages call. concerts.json only (~50K tokens); the other files
// bloat context without helping freeform questions.

const ANTHROPIC_MODEL = "claude-haiku-4-5";

interface QueryResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function runQuery(
  env: Env,
  question: string,
  concertsJson: string,
): Promise<QueryResult | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: QUERY_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is my full concert archive as JSON (concerts.json):\n\n${concertsJson}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`Anthropic query failed ${res.status}`);
    return null;
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!text) return null;

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export function registerTools(server: McpServer, env: Env): void {
  server.registerTool(
    "get_archive_info",
    { title: "Archive overview", description: DESC.archive, inputSchema: {} },
    wrapTool("get_archive_info", async () => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      const facts = await getFacts(env, bgCtx);
      return textResult(archiveInfo(data.concerts, facts));
    }),
  );

  server.registerTool(
    "search_concerts",
    {
      title: "Search concerts",
      description: DESC.search,
      inputSchema: {
        artist: z.string().optional(),
        year: z.number().int().optional(),
        decade: z.enum(["1980s", "1990s", "2000s", "2010s", "2020s"]).optional(),
        city: z.string().optional(),
        genre: z.string().optional(),
        limit: z.number().int().min(1).max(25).optional(),
      },
    },
    wrapTool("search_concerts", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      return textResult(searchConcerts(data.concerts, args as SearchParams));
    }),
  );

  server.registerTool(
    "get_artist_history",
    {
      title: "Artist history",
      description: DESC.artist,
      inputSchema: { artist: z.string() },
    },
    wrapTool("get_artist_history", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      const query = String(args.artist ?? "");
      const [meta, tracks] = await Promise.all([
        getArtistsMetadata(env, bgCtx),
        getArtistsTopTracks(env, bgCtx),
      ]);
      const r = resolveArtist(data.concerts, query);
      const narration =
        r.kind === "match" ? await getNarration("artists", r.slug, env, bgCtx) : null;
      return textResult(
        artistHistory(data.concerts, query, meta ?? {}, tracks ?? {}, narration),
      );
    }),
  );

  server.registerTool(
    "get_venue_history",
    {
      title: "Venue history",
      description: DESC.venue,
      inputSchema: { venue: z.string() },
    },
    wrapTool("get_venue_history", async (args) => {
      const [data, venues] = await Promise.all([
        getConcerts(env, bgCtx),
        getVenuesMetadata(env, bgCtx),
      ]);
      if (!data || !venues) return dataUnavailableResult();
      const query = String(args.venue ?? "");
      const r = resolveVenue(venues, query);
      const narration =
        r.kind === "match" ? await getNarration("venues", r.venue.normalizedName, env, bgCtx) : null;
      return textResult(venueHistory(venues, data.concerts, query, narration));
    }),
  );

  server.registerTool(
    "on_this_day",
    {
      title: "On this day",
      description: DESC.onThisDay,
      inputSchema: {
        month: z.number().int().min(1).max(12).optional(),
        day: z.number().int().min(1).max(31).optional(),
      },
    },
    wrapTool("on_this_day", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      const now = new Date();
      const month = (args.month as number | undefined) ?? now.getUTCMonth() + 1;
      const day = (args.day as number | undefined) ?? now.getUTCDate();
      return textResult(onThisDay(data.concerts, month, day));
    }),
  );

  server.registerTool(
    "surprise_me",
    { title: "Surprise me", description: DESC.surprise, inputSchema: {} },
    wrapTool("surprise_me", async () => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      const [setlists, meta, tracks] = await Promise.all([
        getSetlistsCache(env, bgCtx),
        getArtistsMetadata(env, bgCtx),
        getArtistsTopTracks(env, bgCtx),
      ]);
      const pick = (n: number) => Math.floor(Math.random() * n);
      return textResult(
        surpriseMe(data.concerts, pick, setlists, meta ?? {}, tracks ?? {}).text,
      );
    }),
  );

  server.registerTool(
    "query",
    {
      title: "Ask the archive anything",
      description: DESC.query,
      inputSchema: { question: z.string() },
    },
    wrapTool("query", async (args) => {
      if (!env.ANTHROPIC_API_KEY) {
        return textResult(
          "Freeform questions aren't available right now — try one of my other tools.",
          true,
        );
      }
      // Pre-flight: refuse without spending if today's budget is gone (spec §Enforcement).
      const usage = await readQueryUsage(env);
      if (isQueryUsageOverCap(usage)) {
        return textResult(
          "Today's query budget is spent — try one of my deterministic tools, or come back tomorrow.",
        );
      }
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();

      const result = await runQuery(env, String(args.question ?? ""), JSON.stringify(data.concerts));
      if (!result) {
        return textResult(
          "I couldn't work that one out just now — try again, or use one of my deterministic tools.",
          true,
        );
      }
      // Post-flight: record real token usage so the cap reflects what was actually spent.
      recordQueryUsage(env, bgCtx, usage, {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      return textResult(result.text);
    }),
  );
}
