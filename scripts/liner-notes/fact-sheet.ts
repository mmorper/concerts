/**
 * Fact sheets for the claim verifier (#529).
 *
 * Deterministic. No API call. Given the subjects a post is about, assembles
 * everything the archive actually knows about them, in a form the verifier's
 * prompt can quote back at a suspect sentence. This is the "evidence" half of
 * the verifier; `verify-claims.ts` is the "judgment" half.
 *
 * Every section here is a straight read off data already in the pipeline —
 * concerts, venue metadata, setlists, album eras, and the hand-kept
 * `data/owner-facts.json`. Nothing is inferred or summarized in a lossy way,
 * because the verifier's usefulness depends on the fact sheet being at least
 * as trustworthy as the data it was built from.
 */

import { normalizeArtistName } from "../../src/utils/normalize.ts";
import { songsFor, guestAppearances, type GuestAppearance, type SetlistIndex, type SetlistSong } from "./setlists.ts";
import type { AliasMap } from "./artist-aliases.ts";
import type { AlbumErasSlim } from "./analyze.ts";
import type { Concert } from "../../src/types/concert.ts";

// ── Owner-confirmed facts ────────────────────────────────────────────────────

export interface OwnerFact {
  id: string;
  fact: string;
  note?: string;
}

export interface OwnerFactsMap {
  facts: OwnerFact[];
}

export const EMPTY_OWNER_FACTS: OwnerFactsMap = { facts: [] };

