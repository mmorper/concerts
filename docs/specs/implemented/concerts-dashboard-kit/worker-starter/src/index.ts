/**
 * concerts-dashboard-refresh — standalone Cloudflare Worker.
 *
 * Daily cron (06:00 UTC) → fan out to GA + Cloudflare + Anthropic + MCP →
 * write a ConcertsDashboardSnapshot to the CONCERTS_DASHBOARD KV namespace.
 * The data endpoint serves it; the React /dashboard route renders it.
 *
 * Ported from the Pitch dashboard Worker. The GA Web-Crypto JWT/OAuth engine and
 * the Cloudflare Analytics fetcher are reused VERBATIM and need no changes beyond
 * the GA property id. The Anthropic, MCP, and GA-engagement fetchers are STUBS
 * marked `TODO(concerts)` — fill them in Phase 0/3/4/5 once the data contract is
 * locked. Every source is independently try/caught: a failed source contributes
 * null/zeros + a fetchErrors entry, never an uncaught throw.
 *
 * See concerts-dashboard-spec.md for the data contract this file must honor.
 */

// ──────────────────────────── Data contract ──────────────────────────────

export interface ConcertsDashboardSnapshot {
  refreshedAt: string;
  ga: GaSection | null;
  cloudflare: CloudflareSection;
  anthropic: AnthropicSection | null;
  mcp: McpSection | null;
  github: GitHubSection | null;
  sourceStatus: {
    ga: "ok" | "error" | "not_configured";
    cloudflare: "ok" | "error";
    anthropic: "ok" | "error" | "not_configured";
    mcp: "ok" | "error" | "not_configured";
    github: "ok" | "error" | "not_configured";
  };
  fetchErrors: string[];
  dataAge: "fresh" | "stale";
}

interface GaSection {
  website: {
    sessions7d: number;
    sessions30d: number;
    sessions90d: number;
    byChannel: Record<string, number>;
    byCountry: Record<string, number>;
    topReferrers: Array<{ source: string; sessions: number }>;
    topPages: Array<{ page: string; views: number }>;
  };
  // TODO(concerts) DISCOVER(3): replace with the real custom-event taxonomy.
  engagement: Record<string, unknown>;
}

interface CloudflareSection {
  requests7d: number;
  requests30d: number;
  workerRequests7d: number;
  workerRequests30d: number;
  aiGateway: {
    requests30d: number;
    costUsd30d: number;
    tokensIn30d: number;
    tokensOut30d: number;
  } | null;
}

interface AnthropicSection {
  costUsdToday: number;
  costUsd7d: number;
  costUsd30d: number;
  costUsdMonthToDate: number;
  capUsd: number | null;
  byModel30d: Record<string, number>;
  series: Array<{ date: string; costUsd: number }>;
}

interface McpSection {
  queries7d: number;
  queries30d: number;
  byTool: Record<string, number>;
  bySource: { spa: number; external: number };
  series: Array<{ date: string; queries: number }>;
}

interface GitHubSection {
  velocity: { commitsLast7d: number; commitsLast30d: number; mergedPrsLast30d: number };
  issues: { open: number; byPriority?: Record<string, number> };
  recentPrs: Array<{ number: number; title: string; mergedAt: string }>;
}

export interface Env {
  CONCERTS_DASHBOARD: KVNamespace;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  /** GA service-account JSON key (the same one Pitch uses). Unset → ga null. */
  GA_SA_KEY_JSON?: string;
  /** Domain-wide-delegation subject, e.g. "mike@morper.net". */
  GA_IMPERSONATE_SUBJECT?: string;
  /** Anthropic Admin API key (sk-ant-admin…). Unset → anthropic null. */
  ANTHROPIC_ADMIN_KEY?: string;
  /** Optional: GitHub PAT for the Development tab. Unset → github null. */
  GH_TOKEN?: string;
  /** Optional: GET /?key=<REFRESH_KEY> triggers an out-of-band refresh. */
  REFRESH_KEY?: string;
}

const DAY_MS = 86_400_000;
const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const SNAPSHOT_KEY = "dashboard:snapshot";
const SNAPSHOT_TTL = 60 * 60 * 48; // 48h safety net behind the daily cron

// Your configured monthly Anthropic spend cap (USD). Hand-set; not an API value.
// Keep in sync with how spend is actually constrained. null = no cap line drawn.
const ANTHROPIC_CAP_USD: number | null = null; // TODO(concerts): set e.g. 50

function isoDate(ms: number): string {
  return new Date(ms).toISOString();
}
const num = (s: string | undefined): number => (s ? Number(s) || 0 : 0);

// ════════════════════════════ GA Data API ════════════════════════════════
// Reused verbatim from Pitch. CF Workers run in a V8 isolate (no Node/npm); the
// SA-key OAuth flow is done with the built-in Web Crypto API.

