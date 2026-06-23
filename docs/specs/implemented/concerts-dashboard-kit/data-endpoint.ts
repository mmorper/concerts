/**
 * Dashboard data endpoint — reads the latest snapshot from KV, stamps freshness,
 * returns it as JSON at GET /dashboard/data/. Both /dashboard/ and /dashboard/data/
 * sit behind Cloudflare Access, so Cache-Control is `private` (browser cache only,
 * never the shared edge).
 *
 * TWO VARIANTS below — use the one that matches how the Concerts SPA is served
 * (DISCOVER(2) in concerts-dashboard-spec.md). Delete the one you don't use.
 */

const SNAPSHOT_KEY = "dashboard:snapshot";
const STALE_AFTER_HOURS = 26; // one daily cron + a 2h grace window

function stampAndServe(raw: string | null, bindingPresent: boolean): Response {
  const json = (body: unknown, status = 200, cc?: string) =>
    new Response(JSON.stringify(body), {
      status,
      headers: cc
        ? { "Content-Type": "application/json", "Cache-Control": cc }
        : { "Content-Type": "application/json" },
    });

  if (!bindingPresent) return json({ error: "no snapshot yet" }, 503);
  if (!raw) return json({ error: "no snapshot yet" }, 503);

  let snapshot: { refreshedAt?: string; dataAge?: string };
  try {
    snapshot = JSON.parse(raw);
  } catch {
    return json({ error: "snapshot corrupt" }, 503);
  }

  const refreshedMs = snapshot.refreshedAt ? new Date(snapshot.refreshedAt).getTime() : NaN;
  const ageHours = Number.isFinite(refreshedMs) ? (Date.now() - refreshedMs) / 3_600_000 : Infinity;
  snapshot.dataAge = ageHours > STALE_AFTER_HOURS ? "stale" : "fresh";

  return json(snapshot, 200, "private, max-age=300");
}

// ─────────────── VARIANT A — Cloudflare Pages Function ───────────────
// File path: website/functions/dashboard/data.ts
// Bind CONCERTS_DASHBOARD on the Pages project (Settings → Functions → KV bindings).

interface PagesEnv {
  CONCERTS_DASHBOARD?: KVNamespace;
}

export const onRequest: PagesFunction<PagesEnv> = async ({ env }) => {
  const raw = env.CONCERTS_DASHBOARD ? await env.CONCERTS_DASHBOARD.get(SNAPSHOT_KEY) : null;
  return stampAndServe(raw, Boolean(env.CONCERTS_DASHBOARD));
};

// ─────────────── VARIANT B — route inside the SPA's serving Worker ───────────────
// If the React app is served by a Worker (not Pages), add this branch to that
// Worker's fetch handler instead of using Variant A. Bind CONCERTS_DASHBOARD in
// that Worker's wrangler.toml (same KV id as the refresh Worker).
//
//   export interface SiteEnv { CONCERTS_DASHBOARD: KVNamespace; /* ...rest */ }
//
//   async fetch(request: Request, env: SiteEnv): Promise<Response> {
//     const url = new URL(request.url);
//     if (url.pathname === "/dashboard/data/" || url.pathname === "/dashboard/data") {
//       const raw = await env.CONCERTS_DASHBOARD.get(SNAPSHOT_KEY);
//       return stampAndServe(raw, true);  // export stampAndServe or inline it
//     }
//     // ...existing routing (serve the React app, MCP, etc.)
//   }
