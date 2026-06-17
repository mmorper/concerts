import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SpendCounter } from "./spend-counter.js";
import type { Env } from "./types.js";

// Minimal in-memory DurableObjectStorage — enough for the counter (get/put on one key).
function fakeState() {
  const map = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string): Promise<T | undefined> => map.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => void map.set(key, value),
  };
  return { storage } as unknown as DurableObjectState;
}

function counter() {
  return new SpendCounter(fakeState(), {} as Env);
}

async function call(c: SpendCounter, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await c.fetch(new Request(`https://do/${path}?${qs}`));
  return res.json() as Promise<{ ok?: boolean; id?: string; status: { committedMicroUsd: number; reservedMicroUsd: number; fraction: number; day: string } }>;
}

describe("SpendCounter reserve/commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("reserves up to the cap, then refuses — the ceiling holds", async () => {
    const c = counter();
    const cap = "1000";
    // Three reservations of 300 fit (900 ≤ 1000); the fourth (1200 > 1000) is refused.
    expect((await call(c, "reserve", { cap, est: "300" })).ok).toBe(true);
    expect((await call(c, "reserve", { cap, est: "300" })).ok).toBe(true);
    expect((await call(c, "reserve", { cap, est: "300" })).ok).toBe(true);
    const fourth = await call(c, "reserve", { cap, est: "300" });
    expect(fourth.ok).toBe(false);
    expect(fourth.status.reservedMicroUsd).toBe(900); // unchanged by the refusal
  });

  it("commit swaps the estimate for the measured cost, freeing the slack", async () => {
    const c = counter();
    const cap = "1000";
    const r = await call(c, "reserve", { cap, est: "300" });
    expect(r.status.reservedMicroUsd).toBe(300);
    // Actual cost was only 50 — reservation released, 50 committed.
    const after = await call(c, "commit", { cap, id: r.id!, actual: "50" });
    expect(after.status.reservedMicroUsd).toBe(0);
    expect(after.status.committedMicroUsd).toBe(50);
  });

  it("counts committed + reserved against the cap together", async () => {
    const c = counter();
    const cap = "1000";
    const r = await call(c, "reserve", { cap, est: "300" });
    await call(c, "commit", { cap, id: r.id!, actual: "800" }); // committed 800
    // 800 committed + a 300 reservation would be 1100 > 1000 → refused.
    expect((await call(c, "reserve", { cap, est: "300" })).ok).toBe(false);
    // …but a 150 reservation fits (950 ≤ 1000).
    expect((await call(c, "reserve", { cap, est: "150" })).ok).toBe(true);
  });

  it("release drops a reservation without charging", async () => {
    const c = counter();
    const cap = "1000";
    const r = await call(c, "reserve", { cap, est: "300" });
    const after = await call(c, "release", { cap, id: r.id! });
    expect(after.status.reservedMicroUsd).toBe(0);
    expect(after.status.committedMicroUsd).toBe(0);
  });

  it("prunes orphaned reservations after the TTL (self-heals a crashed turn)", async () => {
    const c = counter();
    const cap = "1000";
    await call(c, "reserve", { cap, est: "900" }); // never committed/released
    expect((await call(c, "reserve", { cap, est: "900" })).ok).toBe(false); // blocked by orphan
    vi.setSystemTime(new Date("2026-06-17T12:03:00Z")); // +3min > 120s TTL
    const status = await call(c, "status", { cap });
    expect(status.status.reservedMicroUsd).toBe(0); // orphan reclaimed
    expect((await call(c, "reserve", { cap, est: "900" })).ok).toBe(true);
  });

  it("rolls over at the UTC day boundary — yesterday's spend doesn't bleed in", async () => {
    const c = counter();
    const cap = "1000";
    const r = await call(c, "reserve", { cap, est: "300" });
    await call(c, "commit", { cap, id: r.id!, actual: "900" });
    expect((await call(c, "status", { cap })).status.committedMicroUsd).toBe(900);
    vi.setSystemTime(new Date("2026-06-18T00:00:01Z")); // next day
    expect((await call(c, "status", { cap })).status.committedMicroUsd).toBe(0);
  });
});
