// Kill-switch + control state (spec §"Kill switch & incident response").
//
// `ask:mode` ∈ {on, paused, deterministic-only} lives in KV so it can be flipped from a
// phone with no redeploy. Read pre-flight on every turn. FAIL-SAFE: an absent or unreadable
// flag defaults to `on` — the DO cost cap is the independent ceiling, so a KV blip can't take
// the feature down while spend stays bounded.

import type { Env, AskMode } from "./types.js";

const MODE_KEY = "ask:mode";
const MODE_MEMO_MS = 10_000; // a flip lands within ~10s (spec: cache ≤10s)

let memo: { value: AskMode; at: number } | null = null;

export async function getMode(env: Env): Promise<AskMode> {
  const now = Date.now();
  if (memo && now - memo.at < MODE_MEMO_MS) return memo.value;
  let value: AskMode = "on";
  try {
    const raw = await env.ASK_CONTROL.get(MODE_KEY);
    if (raw === "paused" || raw === "deterministic-only" || raw === "on") value = raw;
  } catch (e) {
    console.error("ask:mode read failed — defaulting to on", e);
    value = "on";
  }
  memo = { value, at: now };
  return value;
}

export async function setMode(env: Env, mode: AskMode): Promise<void> {
  await env.ASK_CONTROL.put(MODE_KEY, mode);
  memo = { value: mode, at: Date.now() }; // reflect immediately in this isolate
}

// Admin-IP allowlist (#158). Stored in KV so the dashboard can manage it with no redeploy.
// Phase 2 (#172) ships the storage + management endpoints; the turn-path bypass that *reads*
// this list is the remaining #158 work. Until then this list is managed but not yet enforced.
const ADMIN_IPS_KEY = "admin:ips";

/** Trim, drop empties, dedupe — preserving insertion order. Pure; unit-tested. */
export function normalizeIps(ips: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ips) {
    const ip = (raw ?? "").trim();
    if (ip && !seen.has(ip)) {
      seen.add(ip);
      out.push(ip);
    }
  }
  return out;
}

export async function getAdminIps(env: Env): Promise<string[]> {
  try {
    const raw = await env.ASK_CONTROL.get(ADMIN_IPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeIps(parsed.filter((x): x is string => typeof x === "string"));
  } catch (e) {
    console.error("admin:ips read failed", e);
    return [];
  }
}

export async function setAdminIps(env: Env, ips: string[]): Promise<string[]> {
  const clean = normalizeIps(ips);
  await env.ASK_CONTROL.put(ADMIN_IPS_KEY, JSON.stringify(clean));
  return clean;
}
