/**
 * concerts-dashboard-refresh — Phase 1 (Operator MVP) + Phase 3 (GA engagement layer).
 *
 * Daily cron (06:00 UTC) → fan out to its sources in parallel and write one snapshot to the
 * CONCERTS_DASHBOARD KV namespace:
 *   - Cloudflare GraphQL (traffic) + the `ask_turns` Analytics Engine ledger (spend + ask volume +
 *     topics) — exact, server-side, no sampling caveats (Phase 1).
 *   - GA4 Data API (Phase 3, #173) — website report + the Concerts custom-event taxonomy. OPTIONAL:
 *     absent GA creds → the `ga` section is null + sourceStatus.ga = "not_configured".
 *   - Archive Health (Phase 5, #175) — enrichment coverage computed from the generated
 *     public/data/*.json (no new APIs); one equally-weighted row per stage (spec Appendix C).
 *   - MCP & Ask (Phase 4, #174) — unions the mcp_queries Analytics Engine table (external MCP
 *     clients; net-new collector in the morperhaus-mcp Worker) with the ask_turns (in-SPA) side.
 * Later phases (#176) add Topics/Trends/Dev, etc. Every source is independently try/caught: a dead
 * source → null + a fetchErrors entry, never an uncaught throw.
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
  ga: GaSection | null; // Phase 3 (#173) — GA4 website + custom-event engagement
  mcp: McpSection | null; // Phase 4 (#174) — ask_turns (in-SPA) ∪ mcp_queries (external clients)
  archiveHealth: ArchiveHealthSection | null; // Phase 5 (#175) — enrichment coverage
  topics: TopicsSection | null; // Phase 6 (#176) — Topics & Gaps depth (ask_turns + GA search)
  trends: TrendsSection | null; // Phase 6 (#176) — per-day series from dashboard:history:*
  github: GitHubSection | null; // Phase 6 (#176) — Development tab (optional GH_TOKEN)
  monitoring: MonitoringSection | null; // Phase 6 (#176) — 5xx + ask/mcp error outcomes
  sourceStatus: Record<
    "cloudflare" | "spend" | "ask" | "ga" | "mcp" | "archiveHealth" | "topics" | "trends" | "github" | "monitoring",
    SourceStatus
  >;
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

// Phase 3 (#173) — GA4 via the Data API (service account + domain-wide delegation). Two blocks:
// the generic website report (sessions / channels / countries / referrers / pages) and the Concerts
// custom-event taxonomy (Appendix B). Custom-dimension breakdowns ("what's getting clicked") only
// carry data from the day their GA4 custom dimensions were registered — NOT retroactive.
export interface GaWebsite {
  sessions7d: number;
  sessions30d: number;
  sessions90d: number;
  byChannel: Record<string, number>; // sessionDefaultChannelGroup (30d)
  byCountry: Record<string, number>; // country (30d, top 6)
  topReferrers: Array<{ source: string; sessions: number }>; // sessionSource (30d)
  topPages: Array<{ page: string; views: number }>; // pagePath (30d, top 8)
}

export interface GaEngagement {
  byScene: Record<string, number>; // scene_view, keyed by scene_name
  sceneNav: number; // scene_nav_clicked
  deepLinks: number; // deep_link_accessed
  interactions: Record<string, number>; // high-signal interaction event counts
  searches: { count: number; topTerms: Array<{ term: string; n: number }> }; // artist_search_performed
  audioPreviews: number; // artist_preview_played
  ask: Record<string, number>; // ask_* funnel event counts
  device: Record<string, number>; // device_type → raw eventCount (the client renders as share-of-total)
  topArtists: Array<{ name: string; n: number }>; // artist_card_opened.artist_name
  topVenues: Array<{ name: string; n: number }>; // venue_node_clicked + map_marker_clicked.venue_name
  topSongs: Array<{ name: string; n: number }>; // artist_preview_played.track_name
  topSetlists: Array<{ name: string; n: number }>; // setlist_button_clicked.artist_name
  // Phase 4 (#174) — Ask-as-navigation: ask_deeplink_clicked by target_scene. Empty until the
  // `target_scene` GA4 custom dimension is registered (an owner console task, not retroactive).
  askNav: Array<{ name: string; n: number }>;
}

export interface GaSection {
  website: GaWebsite;
  engagement: GaEngagement;
  daily: Array<{ date: string; sessions: number }>; // Phase 6 (#176) — per-day sessions (30d) for Trends
}

// Phase 4 (#174) — MCP & Ask telemetry. Unions the two planes that can drive the archive's tools:
// the in-SPA Ask chat (ask_turns, server-side, already live) and external MCP clients (mcp_queries,
// the net-new Analytics Engine collector in the morperhaus-mcp Worker). `series` carries BOTH planes
// per day so the tab can draw a multi-line chart (spec mock); `byTool` is external-only (the in-SPA
// side has no per-tool breakdown). Until mcp-server ships its instrumentation, the external side is
// 0 and the tab notes "external tool-calls pending instrumentation."
export interface McpSection {
  queries7d: number; // spa + external
  queries30d: number; // spa + external
  byTool: Record<string, number>; // external mcp_queries: tool name → call count (30d)
  bySource: { spa: number; external: number }; // 30d call counts per plane
  series: Array<{ date: string; spa: number; external: number }>; // daily, last 30d
  askExhibitKinds: Record<string, number>; // ask_turns exhibit kind (30d) — feeds the outcomes legend
  // Did the mcp_queries dataset respond? Distinguishes "collector not deployed yet" (false → the tab
  // shows the pending-instrumentation note) from "deployed, but zero external calls in the window"
  // (true, external 0). Without this a legitimately-quiet month would read as undeployed.
  externalLive: boolean;
}

// Phase 5 (#175) — Archive Health. One equally-weighted coverage row per enrichment stage,
// computed from the generated public/data/*.json (no new external APIs). See spec Appendix C.
export interface ArchiveStage {
  stage: string;
  covered: number;
  total: number;
  pct: number; // 0..100, rounded
  note?: string;
}

export interface ArchiveHealthSection {
  lastBuildAt: string | null; // newest generated/lastUpdated timestamp across the data files
  concerts: number;
  artists: number; // unique headliners + openers
  venues: number;
  stages: ArchiveStage[];
  // Phase 6 (#176) — per-headliner enrichment % (genre · photo · previews · discography), keyed by
  // slug. Powers the Demand×Coverage quadrant: join against GA's most-clicked artists (popularity).
  coverageByArtist: Record<string, number>;
}

// Phase 6 (#176) — Topics & Gaps. Derived from the ask_turns query ledger (intent, gaps, wishlist)
// plus GA search events (zero-result searches, suggested-prompt CTR). Intent is a cheap rule-based
// bucketing of query text — NOT an LLM classifier (the spec's deliberate over-engineering cut). The
// gap/wishlist split is heuristic ("flavor, not fact", spec Appendix D): a refused/no-exhibit
// question that names a known artist/venue is a content GAP (we have the entity, couldn't answer);
// one that doesn't is a WISHLIST item (asked about a show not in the archive). GA-fed panels stay
// empty until the search_term / prompt GA4 custom dimensions are registered (not retroactive).
export interface TopicsSection {
  questions30d: number; // total ask_turns this window
  answeredRate30d: number; // answered+deterministic / total
  refusalRate30d: number; // refused / total
  askTopics: Array<{ term: string; n: number }>; // most-asked, normalized top-N
  intentMix: Record<string, number>; // rule-based intent bucket → count
  exhibitKinds: Record<string, number>; // artist/venue/concert/none
  contentGaps: Array<{ term: string; n: number }>; // refused, entity exists
  wishlist: Array<{ term: string; n: number }>; // refused, entity not in archive
  searchTerms: Array<{ term: string; n: number }>; // GA artist_search_performed.search_term
  zeroResultSearches: Array<{ term: string; n: number }>; // GA searches with results_found = 0
  suggestedPrompts: Array<{ prompt: string; n: number }>; // GA ask_suggested_prompt_clicked.prompt
}

// Phase 6 (#176) — Trends. A per-day union of the three daily sources already in the snapshot: GA
// sessions (retroactive 30d), MCP queries (mcp.series), and ask_turns spend (spend.series). No KV
// accumulation — sessions/spend back-fill 30 days immediately; only the external-MCP slice is
// forward-only (it accrues from the day mcp-server's collector is deployed). One point per UTC day.
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  sessions: number; // GA website sessions that day (0 if GA absent)
  mcpQueries: number; // spa + external queries that day
  spendUsd: number; // ask_turns cost that day
}

export interface TrendsSection {
  series: TrendPoint[]; // chronological, last ~90 days
}

// Phase 6 (#176) — Development tab. Trim-down of the Pitch fetchGitHub: commit velocity, open issues
// by label, recent merged PRs for mmorper/concerts. Optional GH_TOKEN — absent → section null.
export interface GitHubSection {
  velocity: { commitsLast7d: number; commitsLast30d: number; mergedPrsLast30d: number };
  issues: { open: number; byLabel: Record<string, number> };
  recentPrs: Array<{ number: number; title: string; mergedAt: string }>;
}

// Phase 6 (#176) — Monitoring. Edge/worker 5xx from CF GraphQL + ask/mcp error & refusal counts read
// straight from the AE ledgers (its own queries, per the per-source-isolation model). The CF 5xx call
// is required; the ask/mcp error counts are best-effort (→ 0).
export interface MonitoringSection {
  edge5xx30d: number;
  worker5xx30d: number;
  askErrors30d: number;
  askRefusals30d: number;
  mcpErrors30d: number;
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
  /** Phase 3 GA — numeric GA4 property id (e.g. "123456789") for G-VKSC8MCN5N. */
  GA_PROPERTY?: string;
  /** Phase 3 GA — the GA service-account key JSON (client_email + private_key + token_uri). */
  GA_SA_KEY_JSON?: string;
  /** Phase 3 GA — optional DWD subject the SA impersonates (a GA-Viewer user/group). */
  GA_IMPERSONATE_SUBJECT?: string;
  /** Phase 5 — base URL the generated public/data/*.json are served from (no trailing slash). */
  DATA_BASE_URL?: string;
  /** Phase 6 — optional GitHub token (repo:read) for the Development tab. Absent → section hidden. */
  GH_TOKEN?: string;
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

