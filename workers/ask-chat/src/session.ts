// Turnstile session gate (spec §"Cost & abuse controls").
//
// Turnstile alone is theater if a solved challenge can be replayed for unlimited turns. So
// solving Turnstile ISSUES a short-lived, server-signed session token (HMAC over {sid, exp});
// /chat requires a valid, unexpired token on every turn. The token is bound to a session id
// the per-session rate limiter keys on — so one challenge buys a bounded budget of turns
// within a short window, not an open proxy.

import type { Env } from "./types.js";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min — a visit's worth; re-challenge after.

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Constant-time-ish comparison via crypto.subtle.verify (handles timing safety for us).
async function sign(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

export interface SessionResult {
  ok: boolean;
  token?: string;
  reason?: string;
}

// Verify a Turnstile token with Cloudflare, then mint a session token. `remoteIp` tightens
// the Turnstile check. Returns a token the client sends back on each /chat turn.
export async function issueSession(env: Env, turnstileToken: string, remoteIp: string | null): Promise<SessionResult> {
  if (!env.TURNSTILE_SECRET || !env.SESSION_HMAC_KEY) {
    return { ok: false, reason: "Session gate not configured." };
  }
  if (!turnstileToken) return { ok: false, reason: "Missing Turnstile token." };

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", turnstileToken);
  if (remoteIp) form.set("remoteip", remoteIp);

  let verified = false;
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const data = (await res.json()) as { success?: boolean };
    verified = data.success === true;
  } catch (e) {
    console.error("Turnstile verify failed", e);
    return { ok: false, reason: "Couldn't verify the challenge — try again." };
  }
  if (!verified) return { ok: false, reason: "Challenge failed — try again." };

  const sid = crypto.randomUUID();
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ sid, exp })));
  const sig = await sign(await hmacKey(env.SESSION_HMAC_KEY), payload);
  return { ok: true, token: `${payload}.${sig}` };
}

export interface VerifiedSession {
  valid: boolean;
  sid?: string;
}

// Validate a session token on a /chat turn: HMAC signature + not expired.
export async function verifySession(env: Env, token: string | null): Promise<VerifiedSession> {
  if (!env.SESSION_HMAC_KEY || !token) return { valid: false };
  const dot = token.indexOf(".");
  if (dot < 0) return { valid: false };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey(env.SESSION_HMAC_KEY);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig),
      new TextEncoder().encode(payload),
    );
    if (!ok) return { valid: false };
    const { sid, exp } = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as {
      sid: string;
      exp: number;
    };
    if (typeof exp !== "number" || Date.now() > exp) return { valid: false };
    return { valid: true, sid };
  } catch {
    return { valid: false };
  }
}
