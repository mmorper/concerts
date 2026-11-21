#!/usr/bin/env tsx
/**
 * Build Now Spinning's index: public/data/now-spinning/
 *
 *   manifest.json          which acts exist (by every name they're billed under), version, rules
 *   acts/<slug>.json       one per act, its billings merged: nights, songs, albums, photos
 *   covers/<actKey>.json   one per act whose songs someone else played at a show Mike was at
 *
 * Many small files rather than one: the Worker runs on Cloudflare's free tier (10 ms of CPU per
 * request), and parsing a single 360 KB file was too close to that.
 *
 * Runs inside `npm run build`, so it must NEVER fail the site's build. Data it can't use is left
 * out and recorded in the manifest's `problems`; the real-data test
 * (test/pipeline/now-spinning-index.test.ts) is what turns that red. The output is gitignored:
 * every deploy publishes an index built from exactly the data it ships with.
 *
 * Usage:
 *   npx tsx scripts/build-now-spinning-index.ts
 *   npx tsx scripts/build-now-spinning-index.ts --out <dir> --only depeche-mode,devo --covers wham,devo
 *     (a subset, for the Worker's frozen test fixture)
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArtistName } from "../src/utils/normalize.ts";
import { lookupSongAlbum, type SongAlbumLookupContext } from "./utils/song-album-lookup.ts";
import { actKey, nearKeys, rulesFingerprint, titleKeys } from "../workers/now-spinning/src/match.ts";
import { INDEX_VERSION, type ActFile, type Album, type CoverRow, type CoversFile, type Manifest, type Night, type Photo } from "../workers/now-spinning/src/types.ts";

// ── Inputs ─────────────────────────────────────────────────────────────────────

interface Concert {
  id: string;
  date: string;
  headliner: string;
  headlinerNormalized: string;
  openers: string[];
  venue: string;
  city: string;
}
interface SetlistSong {
  name?: string;
  tape?: boolean;
  cover?: { name?: string } | null;
}
interface SetlistEntry {
  concertId: string;
  artistName: string;
  date: string;
  setlist: { sets?: { set?: { song?: SetlistSong[] }[] } } | null;
}
interface SongAlbumRow {
  albumTitle?: string;
  mbid?: string;
  releaseDate?: string;
  coverAvailable?: boolean;
}
interface MediaAsset {
  kind: string;
  subject?: string;
  url: string;
  date: string;
  artistNormalized?: string;
  hero?: boolean;
  order?: number;
  crop?: { x: number; y: number; w: number; h: number } | null;
}

export interface IndexInputs {
  concerts: Concert[];
  setlists: SetlistEntry[];
  sameAct: { canonical: string; billings: string[] }[];
  songAlbums: Record<string, SongAlbumRow>;
  albumCovers: Record<string, string>;
  media: MediaAsset[];
  lookupContext?: SongAlbumLookupContext;
}

export interface BuiltIndex {
  manifest: Manifest;
  /** Path under now-spinning/ → contents. Includes manifest.json. */
  files: Record<string, unknown>;
}

const MAX_PHOTOS_PER_NIGHT = 3;
const round = (n: number) => Math.round(n * 1000) / 1000;

// ── Build ──────────────────────────────────────────────────────────────────────

