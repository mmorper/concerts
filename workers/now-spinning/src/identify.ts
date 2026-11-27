/**
 * The lookup: Shazam's artist and title in, the archive's history with that song out, with every
 * word the screen will show already written.
 *
 * The honesty rule governs all of it: the screen never states what the data can't back up.
 *   - "Never heard this one live" only when every night has a setlist, nobody else played it at a
 *     show Mike was at, and nothing close is on a setlist either.
 *   - If the index can't be trusted (missing, wrong version, built with different rules, or a file
 *     it lists won't load), the answer is `unknown` — never `none`, which would be a false claim.
 *
 * `lookup` takes a loader rather than fetching, so the same code runs in the Worker (cached
 * fetches) and in tests (an in-memory index).
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Lookup, §Screen states
 */

import { actKey, actKeysFor, foldSongTitle, nearKey, rulesFingerprint, stripFeat, tidyTitle } from "./match.js";
import {
  INDEX_VERSION,
  type ActFile,
  type CoverRow,
  type CoversFile,
  type Manifest,
  type Night,
  type Photo,
  type Track,
  type TrackInput,
} from "./types.js";

/** Reads one index file by its path under `data/now-spinning/`, or null if it can't be loaded. */
export type Loader = (path: string) => Promise<unknown | null>;

export const SITE = "https://concerts.morperhaus.org";
const MAX_NIGHTS = 4;
const MAX_PHOTOS = 5;

