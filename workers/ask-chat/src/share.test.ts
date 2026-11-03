import { describe, it, expect } from "vitest";
import { QUESTION_MAX, SNAPSHOT_MAX_BYTES, canonical, isShareId, readShare, shareId, signSnapshot, snapshotOf, storeShare } from "./share.js";
import type { Exhibit } from "./exhibits.js";
import type { Env } from "./types.js";

/** KV as a Map, counting writes so idempotency can be seen. */
function memoryKV() {
  const store = new Map<string, string>();
  let puts = 0;
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      puts++;
      store.set(k, v);
    },
  };
  return { kv: kv as unknown as KVNamespace, store, puts: () => puts };
}

function env(kv?: KVNamespace, key: string | undefined = "test-session-key"): Env {
  return { SESSION_HMAC_KEY: key, ASK_SHARES: kv } as unknown as Env;
}

const artist: Exhibit = { kind: "artist", entity: "artist", slug: "the-cure", name: "The Cure", deepLink: "/?scene=artists&artist=the-cure" };
const turn = { question: "Have you seen The Cure?", prose: "Six times, from 1986 to 2023.", exhibit: artist, day: "2026-11-02", turnIndex: 0 };

async function signed(e: Env, over: Partial<typeof turn> = {}) {
  const snap = snapshotOf({ ...turn, ...over });
  if (!snap) throw new Error("not shareable");
  const s = await signSnapshot(e, snap);
  if (!s) throw new Error("not signed");
  return s;
}

describe("snapshotOf — what a shared answer holds", () => {
  it("keeps the question, the prose, the card and the day", () => {
    expect(snapshotOf(turn)).toEqual({ v: 1, question: turn.question, prose: turn.prose, exhibit: artist, answeredOn: "2026-11-02", followUp: false });
  });

  it("marks a turn after the first as a follow-up", () => {
    expect(snapshotOf({ ...turn, turnIndex: 2 })?.followUp).toBe(true);
  });

  it("leaves the chips out: they are the next questions, not this answer", () => {
    const withChips = { ...artist, chips: [{ label: "The clips", tool: "get_media", input: {} }] } as Exhibit;
    expect(snapshotOf({ ...turn, exhibit: withChips })?.exhibit).toEqual(artist);
  });

  it("cuts a long question", () => {
    expect(snapshotOf({ ...turn, question: "x".repeat(500) })?.question).toHaveLength(QUESTION_MAX);
  });

  it("refuses a plain answer, a question back, a refusal, and no prose", () => {
    expect(snapshotOf({ ...turn, exhibit: { kind: "plain" } })).toBeNull();
    expect(snapshotOf({ ...turn, exhibit: { kind: "disambiguation", entity: "artist", candidates: [] } })).toBeNull();
    expect(snapshotOf({ ...turn, exhibit: { kind: "refusal" } })).toBeNull();
    expect(snapshotOf({ ...turn, prose: "  " })).toBeNull();
  });

  it("refuses one too big to store", () => {
    expect(snapshotOf({ ...turn, prose: "y".repeat(SNAPSHOT_MAX_BYTES) })).toBeNull();
  });
});

describe("canonical — the same bytes on both sides", () => {
  it("sorts keys at every depth, so key order can't break a signature", () => {
    expect(canonical({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 2 } })).toBe(canonical({ a: { c: 2, d: [{ y: 2, z: 1 }] }, b: 1 }));
  });
});

describe("storeShare and readShare", () => {
  it("stores a signed answer and reads back the same snapshot", async () => {
    const m = memoryKV();
    const e = env(m.kv);
    const { snapshot, sig } = await signed(e);
    const r = await storeShare(e, { snapshot, sig });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isShareId(r.id)).toBe(true);
    expect(JSON.parse((await readShare(e, r.id))!)).toEqual(snapshot);
  });

  it("survives the trip through JSON, as it does in the browser", async () => {
    const e = env(memoryKV().kv);
    const posted = JSON.parse(JSON.stringify(await signed(e)));
    expect((await storeShare(e, posted)).ok).toBe(true);
  });

  it("refuses a changed character in the prose, the question or the card", async () => {
    const e = env(memoryKV().kv);
    const { snapshot, sig } = await signed(e);
    for (const changed of [
      { ...snapshot, prose: snapshot.prose + "!" },
      { ...snapshot, question: "Have you seen U2?" },
      { ...snapshot, exhibit: { ...artist, name: "The Curé" } },
    ]) {
      expect(await storeShare(e, { snapshot: changed, sig })).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("refuses a snapshot signed with another key", async () => {
    const m = memoryKV();
    const { snapshot, sig } = await signed(env(m.kv, "some-other-key"));
    expect(await storeShare(env(m.kv), { snapshot, sig })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an unshareable card even if it were signed", async () => {
    const e = env(memoryKV().kv);
    const { sig } = await signed(e);
    const plain = { ...snapshotOf(turn)!, exhibit: { kind: "plain" } };
    expect(await storeShare(e, { snapshot: plain, sig })).toMatchObject({ ok: false, status: 400 });
  });

  it("gives the same answer the same id, and writes it once", async () => {
    const m = memoryKV();
    const e = env(m.kv);
    const s = await signed(e);
    const a = await storeShare(e, s);
    const b = await storeShare(e, s);
    expect(a).toEqual(b);
    expect(m.puts()).toBe(1);
  });

  it("gives a different answer a different id", async () => {
    const e = env(memoryKV().kv);
    const a = await shareId((await signed(e)).snapshot);
    const b = await shareId((await signed(e, { prose: "Seven times." })).snapshot);
    expect(a).not.toBe(b);
  });

  it("answers 503 with no store, and signs nothing with no key", async () => {
    const e = env(undefined);
    expect(await storeShare(e, await signed(e))).toMatchObject({ ok: false, status: 503 });
    expect(await signSnapshot(env(memoryKV().kv, ""), snapshotOf(turn)!)).toBeNull();
  });

  it("reads nothing for an unknown or malformed id", async () => {
    const e = env(memoryKV().kv);
    expect(await readShare(e, "AAAAAAAAAAAA")).toBeNull();
    expect(await readShare(e, "../../etc")).toBeNull();
  });
});