/** Parses a raw `data/owner-facts.json`. Absent/malformed input reads as empty — never an error. */
export function loadOwnerFacts(raw: unknown): OwnerFactsMap {
  const file = (raw ?? {}) as { facts?: unknown };
  if (!Array.isArray(file.facts)) return EMPTY_OWNER_FACTS;
  const facts = file.facts.filter(
    (f): f is OwnerFact => Boolean(f && typeof f === "object" && typeof (f as OwnerFact).fact === "string")
  );
  return { facts };
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface FactSheetSubjects {
  /** Normalized artist slugs the post is about. */
  artists: string[];
  /** Normalized venue slugs the post is about. */
  venues: string[];
}

export interface FactSheetSources {
  concerts: Concert[];
  venuesMetadata: Record<
    string,
    { name?: string; city?: string; state?: string; status?: string; closedDate?: string; notes?: string }
  >;
  artistsMetadata?: Record<string, { name?: string } | undefined>;
  aliases?: AliasMap;
  setlists?: SetlistIndex;
  albumEras?: AlbumErasSlim;
  ownerFacts?: OwnerFactsMap;
  /** YYYY-MM-DD. Injected so a run is reproducible and tests do not move with the wall clock. */
  today?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Every billing slug this artist has ever performed under, canonical slug included. */
function billingsFor(normalized: string, aliases?: AliasMap): string[] {
  if (!aliases) return [normalized];
  const canonical = aliases.canonical.get(normalized) ?? normalized;
  const billings = aliases.billings.get(canonical);
  return billings?.length ? [...new Set([canonical, ...billings])] : [canonical, normalized];
}

/** `concert.openers` holds display strings; matched the way the rest of the pipeline does. */
function openerMatches(concert: Concert, slugs: Set<string>): boolean {
  return (concert.openers ?? []).some((o) => slugs.has(normalizeArtistName(o)));
}

interface ArtistAppearance {
  concert: Concert;
  role: "headliner" | "opener";
}

function appearancesFor(normalized: string, sources: FactSheetSources): ArtistAppearance[] {
  const slugs = new Set(billingsFor(normalized, sources.aliases));
  const out: ArtistAppearance[] = [];
  for (const c of sources.concerts) {
    if (slugs.has(c.headlinerNormalized)) out.push({ concert: c, role: "headliner" });
    else if (openerMatches(c, slugs)) out.push({ concert: c, role: "opener" });
  }
  return out.sort((a, b) => a.concert.date.localeCompare(b.concert.date));
}

/**
 * Each show's place in the archive, 1-based, in date order — the same count the
 * milestone-marker detector uses, so "my 150th show" can be checked rather than
 * flagged as an invented number.
 */
function showNumbers(sources: FactSheetSources): Map<string, number> {
  const sorted = [...sources.concerts].sort((a, b) => a.date.localeCompare(b.date));
  return new Map(sorted.map((c, i) => [c.id, i + 1]));
}

function numberOf(c: Concert, numbers: Map<string, number>): string {
  const n = numbers.get(c.id);
  return n ? `, show #${n}` : "";
}

/** Guest spots by this artist on someone else's set, from the setlist `with` field. */
function guestSpotsBy(normalized: string, sources: FactSheetSources): GuestAppearance[] {
  const slugs = new Set(billingsFor(normalized, sources.aliases));
  return guestAppearances(sources.setlists)
    .filter((g) => slugs.has(g.guest) && !slugs.has(g.host))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** "Song (X cover, with Guest)" — the guest is what lets the verifier confirm a walk-on. */
function describeSongWithGuest(song: SetlistSong): string {
  const notes = [song.cover && `${song.cover.name} cover`, song.with && `with ${song.with.name}`].filter(Boolean);
  return notes.length ? `${song.name} (${notes.join(", ")})` : song.name;
}

function showsAtVenue(normalized: string, sources: FactSheetSources): Concert[] {
  return sources.concerts
    .filter((c) => c.venueNormalized === normalized)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Sections ─────────────────────────────────────────────────────────────────

function artistDisplayName(normalized: string, appearances: ArtistAppearance[], sources: FactSheetSources): string {
  const own = appearances.find((a) => a.role === "headliner");
  if (own) return own.concert.headliner;
  const opener = appearances.find((a) => a.role === "opener");
  if (opener) {
    const match = (opener.concert.openers ?? []).find((o) => normalizeArtistName(o) === normalized);
    if (match) return match;
  }
  return sources.artistsMetadata?.[normalized]?.name ?? normalized;
}

function artistSection(normalized: string, sources: FactSheetSources): string[] {
  const appearances = appearancesFor(normalized, sources);
  const guestSpots = guestSpotsBy(normalized, sources);
  const name =
    !appearances.length && guestSpots.length
      ? guestSpots[0].guestName
      : artistDisplayName(normalized, appearances, sources);
  const numbers = showNumbers(sources);
  const lines = [`EVERY SHOW BY ${name} (${appearances.length} total):`];
  if (!appearances.length) lines.push("  (none on record)");
  for (const { concert: c, role } of appearances) {
    const roleNote = role === "opener" ? `, opening for ${c.headliner}` : "";
    lines.push(`  • ${c.date} (${c.dayOfWeek}${numberOf(c, numbers)}) — ${c.venue}, ${c.cityState}${roleNote}`);
  }
  // A guest spot is not a billed show, so it is listed apart from the count
  // above — but it is on record, and without it every guest-bridge note reads
  // as a claim about someone with "0 shows".
  if (guestSpots.length) {
    const byDate = new Map(sources.concerts.map((c) => [c.date, c]));
    lines.push(`GUEST APPEARANCES BY ${name} — joined another act on stage (${guestSpots.length}, from setlists):`);
    for (const g of guestSpots) {
      const night = byDate.get(g.date);
      const where = night ? ` — ${night.venue}, ${night.cityState}` : "";
      const host = night?.headlinerNormalized === g.host ? night.headliner : g.host;
      lines.push(`  • ${g.date}${where}: joined ${host} on "${g.song}"`);
    }
  }
  return lines;
}

function venueSection(normalized: string, sources: FactSheetSources): string[] {
  const shows = showsAtVenue(normalized, sources);
  const meta = sources.venuesMetadata[normalized];
  const name = meta?.name ?? shows[0]?.venue ?? normalized;
  const lines = [`EVERY SHOW AT ${name} (${shows.length} total):`];
  if (meta?.status && meta.status !== "open") {
    lines.push(
      `  STATUS: ${meta.status}${meta.closedDate ? ` (${meta.closedDate})` : ""}${meta.notes ? ` — ${meta.notes}` : ""}`
    );
  }
  if (!shows.length) {
    lines.push("  (none on record)");
    return lines;
  }
  const numbers = showNumbers(sources);
  for (const c of shows) {
    lines.push(`  • ${c.date} (${c.dayOfWeek}${numberOf(c, numbers)}) — ${c.headliner}${c.openers?.length ? ` (opener(s): ${c.openers.join(", ")})` : ""}`);
  }
  return lines;
}

/** Album timing for the concerts the subject artists actually played. */
function albumTimingSection(artists: string[], sources: FactSheetSources): string[] {
  if (!sources.albumEras) return [];
  const lines: string[] = [];
  for (const normalized of artists) {
    const artistEra = sources.albumEras.artists[normalized];
    const appearances = appearancesFor(normalized, sources).filter((a) => a.role === "headliner");
    const rows: string[] = [];
    for (const { concert } of appearances) {
      const era = sources.albumEras!.concerts[concert.id];
      if (!era) continue;
      const current = era.currentAlbum
        ? `touring behind "${era.currentAlbum.title}" (released ${era.currentAlbum.releaseDate})`
        : "between albums — no album era on record for this show";
      rows.push(`  • ${concert.date}: ${current}, album ${era.albumsBefore + 1} of ${era.albumsBefore + era.albumsAfter + 1}`);
    }
    if (rows.length) {
      lines.push(`ALBUM TIMING — ${artistEra?.displayName ?? normalized}:`, ...rows);
    }
    if (artistEra?.studioAlbums.length) {
      lines.push(
        `  Full studio discography: ${artistEra.studioAlbums.map((a) => `"${a.title}" (${a.releaseDate})`).join("; ")}`
      );
    }
  }
  return lines;
}

/** Setlists for the concerts the subject artists actually played, tape excluded. */
function setlistSection(artists: string[], sources: FactSheetSources): string[] {
  if (!sources.setlists) return [];
  const lines: string[] = [];
  for (const normalized of artists) {
    for (const { concert, role } of appearancesFor(normalized, sources)) {
      const songs = songsFor(sources.setlists, concert.date, normalized);
      if (!songs.length) continue;
      const roleNote = role === "opener" ? ` (opening for ${concert.headliner})` : "";
      lines.push(
        `  • ${concert.date}${roleNote}: ${songs.map((s) => describeSongWithGuest(s)).join(", ")}`
      );
    }
  }
  if (!lines.length) return [];
  return ["SETLISTS ON RECORD FOR THESE NIGHTS (tape/walk-on music excluded):", ...lines];
}

function archiveSummary(sources: FactSheetSources): string[] {
  const concerts = [...sources.concerts].sort((a, b) => a.date.localeCompare(b.date));
  if (!concerts.length) return [];
  const byState = new Map<string, number>();
  const byYear = new Map<number, number>();
  for (const c of concerts) {
    byState.set(c.state, (byState.get(c.state) ?? 0) + 1);
    byYear.set(c.year, (byYear.get(c.year) ?? 0) + 1);
  }
  return [
    "ARCHIVE SUMMARY:",
    `  • First show on record: ${concerts[0].date} (${concerts[0].headliner}, ${concerts[0].venue})`,
    `  • ${concerts.length} shows total, spanning ${concerts[0].year}–${concerts[concerts.length - 1].year}`,
    `  • "show #N" above is that show's place in the archive in date order: #1 is the first show on record, #${concerts.length} the latest`,
    `  • Shows by state: ${[...byState.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} (${n})`).join(", ")}`,
  ];
}

const NOT_IN_THE_DATA = [
  "NOT IN THE DATA — never confirm or supply a specific value for any of these unless it appears in OWNER-CONFIRMED PERSONAL FACTS below:",
  "  • birth year or age at any show",
  "  • residence, beyond what OWNER-CONFIRMED PERSONAL FACTS states",
  "  • crowd size or attendance figures",
  "  • set times or door times",
  "  • ticket stubs or any physical ticket detail",
];

function ownerFactsSection(sources: FactSheetSources): string[] {
  const facts = sources.ownerFacts?.facts ?? [];
  if (!facts.length) return [];
  return [
    "OWNER-CONFIRMED PERSONAL FACTS (true, and safe to state as fact):",
    ...facts.map((f) => `  • ${f.fact}`),
  ];
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * The fact sheet for one post: every show by its subject artists and venues,
 * their album timing and setlists, an archive-wide summary, and the two fixed
 * disclaimers (what is not in the data, what the owner has separately confirmed).
 *
 * Returns a single rendered block of text rather than a structured object,
 * because its only consumer is a prompt — a caller that needs the underlying
 * data for something else should read `concerts`/`sources` directly rather than
 * parse this back out.
 */
export function buildFactSheet(subjects: FactSheetSubjects, sources: FactSheetSources): string {
  const today = sources.today ?? todayISO();
  const artists = [...new Set(subjects.artists)];
  const venues = [...new Set(subjects.venues)];

  const sections: string[] = [`TODAY IS ${today}.`, ""];

  for (const a of artists) sections.push(...artistSection(a, sources), "");
  for (const v of venues) sections.push(...venueSection(v, sources), "");

  const timing = albumTimingSection(artists, sources);
  if (timing.length) sections.push(...timing, "");

  const setlists = setlistSection(artists, sources);
  if (setlists.length) sections.push(...setlists, "");

  sections.push(...archiveSummary(sources), "");
  sections.push(...ownerFactsSection(sources), "");
  sections.push(...NOT_IN_THE_DATA);

  return sections.join("\n").trim();
}
