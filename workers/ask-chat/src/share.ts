// Shareable answers (docs/specs/future/global-ask-shareable-answers.md, Phase 1).
//
// A shared answer is a snapshot: the question, the Worker's prose and the card, as they were given.
// The browser holds the conversation, so it could send any text. So the Worker signs every answer
// it gives (on the `done` event), and `POST /api/ask/share` stores only a snapshot whose signature
// checks: nobody can publish their own prose under the site's name. Signing costs nothing; only an
// answer someone actually shares is written to KV.

import type { Env } from "./types.js";
import type { Exhibit } from "./exhibits.js";

export interface SharedAnswer {
  v: 1;
  /** As typed, cut to QUESTION_MAX. */
  question: string;
  /** The Worker's text for that turn. */
  prose: string;
  /** The thin envelope from exhibits.ts, without chips: ids and slugs, not pixels. */
  exhibit: Exhibit;
  /** YYYY-MM-DD */
  answeredOn: string;
  /** True when the turn was not the first in its conversation. */
  followUp: boolean;
}

export const QUESTION_MAX = 200;
export const SNAPSHOT_MAX_BYTES = 16 * 1024;
const ID_LENGTH = 12;
const KEY_PREFIX = "share:";
const CACHE_SECONDS = 86400;

/** Cards that can't be shared: no card, a question back, or a refusal. */
const UNSHAREABLE = new Set<Exhibit["kind"]>(["plain", "disambiguation", "refusal"]);

export const isShareable = (exhibit: Exhibit): boolean => !UNSHAREABLE.has(exhibit.kind);

/** JSON with every object's keys sorted, so the signer and the verifier hash the same bytes. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The signing key, derived from SESSION_HMAC_KEY rather than a secret of its own, so nothing new
 * has to be set in every place keys live. Rotating the session key voids signatures not yet shared;
 * stored answers are already verified, so they stay.
 */
async function shareKey(env: Env): Promise<CryptoKey | null> {
  if (!env.SESSION_HMAC_KEY) return null;
  const root = await crypto.subtle.importKey("raw", enc.encode(env.SESSION_HMAC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", root, enc.encode("ask-share-v1"));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** The snapshot of a finished turn, or null when it can't be shared. */
export function snapshotOf(args: { question: string; prose: string; exhibit: Exhibit; day: string; turnIndex: number }): SharedAnswer | null {
  if (!isShareable(args.exhibit) || !args.prose.trim()) return null;
  // Chips ride on the exhibit event but are the Worker's next questions, not part of this answer.
  const { chips: _chips, ...exhibit } = args.exhibit as Exhibit & { chips?: unknown };
  const snap: SharedAnswer = {
    v: 1,
    question: args.question.trim().slice(0, QUESTION_MAX),
    prose: args.prose,
    exhibit: exhibit as Exhibit,
    answeredOn: args.day,
    followUp: args.turnIndex > 0,
  };
  return enc.encode(canonical(snap)).byteLength <= SNAPSHOT_MAX_BYTES ? snap : null;
}

/** What the `done` event carries: the snapshot and its signature, posted back as-is to share it. */
export async function signSnapshot(env: Env, snap: SharedAnswer): Promise<{ snapshot: SharedAnswer; sig: string } | null> {
  const key = await shareKey(env);
  if (!key) return null;
  return { snapshot: snap, sig: b64url(await crypto.subtle.sign("HMAC", key, enc.encode(canonical(snap)))) };
}

async function verify(env: Env, snap: unknown, sig: unknown): Promise<boolean> {
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(sig)) return false;
  const key = await shareKey(env);
  if (!key) return false;
  const pad = sig.length % 4 ? "=".repeat(4 - (sig.length % 4)) : "";
  const bin = atob(sig.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, bytes, enc.encode(canonical(snap)));
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The first 12 base62 characters of the snapshot's SHA-256: the same answer always gets the same link. */
export async function shareId(snap: SharedAnswer): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(canonical(snap))));
  let n = 0n;
  for (const b of hash) n = (n << 8n) | BigInt(b);
  let out = "";
  while (out.length < ID_LENGTH) {
    out += BASE62[Number(n % 62n)];
    n /= 62n;
  }
  return out;
}

export const isShareId = (s: string): boolean => new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(s);

/** The checks a posted snapshot must pass beyond its signature: its shape and its size. */
function wellFormed(snap: unknown): snap is SharedAnswer {
  if (!snap || typeof snap !== "object") return false;
  const s = snap as Partial<SharedAnswer>;
  return (
    s.v === 1 &&
    typeof s.question === "string" &&
    typeof s.prose === "string" &&
    typeof s.answeredOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.answeredOn) &&
    typeof s.followUp === "boolean" &&
    !!s.exhibit &&
    typeof s.exhibit === "object" &&
    isShareable(s.exhibit as Exhibit) &&
    enc.encode(canonical(snap)).byteLength <= SNAPSHOT_MAX_BYTES
  );
}

export type ShareResult = { ok: true; id: string } | { ok: false; status: 400 | 403 | 503; error: string };

/** POST /api/ask/share: store a signed snapshot. Idempotent: a second share of one answer writes nothing. */
export async function storeShare(env: Env, body: unknown): Promise<ShareResult> {
  if (!env.ASK_SHARES) return { ok: false, status: 503, error: "Sharing isn't set up." };
  const { snapshot, sig } = (body ?? {}) as { snapshot?: unknown; sig?: unknown };
  if (!wellFormed(snapshot)) return { ok: false, status: 400, error: "That answer can't be shared." };
  if (!(await verify(env, snapshot, sig))) return { ok: false, status: 403, error: "That answer can't be shared." };
  const id = await shareId(snapshot);
  const key = KEY_PREFIX + id;
  if ((await env.ASK_SHARES.get(key)) === null) await env.ASK_SHARES.put(key, canonical(snapshot));
  return { ok: true, id };
}

/** GET /api/ask/share/<id>: the snapshot, or null when it isn't there (never shared, or removed). */
export async function readShare(env: Env, id: string): Promise<string | null> {
  if (!env.ASK_SHARES || !isShareId(id)) return null;
  return env.ASK_SHARES.get(KEY_PREFIX + id);
}

export const SHARE_CACHE_CONTROL = `public, max-age=${CACHE_SECONDS}`;
