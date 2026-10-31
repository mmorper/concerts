// GET /api/ask/cover/<release-group mbid>?size=250|500 → 302 to the album's iTunes sleeve, or 404.
//
// Why: Cover Art Archive is exact (keyed by the MusicBrainz id the archive already holds) but
// unreliable — on 2026-10-31 Dare, Hysteria, Secrets and Credo all 500'd, thumbnails and
// originals alike. Apple's artwork CDN does not. So the cards try this first and keep CAA as the
// next rung (src/components/ask/media.ts coverUrls); a 404 here just moves the <img> down the
// ladder, so a miss costs one request, never a broken sleeve.
//
// Resolution, once per album: the archive's own album-eras / song-albums data (MusicBrainz only
// for an id not in them) → (artist, title) → iTunes album search → the result whose artist AND title match after folding (edition suffixes like
// "(Remastered)", "(Deluxe Edition)", " - EP" stripped on both sides). No fuzzy guessing: a wrong
// sleeve is worse than the derived tile. The answer is kept in KV, so MusicBrainz (1 req/s) and
// iTunes (~20/min) are each asked about an album once, not once per view.

import type { Env } from "./types.js";
import { getAlbumEras, getSongAlbums } from "../../mcp-server/src/data.js";
import type { AlbumEras, SongAlbums } from "../../mcp-server/src/types.js";

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UA = "MorperhausConcerts/1.0 ( https://concerts.morperhaus.org )";
const HIT_TTL = 60 * 60 * 24 * 90; // KV: a resolved sleeve
const MISS_TTL = 60 * 60 * 24 * 7; // KV: iTunes has no matching album — ask again in a week

/** What KV holds per album: the iTunes artwork URL template, or null for "no match". */
type Stored = { art: string | null };

export interface ItunesAlbum {
  collectionName: string;
  artistName: string;
  artworkUrl100?: string;
  collectionType?: string;
}

/** Lowercase, accents off, "&" → "and", punctuation and a leading "the" dropped. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

/** A title without the edition dressing stores add: "(2003 Remaster)", "[Deluxe]", " - EP". */
export function bareTitle(s: string): string {
  return fold(s.replace(/\s+-\s+(single|ep)$/i, "").replace(/\s*[([][^)\]]*[)\]]/g, " ")) || fold(s);
}

/** The iTunes album that is this record, or null. Prefers the undressed edition. */
export function pickAlbum(results: ItunesAlbum[], artist: string, title: string): ItunesAlbum | null {
  const a = fold(artist);
  const t = bareTitle(title);
  const hits = results.filter((r) => r.artworkUrl100 && fold(r.artistName) === a && bareTitle(r.collectionName) === t);
  return hits.find((r) => fold(r.collectionName) === fold(title)) ?? hits[0] ?? null;
}

/** artworkUrl100 is ".../100x100bb.jpg"; the CDN serves any square size from the same path. */
export function artAt(template: string, px: number): string {
  return template.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${px}x${px}bb.$1`);
}

/** Who made the record and what it is called — from the archive's own data, else MusicBrainz. */
export interface Identity {
  artist: string;
  title: string;
}

/** Find an mbid in the archive's own files: album-eras (every studio album), then song-albums. */
export function identifyLocally(mbid: string, eras: AlbumEras | null, songs: SongAlbums | null): Identity | null {
  for (const a of Object.values(eras?.artists ?? {})) {
    const hit = a.studioAlbums?.find((x) => x.mbid === mbid);
    if (hit) return { artist: a.displayName, title: hit.title };
  }
  for (const [key, s] of Object.entries(songs?.songs ?? {})) {
    if (s.mbid !== mbid) continue;
    const artistKey = s.originalArtistKey ?? key.split("::")[0];
    const name = eras?.artists?.[artistKey]?.displayName;
    if (name) return { artist: name, title: s.albumTitle };
  }
  return null;
}

type Step = { ok: true; value: Identity } | { ok: false; reason: string; transient: boolean };

async function identifyRemotely(mbid: string): Promise<Step> {
  const mb = await fetch(`https://musicbrainz.org/ws/2/release-group/${mbid}?inc=artist-credits&fmt=json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (mb.status === 404) return { ok: false, reason: "musicbrainz: unknown id", transient: false };
  if (!mb.ok) return { ok: false, reason: `musicbrainz: HTTP ${mb.status}`, transient: true };
  const rg = (await mb.json()) as { title?: string; "artist-credit"?: Array<{ name: string; joinphrase?: string }> };
  const lead = rg["artist-credit"]?.[0]?.name;
  if (!rg.title || !lead) return { ok: false, reason: "musicbrainz: no title/artist", transient: false };
  return { ok: true, value: { artist: lead, title: rg.title } };
}

