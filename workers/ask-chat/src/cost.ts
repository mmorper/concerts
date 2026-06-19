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

// Per-IP daily ceiling — a slice of the global day cap so a single source can't drain the whole
// budget (a denial-of-service-by-budget-exhaustion lever the global cap alone doesn't close).
// Defaults to ~$0.15/day (≈18% of the ~$0.83/day global ceiling). microUSD.
export function ipDailyCapMicroUsd(env: Env): number {
  return Math.round(Number(env.ASK_IP_DAILY_USD || "0.15") * 1_000_000);
}

// Conservative pre-flight reservation for one user turn (the loop may make several model
// calls). commit() swaps this for the measured cost, so over-estimating only briefly tightens
// headroom under concurrency — it never overcharges. ~$0.10.
export const RESERVE_EST_MICRO_USD = 100_000;

// The account-wide counter and a per-IP counter are two instances of the same DO class — each
// tracks its own DayState; the cap is passed per call.
function globalStub(env: Env): DurableObjectStub {
  return env.SPEND_COUNTER.get(env.SPEND_COUNTER.idFromName("global"));
}
function ipStub(env: Env, ip: string): DurableObjectStub {
  return env.SPEND_COUNTER.get(env.SPEND_COUNTER.idFromName(`ip:${ip}`));
}

interface CounterReply {
  ok?: boolean;
  id?: string;
  status: SpendStatus;
}

async function call(
  stub: DurableObjectStub,
  path: string,
  cap: number,
  params: Record<string, string>,
): Promise<CounterReply> {
  const qs = new URLSearchParams({ cap: String(cap), ...params });
  const res = await stub.fetch(`https://do/${path}?${qs}`);
  return (await res.json()) as CounterReply;
}

// A reservation holds a slot on BOTH counters; commit/release must settle both.
export interface ReserveTicket {
  ip: string;
  globalId: string;
  ipId: string;
}

export interface Reservation {
  ok: boolean;
  ticket?: ReserveTicket;
  status: SpendStatus; // the GLOBAL status — drives the done fraction + ≥80% tripwire
  scope?: "global" | "ip"; // which ceiling blocked, when !ok (for the right refusal copy)
}

// Reserve the global and per-IP slots in PARALLEL (two independent DOs — no need to pay their
// latency serially on every turn). Both must pass; if exactly one passes, release it so a refused
// turn never leaks budget.
export async function reserveTurn(env: Env, ip: string): Promise<Reservation> {
  const gCap = dailyCapMicroUsd(env);
  const iCap = ipDailyCapMicroUsd(env);
  const est = String(RESERVE_EST_MICRO_USD);
  const [g, i] = await Promise.all([
    call(globalStub(env), "reserve", gCap, { est }),
    call(ipStub(env, ip), "reserve", iCap, { est }),
  ]);
  const gOk = !!(g.ok && g.id);
  const iOk = !!(i.ok && i.id);

  if (gOk && iOk) {
    return { ok: true, ticket: { ip, globalId: g.id!, ipId: i.id! }, status: g.status };
  }
  // One side blocked (or both): release whichever slot we did take.
  if (gOk) await call(globalStub(env), "release", gCap, { id: g.id! }).catch(() => {});
  if (iOk) await call(ipStub(env, ip), "release", iCap, { id: i.id! }).catch(() => {});
  // Report the global cap as the blocker only if it's actually what blocked; else the per-IP slice.
  return { ok: false, status: g.status, scope: gOk ? "ip" : "global" };
}

export async function commitTurn(env: Env, ticket: ReserveTicket, usage: AnthropicUsage): Promise<SpendStatus> {
  const actual = String(usageMicroUsd(usage));
  const [g] = await Promise.all([
    call(globalStub(env), "commit", dailyCapMicroUsd(env), { id: ticket.globalId, actual }),
    call(ipStub(env, ticket.ip), "commit", ipDailyCapMicroUsd(env), { id: ticket.ipId, actual }),
  ]);
  return g.status;
}

export async function releaseTurn(env: Env, ticket: ReserveTicket): Promise<void> {
  await Promise.all([
    call(globalStub(env), "release", dailyCapMicroUsd(env), { id: ticket.globalId }),
    call(ipStub(env, ticket.ip), "release", ipDailyCapMicroUsd(env), { id: ticket.ipId }),
  ]);
}

export async function spendStatus(env: Env): Promise<SpendStatus> {
  const r = await call(globalStub(env), "status", dailyCapMicroUsd(env), {});
  return r.status;
}