export function buildIndex(inp: IndexInputs, generatedAt = new Date().toISOString()): BuiltIndex {
  const problems: Manifest["problems"] = [];
  const canonOf = new Map<string, string>();
  for (const g of inp.sameAct ?? []) for (const b of g.billings ?? []) canonOf.set(b, g.canonical);
  const canon = (slug: string) => canonOf.get(slug) ?? slug;

  // Photos by "date|billing", hero frames first, then the order the media pipeline set.
  const photos = new Map<string, Photo[]>();
  const images = (inp.media ?? [])
    .filter((m) => m.kind === "image" && m.subject === "artist" && m.artistNormalized && m.url)
    .sort((a, b) => Number(!!b.hero) - Number(!!a.hero) || (a.order ?? 0) - (b.order ?? 0));
  for (const m of images) {
    const key = `${m.date}|${m.artistNormalized}`;
    const list = photos.get(key) ?? [];
    if (list.length >= MAX_PHOTOS_PER_NIGHT) continue;
    const c = m.crop;
    list.push({ u: m.url, fx: c ? round(c.x + c.w / 2) : 0.5, fy: c ? round(c.y + c.h / 2) : 0.5 });
    photos.set(key, list);
  }

  // Setlists by "concertId|billing", performed songs only.
  const setlistOf = new Map<string, SetlistSong[]>();
  for (const e of inp.setlists ?? []) {
    const songs: SetlistSong[] = [];
    for (const set of e.setlist?.sets?.set ?? []) for (const s of set.song ?? []) if (s.name?.trim() && !s.tape) songs.push(s);
    if (songs.length) setlistOf.set(`${e.concertId}|${normalizeArtistName(e.artistName)}`, songs);
  }

  // Acts and their nights, billings merged into the canonical act.
  interface Building {
    slug: string;
    billingNames: Map<string, string>; // billing slug → name
    nights: Night[];
    nightByDate: Map<string, number>;
    songs: Map<string, ActFile["songs"][number]>;
  }
  const acts = new Map<string, Building>();
  const billingInfo: { c: Concert; billing: string; name: string; role: "h" | "o" }[] = [];
  for (const c of inp.concerts ?? []) {
    billingInfo.push({ c, billing: c.headlinerNormalized, name: c.headliner, role: "h" });
    for (const o of c.openers ?? []) billingInfo.push({ c, billing: normalizeArtistName(o), name: o, role: "o" });
  }
  for (const { c, billing, name, role } of [...billingInfo].sort((a, b) => a.c.date.localeCompare(b.c.date))) {
    const slug = canon(billing);
    const act: Building = acts.get(slug) ?? { slug, billingNames: new Map(), nights: [], nightByDate: new Map(), songs: new Map() };
    acts.set(slug, act);
    if (!act.billingNames.has(billing)) act.billingNames.set(billing, name);
    const setlist = setlistOf.get(`${c.id}|${billing}`);
    let i = act.nightByDate.get(c.date);
    if (i === undefined) {
      i = act.nights.length;
      act.nightByDate.set(c.date, i);
      act.nights.push({ d: c.date, billing, venue: c.venue, city: c.city, role, setlist: !!setlist, photos: photos.get(`${c.date}|${billing}`) ?? [] });
    } else {
      // Two billings of one act on one night: one night, headlining if either was.
      const n = act.nights[i];
      if (role === "h") n.role = "h";
      n.setlist ||= !!setlist;
      if (!n.photos.length) n.photos = photos.get(`${c.date}|${billing}`) ?? [];
    }
    for (const s of setlist ?? []) {
      const title = s.name!.trim();
      const k = titleKeys(title);
      if (!k.length) {
        problems.push({ kind: "no-key", what: `${name} — "${title}" (${c.date})` });
        continue;
      }
      const song = act.songs.get(title) ?? { n: title, k, nk: nearKeys(title), on: [], album: albumFor(inp, name, title) };
      if (!song.on.includes(i)) song.on.push(i);
      act.songs.set(title, song);
    }
  }

  // Manifest: every billing name's actKey → its act. Two different acts on one key are ambiguous.
  const keyToAct = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const act of acts.values()) {
    for (const name of act.billingNames.values()) {
      const key = actKey(name);
      if (!key) {
        // "The The" folds to nothing: the act couldn't be found, and the screen would say it isn't
        // in the archive. Report it, so the real-data test goes red until actKey handles it.
        problems.push({ kind: "no-act-key", what: `${name} (${act.slug})` });
        continue;
      }
      const prev = keyToAct.get(key);
      if (prev && prev !== act.slug) {
        if (!ambiguous.has(key)) problems.push({ kind: "ambiguous-act", what: `${key}: ${prev} and ${act.slug}` });
        ambiguous.add(key);
      } else keyToAct.set(key, act.slug);
    }
  }
  for (const key of ambiguous) keyToAct.delete(key);

  // Covers: songs by an act that someone else played, filed under the original act's key.
  const coverRows = new Map<string, CoverRow[]>();
  for (const { c, billing, name } of billingInfo) {
    for (const s of setlistOf.get(`${c.id}|${billing}`) ?? []) {
      const original = s.cover?.name?.trim();
      if (!original) continue;
      const key = actKey(original);
      if (!key) continue;
      const originalAct = keyToAct.get(key);
      if (originalAct && originalAct === canon(billing)) continue; // an act playing its own song
      const k = titleKeys(s.name!.trim());
      if (!k.length) continue;
      const list = coverRows.get(key) ?? [];
      const row: CoverRow = { n: s.name!.trim(), k, by: name, bySlug: canon(billing), d: c.date, venue: c.venue, city: c.city, photos: photos.get(`${c.date}|${billing}`) ?? [] };
      if (!list.some((r) => r.n === row.n && r.bySlug === row.bySlug && r.d === row.d)) list.push(row);
      coverRows.set(key, list);
    }
  }

  const files: Record<string, unknown> = {};
  for (const act of acts.values()) {
    const names = [...act.billingNames.values()];
    const file: ActFile = {
      slug: act.slug,
      name: act.billingNames.get(act.slug) ?? names[0],
      names,
      nights: act.nights,
      songs: [...act.songs.values()].sort((a, b) => a.n.localeCompare(b.n)),
    };
    files[`acts/${act.slug}.json`] = file;
  }
  for (const [key, rows] of coverRows) {
    const file: CoversFile = { rows: rows.sort((a, b) => a.d.localeCompare(b.d)) };
    files[`covers/${key}.json`] = file;
  }

  const manifest: Manifest = {
    v: INDEX_VERSION,
    generatedAt,
    rules: rulesFingerprint(),
    acts: Object.fromEntries([...keyToAct].sort(([a], [b]) => a.localeCompare(b))),
    covers: [...coverRows.keys()].sort(),
    ambiguous: [...ambiguous].sort(),
    problems,
  };
  files["manifest.json"] = manifest;
  return { manifest, files };
}

