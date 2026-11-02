// Follow-up chips (docs/specs/future/global-ask-media.md, Phase 5). One or two next questions
// under an answer that has a card. A chip must never lead to an empty answer, so:
//
//   1. The Worker chooses them after the tool has run. It holds the data the site doesn't load
//      (setlists, album eras), and each candidate is checked against the SAME pure fn its tool
//      runs — a chip is offered only when that fn already returns something.
//   2. A chip carries its tool and arguments, not just words. Clicking it runs that exact tool,
//      then the model writes the prose. Free text could be routed elsewhere.
//   3. chips.walk.test.ts runs every chip offered for every act, venue and night in the real data.
//
// No model call writes them, and the model's text never mentions them.

import { resolveArtist, setlistSelection, mediaResults } from "../../mcp-server/src/tools.js";
import { buildAliasIndex } from "../../mcp-server/src/aliases.js";
import { normalizeArtistName } from "../../../src/utils/normalize.js";
import type { Exhibit } from "./exhibits.js";

type Concerts = Parameters<typeof setlistSelection>[0];
type Concert = Concerts[number];

/** The tools a chip may run. Anything else in a chip from the client is ignored. */
export const CHIP_TOOLS = ["get_concert_setlist", "get_artist_history", "get_media"] as const;
export type ChipTool = (typeof CHIP_TOOLS)[number];

export interface Chip {
  /** The question as it shows in the box: the visitor's words, addressed to the archive. */
  label: string;
  tool: ChipTool;
  input: Record<string, string>;
}

export const MAX_CHIPS = 2;
/** A setlist chip needs this many songs on record: the floor On This Day uses. */
export const SETLIST_FLOOR = 3;

/** Everything the checks read. The Worker loads it through the cached data layer. */
export interface ChipData {
  concerts: Concerts;
  setlists: Parameters<typeof setlistSelection>[1];
  eras: Parameters<typeof setlistSelection>[3];
  songAlbums: Parameters<typeof setlistSelection>[4];
  meta: NonNullable<Parameters<typeof setlistSelection>[5]>;
  aliasData: Parameters<typeof setlistSelection>[6];
  media: Parameters<typeof mediaResults>[1] | null;
  venues: Parameters<typeof mediaResults>[3];
  today: string;
}

const fold = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");
/** "Your first Human League show", not "Your first The Human League show". Labels only, never input. */
const bare = (name: string): string => name.replace(/^the\s+/i, "");
const byDate = (a: Concert, b: Concert) => a.date.localeCompare(b.date);

function songsOn(d: ChipData, artist: string, date: string): number | null {
  const sel = setlistSelection(d.concerts, d.setlists, { artist, date }, d.eras, d.songAlbums, d.meta, d.aliasData);
  return sel ? sel.songs.length : null;
}

/** An act's nights that have happened, oldest first: headlined or opened, under any billing. */
function actNights(d: ChipData, name: string): Concert[] {
  const r = resolveArtist(d.concerts, name, buildAliasIndex(d.aliasData));
  if (r.kind !== "match") return [];
  const them = new Set(r.slugs);
  return d.concerts
    .filter((c) => c.date <= d.today)
    .filter((c) => them.has(c.headlinerNormalized) || c.openers.some((o) => them.has(normalizeArtistName(o))))
    .sort(byDate);
}

// --- One check per chip. Each returns the chip, or null when its tool would come back empty. ---

function setlistChip(d: ChipData, artist: string, date: string): Chip | null {
  const n = songsOn(d, artist, date);
  return n !== null && n >= SETLIST_FLOOR ? { label: "The setlist", tool: "get_concert_setlist", input: { artist, date } } : null;
}

/** The night card is the answer, so it needs the night to resolve, not a setlist. */
function firstChip(d: ChipData, label: string, night: Concert | undefined, artist?: string): Chip | null {
  if (!night) return null;
  const performer = artist ?? night.headliner;
  return songsOn(d, performer, night.date) === null
    ? null
    : { label, tool: "get_concert_setlist", input: { artist: performer, date: night.date } };
}

function everyChip(d: ChipData, name: string): Chip | null {
  return actNights(d, name).length >= 2 ? { label: `Every ${bare(name)} show`, tool: "get_artist_history", input: { artist: name } } : null;
}

/**
 * Clips first, since they're rarer. `photoMin` is how many photos make it worth asking: a night
 * card already shows one, so it needs two. A card never plays a clip, so one clip is enough.
 */
