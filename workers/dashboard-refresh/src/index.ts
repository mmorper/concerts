/**
 * concerts-dashboard-refresh — Phase 1 (Operator MVP).
 *
 * Daily cron (06:00 UTC) → fan out to the two EXACT, server-side sources we already have —
 * Cloudflare GraphQL (traffic) + the `ask_turns` Analytics Engine ledger (spend + ask volume +
 * topics) — and write one snapshot to the CONCERTS_DASHBOARD KV namespace. No GA, no new
 * instrumentation, no sampling caveats. Later phases (#173–#176) add GA, MCP-external, archive
 * health, etc. Every source is independently try/caught: a dead source → null + a fetchErrors
 * entry, never an uncaught throw.
 *
 * Data contract mirrored on the client in src/types/dashboard.ts — keep the two in sync.
 */

export type SourceStatus = "ok" | "error" | "not_configured";

export interface DashboardSnapshot {
  refreshedAt: string; // ISO 8601 UTC
  dataAge: "fresh" | "stale"; // stamped by the data endpoint at serve time
  cloudflare: CloudflareSection | null;
  spend: SpendSection | null;
  ask: AskSection | null;
  sourceStatus: Record<"cloudflare" | "spend" | "ask", SourceStatus>;
  fetchErrors: string[];
}

export interface CloudflareSection {
  requests7d: number;
  requests30d: number;
  workerRequests7d: number;
  workerRequests30d: number;
}

export interface SpendSection {
  source: "ask_turns";
  costUsdToday: number;
  costUsd7d: number;
  costUsd30d: number;
  costUsdMonthToDate: number;
  capUsd: number | null;
  series: Array<{ date: string; costUsd: number }>;
}

export interface AskSection {
  turns7d: number;
  turns30d: number;
  byOutcome: Record<string, number>;
  topTopics: Array<{ term: string; n: number }>;
  refusalRate30d: number;
}

export interface Env {
  CONCERTS_DASHBOARD: KVNamespace;
  /** Account-level token with Analytics:Read + Account Analytics (covers GraphQL + the AE SQL API). */
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  /** Monthly Anthropic spend cap (USD) the trend draws a line at. Mirror ask-chat's ASK_MONTHLY_USD. */
  CAP_USD?: string;
  /** Optional: GET /?key=<REFRESH_KEY> triggers an out-of-band refresh. */
  REFRESH_KEY?: string;
}

const SNAPSHOT_KEY = "dashboard:snapshot";
const SNAPSHOT_TTL = 60 * 60 * 48; // 48h safety net behind the daily cron
const HISTORY_TTL = 60 * 60 * 24 * 400; // ~400 days — bounds the daily-history keys (a future
// Trends tab reads up to a year) so they don't accumulate in KV forever.
const DAY_MS = 86_400_000;
const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

// ──────────────────────────── pure helpers (unit-tested) ─────────────────────────────