// ──────────────────────────── GA4 Data API ─────────────────────────────
// Service-account JWT (RS256, signed via Web Crypto) → DWD OAuth token → batchRunReports.
// I/O is not unit-tested (matching the CF/AE pattern); the row-shaping helpers below are.

interface GaServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface GaReportRow {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}
export interface GaReport {
  rows?: GaReportRow[];
}

// High-signal interaction + Ask funnel event names we pull out of the all-events report.
const INTERACTION_EVENTS = [
  "artist_card_opened",
  "timeline_card_clicked",
  "map_marker_clicked",
  "venue_node_clicked",
  "setlist_button_clicked",
  "artist_preview_played",
  "genre_tile_clicked",
  "artist_tab_viewed",
  "liner_notes_badge_clicked",
  "tour_badge_clicked",
];
const ASK_EVENTS = [
  "ask_opened",
  "ask_question_sent",
  "ask_exhibit_shown",
  "ask_refused",
  "ask_error",
  "ask_deeplink_clicked",
  "ask_suggested_prompt_clicked",
];

export function gaConfigured(env: Env): boolean {
  return Boolean(env.GA_PROPERTY && env.GA_SA_KEY_JSON);
}

/** First metric of a chosen row as a number (used for single-value / per-date-range totals). */
export function gaScalar(report: GaReport | undefined, rowIdx = 0, metricIdx = 0): number {
  return numOf(report?.rows?.[rowIdx]?.metricValues?.[metricIdx]?.value);
}

/** dimension[dimIdx] → metric[metricIdx] number, folded into a Record (skips empty keys). */
export function gaRecord(report: GaReport | undefined, dimIdx = 0, metricIdx = 0): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of report?.rows ?? []) {
    const key = row.dimensionValues?.[dimIdx]?.value;
    if (!key) continue;
    out[key] = (out[key] ?? 0) + numOf(row.metricValues?.[metricIdx]?.value);
  }
  return out;
}

