import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifySession } from "./session.js";
import type { Env } from "./types.js";

// issueSession() calls Turnstile over the network; here we test the security-critical half
// that runs on every turn — verifySession — by minting tokens with the same HMAC the issuer
// uses, then asserting tamper/expiry rejection.

const HMAC_KEY = "test-hmac-secret";
const env = { SESSION_HMAC_KEY: HMAC_KEY } as Env;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mint(payloadObj: object, key = HMAC_KEY): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

describe("verifySession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a valid, unexpired token and returns its sid", async () => {
    const token = await mint({ sid: "abc", exp: Date.now() + 60_000 });
    const r = await verifySession(env, token);
    expect(r.valid).toBe(true);
    expect(r.sid).toBe("abc");
  });

  it("rejects an expired token", async () => {
    const token = await mint({ sid: "abc", exp: Date.now() - 1 });
    expect((await verifySession(env, token)).valid).toBe(false);
  });

  it("rejects a token signed with the wrong key (forgery)", async () => {
    const token = await mint({ sid: "abc", exp: Date.now() + 60_000 }, "attacker-key");
    expect((await verifySession(env, token)).valid).toBe(false);
  });

  it("rejects a tampered payload (sid swapped, original signature)", async () => {
    const good = await mint({ sid: "abc", exp: Date.now() + 60_000 });
    const sig = good.slice(good.indexOf(".") + 1);
    const forgedPayload = b64url(new TextEncoder().encode(JSON.stringify({ sid: "admin", exp: Date.now() + 60_000 })));
    expect((await verifySession(env, `${forgedPayload}.${sig}`)).valid).toBe(false);
  });

  it("rejects missing / malformed tokens", async () => {
    expect((await verifySession(env, null)).valid).toBe(false);
    expect((await verifySession(env, "nodot")).valid).toBe(false);
    expect((await verifySession(env, "a.b.c")).valid).toBe(false);
  });

  it("rejects everything when no HMAC key is configured (fail closed)", async () => {
    const token = await mint({ sid: "abc", exp: Date.now() + 60_000 });
    expect((await verifySession({} as Env, token)).valid).toBe(false);
  });
});
