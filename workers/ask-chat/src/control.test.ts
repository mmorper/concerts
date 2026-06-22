import { describe, it, expect } from "vitest";
import { normalizeIps, getAdminIps, setAdminIps, isAdminIp } from "./control.js";
import type { Env } from "./types.js";

// A minimal Map-backed KVNamespace stand-in — control.ts only ever calls get/put. Pure in-memory,
// so these tests exercise the real read/parse/normalize/write paths with no network or DO.
function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string): Promise<string | null> => (store.has(key) ? store.get(key)! : null),
    put: async (key: string, value: string): Promise<void> => {
      store.set(key, value);
    },
  };
}

function envWith(kv: ReturnType<typeof fakeKv>): Env {
  return { ASK_CONTROL: kv } as unknown as Env;
}

describe("normalizeIps", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeIps(["  1.2.3.4 ", "\t5.6.7.8\n"])).toEqual(["1.2.3.4", "5.6.7.8"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(normalizeIps(["1.2.3.4", "", "   ", "\t"])).toEqual(["1.2.3.4"]);
  });

  it("dedupes, keeping first-seen insertion order", () => {
    expect(normalizeIps(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("dedupes only after trimming (whitespace-different duplicates collapse)", () => {
    expect(normalizeIps(["1.2.3.4", " 1.2.3.4 "])).toEqual(["1.2.3.4"]);
  });

  it("tolerates null/undefined entries without throwing", () => {
    expect(normalizeIps([null as unknown as string, undefined as unknown as string, "ok"])).toEqual(["ok"]);
  });

  it("returns an empty array for empty input", () => {
    expect(normalizeIps([])).toEqual([]);
  });
});

describe("getAdminIps", () => {
  it("returns [] when the key is absent", async () => {
    expect(await getAdminIps(envWith(fakeKv()))).toEqual([]);
  });

  it("reads, parses, and normalizes a stored JSON array", async () => {
    const kv = fakeKv({ "admin:ips": JSON.stringify([" 1.1.1.1 ", "2.2.2.2", "1.1.1.1"]) });
    expect(await getAdminIps(envWith(kv))).toEqual(["1.1.1.1", "2.2.2.2"]);
  });

  it("filters out non-string members before normalizing", async () => {
    const kv = fakeKv({ "admin:ips": JSON.stringify(["1.1.1.1", 5, null, "2.2.2.2"]) });
    expect(await getAdminIps(envWith(kv))).toEqual(["1.1.1.1", "2.2.2.2"]);
  });

  it("returns [] when the stored value is valid JSON but not an array", async () => {
    const kv = fakeKv({ "admin:ips": JSON.stringify({ nope: true }) });
    expect(await getAdminIps(envWith(kv))).toEqual([]);
  });

  it("returns [] (fail-safe) when the stored value is unparseable", async () => {
    const kv = fakeKv({ "admin:ips": "not json at all" });
    expect(await getAdminIps(envWith(kv))).toEqual([]);
  });
});

describe("setAdminIps", () => {
  it("normalizes, persists JSON to KV, and returns the cleaned list", async () => {
    const kv = fakeKv();
    const result = await setAdminIps(envWith(kv), [" 1.1.1.1 ", "1.1.1.1", "", "2.2.2.2"]);
    expect(result).toEqual(["1.1.1.1", "2.2.2.2"]);
    expect(kv.store.get("admin:ips")).toBe(JSON.stringify(["1.1.1.1", "2.2.2.2"]));
  });

  it("round-trips through getAdminIps", async () => {
    const kv = fakeKv();
    await setAdminIps(envWith(kv), ["9.9.9.9", "  8.8.8.8 "]);
    expect(await getAdminIps(envWith(kv))).toEqual(["9.9.9.9", "8.8.8.8"]);
  });

  it("can clear the list", async () => {
    const kv = fakeKv({ "admin:ips": JSON.stringify(["1.1.1.1"]) });
    expect(await setAdminIps(envWith(kv), [])).toEqual([]);
    expect(await getAdminIps(envWith(kv))).toEqual([]);
  });
});

describe("isAdminIp (turn-path bypass)", () => {
  // setAdminIps() clears the module memo, so each test starts from a known cache state.
  it("bypasses a listed IP but not an unlisted one", async () => {
    const env = envWith(fakeKv());
    await setAdminIps(env, ["1.2.3.4"]);
    expect(await isAdminIp(env, "1.2.3.4")).toBe(true);
    expect(await isAdminIp(env, "9.9.9.9")).toBe(false);
  });

  it("never bypasses for unknown/empty IPs (fail-safe)", async () => {
    const env = envWith(fakeKv());
    await setAdminIps(env, ["1.2.3.4"]);
    expect(await isAdminIp(env, "unknown")).toBe(false);
    expect(await isAdminIp(env, "")).toBe(false);
  });

  it("unions the ASK_ADMIN_IPS break-glass env with the KV list", async () => {
    const env = { ASK_CONTROL: fakeKv(), ASK_ADMIN_IPS: "5.5.5.5, 6.6.6.6" } as unknown as Env;
    await setAdminIps(env, ["1.2.3.4"]); // KV path
    expect(await isAdminIp(env, "1.2.3.4")).toBe(true); // from KV
    expect(await isAdminIp(env, "6.6.6.6")).toBe(true); // from env bootstrap
  });
});