/** Top-N {name,n} from a single-dimension report (re-sorted defensively even though GA orders). */
export function gaTopN(
  report: GaReport | undefined,
  limit = 8,
  dimIdx = 0,
  metricIdx = 0,
): Array<{ name: string; n: number }> {
  return (report?.rows ?? [])
    .map((r) => ({ name: r.dimensionValues?.[dimIdx]?.value ?? "", n: numOf(r.metricValues?.[metricIdx]?.value) }))
    .filter((x) => x.name !== "")
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

// ──────────────────────────── MCP & Ask aggregation (Phase 4) ─────────────────────────────
// Pure assembler over the two AE queries (unit-tested); fetchMcp below is the I/O seam (not).
// Both planes are windowed to a clean 30d (today + 29 prior) in JS — the rolling SQL cutoff can
// admit a 31st partial bucket, which we drop here so the named windows are exact (matches the
// ask_turns spend/volume pass). `byTool` is external-only (the in-SPA side has no per-tool dimension).

export function assembleMcp(
  externalRows: Array<{ day: string; tool: string; n: number }>,
  spaRows: Array<{ day: string; n: number }>,
  exhibitRows: Array<{ kind: string; n: number }>,
  nowMs: number,
  externalLive: boolean,
): McpSection {
  const since7 = isoDay(nowMs - 6 * DAY_MS);
  const since30 = isoDay(nowMs - 29 * DAY_MS);
  const byTool: Record<string, number> = {};
  const dayMap = new Map<string, { spa: number; external: number }>();
  const dayBucket = (d: string) => {
    let b = dayMap.get(d);
    if (!b) {
      b = { spa: 0, external: 0 };
      dayMap.set(d, b);
    }
    return b;
  };

  let extTotal = 0, ext7 = 0, spaTotal = 0, spa7 = 0;
  for (const r of externalRows) {
    if (r.day < since30) continue;
    dayBucket(r.day).external += r.n;
    extTotal += r.n;
    if (r.day >= since7) ext7 += r.n;
    if (r.tool) byTool[r.tool] = (byTool[r.tool] ?? 0) + r.n;
  }
  for (const r of spaRows) {
    if (r.day < since30) continue;
    dayBucket(r.day).spa += r.n;
    spaTotal += r.n;
    if (r.day >= since7) spa7 += r.n;
  }

  const series = [...dayMap.entries()]
    .map(([date, v]) => ({ date, spa: v.spa, external: v.external }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const askExhibitKinds: Record<string, number> = {};
  for (const r of exhibitRows) if (r.kind) askExhibitKinds[r.kind] = (askExhibitKinds[r.kind] ?? 0) + r.n;

  return {
    queries7d: spa7 + ext7,
    queries30d: spaTotal + extTotal,
    byTool,
    bySource: { spa: spaTotal, external: extTotal },
    series,
    askExhibitKinds,
    externalLive,
  };
}

/** Pick only the named keys that are present in a counts Record (drops absent events cleanly). */
export function pickCounts(rec: Record<string, number>, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) if (rec[k] != null) out[k] = rec[k];
  return out;
}

function b64urlStr(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBytes(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

async function gaAccessToken(sa: GaServiceAccount, subject?: string): Promise<string> {
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(
    JSON.stringify({
      iss: sa.client_email,
      scope: GA_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
      ...(subject ? { sub: subject } : {}),
    }),
  );
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${b64urlBytes(sig)}`;
  const r = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) throw new Error(`GA token ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("GA token: no access_token in response");
  return j.access_token;
}

async function gaBatch(token: string, property: string, requests: unknown[]): Promise<GaReport[]> {
  const r = await fetch(`${GA_DATA_API}/properties/${property}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!r.ok) throw new Error(`GA batchRunReports ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { reports?: GaReport[] };
  const reports = j.reports ?? [];
  // Reports come back in request order; we read them positionally. A short array would silently
  // shift every index (byChannel reading the country report, etc.) — fail the section instead.
  if (reports.length < requests.length) {
    throw new Error(`GA batchRunReports returned ${reports.length}/${requests.length} reports`);
  }
  return reports;
}

// Small request builders for the Data API JSON.
const dr = (days: number) => ({ startDate: `${days}daysAgo`, endDate: "today" });
const ec = { name: "eventCount" };
const orderByMetric = (name: string) => [{ metric: { metricName: name }, desc: true }];
function eventFilter(names: string[]) {
  return names.length === 1
    ? { filter: { fieldName: "eventName", stringFilter: { value: names[0] } } }
    : { filter: { fieldName: "eventName", inListFilter: { values: names } } };
}

async function fetchGA(env: Env): Promise<GaSection> {
  const sa = JSON.parse(env.GA_SA_KEY_JSON as string) as GaServiceAccount;
  const property = env.GA_PROPERTY as string;
  const token = await gaAccessToken(sa, env.GA_IMPERSONATE_SUBJECT);

  // Three ≤5-report batches: website, events, "what's getting clicked".
  const websiteReqs = [
    { dateRanges: [dr(7), dr(30), dr(90)], metrics: [{ name: "sessions" }] }, // 0 — one row per range
    { dateRanges: [dr(30)], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }] },
    { dateRanges: [dr(30)], dimensions: [{ name: "country" }], metrics: [{ name: "sessions" }], orderBys: orderByMetric("sessions"), limit: 6 },
    { dateRanges: [dr(30)], dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }], orderBys: orderByMetric("sessions"), limit: 8 },
    { dateRanges: [dr(30)], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: orderByMetric("screenPageViews"), limit: 8 },
  ];
  const eventReqs = [
    { dateRanges: [dr(30)], dimensions: [{ name: "eventName" }], metrics: [ec], orderBys: orderByMetric("eventCount"), limit: 200 }, // 0 — all events (ordered so any cap drops lowest-volume)
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:scene_name" }], metrics: [ec], dimensionFilter: eventFilter(["scene_view"]), orderBys: orderByMetric("eventCount"), limit: 12 },
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:search_term" }], metrics: [ec], dimensionFilter: eventFilter(["artist_search_performed"]), orderBys: orderByMetric("eventCount"), limit: 10 },
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:device_type" }], metrics: [ec], orderBys: orderByMetric("eventCount"), limit: 5 },
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:artist_name" }], metrics: [ec], dimensionFilter: eventFilter(["artist_card_opened"]), orderBys: orderByMetric("eventCount"), limit: 8 },
  ];
  const clickedReqs = [
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:venue_name" }], metrics: [ec], dimensionFilter: eventFilter(["venue_node_clicked", "map_marker_clicked"]), orderBys: orderByMetric("eventCount"), limit: 8 },
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:track_name" }], metrics: [ec], dimensionFilter: eventFilter(["artist_preview_played"]), orderBys: orderByMetric("eventCount"), limit: 8 },
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:artist_name" }], metrics: [ec], dimensionFilter: eventFilter(["setlist_button_clicked"]), orderBys: orderByMetric("eventCount"), limit: 8 },
    // Phase 4 (#174) — Ask-as-navigation: ask_deeplink_clicked by target_scene (the MCP & Ask tab).
    { dateRanges: [dr(30)], dimensions: [{ name: "customEvent:target_scene" }], metrics: [ec], dimensionFilter: eventFilter(["ask_deeplink_clicked"]), orderBys: orderByMetric("eventCount"), limit: 8 },
  ];
  // Phase 6 (#176) — per-day sessions for the Trends tab. `date` is a standard (retroactive) GA
  // dimension — no custom dimension needed, so this back-fills the last 30 days immediately.
  const dailyReqs = [
    { dateRanges: [dr(30)], dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }], orderBys: [{ dimension: { dimensionName: "date" }, desc: false }], limit: 40 },
  ];

  const [web, events, clicked, daily] = await Promise.all([
    gaBatch(token, property, websiteReqs),
    gaBatch(token, property, eventReqs),
    gaBatch(token, property, clickedReqs),
    gaBatch(token, property, dailyReqs),
  ]);

  const allEvents = gaRecord(events[0]);
  return {
    website: {
      sessions7d: gaScalar(web[0], 0),
      sessions30d: gaScalar(web[0], 1),
      sessions90d: gaScalar(web[0], 2),
      byChannel: gaRecord(web[1]),
      byCountry: gaRecord(web[2]),
      topReferrers: gaTopN(web[3], 8).map(({ name, n }) => ({ source: name, sessions: n })),
      topPages: gaTopN(web[4], 8).map(({ name, n }) => ({ page: name, views: n })),
    },
    engagement: {
      byScene: gaRecord(events[1]),
      sceneNav: allEvents["scene_nav_clicked"] ?? 0,
      deepLinks: allEvents["deep_link_accessed"] ?? 0,
      interactions: pickCounts(allEvents, INTERACTION_EVENTS),
      searches: {
        count: allEvents["artist_search_performed"] ?? 0,
        topTerms: gaTopN(events[2], 10).map(({ name, n }) => ({ term: name, n })),
      },
      audioPreviews: allEvents["artist_preview_played"] ?? 0,
      ask: pickCounts(allEvents, ASK_EVENTS),
      device: gaRecord(events[3]),
      topArtists: gaTopN(events[4], 8),
      topVenues: gaTopN(clicked[0], 8),
      topSongs: gaTopN(clicked[1], 8),
      topSetlists: gaTopN(clicked[2], 8),
      askNav: gaTopN(clicked[3], 8),
    },
    daily: (daily[0].rows ?? [])
      .map((r) => ({ date: gaDate(r.dimensionValues?.[0]?.value), sessions: numOf(r.metricValues?.[0]?.value) }))
      .filter((x) => x.date),
  };
}

