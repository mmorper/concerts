/**
 * Now Spinning — the Worker at concerts.morperhaus.org/api/now-spinning*
 *
 *   POST /api/now-spinning         ingest token   the listener reports a track, a gap, a stop, a heartbeat
 *   GET  /api/now-spinning         display token  the current state (polling fallback, debugging)
 *   GET  /api/now-spinning/ws      display token  WebSocket: the current state, then each change
 *   GET  /api/now-spinning/health  display token  the listener's health; no song data
 *
 * The archive lookup runs here, before the room is called, so the room only ever stores results.
 *
 * Fails closed: if either secret is missing, every request gets 503. That is what makes the first
 * deploy safe — CI deploys on merge, before the secrets are set (#693).
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Worker API
 */

import { sameToken, tokenOf, wantsSubprotocol } from "./auth.js";
import { lookup, unknownTrack, type Loader } from "./identify.js";
import { actKey, foldSongTitle } from "./match.js";
import { json, NowSpinningRoom } from "./room.js";
import type { RoomEvent } from "./room-logic.js";
import type { TrackInput } from "./types.js";

export { NowSpinningRoom };

export interface Env {
  NOW_SPINNING_ROOM: DurableObjectNamespace;
  NOW_SPINNING_INGEST_TOKEN?: string;
  NOW_SPINNING_DISPLAY_TOKEN?: string;
  DATA_BASE_URL: string;
  DISPLAY_TZ?: string;
}

const BASE = "/api/now-spinning";
const MAX_BODY = 2048;
const CACHE_TTL_S = 300;

// ── The index, read through the edge cache ─────────────────────────────────────

/** The manifest is read on every lookup, so it is kept for the life of the isolate. */
let manifestCache: { at: number; value: unknown | null } | null = null;

export function makeLoader(env: Env, nowMs = Date.now()): Loader {
  return async (path) => {
    if (path === "manifest.json" && manifestCache && nowMs - manifestCache.at < CACHE_TTL_S * 1000 && manifestCache.value) {
      return manifestCache.value;
    }
    const value = await fetchJson(`${env.DATA_BASE_URL}/now-spinning/${path}`);
    if (path === "manifest.json") manifestCache = { at: nowMs, value };
    return value;
  };
}

/** JSON, or null. A missing file on this site comes back as its HTML page with status 200. */
async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cf: { cacheTtl: CACHE_TTL_S, cacheEverything: true } } as RequestInit);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trimStart().startsWith("{")) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** For tests. */
export function resetManifestCache(): void {
  manifestCache = null;
}

// ── Requests ───────────────────────────────────────────────────────────────────

const room = (env: Env) => env.NOW_SPINNING_ROOM.get(env.NOW_SPINNING_ROOM.idFromName("living-room"));
const roomUrl = (path: string) => `https://room${path}`;

const str = (x: unknown, max = 300): string | undefined => (typeof x === "string" && x.trim() && x.length <= max ? x.trim() : undefined);
const okOrBad = (x: unknown, good: string, bad: string) => x === good || x === bad;

/** What the listener may send: a room event, except that a track is still to be looked up. */
export type IngestEvent =
  | { event: "track"; input: TrackInput; shazamId?: string }
  | Exclude<RoomEvent, { event: "track" } | { event: "alarm" }>;

/** Validate a POST body, or null. */
export function parseEvent(body: unknown): IngestEvent | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  switch (b.event) {
    case "track": {
      const artist = str(b.artist);
      const title = str(b.title);
      if (!artist || !title) return null;
      const input: TrackInput = { artist, title, album: str(b.album), artworkUrl: str(b.artworkUrl, 1000) };
      return { event: "track", input, shazamId: str(b.shazamId, 100) };
    }
    case "gap":
    case "unmatched":
    case "stopped":
    case "alive":
      return { event: b.event };
    case "status":
      // "off": the listener isn't recognising songs at all (Phase 4a, before Shazam). Honest,
      // and unlike "failing" it puts no notice on the idle screen.
      if (!(okOrBad(b.recognizer, "ok", "failing") || b.recognizer === "off") || !okOrBad(b.receiver, "ok", "unreachable") || !okOrBad(b.appleTv, "ok", "unreachable")) return null;
      return {
        event: "status",
        recognizer: b.recognizer as "ok" | "failing" | "off",
        receiver: b.receiver as "ok" | "unreachable",
        appleTv: b.appleTv as "ok" | "unreachable",
        version: str(b.version, 40) ?? "unknown",
      };
    default:
      return null;
  }
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return json({ error: "not found" }, 404);

  // Fail closed until both secrets exist.
  const ingestToken = env.NOW_SPINNING_INGEST_TOKEN;
  const displayToken = env.NOW_SPINNING_DISPLAY_TOKEN;
  // Two tokens only mean something if they differ: a display must not be able to write.
  if (!ingestToken || !displayToken || ingestToken === displayToken) return json({ error: "not configured" }, 503);

  const token = tokenOf(req);

  if (path === BASE && req.method === "POST") {
    if (!sameToken(token, ingestToken)) return json({ error: "unauthorized" }, 401);
    const length = Number(req.headers.get("Content-Length") ?? 0);
    if (length > MAX_BODY) return json({ error: "body too large" }, 413);
    const text = await req.text();
    // In bytes, not UTF-16 code units: the limit is 2 KB.
    if (new TextEncoder().encode(text).length > MAX_BODY) return json({ error: "body too large" }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }
    const parsed = parseEvent(body);
    if (!parsed) return json({ error: "invalid event" }, 400);

    let ev: RoomEvent;
    if (parsed.event === "track") {
      // A track always produces a state. If the lookup itself fails, say nothing about the archive.
      let track;
      try {
        track = await lookup(parsed.input, makeLoader(env));
      } catch {
        track = unknownTrack(parsed.input);
      }
      const key = parsed.shazamId || `${actKey(parsed.input.artist)}|${foldSongTitle(parsed.input.title)}`;
      ev = { event: "track", track, key };
    } else {
      ev = parsed;
    }
    const res = await room(env).fetch(roomUrl("/ingest"), { method: "POST", body: JSON.stringify(ev) });
    return json(await res.json());
  }

  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);
  if (!sameToken(token, displayToken)) return json({ error: "unauthorized" }, 401);

  if (path === BASE) return json(await (await room(env).fetch(roomUrl("/state"))).json());
  if (path === `${BASE}/health`) return json(await (await room(env).fetch(roomUrl("/health"))).json());
  if (path === `${BASE}/ws`) {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "expected a WebSocket upgrade" }, 426);
    // Hand the upgrade to the room, telling it whether to name our subprotocol in its answer.
    return room(env).fetch(roomUrl(`/ws?subprotocol=${wantsSubprotocol(req) ? 1 : 0}`), { headers: req.headers });
  }
  return json({ error: "not found" }, 404);
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
} satisfies ExportedHandler<Env>;