function mediaChip(d: ChipData, args: Record<string, string>, photoMin = 1): Chip | null {
  if (!d.media) return null;
  const aliases = buildAliasIndex(d.aliasData);
  for (const kind of ["clip", "photo"] as const) {
    const r = mediaResults(d.concerts, d.media, { ...args, kind }, d.venues, aliases, d.today);
    if (r.total >= (kind === "clip" ? 1 : photoMin)) {
      return { label: kind === "clip" ? "The clips" : "The photos", tool: "get_media", input: { ...args, kind } };
    }
  }
  return null;
}

function concertById(d: ChipData, id: string): Concert | undefined {
  return d.concerts.find((c) => c.id === id);
}

/** The candidates for one answer, best first, before any are dropped. */
function candidates(exhibit: Exhibit, d: ChipData): Array<Chip | null> {
  switch (exhibit.kind) {
    case "artist": {
      const nights = actNights(d, exhibit.name);
      return [
        nights.length >= 2 ? firstChip(d, `Your first ${bare(exhibit.name)} show`, nights[0], exhibit.name) : null,
        mediaChip(d, { artist: exhibit.name }),
      ];
    }
    case "venue": {
      const nights = d.concerts.filter((c) => c.venueNormalized === exhibit.slug && c.date <= d.today).sort(byDate);
      return [
        // "Here" reads right under the room's card, and a venue name has no article to get wrong.
        nights.length >= 2 ? firstChip(d, "Your first show here", nights[0]) : null,
        mediaChip(d, { venue: exhibit.name }),
      ];
    }
    case "show":
      // The card already holds the set and one frame, so the next step is the act, or the rest of the night.
      return [everyChip(d, exhibit.performer), mediaChip(d, { date: exhibit.date }, 2)];
    case "serendipity": {
      const c = concertById(d, exhibit.concertId);
      return c ? [setlistChip(d, c.headliner, c.date), mediaChip(d, { date: c.date })] : [];
    }
    case "era":
      return [setlistChip(d, exhibit.artist.name, exhibit.date), everyChip(d, exhibit.artist.name)];
    case "list": {
      if (exhibit.rows.length !== 1) return [];
      const row = exhibit.rows[0];
      return [setlistChip(d, row.artist.name, row.date), mediaChip(d, { date: row.date })];
    }
    case "gallery": {
      const dates = new Set(exhibit.items.map((i) => i.date));
      const acts = new Set(exhibit.items.map((i) => i.act));
      if (dates.size !== 1 || acts.size !== 1) return [];
      const date = [...dates][0];
      const act = [...acts][0] ?? d.concerts.find((c) => c.date === date)?.headliner;
      return act ? [setlistChip(d, act, date)] : [];
    }
    case "acts":
      return exhibit.acts.length ? [everyChip(d, exhibit.acts[0].artist.name)] : [];
    default:
      return [];
  }
}

/**
 * The chips for an answer. `asked` is every question already in the conversation, this one
 * included: a chip never repeats one. Pure, so the walk test can run it over the whole archive.
 */
export function offerChips(exhibit: Exhibit, d: ChipData, asked: string[]): Chip[] {
  const seen = new Set(asked.map(fold));
  const out: Chip[] = [];
  for (const chip of candidates(exhibit, d)) {
    if (!chip || seen.has(fold(chip.label))) continue;
    seen.add(fold(chip.label));
    out.push(chip);
    if (out.length === MAX_CHIPS) break;
  }
  return out;
}

// --- Reading a chip back from the client. It came over the wire, so trust none of it. ---

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT = /^[^\n\r]{1,120}$/;
const ALLOWED: Record<ChipTool, Record<string, RegExp>> = {
  get_concert_setlist: { artist: TEXT, date: DATE },
  get_artist_history: { artist: TEXT },
  get_media: { artist: TEXT, venue: TEXT, date: DATE, kind: /^(photo|clip)$/ },
};

/** A chip the client sent with its turn, or null to treat the turn as a typed question. */
export function readChip(raw: unknown): Pick<Chip, "tool" | "input"> | null {
  if (!raw || typeof raw !== "object") return null;
  const { tool, input } = raw as { tool?: unknown; input?: unknown };
  if (typeof tool !== "string" || !(CHIP_TOOLS as readonly string[]).includes(tool)) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const rules = ALLOWED[tool as ChipTool];
  const entries = Object.entries(input as Record<string, unknown>);
  if (!entries.length) return null;
  const clean: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!rules[k] || typeof v !== "string" || !rules[k].test(v)) return null;
    clean[k] = v;
  }
  return { tool: tool as ChipTool, input: clean };
}