const GA_PROPERTY = "<CONCERTS_GA4_PROPERTY_ID>"; // TODO(concerts) DISCOVER(1)
const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA_REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY}:runReport`;

function b64url(input: string | Uint8Array): string {
  let bin = "";
  if (typeof input === "string") bin = input;
  else for (const byte of input) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function buildGaJwt(saKeyJson: string, nowSec: number, subject?: string): Promise<string> {
  const sa = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim: Record<string, unknown> = {
    iss: sa.client_email,
    scope: GA_SCOPE,
    aud: GA_TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  if (subject) claim.sub = subject; // domain-wide delegation: act as this user
  const claims = b64url(JSON.stringify(claim));
  const signingInput = `${header}.${claims}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

async function getGaAccessToken(saKeyJson: string, nowMs: number, subject?: string): Promise<string> {
  const jwt = await buildGaJwt(saKeyJson, Math.floor(nowMs / 1000), subject);
  const r = await fetch(GA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const j = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new Error(`GA token exchange ${r.status}: ${j.error ?? ""} ${j.error_description ?? ""}`.trim());
  }
  return j.access_token;
}

interface GaReportSpec {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: unknown;
  limit?: number;
  orderBys?: unknown[];
}
interface GaRow {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}

async function gaReport(token: string, spec: GaReportSpec): Promise<GaRow[]> {
  const r = await fetch(GA_REPORT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  const j = (await r.json()) as { rows?: GaRow[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`GA runReport ${r.status}: ${j.error?.message ?? ""}`);
  return j.rows ?? [];
}

function eventNameFilter(name: string): unknown {
  return { filter: { fieldName: "eventName", stringFilter: { value: name } } };
}
export function rowsToMap(rows: GaRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = row.dimensionValues?.[0]?.value;
    if (k) out[k] = num(row.metricValues?.[0]?.value);
  }
  return out;
}

async function fetchGA(saKeyJson: string, nowMs: number, subject?: string): Promise<GaSection> {
  const token = await getGaAccessToken(saKeyJson, nowMs, subject);
  const dr = (days: number) => ({ startDate: `${days}daysAgo`, endDate: "today" });
  const d7 = dr(7), d30 = dr(30), d90 = dr(90);
  const bySessions = { metric: { metricName: "sessions" }, desc: true };

  const sessionsFor = async (range: { startDate: string; endDate: string }) =>
    num((await gaReport(token, { dateRanges: [range], metrics: [{ name: "sessions" }] }))[0]?.metricValues?.[0]?.value);

  // ── Website block (generic; identical to Pitch) ──
  const [sessions7d, sessions30d, sessions90d, channelRows, countryRows, referrerRows, pageRows] =
    await Promise.all([
      sessionsFor(d7),
      sessionsFor(d30),
      sessionsFor(d90),
      gaReport(token, { dateRanges: [d30], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], limit: 10 }),
      gaReport(token, { dateRanges: [d30], dimensions: [{ name: "country" }], metrics: [{ name: "sessions" }], limit: 6, orderBys: [bySessions] }).catch(() => [] as GaRow[]),
      gaReport(token, { dateRanges: [d30], dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }], limit: 6, orderBys: [bySessions] }).catch(() => [] as GaRow[]),
      gaReport(token, { dateRanges: [d30], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], limit: 8, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] }),
    ]);

  const website: GaSection["website"] = {
    sessions7d, sessions30d, sessions90d,
    byChannel: rowsToMap(channelRows),
    byCountry: rowsToMap(countryRows),
    topReferrers: referrerRows.map((row) => ({ source: row.dimensionValues?.[0]?.value ?? "", sessions: num(row.metricValues?.[0]?.value) })),
    topPages: pageRows.map((row) => ({ page: row.dimensionValues?.[0]?.value ?? "", views: num(row.metricValues?.[0]?.value) })),
  };

  // ── Engagement block (Concerts-specific custom events) ──
  // TODO(concerts) DISCOVER(3): once the SPA event taxonomy is known, fetch the
  // per-event / per-param breakdowns. Pattern (per event):
  //   const sceneRows = await gaReport(token, {
  //     dateRanges: [d30],
  //     dimensions: [{ name: "eventName" }],          // or customEvent:<param>
  //     metrics: [{ name: "eventCount" }],
  //     dimensionFilter: { filter: { fieldName: "eventName",
  //       inListFilter: { values: ["scene_timeline","scene_venues","scene_artists","scene_ask"] } } },
  //     limit: 25,
  //   }).catch(() => [] as GaRow[]);
  //   engagement.byScene = rowsToMap(sceneRows);
  const engagement: Record<string, unknown> = { byScene: {} };

  return { website, engagement };
}

// ════════════════════════════ Cloudflare ═════════════════════════════════
// Reused verbatim from Pitch. Optionally extended with AI Gateway analytics.

