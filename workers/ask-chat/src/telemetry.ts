// Per-turn telemetry → Cloudflare Analytics Engine (issue: ask analytics). ONE row per user turn:
// the question, how it ended, which exhibit it produced, token usage, and cost. This is the
// durable spend + query ledger the SpendCounter DO can't be — the DO forgets everything at the UTC
// rollover (it only enforces *today's* cap). Analytics Engine keeps the history and is queryable
// via the account-level SQL API, so a future /dashboard reads "queries this week", "spend trend",
// and "top exhibit kinds" straight from here.
//
// The binding is OPTIONAL: absent in dev/test and any deploy that hasn't added the dataset → this
// is a no-op. It NEVER throws into the request path (the answer already streamed by the time we log).

import type { Env } from "./types.js";
import { usageMicroUsd, type AnthropicUsage } from "./cost.js";

// How a turn ended. Mirrors the SSE terminal states so the ledger explains every turn.
export type TurnOutcome =
  | "answered" // LLM turn produced prose + exhibit
  | "deterministic" // kill-switch middle tier: answered from a tool, no LLM spend
  | "refused" // graceful refusal (off-topic, empty answer)
  | "cap" // daily/per-IP budget exhausted
  | "paused" // kill switch off, or no API key
  | "error"; // unexpected failure

export interface TurnTelemetry {
  day: string; // YYYY-MM-DD (UTC) — the partition a dashboard groups by
  query: string; // the user's question (truncated)
  outcome: TurnOutcome;
  exhibitKind: string; // primary exhibit card kind, or "none"
  usage: AnthropicUsage; // token counts for the turn (empty when no LLM call ran)
  fraction: number; // committed spend / daily cap at the end of the turn
}

// Analytics Engine blobs cap at 5120 bytes total across the row; one question can't be allowed to
// blow that. 512 chars is plenty to see what people actually ask.
const MAX_QUERY_LEN = 512;

export function logTurn(env: Env, t: TurnTelemetry): void {
  if (!env.ASK_ANALYTICS) return;
  try {
    env.ASK_ANALYTICS.writeDataPoint({
      // index1 is the sampling/group key (≤96B) — outcome lets the dashboard slice the ledger by
      // how turns ended (answered vs refused vs cap) cheaply.
      indexes: [t.outcome],
      blobs: [t.day, t.query.slice(0, MAX_QUERY_LEN), t.exhibitKind, t.outcome],
      doubles: [
        t.usage.input_tokens ?? 0, // double1
        t.usage.output_tokens ?? 0, // double2
        t.usage.cache_creation_input_tokens ?? 0, // double3
        t.usage.cache_read_input_tokens ?? 0, // double4
        usageMicroUsd(t.usage), // double5 — measured cost, microUSD
        t.fraction, // double6 — spend fraction of the daily cap
      ],
    });
  } catch (e) {
    // Telemetry must never break a turn that already answered.
    console.error("ask telemetry write failed", e);
  }
}
