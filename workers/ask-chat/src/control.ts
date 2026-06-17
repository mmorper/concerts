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
