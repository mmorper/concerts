// Environment bindings for the Ask-the-Archive chat worker. See wrangler.toml.

import type { RateLimit } from "./ratelimit.js";

export interface Env {
  // Same data origin the MCP worker reads; the reused tool fns fetch these by URL.
  DATA_BASE_URL: string;
  // Monthly USD ceiling as a string var (Workers vars are strings). Daily cap derived from it.
  ASK_MONTHLY_USD: string;
  // Per-IP daily spend ceiling (USD, string var). A slice of the global day cap so one source
  // can't drain the whole budget and deny service to everyone. Optional; defaults in cost.ts.
  ASK_IP_DAILY_USD?: string;

  // Atomic per-day spend counter (Durable Object) — the cost cap's accurate ceiling.
  SPEND_COUNTER: DurableObjectNamespace;
  // Kill-switch flag + small control state. `ask:mode` ∈ {on, paused, deterministic-only}.
  ASK_CONTROL: KVNamespace;

  // Per-turn ledger (query + outcome + tokens + cost) for analytics + a future /dashboard. The
  // durable history the SpendCounter DO isn't. Optional: absent → telemetry is a no-op (see
  // telemetry.ts). Queryable via the account-level Analytics Engine SQL API.
  ASK_ANALYTICS?: AnalyticsEngineDataset;

  // Primary abuse gate — native Rate Limiting bindings (edge-local). Optional so local/test
  // runs without them fail open (defense-in-depth; session gate + cost cap still apply).
  IP_LIMITER?: RateLimit;
  SESSION_LIMITER?: RateLimit;

  // /ask/admin Cloudflare Access config (vars, not secrets — they're identifiers, not keys).
  ACCESS_TEAM_DOMAIN?: string; // <team>.cloudflareaccess.com
  ACCESS_AUD?: string; // the Access application's AUD tag

  // Secrets (wrangler secret put):
  ANTHROPIC_API_KEY?: string;
  TURNSTILE_SECRET?: string; // Turnstile server-side secret (session issuance)
  SESSION_HMAC_KEY?: string; // signs the short-lived session token
  NOTIFY_WEBHOOK_URL?: string; // tripwire push endpoint (ntfy/Pushover-style); optional
  ASK_ADMIN_IPS?: string; // optional comma-separated break-glass admin IPs (KV admin:ips is primary)
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