/** GA `date` dimension is YYYYMMDD — normalize to the ISO YYYY-MM-DD the rest of the snapshot uses. */
const gaDate = (s?: string): string =>
  s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "";

// ──────────────────────────── MCP & Ask (Phase 4) ─────────────────────────────
// Two AE tables, unioned: mcp_queries (external clients — net-new, may not exist until mcp-server
// deploys its instrumentation) and ask_turns (the in-SPA Ask side — already live). The external
// query is independently caught → [] so the section still renders the in-SPA side with external 0
// (the "pending instrumentation" state). A failure of the required ask_turns pass throws → the whole
// mcp section goes null (handled by buildSnapshot's try/catch), exactly like the other sources.

async function fetchMcp(env: Env, nowMs: number): Promise<McpSection> {
  // External (mcp_queries): blob1=day, blob2=tool. Best-effort — the dataset doesn't exist until
  // the first writeDataPoint post-deploy, and querying a missing table errors; treat that as zero
  // but remember the query DIDN'T respond, so the tab can tell "not deployed" from "deployed, quiet".
  const externalP = aeSql<{ day: string; tool: string; n: string }>(
    env,
    `SELECT blob1 AS day, blob2 AS tool, SUM(_sample_interval) AS n
     FROM mcp_queries
     WHERE timestamp >= NOW() - INTERVAL '30' DAY
     GROUP BY day, tool
     ORDER BY day`,
  )
    .then((rows) => ({ live: true, rows }))
    .catch(() => ({ live: false, rows: [] as Array<{ day: string; tool: string; n: string }> }));

  // In-SPA (ask_turns): one row per day. Required — a failure fails the section.
  const spaP = aeSql<{ day: string; n: string }>(
    env,
    `SELECT blob1 AS day, SUM(_sample_interval) AS n
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY
     GROUP BY day
     ORDER BY day`,
  );

  // Exhibit-kind mix (ask_turns blob3) for the outcomes legend. Best-effort → [] on error.
  const exhibitP = aeSql<{ kind: string; n: string }>(
    env,
    `SELECT blob3 AS kind, SUM(_sample_interval) AS n
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob3 != '' AND blob3 != 'none'
     GROUP BY kind
     ORDER BY n DESC`,
  ).catch((): Array<{ kind: string; n: string }> => []);

  const [external, spa, exhibits] = await Promise.all([externalP, spaP, exhibitP]);

  return assembleMcp(
    external.rows.map((r) => ({ day: r.day, tool: r.tool, n: numOf(r.n) })),
    spa.map((r) => ({ day: r.day, n: numOf(r.n) })),
    exhibits.map((r) => ({ kind: r.kind, n: numOf(r.n) })),
    nowMs,
    external.live,
  );
}

// ──────────────────────────── Archive Health (public/data) ─────────────────────────────
// Pure computation over the generated data files (unit-tested); the fetch wrapper is not.

const DATA_FILES = [
  "concerts",
  "artists-metadata",
  "artists-top-tracks",
  "venues-metadata",
  "setlists-cache",
  "discography",
  "liner-notes",
] as const;

