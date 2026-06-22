// Phase 4 (#174) — per-tool-call telemetry → Cloudflare Analytics Engine (dataset `mcp_queries`).
// ONE row per tool invocation: which tool ran, which plane it came from, and how it ended. This is
// the net-new, NOT-retroactive collector — external MCP clients (Claude et al.) hit this Worker
// directly and touch neither GA nor the ask_turns ledger, so without this they're invisible. The
// operator dashboard's refresh Worker reads `mcp_queries` via the account-level SQL API and unions
// it with the ask_turns (in-SPA) side to show queries-by-tool and in-SPA-vs-external split.
//
// Mirrors the ask-chat telemetry conventions (workers/ask-chat/src/telemetry.ts): blob1 = day (the
// partition a dashboard groups by), index1 = the cheap sampling/group key. The binding is OPTIONAL:
// absent in dev/test and any deploy that hasn't added the dataset → this is a no-op. It NEVER throws
// into the tool path (the tool result is already built by the time we log).

import type { Env } from "./types.js";

// Every tool call this Worker serves originates from an external MCP client — the in-SPA Ask side is
// the ask-chat worker's ask_turns ledger. The dashboard reads mcp_queries AS the external plane, so
// this is constant; it's a blob (not implicit) to keep the row self-describing alongside ask_turns.
const SOURCE_EXTERNAL = "external";

/** UTC day partition (YYYY-MM-DD), matching ask_turns' blob1 convention. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record one tool call. `outcome` is "ok" or "error" (the wrapTool isError flag) so a later
 * monitoring view can slice mcp errors the way it does ask_turns. Fire-and-forget; never throws.
 */
export function recordMcpQuery(env: Env, tool: string, outcome: "ok" | "error"): void {
  if (!env.MCP_ANALYTICS) return;
  try {
    env.MCP_ANALYTICS.writeDataPoint({
      // index1 (≤96B sampling/group key) — the tool name, the primary slice the dashboard groups by.
      indexes: [tool],
      // blob1 = day, blob2 = tool, blob3 = source plane, blob4 = outcome.
      blobs: [utcDay(), tool, SOURCE_EXTERNAL, outcome],
      doubles: [1], // double1 — a literal 1 per call (SUM gives an unsampled count alongside _sample_interval)
    });
  } catch (e) {
    // Telemetry must never break a tool call that already produced a result.
    console.error("mcp telemetry write failed", e);
  }
}
