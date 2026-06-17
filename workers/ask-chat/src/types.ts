// Environment bindings for the Ask-the-Archive chat worker. See wrangler.toml.

export interface Env {
  // Same data origin the MCP worker reads; the reused tool fns fetch these by URL.
  DATA_BASE_URL: string;
  // Monthly USD ceiling as a string var (Workers vars are strings). Daily cap derived from it.
  ASK_MONTHLY_USD: string;

  // Atomic per-day spend counter (Durable Object) — the cost cap's accurate ceiling.
  SPEND_COUNTER: DurableObjectNamespace;
  // Kill-switch flag + small control state. `ask:mode` ∈ {on, paused, deterministic-only}.
  ASK_CONTROL: KVNamespace;

  // Secrets (wrangler secret put):
  ANTHROPIC_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  SESSION_HMAC_KEY?: string;
}

// The reused data layer (workers/mcp-server/src/data.ts) only ever reads env.DATA_BASE_URL,
// but its fns are typed against the MCP worker's Env (which also declares MCP_QUERY_USAGE).
// This is the structural subset they actually touch — cast at the single bridge seam.
export type DataEnv = { DATA_BASE_URL: string };

// Kill-switch modes (spec §"Kill switch & incident response").
export type AskMode = "on" | "paused" | "deterministic-only";

// Spend snapshot returned by the SpendCounter DO and surfaced on /admin + the tripwire.
export interface SpendStatus {
  day: string; // YYYY-MM-DD (UTC)
  committedMicroUsd: number;
  reservedMicroUsd: number;
  capMicroUsd: number;
  fraction: number; // committed / cap, drives the ≥80% tripwire
}