// Minimal shapes — only the fields the coverage formulas read.
interface ArchiveData {
  concerts: {
    metadata?: { lastUpdated?: string };
    concerts: Array<{
      id: string;
      date?: string;
      headliner?: string;
      headlinerNormalized?: string;
      venue?: string;
      genreNormalized?: string;
      openers?: string[];
    }>;
  };
  "artists-metadata": Record<string, { image?: string; bio?: string; genres?: string[] }>;
  "artists-top-tracks": Record<string, { tracks?: Array<{ previewUrl?: string }> }>;
  "venues-metadata": Record<string, { photoUrls?: Record<string, unknown> | unknown[]; location?: { lat?: number } }>;
  "setlists-cache": {
    generatedAt?: string;
    entries?: Array<{ concertId?: string; setlist?: { sets?: { set?: Array<{ song?: unknown[] }> } } }>;
  };
  discography: Record<string, { albums?: Array<{ coverUrl?: string; coverAvailable?: boolean }> }>;
  "liner-notes": {
    generatedAt?: string;
    metadata?: { totalPosts?: number; totalGenerated?: number; lastPipelineRun?: string };
  };
}

/** Slugify a display name to the data files' key convention (mirrors src/utils/normalize). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rounded coverage percentage; 0 when there's nothing to cover. */
export function pct(covered: number, total: number): number {
  return total > 0 ? Math.round((covered / total) * 100) : 0;
}

const mkStage = (stage: string, covered: number, total: number, note?: string): ArchiveStage => ({
  stage,
  covered,
  total,
  pct: pct(covered, total),
  note,
});

// A venue photo only counts if it's a real image — every venue carries a placeholder
// (/images/venues/fallback.jpg) in photoUrls, so a non-empty object alone would read as 100%.
const isRealPhoto = (url: unknown): url is string =>
  typeof url === "string" && url.length > 0 && !/fallback|placeholder/i.test(url);

/** Newest ISO timestamp among the candidates (ISO 8601 sorts lexically); null if none. */
function newestIso(candidates: Array<string | undefined>): string | null {
  const valid = candidates.filter((s): s is string => typeof s === "string" && s.length > 0);
  return valid.length ? valid.reduce((a, b) => (a > b ? a : b)) : null;
}

export function computeArchiveHealth(d: ArchiveData): ArchiveHealthSection {
  const concerts = d.concerts.concerts ?? [];
  const total = concerts.length;
  const am = d["artists-metadata"] ?? {};
  const tt = d["artists-top-tracks"] ?? {};
  const venues = d["venues-metadata"] ?? {};
  const disco = d.discography ?? {};

  // Artist universe: headliners ∪ openers (openers-only tracked separately for the genre split).
  const headliners = new Set<string>();
  for (const c of concerts) {
    const h = c.headlinerNormalized || (c.headliner ? normalizeName(c.headliner) : "");
    if (h) headliners.add(h);
  }
  const openersOnly = new Set<string>();
  for (const c of concerts) {
    for (const o of c.openers ?? []) {
      const n = normalizeName(o);
      if (n && !headliners.has(n)) openersOnly.add(n);
    }
  }
  // Materialize the artist sets once — every per-artist stage below reads the same universe.
  const headlinerList = [...headliners];
  const openerList = [...openersOnly];
  const artistList = [...headliners, ...openersOnly];
  const artistCount = artistList.length;

  // 1. Concert metadata — required fields present.
  const validConcerts = concerts.filter((c) => c.date && c.headliner && c.venue).length;

  // 2. Genres — artist-level genres, split headliner vs opener (the gap the spec calls out).
  const hasGenre = (a: string) => (am[a]?.genres?.length ?? 0) > 0;
  const hg = headlinerList.filter(hasGenre).length;
  const og = openerList.filter(hasGenre).length;

  // 3. Artist metadata — photo (bio is not currently populated by the pipeline; noted, not scored).
  const withImage = artistList.filter((a) => am[a]?.image).length;
  const withBio = artistList.filter((a) => am[a]?.bio).length;

  // 4. Audio previews — artists with ≥2 of 5 preview URLs.
  const previewCount = (a: string) => (tt[a]?.tracks ?? []).filter((t) => t.previewUrl).length;
  const withPreviews = artistList.filter((a) => previewCount(a) >= 2).length;

  // 5. Venues — real photos (placeholders excluded) and geocode (a real lat).
  const venueVals = Object.values(venues);
  const withPhoto = venueVals.filter((v) => Object.values(v.photoUrls ?? {}).some(isRealPhoto)).length;
  const withGeo = venueVals.filter((v) => typeof v.location?.lat === "number").length;

  // 6. Setlists — concerts whose cached setlist actually carries songs.
  const concertIds = new Set(concerts.map((c) => c.id));
  const withSetlist = new Set<string>();
  for (const e of d["setlists-cache"].entries ?? []) {
    if (!e.concertId || !concertIds.has(e.concertId)) continue;
    const sets = e.setlist?.sets?.set ?? [];
    if (sets.some((s) => (s.song?.length ?? 0) > 0)) withSetlist.add(e.concertId);
  }

  // 7. Discography — artists with ≥1 album; cover-art availability noted (one pass).
  let withAlbums = 0;
  let albumTotal = 0;
  let albumCover = 0;
  for (const a of artistList) {
    const albums = disco[a]?.albums ?? [];
    if (albums.length > 0) withAlbums++;
    for (const al of albums) {
      albumTotal++;
      if (al.coverAvailable) albumCover++;
    }
  }

  // Per-headliner enrichment % over four equally-weighted signals (genre · photo · ≥2 previews ·
  // ≥1 album). Headliners only — those are the artists GA's artist_card_opened tracks (the demand
  // axis of the Demand×Coverage quadrant).
  const coverageByArtist: Record<string, number> = {};
  for (const a of headlinerList) {
    let signals = 0;
    if (hasGenre(a)) signals++;
    if (am[a]?.image) signals++;
    if (previewCount(a) >= 2) signals++;
    if ((disco[a]?.albums?.length ?? 0) > 0) signals++;
    coverageByArtist[a] = Math.round((signals / 4) * 100);
  }

  // 8. Liner notes — published findings / analyzed findings.
  const ln = d["liner-notes"].metadata ?? {};
  const published = ln.totalPosts ?? 0;
  const analyzed = ln.totalGenerated ?? 0;

  const stages: ArchiveStage[] = [
    mkStage("Concert metadata", validConcerts, total, "date · headliner · venue present"),
    mkStage(
      "Genres",
      hg + og,
      artistCount,
      `headliners ${pct(hg, headliners.size)}% · openers ${pct(og, openersOnly.size)}%`,
    ),
    mkStage("Artist photos", withImage, artistCount, `bio sparse — ${withBio}/${artistCount} have one`),
    mkStage("Audio previews", withPreviews, artistCount, "≥2 of 5 preview URLs"),
    mkStage("Venue photos", withPhoto, venueVals.length, `geocoded ${pct(withGeo, venueVals.length)}%`),
    mkStage("Setlists", withSetlist.size, total, "concerts with ≥1 song"),
    mkStage("Discography", withAlbums, artistCount, `${pct(albumCover, albumTotal)}% of albums have cover art`),
    mkStage("Liner notes", published, analyzed, "published / analyzed findings"),
  ];

  return {
    lastBuildAt: newestIso([
      d.concerts.metadata?.lastUpdated,
      d["setlists-cache"].generatedAt,
      d["liner-notes"].generatedAt,
      d["liner-notes"].metadata?.lastPipelineRun,
    ]),
    concerts: total,
    artists: artistCount,
    venues: venueVals.length,
    stages,
    coverageByArtist,
  };
}