function albumFor(inp: IndexInputs, billingName: string, title: string): Album | null {
  const row = lookupSongAlbum(inp.songAlbums, billingName, title, inp.lookupContext ?? {});
  if (!row?.albumTitle) return null;
  const cover = row.mbid ? inp.albumCovers?.[row.mbid] : undefined;
  return {
    t: row.albumTitle,
    y: (row.releaseDate ?? "").slice(0, 4),
    c: cover
      ? cover.replace("100x100bb", "600x600bb")
      : row.coverAvailable && row.mbid
        ? `https://coverartarchive.org/release-group/${row.mbid}/front-500.jpg`
        : null,
  };
}

/** Keep only some acts and covers files: for the Worker's small, frozen test fixture. */
export function subsetIndex(built: BuiltIndex, onlyActs: string[], onlyCovers: string[]): BuiltIndex {
  const acts = new Set(onlyActs);
  const covers = new Set(onlyCovers);
  const manifest: Manifest = {
    ...built.manifest,
    acts: Object.fromEntries(Object.entries(built.manifest.acts).filter(([, slug]) => acts.has(slug))),
    covers: built.manifest.covers.filter((k) => covers.has(k)),
    ambiguous: [],
    problems: [],
  };
  const files: Record<string, unknown> = { "manifest.json": manifest };
  for (const slug of acts) if (built.files[`acts/${slug}.json`]) files[`acts/${slug}.json`] = built.files[`acts/${slug}.json`];
  for (const key of manifest.covers) files[`covers/${key}.json`] = built.files[`covers/${key}.json`];
  return { manifest, files };
}

// ── CLI ────────────────────────────────────────────────────────────────────────

export function readInputs(dataDir: string): IndexInputs {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf-8"));
  const aliases = read("artist-aliases.json");
  return {
    concerts: read("concerts.json").concerts,
    setlists: read("setlists-cache.json").entries,
    sameAct: aliases.sameAct ?? [],
    songAlbums: read("song-albums.json").songs ?? {},
    albumCovers: read("album-covers.json").covers ?? {},
    media: read("media-index.json").assets ?? [],
    lookupContext: { discographyKeys: aliases.discographyKeys ?? [], artistsMetadata: read("artists-metadata.json") },
  };
}

export function writeIndex(built: BuiltIndex, outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [rel, data] of Object.entries(built.files)) {
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data) + "\n", "utf-8");
  }
}

function main(): void {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = arg("--out") ?? path.join(root, "public", "data", "now-spinning");
  try {
    let built = buildIndex(readInputs(path.join(root, "public", "data")));
    const only = arg("--only");
    if (only) built = subsetIndex(built, only.split(","), (arg("--covers") ?? "").split(",").filter(Boolean));
    writeIndex(built, outDir);
    // The state contract's examples, so /now-spinning?fixture=heard renders on any build of the
    // site. Not for a subset build, which is the test fixture.
    if (!only) fs.copyFileSync(path.join(root, "test", "fixtures", "now-spinning-states.json"), path.join(outDir, "states.json"));
    const n = Object.keys(built.files).length;
    console.log(`✓ Now Spinning index: ${n} files, ${Object.keys(built.manifest.acts).length} act names, ${built.manifest.covers.length} covers files → ${path.relative(root, outDir)}`);
    if (built.manifest.problems.length) {
      console.warn(`⚠️  ${built.manifest.problems.length} item(s) left out of the Now Spinning index:`);
      for (const p of built.manifest.problems) console.warn(`   ${p.kind}: ${p.what}`);
    }
  } catch (e) {
    // Never fail the site's build over this index. The Worker answers "unknown" without it, and
    // the real-data test catches the cause.
    console.warn("⚠️  Now Spinning index not built:", e instanceof Error ? e.message : e);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