// ── Formatting ─────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2023-03-28" → "Mar 28, 2023". Written out, so it never depends on a runtime's locale data. */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** The colour of a record nobody has a sleeve for, derived from its title. */
export function accentHue(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** "A", "A and B", "A, B and C". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const timesPhrase = (n: number) => (n === 1 ? "once" : `${n} times`);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ── The lookup ─────────────────────────────────────────────────────────────────

function isManifest(x: unknown): x is Manifest {
  const m = x as Manifest | null;
  return (
    !!m &&
    m.v === INDEX_VERSION &&
    typeof m.rules === "string" &&
    !!m.acts &&
    typeof m.acts === "object" &&
    !Array.isArray(m.acts) &&
    Array.isArray(m.covers) &&
    Array.isArray(m.ambiguous)
  );
}

/** What the screen shows when the archive can't be trusted: the song, and nothing about history. */
export function unknownTrack(input: TrackInput): Track {
  const title = tidyTitle(input.title);
  const album = input.album ? { title: input.album, ...(input.artworkUrl ? { coverUrl: input.artworkUrl } : {}) } : null;
  return {
    title,
    artist: stripFeat(input.artist),
    album,
    screen: "unknown",
    headline: "The archive isn't answering right now.",
    lines: [],
    nights: [],
    moreNights: 0,
    photos: [],
    accentHue: accentHue(album?.title || title),
  };
}

export async function lookup(input: TrackInput, load: Loader): Promise<Track> {
  const manifest = await load("manifest.json");
  if (!isManifest(manifest) || manifest.rules !== rulesFingerprint()) return unknownTrack(input);

  // A name with no key ("The The" drops both its words; "!!!" has no letters) can't be looked up,
  // so nothing can be said about it. Saying "not in the archive" would be a guess.
  const actKeys = actKeysFor(input.artist);
  if (!actKeys.length) return unknownTrack(input);

  // The act: the full name first, then with a featured act dropped.
  let act: ActFile | null = null;
  for (const key of actKeys) {
    if (manifest.ambiguous.includes(key)) return unknownTrack(input);
    const slug = manifest.acts[key];
    if (!slug) continue;
    act = (await load(`acts/${slug}.json`)) as ActFile | null;
    if (!act || !Array.isArray(act.nights) || !Array.isArray(act.songs)) return unknownTrack(input);
    break;
  }

  // Who else played this act's songs, under every name it goes by.
  const coverKeys = new Set<string>(actKeys);
  for (const name of act?.names ?? []) coverKeys.add(actKey(name));
  const rows = new Map<string, CoverRow>();
  for (const key of coverKeys) {
    if (!manifest.covers.includes(key)) continue;
    const file = (await load(`covers/${key}.json`)) as CoversFile | null;
    if (!file || !Array.isArray(file.rows)) return unknownTrack(input);
    for (const r of file.rows) {
      if (act && r.bySlug === act.slug) continue;
      rows.set(`${r.n}|${r.bySlug}|${r.d}`, r);
    }
  }

  return describe(input, act, [...rows.values()].sort((a, b) => cmp(a.d, b.d)));
}

interface HeardNight {
  night: Night;
  /** Heard only inside a medley that night. */
  medley: boolean;
}

/** Pure: everything after the files are loaded. Exported for tests. */
export function describe(input: TrackInput, act: ActFile | null, covers: CoverRow[]): Track {
  const t = foldSongTitle(input.title);

  // Strict matches on the act's own setlists.
  const matches = act && t ? act.songs.filter((s) => s.k.includes(t)) : [];
  const whole = matches.find((s) => foldSongTitle(s.n) === t) ?? null;
  const byNight = new Map<number, boolean>();
  for (const s of matches) {
    const part = foldSongTitle(s.n) !== t;
    for (const i of s.on) byNight.set(i, byNight.has(i) ? byNight.get(i)! && part : part);
  }
  const heard: HeardNight[] = [...byNight.entries()]
    .map(([i, medley]) => ({ night: act!.nights[i], medley }))
    .filter((h) => h.night)
    .sort((a, b) => cmp(a.night.d, b.night.d));

  const coverOfThis = t ? covers.filter((r) => r.k.includes(t)) : [];
  const nk = nearKey(input.title);
  const near = act && !matches.length && nk.length >= 4 ? act.songs.filter((s) => s.nk.includes(nk)) : [];

  const title = whole ? whole.n : tidyTitle(input.title);
  const artist = act ? act.name : stripFeat(input.artist);
  const archiveAlbum = (whole ?? matches.find((s) => s.album))?.album ?? null;
  const album = archiveAlbum
    ? { title: archiveAlbum.t, ...(archiveAlbum.y ? { year: archiveAlbum.y } : {}), ...(archiveAlbum.c ? { coverUrl: archiveAlbum.c } : {}) }
    : input.album
      ? { title: input.album, ...(input.artworkUrl ? { coverUrl: input.artworkUrl } : {}) }
      : null;

  const base = { title, artist, album, accentHue: accentHue(album?.title || title) };
  const performers = (rs: CoverRow[]) => [...new Set(rs.map((r) => r.by))];

  // 1. heard
  if (heard.length) {
    const n = heard.length;
    const first = heard[0].night.d.slice(0, 4);
    const last = heard[n - 1].night.d;
    const lines: string[] = [];
    if (n > 1) lines.push(`First in ${first} · most recent ${dateLabel(last)}`);
    if (coverOfThis.length) lines.push(`${listOf(performers(coverOfThis))} played it too.`);
    return {
      ...base,
      screen: "heard",
      count: { n, times: true },
      headline: n === 1 ? "You heard this one live, once." : `You've heard this one live ${n} times.`,
      lines,
      ...ownNights(heard),
      photos: photosOf(heard.map((h) => ({ d: h.night.d, venue: h.night.venue, photos: h.night.photos }))),
    };
  }

  const seen = act?.nights.length ?? 0;
  const withSetlist = act?.nights.filter((x) => x.setlist).length ?? 0;

  // 2. seen the act, heard this song from someone else
  if (act && seen && coverOfThis.length) {
    const k = coverOfThis.length;
    const own =
      withSetlist === seen
        ? `${artist} didn't play it ${seen === 1 ? "the night" : "on the nights"} you saw them.`
        : withSetlist === 0
          ? `There's no ${artist} setlist from ${seen === 1 ? "that night" : "those nights"}, so maybe they played it too.`
          : `It isn't on the ${withSetlist} ${artist} ${plural(withSetlist, "setlist", "setlists")} I have. ${seen - withSetlist} ${plural(seen - withSetlist, "night has", "nights have")} no setlist.`;
    return {
      ...base,
      screen: "seen-cover",
      count: { n: k, times: true },
      headline: `You've seen ${artist} ${timesPhrase(seen)}, and you heard ${listOf(performers(coverOfThis))} play this one${k > 1 ? ` ${k} times` : ""}.`,
      lines: [own],
      ...coverNights(coverOfThis, (r) => r.by),
      photos: photosOf(coverOfThis),
    };
  }

  // 3. seen the act, song not found anywhere
  if (act && seen) {
    const nearNights = new Set(near.flatMap((s) => s.on)).size;
    let headline: string;
    let line: string | null;
    if (!t) {
      // The title has no key ("!!!", or empty), so nothing was compared: say only what's known.
      headline = `You've seen ${artist} ${timesPhrase(seen)}.`;
      line = null;
    } else if (near.length) {
      const firstNight = act.nights[Math.min(...near.flatMap((s) => s.on))];
      headline = `You've seen ${artist} ${timesPhrase(seen)}.`;
      line = `Something close to it is on ${nearNights === 1 ? `the setlist from ${dateLabel(firstNight.d)}` : `${nearNights} of those setlists`}: “${near[0].n}”.`;
    } else if (withSetlist === seen) {
      headline = `You've seen ${artist} ${timesPhrase(seen)}, but never heard this one live.`;
      line = "It isn't on any of the setlists from those nights.";
    } else {
      headline = `You've seen ${artist} ${timesPhrase(seen)}.`;
      line =
        withSetlist === 0
          ? `There's no setlist from ${seen === 1 ? "that night" : "those nights"}, so maybe you did.`
          : `It isn't on the ${withSetlist} ${plural(withSetlist, "setlist", "setlists")} I have. ${seen - withSetlist} ${plural(seen - withSetlist, "night has", "nights have")} no setlist.`;
    }
    const nights = act.nights.map((night) => ({ night, medley: false }));
    return {
      ...base,
      screen: "seen",
      count: { n: seen, times: true },
      headline,
      lines: line ? [line] : [],
      ...ownNights(nights),
      photos: photosOf(act.nights),
    };
  }

  // 4. never seen the act, but someone else played this song
  if (coverOfThis.length) {
    return {
      ...base,
      screen: "cover-of-this",
      count: { n: coverOfThis.length, times: true },
      headline: `You've never seen ${artist}. But you've heard this one live, played by ${listOf(performers(coverOfThis))}.`,
      lines: ["Not in the archive yet. This song is, though."],
      ...coverNights(coverOfThis, (r) => r.by),
      photos: photosOf(coverOfThis),
    };
  }

  // 5. never seen the act, but others played other songs of theirs
  if (covers.length) {
    const songs = [...new Set(covers.map((r) => r.n.replace(/"/g, "")))];
    return {
      ...base,
      screen: "covers",
      count: { n: songs.length, times: false },
      headline: `You've never seen ${artist}, but you've heard ${songs.length === 1 ? "one of their songs" : `${songs.length} of their songs`} live, in other hands.`,
      lines: [],
      ...coverNights(covers, (r) => `“${r.n.replace(/"/g, "")}” · ${r.by}`),
      photos: photosOf(covers),
    };
  }

  // 6. no connection
  return {
    ...base,
    screen: "none",
    headline: "Not in the archive. Yet.",
    lines: [
      `No ${artist} show on the books, and nobody you've seen has played one of their songs either.`,
      "Maybe this is the one you go see next.",
    ],
    nights: [],
    moreNights: 0,
    photos: [],
  };
}

// ── Nights and photos ──────────────────────────────────────────────────────────

function ownNights(list: HeardNight[]): Pick<Track, "nights" | "moreNights"> {
  const newest = [...list].reverse();
  return {
    nights: newest.slice(0, MAX_NIGHTS).map(({ night, medley }) => ({
      date: night.d,
      dateLabel: dateLabel(night.d),
      // A medley note takes the city's place, so the line stays readable.
      text: `${night.venue}${medley ? " · in a medley" : night.city ? `, ${night.city}` : ""}${night.role === "o" ? " · opening" : ""}`,
      hasPhotos: night.photos.length > 0,
    })),
    moreNights: Math.max(0, list.length - MAX_NIGHTS),
  };
}

function coverNights(rows: CoverRow[], label: (r: CoverRow) => string): Pick<Track, "nights" | "moreNights"> {
  const newest = [...rows].reverse();
  return {
    nights: newest.slice(0, MAX_NIGHTS).map((r) => ({
      date: r.d,
      dateLabel: dateLabel(r.d),
      text: `${label(r)} · ${r.venue}`,
      hasPhotos: r.photos.length > 0,
    })),
    moreNights: Math.max(0, rows.length - MAX_NIGHTS),
  };
}

/** The index's thumbnail box, if it's a usable one: four numbers, inside the image. */
function boxOf(t: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!Array.isArray(t) || t.length !== 4 || !t.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [x, y, w, h] = t as number[];
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) return null;
  return { x, y, w, h };
}

/** Photos from these nights, newest night first. Every caption names the night it is from. */
function photosOf(nights: { d: string; venue: string; photos: Photo[] }[]): Track["photos"] {
  const out: Track["photos"] = [];
  for (const n of [...nights].sort((a, b) => cmp(b.d, a.d))) {
    for (const p of n.photos) {
      const thumb = boxOf(p.t);
      out.push({ url: `${SITE}${p.u}`, caption: `${dateLabel(n.d)} · ${n.venue}`, fx: p.fx, fy: p.fy, ...(thumb ? { thumb } : {}) });
      if (out.length === MAX_PHOTOS) return out;
    }
  }
  return out;
}

/** ISO dates (YYYY-MM-DD) sort as plain strings. localeCompare would load ICU collation on a cold isolate (~8 ms of CPU). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