function cfSum(groups: Array<{ sum?: { requests?: number } }> | undefined): number {
  return groups?.[0]?.sum?.requests ?? 0;
}

async function fetchCloudflare(token: string, accountId: string, nowMs: number): Promise<CloudflareSection> {
  const d7 = isoDate(nowMs - 7 * DAY_MS).slice(0, 10);
  const d30 = isoDate(nowMs - 30 * DAY_MS).slice(0, 10);
  const dt7 = isoDate(nowMs - 7 * DAY_MS);
  const dt30 = isoDate(nowMs - 30 * DAY_MS);

  const query = `{
    viewer { accounts(filter: { accountTag: "${accountId}" }) {
      r7: httpRequests1dGroups(limit: 100, filter: { date_geq: "${d7}" }) { sum { requests } }
      r30: httpRequests1dGroups(limit: 100, filter: { date_geq: "${d30}" }) { sum { requests } }
      w7: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: "${dt7}" }) { sum { requests } }
      w30: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: "${dt30}" }) { sum { requests } }
    } }
  }`;

  const r = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Cloudflare GraphQL ${r.status}`);
  const json = (await r.json()) as {
    errors: unknown[] | null;
    data?: { viewer?: { accounts?: Array<Record<string, Array<{ sum?: { requests?: number } }>>> } };
  };
  if (json.errors && json.errors.length) throw new Error(`Cloudflare GraphQL: ${JSON.stringify(json.errors)}`);
  const acc = json.data?.viewer?.accounts?.[0];
  if (!acc) throw new Error("Cloudflare GraphQL: no account in response");

  // TODO(concerts) DISCOVER(4): if Anthropic runs through AI Gateway, add the AI
  // Gateway analytics dataset to the GraphQL query above and populate aiGateway.
  // Verify the dataset/field names against current CF docs (cloudflare skill).
  return {
    requests7d: cfSum(acc.r7),
    requests30d: cfSum(acc.r30),
    workerRequests7d: cfSum(acc.w7),
    workerRequests30d: cfSum(acc.w30),
    aiGateway: null,
  };
}

function emptyCloudflare(): CloudflareSection {
  return { requests7d: 0, requests30d: 0, workerRequests7d: 0, workerRequests30d: 0, aiGateway: null };
}

// ════════════════════════════ Anthropic spend ════════════════════════════
// NET-NEW. Skip entirely if you go the AI Gateway route (cost lives in CF then).

async function fetchAnthropic(adminKey: string, nowMs: number): Promise<AnthropicSection> {
  // TODO(concerts) DISCOVER(4) + VERIFY: the Anthropic Admin Usage & Cost API
  // evolves — confirm the current endpoint, query params, headers, and response
  // shape via the `claude-api` skill / Anthropic docs before trusting this.
  //
  // As of writing, the Cost report is roughly:
  //   GET https://api.anthropic.com/v1/organizations/cost_report
  //       ?starting_at=<ISO>&ending_at=<ISO>&bucket_width=1d
  //   headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" }
  //   → { data: [ { starting_at, ending_at, results: [ { amount: {currency,value}, ... } ] } ] }
  //
  // Implement: pull a 30d daily series, sum windows (today/7d/30d/MTD), and map
  // by model if the response exposes it. Returning the empty shape below keeps
  // the dashboard rendering ("Pending") until this is wired.
  void adminKey;
  void nowMs;
  return {
    costUsdToday: 0,
    costUsd7d: 0,
    costUsd30d: 0,
    costUsdMonthToDate: 0,
    capUsd: ANTHROPIC_CAP_USD,
    byModel30d: {},
    series: [],
  };
}

// ════════════════════════════ MCP telemetry ══════════════════════════════
// NET-NEW. Reads whatever store the MCP Worker logs queries into. Prereq: that
// store must exist (Phase 0 / Phase 5). Until then this stays null.

async function fetchMcp(env: Env, nowMs: number): Promise<McpSection> {
  // TODO(concerts) DISCOVER(5): read MCP query telemetry. Recommended source for
  // a Worker-based MCP server: Cloudflare Workers Analytics Engine — one data
  // point per query with blobs [tool, source('spa'|'external')], queried here via
  // the Analytics Engine SQL API. Alternatives: a D1 table or KV counters.
  //
  // Example (Analytics Engine SQL API):
  //   const sql = `SELECT blob1 AS tool, blob2 AS source, count() AS n
  //                FROM mcp_queries WHERE timestamp > now() - INTERVAL '30' DAY
  //                GROUP BY tool, source`;
  //   POST https://api.cloudflare.com/client/v4/accounts/<acct>/analytics_engine/sql
  //   Authorization: Bearer <token with Account Analytics:Read>
  void env;
  void nowMs;
  throw new Error("MCP telemetry source not yet implemented");
}

