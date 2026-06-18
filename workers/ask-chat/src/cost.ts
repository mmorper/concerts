// Cost math + the client seam to the SpendCounter Durable Object.
//
// Pricing: Haiku 4.5 — $1 / MTok input, $5 / MTok output (verified 2026-06-16, same source
// as the MCP query tool). $1/MTok == exactly 1 microUSD per token, which makes the per-token
// rates whole-ish numbers and the counter integer-friendly.

import type { Env, SpendStatus } from "./types.js";

// microUSD per token, by token class. Anthropic reports cached input separately from fresh
// input, and cache writes/reads are priced off the base input rate (1.25× write, 0.1× read).
const RATE = {
  input: 1, // $1 / MTok
  output: 5, // $5 / MTok
  cacheWrite: 1.25, // 5-minute cache write = 1.25× input
  cacheRead: 0.1, // cache read = 0.1× input
} as const;

export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Measured cost of one Messages call, in microUSD.
export function usageMicroUsd(u: AnthropicUsage): number {
  return Math.ceil(
    (u.input_tokens ?? 0) * RATE.input +
      (u.output_tokens ?? 0) * RATE.output +
      (u.cache_creation_input_tokens ?? 0) * RATE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * RATE.cacheRead,
  );
}

// Daily ceiling derived from the monthly knob (spec frames the cap as per-day). microUSD.
export function dailyCapMicroUsd(env: Env): number {
  const monthly = Number(env.ASK_MONTHLY_USD || "25");
  return Math.round((monthly / 30) * 1_000_000);
}

// Conservative pre-flight reservation for one user turn (the loop may make several model
// calls). commit() swaps this for the measured cost, so over-estimating only briefly tightens
// headroom under concurrency — it never overcharges. ~$0.10.
export const RESERVE_EST_MICRO_USD = 100_000;

// One global counter instance — the cap is account-wide, not per-user.
function stub(env: Env): DurableObjectStub {
  return env.SPEND_COUNTER.get(env.SPEND_COUNTER.idFromName("global"));
}

interface CounterReply {
  ok?: boolean;
  id?: string;
  status: SpendStatus;
}

async function call(env: Env, path: string, params: Record<string, string>): Promise<CounterReply> {
  const qs = new URLSearchParams({ cap: String(dailyCapMicroUsd(env)), ...params });
  const res = await stub(env).fetch(`https://do/${path}?${qs}`);
  return (await res.json()) as CounterReply;
}

export interface Reservation {
  ok: boolean;
  id?: string;
  status: SpendStatus;
}

export async function reserveTurn(env: Env): Promise<Reservation> {
  const r = await call(env, "reserve", { est: String(RESERVE_EST_MICRO_USD) });
  return { ok: r.ok ?? false, id: r.id, status: r.status };
}

export async function commitTurn(env: Env, id: string, usage: AnthropicUsage): Promise<SpendStatus> {
  const r = await call(env, "commit", { id, actual: String(usageMicroUsd(usage)) });
  return r.status;
}

export async function releaseTurn(env: Env, id: string): Promise<void> {
  await call(env, "release", { id });
}

export async function spendStatus(env: Env): Promise<SpendStatus> {
  const r = await call(env, "status", {});
  return r.status;
}