async function fetchArchiveHealth(env: Env): Promise<ArchiveHealthSection> {
  const base = (env.DATA_BASE_URL ?? "https://concerts.morperhaus.org/data").replace(/\/$/, "");
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const r = await fetch(`${base}/${name}.json`);
      if (!r.ok) throw new Error(`${name}.json ${r.status}`);
      return [name, await r.json()] as const;
    }),
  );
  const data = Object.fromEntries(entries) as unknown as ArchiveData;
  return computeArchiveHealth(data);
}

// ──────────────────────────── Topics & Gaps (Phase 6) ─────────────────────────────
// Derived from the ask_turns ledger. Intent is rule-based bucketing of the question text (the spec's
// "top-N frequency, no LLM classifier" cut). The gap/wishlist split is heuristic: a refused/no-exhibit
// question that names a known artist/venue is a content GAP; one that doesn't is a WISHLIST item.

// Order matters — earlier rules win. "Counting" precedes "Have you seen…" so that
// "how many times did you see X" reads as counting, not a have-you-seen question.
const INTENT_RULES: Array<[string, RegExp]> = [
  ["Counting / stats", /\bhow many\b|\bhow often\b|\bnumber of\b|\bcount\b|\bmost\b|\btotal\b|\bhow much\b/],
  ["Have you seen…", /\b(have|did) you (ever )?(see|seen|been to)\b|\bever seen\b/],
  ["On this day", /\bon this (day|date)\b|\btoday\b/],
  ["Comparison", /\b(vs|versus|compared? to|more than|better than)\b/],
  ["Recommendation", /\brecommend|\bsuggest|\bshould i\b|\bwhat should\b|\bbest\b/],
  ["Lookup", /\bwho\b|\bwhen\b|\bwhere\b|\bwhich\b|\bwhat (year|venue|city|date)\b/],
];

/** Cheap rule-based intent bucket for a question (first matching rule wins; else "Other"). */
export function classifyIntent(query: string): string {
  const s = query.toLowerCase();
  for (const [label, re] of INTENT_RULES) if (re.test(s)) return label;
  return "Other";
}

export interface AskTopicRow {
  q: string;
  outcome: string;
  kind: string;
  n: number;
}

export function assembleTopics(rows: AskTopicRow[], archiveNames: string[], nowMs: number): TopicsSection {
  void nowMs; // window is applied in SQL; topics are approximate (no per-day re-window)
  // Normalize the archive names the SAME way as the query text (refusedAgg keys are normalizeQuery'd)
  // so the gap/wishlist match compares like with like — otherwise a punctuated name ("Guns N' Roses")
  // never matches its stripped query form ("guns n roses").
  const normNames = [...new Set(archiveNames.map(normalizeQuery))].filter((n) => n.length > 1);
  let total = 0,
    answered = 0,
    refused = 0;
  const intentMix: Record<string, number> = {};
  const exhibitKinds: Record<string, number> = {};
  const refusedAgg = new Map<string, number>(); // normalized question → count (gap/wishlist candidates)

  for (const r of rows) {
    total += r.n;
    if (r.outcome === "answered" || r.outcome === "deterministic") answered += r.n;
    if (r.outcome === "refused") refused += r.n;
    const intent = classifyIntent(r.q);
    intentMix[intent] = (intentMix[intent] ?? 0) + r.n;
    const kind = r.kind || "none";
    exhibitKinds[kind] = (exhibitKinds[kind] ?? 0) + r.n;
    // A question we couldn't answer with an exhibit is a gap/wishlist candidate.
    if (r.outcome === "refused" || kind === "none") {
      const key = normalizeQuery(r.q);
      if (key) refusedAgg.set(key, (refusedAgg.get(key) ?? 0) + r.n);
    }
  }

  const gaps: Array<{ term: string; n: number }> = [];
  const wishlist: Array<{ term: string; n: number }> = [];
  for (const [term, n] of refusedAgg) {
    // Whole-word match (padded) so a known name counts only as a standalone token — avoids short
    // names ("u2", "air") substring-matching unrelated words.
    const padded = ` ${term} `;
    const namesAKnown = normNames.some((name) => padded.includes(` ${name} `));
    (namesAKnown ? gaps : wishlist).push({ term, n });
  }
  const byN = (a: { n: number }, b: { n: number }) => b.n - a.n;

  return {
    questions30d: total,
    answeredRate30d: total ? answered / total : 0,
    refusalRate30d: total ? refused / total : 0,
    askTopics: topTopics(
      rows.map((r) => ({ q: r.q, n: r.n })),
      10,
    ),
    intentMix,
    exhibitKinds,
    contentGaps: gaps.sort(byN).slice(0, 8),
    wishlist: wishlist.sort(byN).slice(0, 8),
    searchTerms: [], // filled from the GA section in buildSnapshot (if GA is configured)
    zeroResultSearches: [], // pending the `results_found` GA4 custom dimension (not in the current set)
    suggestedPrompts: [], // pending the `prompt` GA4 custom dimension (not in the current set)
  };
}

