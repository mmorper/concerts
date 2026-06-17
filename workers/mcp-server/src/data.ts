import type {
  ArtistsMetadata,
  ArtistsTopTracks,
  ConcertData,
  Env,
  FactsData,
  MostPlayedSongs,
  Narration,
  NarrationKind,
  NarrationRecord,
  QueryUsageRecord,
  SetlistsCache,
  VenuesMetadata,
} from "./types.js";
import { QUERY_DAILY_CALL_CAP, QUERY_DAILY_TOKEN_CAP } from "./types.js";

// Mirrors workers/meta-injector/worker.js cachedJsonFetch — same caches.default + 300s TTL pattern
// from W1 (PR #118). Uses ctx.waitUntil so the cache write doesn't block the response.
export async function cachedJsonFetch<T>(
  url: string,
  ctx: ExecutionContext,
): Promise<T | null> {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return (await cached.json()) as T;
    } catch (e) {
      console.error(`Cached response malformed for ${url}`, e);
      return null;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Data fetch failed ${response.status} for ${url}`);
    return null;
  }

  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", "public, max-age=300");
  ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));

  try {
    return (await cacheable.json()) as T;
  } catch (e) {
    console.error(`Malformed JSON at ${url}`, e);
    return null;
  }
}

// ---------- Data file registry ----------
// Spec §"Data Flow". LOAD = eager (warmed on cold start, ~215K total). LAZY = fetched
// on first tool use that needs them. SKIP files (geocode, venue-photos, liner-notes,
// discography) are intentionally absent — not useful for a text-based MCP.

const LOAD_FILES = [
  "concerts.json",
  "facts.json",
  "artists-metadata.json",
] as const;

const LAZY_FILES = [
  "venues-metadata.json",
  "setlists-cache.json",
  "artists-top-tracks.json",
  "most-played-songs.json",
] as const;

function dataUrl(env: Env, file: string): string {
  return `${env.DATA_BASE_URL}/${file}`;
}

// ---------- LOAD (eager) helpers ----------

export function getConcerts(
  env: Env,
  ctx: ExecutionContext,
): Promise<ConcertData | null> {
  return cachedJsonFetch<ConcertData>(dataUrl(env, "concerts.json"), ctx);
}

export function getFacts(
  env: Env,
  ctx: ExecutionContext,
): Promise<FactsData | null> {
  return cachedJsonFetch<FactsData>(dataUrl(env, "facts.json"), ctx);
}

export function getArtistsMetadata(
  env: Env,
  ctx: ExecutionContext,
): Promise<ArtistsMetadata | null> {
  return cachedJsonFetch<ArtistsMetadata>(
    dataUrl(env, "artists-metadata.json"),
    ctx,
  );
}

// ---------- LAZY helpers ----------
// First caller pays the fetch latency for the specific file their tool needs;
// background prefetch (below) warms the rest for subsequent callers.

export function getVenuesMetadata(
  env: Env,
  ctx: ExecutionContext,
): Promise<VenuesMetadata | null> {
  return cachedJsonFetch<VenuesMetadata>(
    dataUrl(env, "venues-metadata.json"),
    ctx,
  );
}

export function getSetlistsCache(
  env: Env,
  ctx: ExecutionContext,
): Promise<SetlistsCache | null> {
  return cachedJsonFetch<SetlistsCache>(
    dataUrl(env, "setlists-cache.json"),
    ctx,
  );
}

export function getArtistsTopTracks(
  env: Env,
  ctx: ExecutionContext,
): Promise<ArtistsTopTracks | null> {
  return cachedJsonFetch<ArtistsTopTracks>(
    dataUrl(env, "artists-top-tracks.json"),
    ctx,
  );
}

export function getMostPlayedSongs(
  env: Env,
  ctx: ExecutionContext,
): Promise<MostPlayedSongs | null> {
  return cachedJsonFetch<MostPlayedSongs>(
    dataUrl(env, "most-played-songs.json"),
    ctx,
  );
}

// ---------- Background cache warming ----------
// Spec §"Lazy-Load UX: Background Prefetch on First Hot Path". Both helpers run under
// ctx.waitUntil so they warm caches.default without blocking the response — the LAZY
// files are never fetched synchronously on the cold-start path. cachedJsonFetch swallows
// and logs its own failures, so these never reject (Promise.allSettled belt-and-braces).

export async function prefetchLoadFiles(
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  await Promise.allSettled(
    LOAD_FILES.map((file) => cachedJsonFetch(dataUrl(env, file), ctx)),
  );
}

export async function prefetchLazyFiles(
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  await Promise.allSettled(
    LAZY_FILES.map((file) => cachedJsonFetch(dataUrl(env, file), ctx)),
  );
}

// Returns null on miss so callers can fall back to templated narration.
// See Addendum 2026-05-17 §"W2 (#105) scope changes" — getNarration is the
// hybrid-layer contract for get_artist_history and get_venue_history.
export async function getNarration(
  kind: NarrationKind,
  slug: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Narration | null> {
  const url = `${env.DATA_BASE_URL}/narrations/${kind}.json`;
  const all = await cachedJsonFetch<Record<string, NarrationRecord>>(url, ctx);
  if (!all) return null;
  const record = all[slug];
  return record?.narration ?? null;
}

// ---------- Query escape hatch usage tracking ----------
// Addendum 2026-05-17 §"Decision: runtime `query` escape hatch" — KV-backed daily caps.

function todayKey(now = new Date()): string {
  return `query-usage:${now.toISOString().slice(0, 10)}`;
}

export async function readQueryUsage(env: Env): Promise<QueryUsageRecord> {
  const raw = await env.MCP_QUERY_USAGE.get(todayKey(), "json");
  return (raw as QueryUsageRecord | null) ?? { tokens: 0, calls: 0 };
}

export function isQueryUsageOverCap(usage: QueryUsageRecord): boolean {
  return (
    usage.tokens >= QUERY_DAILY_TOKEN_CAP || usage.calls >= QUERY_DAILY_CALL_CAP
  );
}

// 48h TTL is self-cleaning — yesterday's record falls out before we need today's.
const QUERY_USAGE_TTL_SECONDS = 60 * 60 * 48;

export function recordQueryUsage(
  env: Env,
  ctx: ExecutionContext,
  previous: QueryUsageRecord,
  delta: { inputTokens: number; outputTokens: number },
): void {
  const next: QueryUsageRecord = {
    tokens: previous.tokens + delta.inputTokens + delta.outputTokens,
    calls: previous.calls + 1,
  };
  ctx.waitUntil(
    env.MCP_QUERY_USAGE.put(todayKey(), JSON.stringify(next), {
      expirationTtl: QUERY_USAGE_TTL_SECONDS,
    }),
  );
}