/** Normalize a question for top-N frequency clustering (Phase 1: no LLM, just tidy + fold). */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aggregate raw {query,n} rows into the top-N normalized topics. */
export function topTopics(
  rows: Array<{ q: string; n: number }>,
  limit = 10,
): Array<{ term: string; n: number }> {
  const acc = new Map<string, number>();
  for (const { q, n } of rows) {
    const key = normalizeQuery(q);
    if (!key) continue;
    acc.set(key, (acc.get(key) ?? 0) + n);
  }
  return [...acc.entries()]
    .map(([term, n]) => ({ term, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

/** Roll a per-day cost series into today / 7d / 30d / month-to-date windows (USD). */
export function spendWindows(
  series: Array<{ date: string; costUsd: number }>,
  nowMs: number,
): { costUsdToday: number; costUsd7d: number; costUsd30d: number; costUsdMonthToDate: number } {
  const today = isoDay(nowMs);
  const since7 = isoDay(nowMs - 6 * DAY_MS);
  const since30 = isoDay(nowMs - 29 * DAY_MS);
  const monthPrefix = today.slice(0, 7);
  let costUsdToday = 0, costUsd7d = 0, costUsd30d = 0, costUsdMonthToDate = 0;
  for (const { date, costUsd } of series) {
    // Window 30d explicitly (today + 29 prior) rather than "whatever the series carried", so the
    // total stays correct even if the series is ever wider than the query window.
    if (date >= since30) costUsd30d += costUsd;
    if (date === today) costUsdToday += costUsd;
    if (date >= since7) costUsd7d += costUsd;
    if (date.startsWith(monthPrefix)) costUsdMonthToDate += costUsd;
  }
  return { costUsdToday, costUsd7d, costUsd30d, costUsdMonthToDate };
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
const numOf = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Resolve the spend-cap line (USD). Unset → 25 (mirrors ask-chat's ASK_MONTHLY_USD default); a
 * numeric value is used as-is INCLUDING 0 (an intentional zero cap); anything non-numeric → null
 * (no cap line) rather than silently coercing a real "0" into "no cap".
 */
export function parseCapUsd(raw: string | undefined): number | null {
  if (raw == null || raw === "") return 25;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ──────────────────────────── Cloudflare GraphQL ─────────────────────────────

// httpRequests1dGroups / workersInvocationsAdaptive return ONE group per UTC day — sum across all
// of them for the window total (taking [0] would report just a single day, undercounting ~7–30×).
function cfSum(groups: Array<{ sum?: { requests?: number } }> | undefined): number {
  return (groups ?? []).reduce((total, g) => total + (g.sum?.requests ?? 0), 0);
}

async function fetchCloudflare(env: Env, nowMs: number): Promise<CloudflareSection> {
  // Inclusive day windows matching the ask/spend sections: "7d" = today + 6 prior, "30d" = today
  // + 29 prior. (Datetimes anchored to the start of the first day so the worker series lines up.)
  const d7 = isoDay(nowMs - 6 * DAY_MS);
  const d30 = isoDay(nowMs - 29 * DAY_MS);
  const dt7 = `${d7}T00:00:00Z`;
  const dt30 = `${d30}T00:00:00Z`;
  const query = `{
    viewer { accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) {
      r7: httpRequests1dGroups(limit: 100, filter: { date_geq: "${d7}" }) { sum { requests } }
      r30: httpRequests1dGroups(limit: 100, filter: { date_geq: "${d30}" }) { sum { requests } }
      w7: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: "${dt7}" }) { sum { requests } }
      w30: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: "${dt30}" }) { sum { requests } }
    } }
  }`;
  const r = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Cloudflare GraphQL ${r.status}`);
  const json = (await r.json()) as {
    errors?: unknown[] | null;
    data?: { viewer?: { accounts?: Array<Record<string, Array<{ sum?: { requests?: number } }>>> } };
  };
  if (json.errors && json.errors.length) throw new Error(`Cloudflare GraphQL: ${JSON.stringify(json.errors)}`);
  const acc = json.data?.viewer?.accounts?.[0];
  if (!acc) throw new Error("Cloudflare GraphQL: no account in response");
  return {
    requests7d: cfSum(acc.r7),
    requests30d: cfSum(acc.r30),
    workerRequests7d: cfSum(acc.w7),
    workerRequests30d: cfSum(acc.w30),
  };
}

// ──────────────────────────── Analytics Engine (ask_turns) ─────────────────────────────
// blobs = [day, query, exhibitKind, outcome]; index1 = outcome;
// doubles = [in, out, cacheCreate, cacheRead, costMicroUsd(double5), fraction(double6)].
// _sample_interval is the adaptive-sampling weight — multiply counts/sums by it for accuracy.

async function aeSql<T = Record<string, unknown>>(env: Env, sql: string): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "text/plain" },
    body: sql,
  });
  if (!r.ok) throw new Error(`Analytics Engine SQL ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = (await r.json()) as { data?: T[] };
  return json.data ?? [];
}

async function fetchAskAndSpend(
  env: Env,
  nowMs: number,
): Promise<{ spend: SpendSection; ask: AskSection }> {
  // Two independent passes over the same table/window — fire them concurrently. Spend/volume is
  // required (a failure fails the whole ask_turns section); topics is best-effort (→ [] on error).
  const rowsP = aeSql<{ day: string; outcome: string; n: string; micro: string }>(
    env,
    `SELECT blob1 AS day, blob4 AS outcome,
            SUM(_sample_interval) AS n,
            SUM(double5 * _sample_interval) AS micro
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY
     GROUP BY day, outcome
     ORDER BY day`,
  );
  const topicsP = aeSql<{ q: string; n: string }>(
    env,
    `SELECT blob2 AS q, SUM(_sample_interval) AS n
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob2 != ''
     GROUP BY q ORDER BY n DESC LIMIT 300`,
  )
    .then((qrows) => topTopics(qrows.map((r) => ({ q: r.q, n: numOf(r.n) }))))
    .catch((): Array<{ term: string; n: number }> => []);

  const rows = await rowsP;

  const seriesMap = new Map<string, number>();
  const byOutcome: Record<string, number> = {};
  const since7 = isoDay(nowMs - 6 * DAY_MS);
  const since30 = isoDay(nowMs - 29 * DAY_MS);
  let turns7d = 0, turns30d = 0;
  for (const row of rows) {
    const day = row.day;
    const n = numOf(row.n);
    const usd = numOf(row.micro) / 1e6;
    seriesMap.set(day, (seriesMap.get(day) ?? 0) + usd); // full series → sparkline
    // Aggregates are windowed to 30 clean days (today + 29 prior); the rolling SQL cutoff can
    // include a 31st partial bucket, which we exclude here so the named windows are exact.
    if (day >= since30) {
      byOutcome[row.outcome] = (byOutcome[row.outcome] ?? 0) + n;
      turns30d += n;
      if (day >= since7) turns7d += n;
    }
  }
  const series = [...seriesMap.entries()]
    .map(([date, costUsd]) => ({ date, costUsd }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const topics = await topicsP;

  const refused = byOutcome["refused"] ?? 0;
  const capUsd = parseCapUsd(env.CAP_USD);
  const w = spendWindows(series, nowMs);

  return {
    spend: { source: "ask_turns", ...w, capUsd, series },
    ask: {
      turns7d,
      turns30d,
      byOutcome,
      topTopics: topics,
      refusalRate30d: turns30d ? refused / turns30d : 0,
    },
  };
}

// ──────────────────────────── snapshot assembly ─────────────────────────────

export async function buildSnapshot(env: Env, nowMs: number = Date.now()): Promise<DashboardSnapshot> {
  const fetchErrors: string[] = [];
  let cloudflare: CloudflareSection | null = null;
  let spend: SpendSection | null = null;
  let ask: AskSection | null = null;
  const sourceStatus: DashboardSnapshot["sourceStatus"] = {
    cloudflare: "error",
    spend: "error",
    ask: "error",
  };
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  await Promise.all([
    fetchCloudflare(env, nowMs)
      .then((c) => { cloudflare = c; sourceStatus.cloudflare = "ok"; })
      .catch((e) => { fetchErrors.push(`Cloudflare unavailable — ${msg(e)}`); }),
    fetchAskAndSpend(env, nowMs)
      .then(({ spend: s, ask: a }) => {
        spend = s; ask = a;
        sourceStatus.spend = "ok"; sourceStatus.ask = "ok";
      })
      .catch((e) => { fetchErrors.push(`ask_turns unavailable — ${msg(e)}`); }),
  ]);

  return {
    refreshedAt: new Date(nowMs).toISOString(),
    dataAge: "fresh",
    cloudflare,
    spend,
    ask,
    sourceStatus,
    fetchErrors,
  };
}

async function writeSnapshot(env: Env, snapshot: DashboardSnapshot): Promise<void> {
  await env.CONCERTS_DASHBOARD.put(SNAPSHOT_KEY, JSON.stringify(snapshot), { expirationTtl: SNAPSHOT_TTL });
  await env.CONCERTS_DASHBOARD.put(
    `dashboard:history:${snapshot.refreshedAt.slice(0, 10)}`,
    JSON.stringify(snapshot),
    { expirationTtl: HISTORY_TTL },
  );
}

export default {
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await writeSnapshot(env, await buildSnapshot(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!env.REFRESH_KEY) return new Response("refresh trigger disabled (set REFRESH_KEY)\n", { status: 403 });
    if (url.searchParams.get("key") !== env.REFRESH_KEY) return new Response("forbidden\n", { status: 403 });
    const snapshot = await buildSnapshot(env);
    await writeSnapshot(env, snapshot);
    return new Response(JSON.stringify(snapshot, null, 2), { headers: { "Content-Type": "application/json" } });
  },
};
