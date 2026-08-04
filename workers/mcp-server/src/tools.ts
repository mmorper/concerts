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
  MostPlayedSongs,
  Narration,
  SetlistEntry,
  SetlistSong,
  SetlistsCache,
  VenueMetadata,
  VenuesMetadata,
} from "./types.js";
import {
  getArtistsMetadata,
  getArtistsTopTracks,
  getConcerts,
  getFacts,
  getMostPlayedSongs,
  getNarration,
  getSetlistsCache,
  getVenuesMetadata,
  isQueryUsageOverCap,
  readQueryUsage,
  recordQueryUsage,
} from "./data.js";
import { recordMcpQuery } from "./telemetry.js";
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

// Phase 4 (#174) — the same error-wrapped handler, plus a fire-and-forget telemetry write per call
// (dataset `mcp_queries`). wrapTool never throws and stamps isError on a failed result, so reading
// that flag here gives a clean ok/error outcome without a second try/catch. The write is a no-op
// unless MCP_ANALYTICS is bound (see telemetry.ts), so this changes nothing in dev/test.
export function instrument(
  env: Env,
  name: string,
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>,
): (args: Record<string, unknown>) => Promise<CallToolResult> {
  const wrapped = wrapTool(name, handler);
  return async (args: Record<string, unknown>) => {
    const result = await wrapped(args ?? {});
    recordMcpQuery(env, name, result.isError ? "error" : "ok");
    return result;
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

// #200 — a link to one specific night, opening the gatefold with that setlist
// already expanded. Keyed on the concert date, never c.id: those are row-order
// artifacts, so a re-import that renumbers rows would break every link already
// sent. Shape asserted against test/fixtures/deep-link-urls.json.
//
// Only emit this where a setlist actually exists. The URL resolves either way
// (the panel renders "No setlist available"), but a link offered *as* a setlist
// that turns out to be empty is worse than no link — only 117 of 183 concerts
// have one, so that branch is load-bearing, not an edge case.
function showLink(label: string, artistSlug: string, date: string): string {
  return `[${label}](${SITE_BASE_URL}/?scene=artists&artist=${artistSlug}&show=${date})`;
}

// Liner-notes-style links footer. The model paraphrases tool prose (and drops inline
// links woven into it), but a clearly-delimited block at the very end survives far more
// reliably. We extract the links already present in the response, dedupe by URL, and
// append them as one labelled footer. No-op when a response has no links.
function linkFooter(text: string): string {
  const re = /\[([^\]]+)\]\((https:\/\/[^)]+)\)/g;
  const byUrl = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!byUrl.has(m[2])) byUrl.set(m[2], m[1]);
  }
  if (byUrl.size === 0) return "";
  const items = [...byUrl].map(([url, label]) => `[${label}](${url})`);
  return `\n\n---\n**Open on the site:** ${items.join(" · ")}`;
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
  const out = lines.join("\n");
  return out + linkFooter(out);
}

// ===================================================================
// 2. search_concerts
// ===================================================================

export interface SearchParams {
  artist?: string;
  year?: number;
  month?: number; // 1-12 — calendar month across all years (e.g. "shows in June")
  decade?: string;
  city?: string;
  genre?: string;
  limit?: number;
}

