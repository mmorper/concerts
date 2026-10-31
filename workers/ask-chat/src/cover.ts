// GET /api/ask/cover/<release-group mbid>?size=250|500 → 302 to the album's iTunes sleeve, or 404.
//
// Why: Cover Art Archive is exact (keyed by the MusicBrainz id the archive already holds) but
// unreliable — on 2026-10-31 Dare, Hysteria, Secrets and Credo all 500'd, thumbnails and
// originals alike. Apple's artwork CDN does not. So the cards try this first and keep CAA as the
// next rung (src/components/ask/media.ts coverUrls); a 404 here just moves the <img> down the
// ladder, so a miss costs one request, never a broken sleeve.
//
// Resolution, once per album: MusicBrainz release-group → (artist credit, title) → iTunes album
// search → the result whose artist AND title match after folding (edition suffixes like
// "(Remastered)", "(Deluxe Edition)", " - EP" stripped on both sides). No fuzzy guessing: a wrong
// sleeve is worse than the derived tile. The answer is kept in KV, so MusicBrainz (1 req/s) and
// iTunes (~20/min) are each asked about an album once, not once per view.

import type { Env } from "./types.js";

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

async function resolve(mbid: string): Promise<Stored | "error"> {
  const mb = await fetch(`https://musicbrainz.org/ws/2/release-group/${mbid}?inc=artist-credits&fmt=json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (mb.status === 404) return { art: null };
  if (!mb.ok) return "error";
  const rg = (await mb.json()) as { title?: string; "artist-credit"?: Array<{ name: string; joinphrase?: string }> };
  const credit = (rg["artist-credit"] ?? []).map((c) => c.name + (c.joinphrase ?? "")).join("").trim();
  if (!rg.title || !credit) return { art: null };

  const q = new URLSearchParams({ term: `${credit} ${rg.title}`, entity: "album", media: "music", limit: "25", country: "US" });
  const it = await fetch(`https://itunes.apple.com/search?${q}`, { headers: { "User-Agent": UA } });
  if (!it.ok) return "error";
  const body = (await it.json()) as { results?: ItunesAlbum[] };
  const lead = (rg["artist-credit"] ?? [])[0]?.name ?? credit;
  const hit = pickAlbum(body.results ?? [], credit, rg.title) ?? (lead !== credit ? pickAlbum(body.results ?? [], lead, rg.title) : null);
  return { art: hit?.artworkUrl100 ?? null };
}

export async function handleCover(request: Request, env: Env, ctx: ExecutionContext, mbid: string): Promise<Response> {
  const notFound = (maxAge: number) =>
    new Response("No cover", { status: 404, headers: { "Cache-Control": `public, max-age=${maxAge}`, "Access-Control-Allow-Origin": "*" } });
  if (!MBID.test(mbid)) return notFound(86400);
  const px = new URL(request.url).searchParams.get("size") === "500" ? 600 : 300;

  const key = `cover:${mbid}`;
  let stored = (await env.ASK_CONTROL.get(key, "json")) as Stored | null;
  if (!stored) {
    let r: Stored | "error";
    try {
      r = await resolve(mbid);
    } catch {
      r = "error";
    }
    if (r === "error") return notFound(300); // upstream hiccup: don't remember it
    stored = r;
    ctx.waitUntil(env.ASK_CONTROL.put(key, JSON.stringify(r), { expirationTtl: r.art ? HIT_TTL : MISS_TTL }));
  }
  if (!stored.art) return notFound(86400);
  return new Response(null, {
    status: 302,
    headers: { Location: artAt(stored.art, px), "Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*" },
  });
}
