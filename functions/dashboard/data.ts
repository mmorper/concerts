/**
 * Dashboard data endpoint — Cloudflare Pages Function at GET /dashboard/data/.
 *
 * Reads the latest snapshot from KV, stamps freshness, returns JSON. Both /dashboard and
 * /dashboard/data sit behind Cloudflare Access, so Cache-Control is `private` (browser cache only,
 * never the shared edge — so Access is always honored).
 *
 * Bind CONCERTS_DASHBOARD on the Pages project (Settings → Functions → KV bindings) to the SAME
 * namespace id the refresh Worker writes (workers/dashboard-refresh).
 */

const SNAPSHOT_KEY = "dashboard:snapshot";
const STALE_AFTER_HOURS = 26; // one daily cron + a 2h grace window

interface Env {
  CONCERTS_DASHBOARD?: KVNamespace;
}

function json(body: unknown, status = 200, cacheControl?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  if (!env.CONCERTS_DASHBOARD) return json({ error: "no snapshot yet" }, 503);
  const raw = await env.CONCERTS_DASHBOARD.get(SNAPSHOT_KEY);
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
};