/** Lowercased headliner / opener / venue names from concerts.json — the gap-vs-wishlist test set. */
async function fetchArchiveNames(env: Env): Promise<string[]> {
  const base = (env.DATA_BASE_URL ?? "https://concerts.morperhaus.org/data").replace(/\/$/, "");
  const r = await fetch(`${base}/concerts.json`);
  if (!r.ok) throw new Error(`concerts.json ${r.status}`);
  const data = (await r.json()) as {
    concerts?: Array<{ headliner?: string; venue?: string; openers?: string[] }>;
  };
  const set = new Set<string>();
  for (const c of data.concerts ?? []) {
    if (c.headliner) set.add(c.headliner.toLowerCase());
    if (c.venue) set.add(c.venue.toLowerCase());
    for (const o of c.openers ?? []) if (o) set.add(o.toLowerCase());
  }
  return [...set];
}

async function fetchTopics(env: Env, nowMs: number): Promise<TopicsSection> {
  const rowsP = aeSql<{ q: string; outcome: string; kind: string; n: string }>(
    env,
    `SELECT blob2 AS q, blob4 AS outcome, blob3 AS kind, SUM(_sample_interval) AS n
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob2 != ''
     GROUP BY q, outcome, kind`,
  );
  // Archive names are best-effort: without them the gap/wishlist split degrades (everything reads as
  // wishlist) but the rest of the section is unaffected.
  const namesP = fetchArchiveNames(env).catch((): string[] => []);
  const [rows, names] = await Promise.all([rowsP, namesP]);
  return assembleTopics(
    rows.map((r) => ({ q: r.q, outcome: r.outcome, kind: r.kind, n: numOf(r.n) })),
    names,
    nowMs,
  );
}

// ──────────────────────────── Trends (Phase 6) ─────────────────────────────
// One per-day series unioned from the three daily sources already in the snapshot: GA sessions
// (retroactive 30d), MCP queries (mcp.series), and ask_turns spend (spend.series). No KV
// accumulation — sessions/spend back-fill 30d immediately; only the external-MCP slice is forward-only.

export function assembleTrends(
  gaDaily: Array<{ date: string; sessions: number }>,
  mcpSeries: Array<{ date: string; spa: number; external: number }>,
  spendSeries: Array<{ date: string; costUsd: number }>,
): TrendsSection {
  const map = new Map<string, TrendPoint>();
  const at = (date: string): TrendPoint => {
    let p = map.get(date);
    if (!p) {
      p = { date, sessions: 0, mcpQueries: 0, spendUsd: 0 };
      map.set(date, p);
    }
    return p;
  };
  for (const d of gaDaily) if (d.date) at(d.date).sessions += d.sessions;
  for (const m of mcpSeries) at(m.date).mcpQueries += m.spa + m.external;
  for (const s of spendSeries) at(s.date).spendUsd += s.costUsd;
  return { series: [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)) };
}

// ──────────────────────────── Development / GitHub (Phase 6) ─────────────────────────────
// Trim-down of the Pitch fetchGitHub. Optional GH_TOKEN; absent → the section stays not_configured.

const GH_REPO = "mmorper/concerts";