/** iTunes album search, strict match. Tries "artist title", then the title alone. */
async function findOnItunes(id: Identity): Promise<{ art: string | null; reason: string; transient: boolean }> {
  let seen = 0;
  for (const term of [`${id.artist} ${id.title}`, id.title]) {
    const q = new URLSearchParams({ term, entity: "album", media: "music", limit: "50", country: "US" });
    const it = await fetch(`https://itunes.apple.com/search?${q}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!it.ok) return { art: null, reason: `itunes: HTTP ${it.status}`, transient: true };
    const body = (await it.json()) as { results?: ItunesAlbum[] };
    seen += body.results?.length ?? 0;
    const hit = pickAlbum(body.results ?? [], id.artist, id.title);
    if (hit?.artworkUrl100) return { art: hit.artworkUrl100, reason: `itunes: matched "${hit.collectionName}"`, transient: false };
  }
  return { art: null, reason: `itunes: no album matching "${id.artist}" / "${id.title}" in ${seen} results`, transient: false };
}

export async function resolve(mbid: string, local: Identity | null): Promise<Stored & { reason: string; transient: boolean }> {
  let id = local;
  let via = "archive data";
  if (!id) {
    const r = await identifyRemotely(mbid);
    if (!r.ok) return { art: null, reason: r.reason, transient: r.transient };
    id = r.value;
    via = "musicbrainz";
  }
  const found = await findOnItunes(id);
  return { art: found.art, reason: `${via} → ${found.reason}`, transient: found.transient };
}

export async function handleCover(request: Request, env: Env, ctx: ExecutionContext, mbid: string): Promise<Response> {
  // Every response says why (X-Cover), so a miss can be diagnosed from the browser.
  const headers = (why: string, maxAge: number): Record<string, string> => ({
    "Cache-Control": `public, max-age=${maxAge}`,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "X-Cover",
    "X-Cover": why.replace(/[^\x20-\x7e]/g, "?"),
  });
  const notFound = (why: string, maxAge: number) => new Response(`No cover: ${why}`, { status: 404, headers: headers(why, maxAge) });
  if (!MBID.test(mbid)) return notFound("not a release-group id", 86400);
  const params = new URL(request.url).searchParams;
  const px = params.get("size") === "500" ? 600 : 300;
  const fresh = params.has("fresh"); // skip the stored answer — for checking a fix

  const key = `cover:v2:${mbid}`;
  let stored = fresh ? null : ((await env.ASK_CONTROL.get(key, "json")) as (Stored & { reason?: string }) | null);
  let why = stored ? `stored: ${stored.reason ?? ""}` : "";
  if (!stored) {
    let r: Stored & { reason: string; transient: boolean };
    try {
      const reused = env as unknown as Parameters<typeof getAlbumEras>[0];
      const [eras, songs] = await Promise.all([getAlbumEras(reused, ctx), getSongAlbums(reused, ctx)]);
      r = await resolve(mbid, identifyLocally(mbid, eras, songs));
    } catch (e) {
      r = { art: null, reason: `error: ${e instanceof Error ? e.message : String(e)}`, transient: true };
    }
    why = r.reason;
    if (r.transient) return notFound(why, 60); // upstream hiccup: don't remember it
    stored = { art: r.art, reason: r.reason };
    ctx.waitUntil(env.ASK_CONTROL.put(key, JSON.stringify(stored), { expirationTtl: r.art ? HIT_TTL : MISS_TTL }));
  }
  if (!stored.art) return notFound(why, 3600);
  return new Response(null, { status: 302, headers: { ...headers(why, 604800), Location: artAt(stored.art, px) } });
}
