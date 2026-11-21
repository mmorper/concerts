/**
 * The Worker end to end: auth, validation, the lookup and the room, with the Durable Object run
 * in memory and the site's data files served from the frozen fixture. WebSocket upgrades need the
 * Workers runtime and are checked after deploy (#693, #694), not here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle, resetManifestCache, type Env } from "./index.js";
import { NowSpinningRoom } from "./room.js";
import { FIXTURE_DIR } from "./test-loader.js";

const INGEST = "a".repeat(64);
const DISPLAY = "b".repeat(64);
const DATA = "https://concerts.morperhaus.org/data";

class FakeStorage {
  map = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(k: string): Promise<T | undefined> {
    return this.map.has(k) ? structuredClone(this.map.get(k) as T) : undefined;
  }
  async put(entries: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) this.map.set(k, structuredClone(v));
  }
  async setAlarm(t: number): Promise<void> {
    this.alarm = t;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

function makeEnv(overrides: Partial<Env> = {}) {
  const storage = new FakeStorage();
  const ctx = { storage, getWebSockets: () => [], acceptWebSocket: () => {} } as unknown as DurableObjectState;
  const roomObj = new NowSpinningRoom(ctx, { DISPLAY_TZ: "America/Los_Angeles" });
  const ns = {
    idFromName: () => "living-room",
    get: () => ({ fetch: (url: string, init?: RequestInit) => roomObj.fetch(new Request(url, init)) }),
  } as unknown as DurableObjectNamespace;
  const env: Env = {
    NOW_SPINNING_ROOM: ns,
    NOW_SPINNING_INGEST_TOKEN: INGEST,
    NOW_SPINNING_DISPLAY_TOKEN: DISPLAY,
    DATA_BASE_URL: DATA,
    DISPLAY_TZ: "America/Los_Angeles",
    ...overrides,
  };
  return { env, storage, roomObj };
}

const req = (path: string, init: RequestInit & { token?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  return new Request(`https://concerts.morperhaus.org${path}`, { ...init, headers });
};
const post = (body: unknown, token = INGEST) =>
  req("/api/now-spinning", { method: "POST", token, body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => {
  resetManifestCache();
  // The site: fixture files by path, and (like the real site) its HTML page with 200 for anything else.
  vi.stubGlobal("fetch", async (url: string) => {
    const path = String(url).replace(`${DATA}/now-spinning/`, "");
    try {
      return new Response(readFileSync(join(FIXTURE_DIR, path), "utf-8"), { status: 200 });
    } catch {
      return new Response("<!DOCTYPE html><html></html>", { status: 200 });
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("auth", () => {
  it("answers 503 to everything while a secret is unset (a safe first deploy)", async () => {
    for (const overrides of [{ NOW_SPINNING_INGEST_TOKEN: undefined }, { NOW_SPINNING_DISPLAY_TOKEN: "" }]) {
      const { env } = makeEnv(overrides);
      expect((await handle(post({ event: "alive" }), env)).status).toBe(503);
      expect((await handle(req("/api/now-spinning", { token: DISPLAY }), env)).status).toBe(503);
    }
  });

  it("refuses a write without the ingest token, or with the display token", async () => {
    const { env } = makeEnv();
    expect((await handle(req("/api/now-spinning", { method: "POST", body: "{}" }), env)).status).toBe(401);
    expect((await handle(post({ event: "alive" }, DISPLAY), env)).status).toBe(401);
  });

  it.each(["/api/now-spinning", "/api/now-spinning/health", "/api/now-spinning/ws"])(
    "refuses to read %s without the display token, or with the ingest token",
    async (path) => {
      const { env } = makeEnv();
      expect((await handle(req(path), env)).status).toBe(401);
      expect((await handle(req(path, { token: INGEST }), env)).status).toBe(401);
    },
  );

  it("accepts the display token as a WebSocket subprotocol", async () => {
    const { env } = makeEnv();
    const r = await handle(req("/api/now-spinning/ws", { headers: { "Sec-WebSocket-Protocol": `now-spinning.v1, ${DISPLAY}` } }), env);
    expect(r.status).toBe(426); // authorised; refused only because this isn't a real upgrade
  });

  it("never caches an answer", async () => {
    const { env } = makeEnv();
    expect((await handle(req("/api/now-spinning", { token: DISPLAY }), env)).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("ingest", () => {
  it("rejects bad bodies", async () => {
    const { env } = makeEnv();
    expect((await handle(post("not json"), env)).status).toBe(400);
    expect((await handle(post({ event: "dance" }), env)).status).toBe(400);
    expect((await handle(post({ event: "track", artist: "Devo" }), env)).status).toBe(400);
    expect((await handle(post({ event: "status", recognizer: "great" }), env)).status).toBe(400);
    expect((await handle(post({ event: "track", artist: "x".repeat(3000), title: "y" }), env)).status).toBe(413);
  });

  it("looks a track up and stores the answer", async () => {
    const { env } = makeEnv();
    const r = await handle(post({ event: "track", artist: "Depeche Mode", title: "Everything Counts (Remastered 2006)" }), env);
    expect(r.status).toBe(200);
    const state = (await r.json()) as { kind: string; now: string; track: { screen: string; title: string } };
    expect(state).toMatchObject({ kind: "track", track: { screen: "heard", title: "Everything Counts" } });
    expect(state.now).toBeTruthy();

    const read = (await (await handle(req("/api/now-spinning", { token: DISPLAY }), env)).json()) as { track: { title: string } };
    expect(read.track.title).toBe("Everything Counts");
  });

  it("says the archive isn't answering, never 'not in the archive', when the index is missing", async () => {
    vi.stubGlobal("fetch", async () => new Response("<!DOCTYPE html>", { status: 200 }));
    const { env } = makeEnv();
    const state = (await (await handle(post({ event: "track", artist: "Depeche Mode", title: "Enjoy the Silence" }), env)).json()) as {
      track: { screen: string };
    };
    expect(state.track.screen).toBe("unknown");
  });

  it("holds exactly two keys however many songs arrive", async () => {
    const { env, storage } = makeEnv();
    for (let i = 0; i < 100; i++) await handle(post({ event: "track", artist: "Depeche Mode", title: `Song ${i}`, shazamId: String(i) }), env);
    expect([...storage.map.keys()].sort()).toEqual(["listener", "state"]);
    expect(JSON.stringify([...storage.map.values()])).not.toContain("Song 98");
  });

  it("reports health with no song data", async () => {
    const { env } = makeEnv();
    await handle(post({ event: "track", artist: "Depeche Mode", title: "Enjoy the Silence" }), env);
    await handle(post({ event: "status", recognizer: "ok", receiver: "ok", appleTv: "unreachable", version: "0.1.0" }), env);
    const h = (await (await handle(req("/api/now-spinning/health", { token: DISPLAY }), env)).json()) as Record<string, unknown>;
    expect(h).toMatchObject({ online: true, recognizer: "ok", receiver: "ok", appleTv: "unreachable", version: "0.1.0" });
    expect(JSON.stringify(h)).not.toContain("Silence");
  });

  it("sets the alarm, and the alarm sends the room idle", async () => {
    const { env, storage, roomObj } = makeEnv();
    await handle(post({ event: "track", artist: "Depeche Mode", title: "Enjoy the Silence" }), env);
    expect(storage.alarm).toBeGreaterThan(Date.now());
    vi.useFakeTimers({ now: Date.now() + 3 * 60_000 + 1 });
    await roomObj.alarm();
    vi.useRealTimers();
    const state = (await (await handle(req("/api/now-spinning", { token: DISPLAY }), env)).json()) as { kind: string };
    expect(state.kind).toBe("idle");
  });
});

describe("routing", () => {
  it("only answers under /api/now-spinning", async () => {
    const { env } = makeEnv();
    expect((await handle(req("/api/now-spinning/nope", { token: DISPLAY }), env)).status).toBe(404);
    expect((await handle(req("/api/now-spinning", { method: "DELETE", token: DISPLAY }), env)).status).toBe(405);
  });
});