async function fetchGitHub(env: Env, nowMs: number): Promise<GitHubSection> {
  const headers = {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    "User-Agent": "concerts-dashboard-refresh",
    Accept: "application/vnd.github+json",
  };
  const gh = async <T>(path: string): Promise<{ body: T; link: string | null }> => {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}${path}`, { headers });
    if (!r.ok) throw new Error(`GitHub ${path} ${r.status}`);
    return { body: (await r.json()) as T, link: r.headers.get("link") };
  };
  // Exact count without fetching every row: request one item and read the `rel="last"` page number
  // from the Link header (= the total count). Falls back to the page length when there's no Link
  // header (≤1 page).
  const ghCount = async (path: string): Promise<number> => {
    const sep = path.includes("?") ? "&" : "?";
    const { body, link } = await gh<unknown[]>(`${path}${sep}per_page=1`);
    const last = link?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    return last ? Number(last[1]) : body.length;
  };
  const since7 = new Date(nowMs - 7 * DAY_MS).toISOString();
  const since30 = new Date(nowMs - 30 * DAY_MS).toISOString();
  type Issue = { pull_request?: unknown; labels?: Array<{ name: string }> };
  type Pull = { number: number; title: string; merged_at: string | null };

  const [commits7d, commits30d, issuesRes, pullsRes] = await Promise.all([
    ghCount(`/commits?since=${since7}`),
    ghCount(`/commits?since=${since30}`),
    gh<Issue[]>(`/issues?state=open&per_page=100`),
    gh<Pull[]>(`/pulls?state=closed&per_page=50&sort=updated&direction=desc`),
  ]);

  // The issues endpoint returns PRs too — drop anything carrying a pull_request key.
  const realIssues = issuesRes.body.filter((i) => !i.pull_request);
  const byLabel: Record<string, number> = {};
  for (const i of realIssues) for (const l of i.labels ?? []) byLabel[l.name] = (byLabel[l.name] ?? 0) + 1;

  // Sort merged PRs by merge time (the API only sorts by `updated`, which a late comment can bump).
  const merged = pullsRes.body
    .filter((p) => p.merged_at)
    .sort((a, b) => (b.merged_at as string).localeCompare(a.merged_at as string));
  const mergedLast30d = merged.filter((p) => (p.merged_at as string) >= since30).length;

  return {
    velocity: { commitsLast7d: commits7d, commitsLast30d: commits30d, mergedPrsLast30d: mergedLast30d },
    issues: { open: realIssues.length, byLabel },
    recentPrs: merged
      .slice(0, 8)
      .map((p) => ({ number: p.number, title: p.title, mergedAt: p.merged_at as string })),
  };
}

// ──────────────────────────── Monitoring (Phase 6) ─────────────────────────────
// Edge/worker 5xx from CF GraphQL + ask/mcp error & refusal counts. Every sub-query is best-effort
// (→ 0) so a single dead dataset never blanks the section. NOTE: the CF 5xx dataset/field names
// should be re-verified against current CF GraphQL on first hydration (spec Data sources #2).

async function fetchMonitoring(env: Env, nowMs: number): Promise<MonitoringSection> {
  const dt30 = `${isoDay(nowMs - 29 * DAY_MS)}T00:00:00Z`;
  const cfQuery = `{
    viewer { accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) {
      edge: httpRequestsAdaptiveGroups(limit: 100, filter: { datetime_geq: "${dt30}", edgeResponseStatus_geq: 500 }) { count }
      worker: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: "${dt30}" }) { sum { errors } }
    } }
  }`;
  // The CF 5xx call is NOT swallowed: if it fails (bad token, wrong field names), fetchMonitoring
  // throws → sourceStatus.monitoring = "error". Swallowing it would render an all-zero "all clear"
  // board during an actual outage of the telemetry meant to surface errors.
  const cfP = fetch(CF_GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: cfQuery }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`CF 5xx ${r.status}`);
    const j = (await r.json()) as {
      errors?: unknown[] | null;
      data?: { viewer?: { accounts?: Array<{ edge?: Array<{ count?: number }>; worker?: Array<{ sum?: { errors?: number } }> }> } };
    };
    if (j.errors && j.errors.length) throw new Error(`CF 5xx: ${JSON.stringify(j.errors)}`);
    const acc = j.data?.viewer?.accounts?.[0];
    const edge = (acc?.edge ?? []).reduce((t, g) => t + (g.count ?? 0), 0);
    const worker = (acc?.worker ?? []).reduce((t, g) => t + (g.sum?.errors ?? 0), 0);
    return { edge, worker };
  });

  const askP = aeSql<{ outcome: string; n: string }>(
    env,
    `SELECT blob4 AS outcome, SUM(_sample_interval) AS n
     FROM ask_turns
     WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob4 IN ('error', 'refused')
     GROUP BY outcome`,
  ).catch((): Array<{ outcome: string; n: string }> => []);
  const mcpP = aeSql<{ n: string }>(
    env,
    `SELECT SUM(_sample_interval) AS n FROM mcp_queries
     WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob4 = 'error'`,
  ).catch((): Array<{ n: string }> => []);

  const [cf, ask, mcp] = await Promise.all([cfP, askP, mcpP]);
  const byOutcome: Record<string, number> = {};
  for (const r of ask) byOutcome[r.outcome] = numOf(r.n);

  return {
    edge5xx30d: cf.edge,
    worker5xx30d: cf.worker,
    askErrors30d: byOutcome["error"] ?? 0,
    askRefusals30d: byOutcome["refused"] ?? 0,
    mcpErrors30d: numOf(mcp[0]?.n),
  };
}

// ──────────────────────────── snapshot assembly ─────────────────────────────

export async function buildSnapshot(env: Env, nowMs: number = Date.now()): Promise<DashboardSnapshot> {
  const fetchErrors: string[] = [];
  let cloudflare: CloudflareSection | null = null;
  let spend: SpendSection | null = null;
  let ask: AskSection | null = null;
  let ga: GaSection | null = null;
  let mcp: McpSection | null = null;
  let archiveHealth: ArchiveHealthSection | null = null;
  let topics: TopicsSection | null = null;
  let github: GitHubSection | null = null;
  let monitoring: MonitoringSection | null = null;
  const sourceStatus: DashboardSnapshot["sourceStatus"] = {
    cloudflare: "error",
    spend: "error",
    ask: "error",
    ga: "not_configured", // GA creds are optional — stays not_configured until they land
    mcp: "error",
    archiveHealth: "error",
    topics: "error",
    trends: "ok", // derived locally from other sections — never a fetch of its own
    github: "not_configured", // GH_TOKEN is optional — stays not_configured until it lands
    monitoring: "error",
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
    // GA is independently optional: unconfigured → not_configured (no error); a live failure → error.
    gaConfigured(env)
      ? fetchGA(env)
          .then((g) => { ga = g; sourceStatus.ga = "ok"; })
          .catch((e) => { sourceStatus.ga = "error"; fetchErrors.push(`GA unavailable — ${msg(e)}`); })
      : Promise.resolve(),
    fetchMcp(env, nowMs)
      .then((m) => { mcp = m; sourceStatus.mcp = "ok"; })
      .catch((e) => { fetchErrors.push(`MCP unavailable — ${msg(e)}`); }),
    fetchArchiveHealth(env)
      .then((h) => { archiveHealth = h; sourceStatus.archiveHealth = "ok"; })
      .catch((e) => { fetchErrors.push(`Archive health unavailable — ${msg(e)}`); }),
    fetchTopics(env, nowMs)
      .then((t) => { topics = t; sourceStatus.topics = "ok"; })
      .catch((e) => { fetchErrors.push(`Topics unavailable — ${msg(e)}`); }),
    fetchMonitoring(env, nowMs)
      .then((m) => { monitoring = m; sourceStatus.monitoring = "ok"; })
      .catch((e) => { fetchErrors.push(`Monitoring unavailable — ${msg(e)}`); }),
    // GitHub is optional like GA: no token → not_configured; a live failure → error.
    env.GH_TOKEN
      ? fetchGitHub(env, nowMs)
          .then((g) => { github = g; sourceStatus.github = "ok"; })
          .catch((e) => { sourceStatus.github = "error"; fetchErrors.push(`GitHub unavailable — ${msg(e)}`); })
      : Promise.resolve(),
  ]);

  // Trends unions the daily sources just fetched (no fetch of its own). Topics borrows GA search
  // terms when GA is configured — the rest of Topics is already assembled from ask_turns.
  // (The sources are assigned inside the Promise.all callbacks above, so TS can't see they're set —
  // re-widen them to read the daily series back out.)
  const gaOut = ga as GaSection | null;
  const trends = assembleTrends(
    gaOut?.daily ?? [],
    (mcp as McpSection | null)?.series ?? [],
    (spend as SpendSection | null)?.series ?? [],
  );
  if (topics && gaOut) {
    (topics as TopicsSection).searchTerms = gaOut.engagement.searches.topTerms;
  }

  return {
    refreshedAt: new Date(nowMs).toISOString(),
    dataAge: "fresh",
    cloudflare,
    spend,
    ask,
    ga,
    mcp,
    archiveHealth,
    topics,
    trends,
    github,
    monitoring,
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