export function searchConcerts(concerts: Concert[], params: SearchParams): { text: string; matches: Concert[] } {
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
      if (params.month && c.month !== params.month) return false;
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
  if (params.month) bits.push(MONTHS[params.month - 1]);
  if (params.year) bits.push(String(params.year));
  else if (params.decade) bits.push(`the ${params.decade}`);
  const summary = bits.length ? bits.join(", ") : "everything";

  const total = matches.length;
  if (total === 0) {
    return { text: `I don't have anything matching ${summary} in the archive.`, matches: [] };
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
  const out = lines.join("\n");
  return { text: out + linkFooter(out), matches: shown };
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

  // Headliners first — their slug ships with the record, so it is authoritative.
  for (const c of concerts) {
    const key = c.headliner.toLowerCase();
    if (!byName.has(key)) byName.set(key, { display: c.headliner, slug: c.headlinerNormalized });
  }

  // #219 — openers are artists too. Most of the archive has never headlined, and
  // indexing headliners alone made those bands answer "isn't in the archive" while
  // search_concerts found them fine. Added in a second pass so a band that has both
  // headlined and opened keeps its headline spelling and slug.
  //
  // No *Normalized field ships for openers, so the slug is derived the way the site
  // derives it (src/utils/normalize.ts) — that equivalence is what keeps the links
  // these tools emit pointing at real artist cards.
  for (const c of concerts) {
    for (const opener of c.openers) {
      const name = opener.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { display: name, slug: normalizeName(name) });
    }
  }

  const exact = byName.get(q);
  if (exact) return { kind: "match", name: exact.display, slug: exact.slug };

  // Then an exact slug, so a caller can hand back the slug out of a link these tools
  // emitted — "the-psychedelic-furs" as readily as "The Psychedelic Furs". resolveVenue
  // has always accepted its normalizedName; artists were the inconsistent one, and a
  // multi-word artist was unreachable that way (only 21 of 107 headliners resolved).
  //
  // Placed after the display-name check and before partials so it can only ever convert
  // a miss into a hit: an exact name still wins, and a query that matches no slug falls
  // through to the same partial/ambiguity handling as before. Insertion order puts
  // headliners first, so a band that has both headlined and opened keeps its slug.
  const qSlug = normalizeName(q);
  if (qSlug) {
    for (const v of byName.values()) {
      if (v.slug === qSlug) return { kind: "match", name: v.display, slug: v.slug };
    }
  }

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

  // Matched on slug rather than display name so an opening slot counts as a show
  // (#219). Slug comparison also folds together spellings differing only in case or
  // punctuation ("Yaz!" / "Yaz"). It does NOT fold a leading article — "Psychedelic
  // Furs" and "The Psychedelic Furs" are still distinct slugs, which is why that split
  // had to be corrected in the source data rather than papered over here.
  const headlined = (c: Concert) => c.headlinerNormalized === r.slug;
  const shows = concerts
    .filter((c) => headlined(c) || c.openers.some((o) => normalizeName(o) === r.slug))
    .sort(byDate);
  const n = shows.length;
  const firstY = shows[0].year;
  const lastY = shows[n - 1].year;
  const openingSlots = shows.filter((c) => !headlined(c)).length;

  let header = `I've seen ${artistLink(r.name, r.slug)} ${n} ${n === 1 ? "time" : "times"}`;
  if (n > 1) header += lastY > firstY ? `, across ${lastY - firstY} years (${firstY}–${lastY})` : `, all in ${firstY}`;
  header += ".";

  const lines = [header];

  // An opening slot is a different memory from a headline set — say which, rather than
  // flattening both into a show count.
  if (openingSlots === n) {
    lines.push(
      n === 1
        ? "An opening set — never a headline show of their own in my archive."
        : "Always in the opening slot — never a headline show of their own in my archive.",
    );
  } else if (openingSlots > 0) {
    lines.push(`${n - openingSlots} headlining, ${openingSlots} opening.`);
  }

  const meta = artistsMeta[r.slug];
  const formedGenre: string[] = [];
  if (meta?.formed) formedGenre.push(`Formed ${meta.formed}`);
  if (meta?.genres?.length) formedGenre.push(meta.genres[0]);
  if (formedGenre.length) lines.push(`${formedGenre.join(", ")}.`);

  if (narration?.context) lines.push(narration.context);

  lines.push("");
  shows.forEach((c, i) => {
    lines.push(`${i + 1}. ${fullDate(c.date)} — ${venueLink(c.venue, c.venueNormalized)}, ${c.city} [${c.id}]`);
    if (headlined(c)) {
      const opener = openerLine(c.openers, "   ");
      if (opener) lines.push(opener);
    } else {
      // Who they opened for is the fact that places the night; the rest of the
      // undercard belongs to the headliner's history, not theirs.
      lines.push(`   Opening for ${artistLink(c.headliner, c.headlinerNormalized)}.`);
    }
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

  const out = lines.join("\n");
  return out + linkFooter(out);
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

  const out = lines.join("\n");
  return out + linkFooter(out);
}

// ===================================================================
// 5. on_this_day
// ===================================================================

// `setlists` is optional so existing callers and tests keep working; when it's
// supplied, each night that has a setlist on record links straight to it (#200).
export function onThisDay(
  concerts: Concert[],
  month: number,
  day: number,
  setlists: SetlistsCache | null = null,
): { text: string; matches: Concert[] } {
  const matches = concerts
    .filter((c) => c.month === month && c.day === day)
    .sort((a, b) => a.year - b.year);
  const mName = MONTHS[month - 1];

  if (matches.length === 0) {
    return { text: `Nothing in the archive on ${mName} ${day}. A quiet date.`, matches: [] };
  }

  const lines = [`On ${mName} ${day}, across the years:`, ""];
  for (const c of matches) {
    // The year label carries the link to that night, where a setlist exists.
    const hasSetlist =
      resolveSetlistEntry(setlists, c.id, c.headlinerNormalized).songs.length > 0;
    const year = hasSetlist
      ? showLink(String(c.year), c.headlinerNormalized, c.date)
      : String(c.year);
    lines.push(
      `${year}: ${artistLink(c.headliner, c.headlinerNormalized)} at ${venueLink(c.venue, c.venueNormalized)}, ${c.city} [${c.id}]`,
    );
  }
  if (matches.length === 1) {
    lines.push("", `One show on this date — ${matches[0].headliner}, ${matches[0].year}.`);
  }
  const out = lines.join("\n");
  return { text: out + linkFooter(out), matches };
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

// Matches src/utils/normalize.ts: lowercase, non-alphanumeric runs → hyphens, trimmed.
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function songsOf(entry: SetlistEntry): SetlistSong[] {
  const sets = entry.setlist?.sets?.set ?? [];
  const songs: SetlistSong[] = [];
  for (const s of sets) for (const song of s.song ?? []) if (song.name) songs.push(song);
  return songs;
}

// What the site prints beside a title, in the same order: "(Duran Duran cover)",
// "(with Nile Rodgers)", "(tape)". Without this, a night of covers reads as a list of
// songs the headliner appears to have written.
function songLine(song: SetlistSong): string {
  const notes: string[] = [];
  if (song.cover?.name) notes.push(`${song.cover.name} cover`);
  if (song.with?.name) notes.push(`with ${song.with.name}`);
  if (song.tape) notes.push("tape");
  return song.name + notes.map((n) => ` (${n})`).join("");
}

export interface ResolvedSetlist {
  songs: SetlistSong[];
  tour?: string;
  isOpener: boolean;
  artistName?: string;
}

// A single concert can have several cache entries — the headliner AND each opener get
// their own setlist.fm lookup (34 of 183 concerts, verified). Prefer the headliner's set;
// fall back to the richest opener set (flagged isOpener) so a covered night never reads as
// empty just because the headliner lookup missed. Empty/null setlists are skipped entirely.
function resolveSetlistEntry(
  setlists: SetlistsCache | null,
  concertId: string,
  headlinerNormalized: string,
): ResolvedSetlist {
  const withSongs = (setlists?.entries ?? [])
    .filter((e) => e.concertId === concertId)
    .map((e) => ({ e, songs: songsOf(e) }))
    .filter((x) => x.songs.length > 0);
  if (withSongs.length === 0) return { songs: [], isOpener: false };

  const headliner = withSongs.find(
    (x) => normalizeName(x.e.artistName) === headlinerNormalized,
  );
  const chosen =
    headliner ?? [...withSongs].sort((a, b) => b.songs.length - a.songs.length)[0];
  return {
    songs: chosen.songs,
    tour: chosen.e.setlist?.tour?.name,
    isOpener: !headliner,
    artistName: chosen.e.artistName,
  };
}

export function surpriseMe(
  concerts: Concert[],
  pick: (n: number) => number,
  setlists: SetlistsCache | null,
  artistsMeta: ArtistsMetadata,
  topTracks: ArtistsTopTracks,
): { text: string; angle: SurpriseAngle; concert: Concert } {
  const c = concerts[pick(concerts.length)];

  const sameArtist = concerts.filter((x) => x.headlinerNormalized === c.headlinerNormalized).sort(byDate);
  const artistCount = sameArtist.length;
  const venueCount = concerts.filter((x) => x.venueNormalized === c.venueNormalized).length;
  const isFirst = sameArtist[0].id === c.id;
  const isLast = sameArtist[sameArtist.length - 1].id === c.id;

  const yearCounts = tally(concerts, (x) => String(x.year));
  const busiestYear = Number(yearCounts[0][0]);
  const quietestYear = Number(yearCounts[yearCounts.length - 1][0]);

  const songs = resolveSetlistEntry(setlists, c.id, c.headlinerNormalized).songs;

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
    // Link the night only when there's a setlist behind it (#200) — this tool
    // already narrates two of its songs below, so the link pays off here.
    songs.length
      ? `${showLink(fullDate(c.date), c.headlinerNormalized, c.date)} [${c.id}]`
      : `${fullDate(c.date)} [${c.id}]`,
  ];

  const meta = artistsMeta[c.headlinerNormalized];
  const enrich: string[] = [];
  if (meta?.genres?.length) enrich.push(meta.genres[0]);
  if (meta?.formed) enrich.push(`Formed ${meta.formed}`);
  if (enrich.length) lines.push(enrich.join(" • "));

  const opener = openerLine(c.openers, "");
  if (opener) lines.push(opener);

  if (songs.length) {
    lines.push("", `The setlist that night included ${joinList(songs.slice(0, 2).map((s) => s.name))}.`);
  }
  const tracks = topTracks[c.headlinerNormalized]?.tracks;
  if (tracks?.length) {
    lines.push(`Known for ${joinList(tracks.slice(0, 2).map((t) => t.name))}.`);
  }

  const out = lines.join("\n");
  return { text: out + linkFooter(out), angle, concert: c };
}

// ===================================================================
// 7. get_concert_setlist
// ===================================================================

// Resolve a concert from {concertId} or {artist, date}. Returns the matched concert, a
// disambiguation/whiff message to return as-is, or null context the caller turns into a
// "tell me which show" prompt.
type ConcertResolution =
  | { kind: "match"; concert: Concert }
  | { kind: "message"; text: string };

function resolveConcert(
  concerts: Concert[],
  args: { artist?: string; date?: string; concertId?: string },
): ConcertResolution {
  if (args.concertId) {
    const c = concerts.find((x) => x.id === args.concertId);
    if (c) return { kind: "match", concert: c };
    return { kind: "message", text: `I don't have a concert with id "${args.concertId}" in the archive.` };
  }

  if (!args.artist) {
    return {
      kind: "message",
      text: "Tell me which show — an artist (with a date if you have one), or a concert id like concert-59.",
    };
  }

  const r = resolveArtist(concerts, args.artist);
  if (r.kind === "none") return { kind: "message", text: `${args.artist.trim()} isn't in the archive.` };
  if (r.kind === "ambiguous") {
    return {
      kind: "message",
      text: [
        `I have a few artists matching "${args.artist.trim()}":`,
        ...r.options.map((o) => `- ${o}`),
        "",
        "Which one did you mean?",
      ].join("\n"),
    };
  }

  let shows = concerts.filter((c) => c.headliner === r.name).sort(byDate);
  if (args.date) {
    const d = args.date.trim();
    const matched = shows.filter(
      (c) => c.date === d || c.date.startsWith(d) || String(c.year) === d,
    );
    if (matched.length === 0) {
      return {
        kind: "message",
        text: `I don't have a ${r.name} show on ${d} in the archive — I've seen them ${shows.length} ${shows.length === 1 ? "time" : "times"}.`,
      };
    }
    shows = matched;
  }

  if (shows.length === 1) return { kind: "match", concert: shows[0] };

  // Multiple candidates and no date narrowed it to one — ask which night.
  return {
    kind: "message",
    text: [
      `I've seen ${r.name} ${shows.length} times — which night?`,
      ...shows.map((c) => `- ${fullDate(c.date)} — ${c.venue}, ${c.city} [${c.id}]`),
    ].join("\n"),
  };
}

export function concertSetlist(
  concerts: Concert[],
  setlists: SetlistsCache | null,
  args: { artist?: string; date?: string; concertId?: string },
  topTracks: ArtistsTopTracks = {},
): string {
  const r = resolveConcert(concerts, args);
  if (r.kind === "message") return r.text;

  const c = r.concert;
  const sl = resolveSetlistEntry(setlists, c.id, c.headlinerNormalized);

  // The date becomes the link to the night itself — but only below, on the
  // path where songs exist. The no-setlist fallback keeps artist/venue links
  // only, so we never hand back a "here's the setlist" link to an empty panel.
  const head = [
    `${artistLink(c.headliner, c.headlinerNormalized)} at ${venueLink(c.venue, c.venueNormalized)}, ${c.city}`,
    `${showLink(fullDate(c.date), c.headlinerNormalized, c.date)} [${c.id}]`,
  ];

  // Graceful fallback — covers no-entry, setlist === null, and empty song lists alike.
  // State the gap plainly, then offer something that works (openers, best-known tracks).
  if (sl.songs.length === 0) {
    const lines = [
      `I don't have a setlist on record for ${artistLink(c.headliner, c.headlinerNormalized)} at ${venueLink(c.venue, c.venueNormalized)} on ${fullDate(c.date)} [${c.id}].`,
    ];
    const extras: string[] = [];
    if (c.openers.length) extras.push(`That night ${joinList(c.openers)} opened.`);
    const tracks = topTracks[c.headlinerNormalized]?.tracks;
    if (tracks?.length) {
      extras.push(`If it helps, they're best known for ${joinList(tracks.slice(0, 3).map((t) => t.name))}.`);
    }
    if (extras.length) lines.push("", ...extras);
    const out = lines.join("\n");
    return out + linkFooter(out);
  }

  const lines = [...head];

  // Opener-only coverage: be explicit that this is the opener's set, not the headliner's.
  if (sl.isOpener) {
    lines.push(
      "",
      `I don't have ${c.headliner}'s own setlist from that night, but I do have ${sl.artistName}'s opening set${sl.tour ? ` (${sl.tour} tour)` : ""}:`,
    );
  } else if (sl.tour) {
    lines.push(`On the ${sl.tour} tour.`, "");
  } else {
    lines.push("");
  }

  sl.songs.forEach((song, i) => {
    lines.push(`${i + 1}. ${songLine(song)}`);
    // setlist.fm's free-text note — "first time live since 1984", that kind of thing.
    // Indented under its song, the way the panel renders it.
    if (song.info) lines.push(`   ${song.info}`);
  });

  const out = lines.join("\n");
  return out + linkFooter(out);
}

// ===================================================================
// 8. get_archive_top_songs
// ===================================================================

// Build-time aggregation of song frequency across the setlists on record. Coverage is
// partial, so the narration leads with the caveat — these counts describe the shows I
// actually have setlists for, not the whole archive.
export function archiveTopSongs(data: MostPlayedSongs | null, limit = 10): string {
  if (!data || data.songs.length === 0) {
    return "I don't have enough setlists on record yet to say which songs come up most.";
  }
  const { concertsWithSetlist, totalConcerts } = data.coverage;
  const top = data.songs.slice(0, Math.min(Math.max(limit, 1), 25));

  const lines = [
    `Across the ${concertsWithSetlist} of ${totalConcerts} shows I have setlists for, these are the songs I've heard most:`,
    "",
  ];
  top.forEach((s, i) => {
    const who =
      s.artists.length === 1
        ? artistLink(s.artists[0], normalizeName(s.artists[0]))
        : `across ${s.artists.length} artists`;
    lines.push(`${i + 1}. ${s.name} — ${s.count} times (${who})`);
  });
  lines.push(
    "",
    `That's only the ${concertsWithSetlist} shows with a setlist on record, so it leans toward the artists I've seen most.`,
  );

  const out = lines.join("\n");
  return out + linkFooter(out);
}

// ===================================================================
// Registration — the I/O seam
// ===================================================================

// Appended to the list tools: the model paraphrases prose and drops inline links, so the
// durable contract is the footer block — tell it explicitly to keep that block.
const LINK_NOTE =
  ' Each result ends with an "Open on the site" line of links — always include it, exactly as given, at the end of your reply so people can click through to the artists and venues.';

// Tool descriptions read as the archive offering them (spec §"The 6 Tools").
const DESC = {
  archive: "The front door. A sense of the collection's shape — four decades, the artists and venues that keep coming back, the rhythm of a concert life.",
  search: "Search memory by name, by place, by year." + LINK_NOTE,
  artist: "Everything I remember about an artist — every show, every venue, every year." + LINK_NOTE,
  venue: "The rooms I've kept returning to — every show at a single venue, in order." + LINK_NOTE,
  onThisDay: "Concerts that share a date — across all the years, whatever's happened on this day." + LINK_NOTE,
  surprise: "I'll pick one. A random concert, and why it's worth remembering." + LINK_NOTE,
  setlist: "The songs from a specific night — give me an artist (and a date if you have one) or a concert id, and I'll tell you what they played, if I have it on record." + LINK_NOTE,
  topSongs: "The songs I've heard most across every setlist on record — counted honestly from the shows I have setlists for, not the whole archive." + LINK_NOTE,
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
    instrument(env, "get_archive_info", async () => {
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
        month: z.number().int().min(1).max(12).optional(),
        decade: z.enum(["1980s", "1990s", "2000s", "2010s", "2020s"]).optional(),
        city: z.string().optional(),
        genre: z.string().optional(),
        limit: z.number().int().min(1).max(25).optional(),
      },
    },
    instrument(env, "search_concerts", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      return textResult(searchConcerts(data.concerts, args as SearchParams).text);
    }),
  );

  server.registerTool(
    "get_artist_history",
    {
      title: "Artist history",
      description: DESC.artist,
      inputSchema: { artist: z.string() },
    },
    instrument(env, "get_artist_history", async (args) => {
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
    instrument(env, "get_venue_history", async (args) => {
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
    instrument(env, "on_this_day", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      // Same cached loader surprise_me and get_concert_setlist already use, so
      // linking the nights that have setlists costs no extra fetch (#200).
      const setlists = await getSetlistsCache(env, bgCtx);
      const now = new Date();
      const month = (args.month as number | undefined) ?? now.getUTCMonth() + 1;
      const day = (args.day as number | undefined) ?? now.getUTCDate();
      return textResult(onThisDay(data.concerts, month, day, setlists).text);
    }),
  );

  server.registerTool(
    "surprise_me",
    { title: "Surprise me", description: DESC.surprise, inputSchema: {} },
    instrument(env, "surprise_me", async () => {
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
    "get_concert_setlist",
    {
      title: "Concert setlist",
      description: DESC.setlist,
      inputSchema: {
        artist: z.string().optional(),
        date: z.string().optional(),
        concertId: z.string().optional(),
      },
    },
    instrument(env, "get_concert_setlist", async (args) => {
      const data = await getConcerts(env, bgCtx);
      if (!data) return dataUnavailableResult();
      const [setlists, tracks] = await Promise.all([
        getSetlistsCache(env, bgCtx),
        getArtistsTopTracks(env, bgCtx),
      ]);
      return textResult(
        concertSetlist(
          data.concerts,
          setlists,
          args as { artist?: string; date?: string; concertId?: string },
          tracks ?? {},
        ),
      );
    }),
  );

  server.registerTool(
    "get_archive_top_songs",
    {
      title: "Most-played songs",
      description: DESC.topSongs,
      inputSchema: { limit: z.number().int().min(1).max(25).optional() },
    },
    instrument(env, "get_archive_top_songs", async (args) => {
      const songs = await getMostPlayedSongs(env, bgCtx);
      if (!songs) return dataUnavailableResult();
      return textResult(archiveTopSongs(songs, args.limit as number | undefined));
    }),
  );

  server.registerTool(
    "query",
    {
      title: "Ask the archive anything",
      description: DESC.query,
      inputSchema: { question: z.string() },
    },
    instrument(env, "query", async (args) => {
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