// ════════════════════════════ GitHub (optional) ══════════════════════════

async function fetchGitHub(token: string, nowMs: number): Promise<GitHubSection> {
  // TODO(concerts): trim-down of Pitch's fetchGitHub. Point REPO at the Concerts
  // repo, pull commits (velocity) + open issues + recent merged PRs. Optional
  // tab — omit the whole source if you don't want a Development tab.
  void token;
  void nowMs;
  throw new Error("GitHub source not yet implemented");
}

// ════════════════════════════ Snapshot assembly ══════════════════════════

export async function buildSnapshot(env: Env, nowMs: number = Date.now()): Promise<ConcertsDashboardSnapshot> {
  const fetchErrors: string[] = [];
  let ga: GaSection | null = null;
  let cloudflare = emptyCloudflare();
  let anthropic: AnthropicSection | null = null;
  let mcp: McpSection | null = null;
  let github: GitHubSection | null = null;

  let cloudflareStatus: "ok" | "error" = "ok";
  let gaStatus: "ok" | "error" | "not_configured" = env.GA_SA_KEY_JSON ? "ok" : "not_configured";
  let anthropicStatus: "ok" | "error" | "not_configured" = env.ANTHROPIC_ADMIN_KEY ? "ok" : "not_configured";
  let mcpStatus: "ok" | "error" | "not_configured" = "not_configured";
  let githubStatus: "ok" | "error" | "not_configured" = env.GH_TOKEN ? "ok" : "not_configured";

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  await Promise.all([
    fetchCloudflare(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, nowMs)
      .then((c) => { cloudflare = c; })
      .catch((e) => { cloudflareStatus = "error"; fetchErrors.push(`Cloudflare unavailable — ${errMsg(e)}`); }),

    env.GA_SA_KEY_JSON
      ? fetchGA(env.GA_SA_KEY_JSON, nowMs, env.GA_IMPERSONATE_SUBJECT)
          .then((g) => { ga = g; })
          .catch((e) => { gaStatus = "error"; fetchErrors.push(`GA unavailable — ${errMsg(e)}`); })
      : Promise.resolve(),

    env.ANTHROPIC_ADMIN_KEY
      ? fetchAnthropic(env.ANTHROPIC_ADMIN_KEY, nowMs)
          .then((a) => { anthropic = a; })
          .catch((e) => { anthropicStatus = "error"; fetchErrors.push(`Anthropic unavailable — ${errMsg(e)}`); })
      : Promise.resolve(),

    // MCP: attempt always; "not yet implemented" lands as not_configured, not error.
    fetchMcp(env, nowMs)
      .then((m) => { mcp = m; mcpStatus = "ok"; })
      .catch((e) => {
        const msg = errMsg(e);
        if (/not yet implemented/.test(msg)) { mcpStatus = "not_configured"; }
        else { mcpStatus = "error"; fetchErrors.push(`MCP unavailable — ${msg}`); }
      }),

    env.GH_TOKEN
      ? fetchGitHub(env.GH_TOKEN, nowMs)
          .then((g) => { github = g; })
          .catch((e) => { githubStatus = "error"; fetchErrors.push(`GitHub unavailable — ${errMsg(e)}`); })
      : Promise.resolve(),
  ]);

  return {
    refreshedAt: isoDate(nowMs),
    ga,
    cloudflare,
    anthropic,
    mcp,
    github,
    sourceStatus: {
      ga: gaStatus,
      cloudflare: cloudflareStatus,
      anthropic: anthropicStatus,
      mcp: mcpStatus,
      github: githubStatus,
    },
    fetchErrors,
    dataAge: "fresh",
  };
}

async function writeSnapshot(env: Env, snapshot: ConcertsDashboardSnapshot): Promise<void> {
  await env.CONCERTS_DASHBOARD.put(SNAPSHOT_KEY, JSON.stringify(snapshot), { expirationTtl: SNAPSHOT_TTL });
  const dateKey = snapshot.refreshedAt.slice(0, 10);
  await env.CONCERTS_DASHBOARD.put(`dashboard:history:${dateKey}`, JSON.stringify(snapshot));
}

// ──────────────────────────── Worker entrypoints ─────────────────────────

export default {
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await writeSnapshot(env, await buildSnapshot(env));
    // TODO(concerts): port the timeseries builder for the Trends view if wanted.
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!env.REFRESH_KEY) return new Response("refresh trigger disabled (set REFRESH_KEY)\n", { status: 403 });
    if (url.searchParams.get("key") !== env.REFRESH_KEY) return new Response("forbidden\n", { status: 403 });
    const snapshot = await buildSnapshot(env);
    await writeSnapshot(env, snapshot);
    return new Response(JSON.stringify(snapshot, null, 2), { headers: { "Content-Type": "application/json" } });
  },
};
