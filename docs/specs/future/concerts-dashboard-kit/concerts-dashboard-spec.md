# Concerts Operator Dashboard (concerts.morperhaus.org/dashboard)

**Status:** Ready
**Type:** Architecture / Infrastructure (not a user-facing app feature)
**Priority:** Medium
**Estimated Complexity:** High
**Ported from:** Pitch dashboard (`pitch.morperhaus.org/dashboard/`) — same architecture, same CF account, same GA service account.

---

## Executive Summary

A standalone **operator console** for Morperhaus Concerts at
`concerts.morperhaus.org/dashboard/`, behind Cloudflare Access (Google SSO, one
user). A standalone Cloudflare Worker runs on a daily cron, fans out to four
data sources in parallel, and writes a single JSON snapshot to Cloudflare KV. A
data endpoint serves that snapshot; a React route in the SPA renders it.

**This dashboard is strictly operational. It is NOT a concert-data showcase**
(no artists/venues/setlists — that data is out of scope). The four things it
surfaces:

1. **SPA traffic & engagement** — GA4 standard web stats + the custom events the
   app already fires ("scenes": timeline, venues, artists, ask, search…).
2. **MCP usage** — query volume from both the in-SPA experience and external
   clients (Claude), by tool, over time.
3. **Cloudflare infra** — edge + Worker request volume, and (if AI Gateway is
   used) Anthropic cost/token analytics.
4. **Anthropic spend** — total cost per day/week/month, against the configured
   spend cap.

The architecture is a verbatim port of the Pitch dashboard; the value of this
spec is in **what changes** (the four sources above) and **what's deleted**
(everything tied to a desktop app: downloads, installs, auto-update, release
mirror, code coverage, the Pitch strategy tab).

---

## Implementation Quick Start

**Copy/paste this prompt into a NEW Claude Code session in the Concerts repo.**

```
I'm building an operator dashboard for Morperhaus Concerts, ported from the
Pitch dashboard. The full spec is in this kit: concerts-dashboard-spec.md.
The refresh Worker starter is in worker-starter/. Read the spec first — it is
the source of truth.

This is a serverless operator console:
  CF Worker (daily cron) → fetch 4 sources → write JSON to CF KV
  data endpoint reads KV → returns JSON
  React /dashboard route fetches it → renders with a charting lib
  Cloudflare Access (Google SSO) fences /dashboard/* — no auth code

Start with PHASE 0 — CODEBASE AUDIT. Do NOT write dashboard code yet. Produce a
findings report that resolves the five DISCOVER blanks in the spec:
  1. The GA4 property ID for concerts.morperhaus.org (find the G-XXXX gtag id;
     map to numeric property id).
  2. How the SPA is served (a Worker that renders/serves the React app? CF
     Pages? both?) — decides where the /dashboard route + data endpoint live.
  3. The custom GA4 event taxonomy the SPA already fires — exact event names +
     params (the "scenes" and any search/interaction events).
  4. How Anthropic is called and how spend is constrained today. Specifically:
     is Cloudflare AI Gateway in the path? (If yes, we get cost analytics from
     the CF GraphQL API for free and should use it. If no, we use the Anthropic
     Admin API cost_report and need an admin key.)
  5. Where MCP queries can be read from so BOTH the in-SPA calls AND external
     clients (Claude) are counted. There is probably no such store yet — propose
     the instrumentation (Cloudflare Workers Analytics Engine is the natural fit
     for a Worker-based MCP server; D1 or KV counters also work).

While you're in there, also recommend any additional operator telemetry worth
capturing that this spec doesn't list. Then we'll lock the data contract and
implement phases 1–5.
```

---

## Architecture

```
06:00 UTC daily (cron)            manual: GET /?key=<REFRESH_KEY>
        │                                  │
        ▼                                  ▼
workers/dashboard-refresh/   (standalone CF Worker — cron + manual trigger)
   secrets: GH_TOKEN?, CF_API_TOKEN, CF_ACCOUNT_ID, GA_SA_KEY_JSON,
            GA_IMPERSONATE_SUBJECT, ANTHROPIC_ADMIN_KEY?, REFRESH_KEY?
        │
        ├─ GA Data API ───── sessions + channels + countries + top pages
        │                    + custom SPA events  (SA-key JWT via Web Crypto)
        ├─ CF GraphQL ─────── edge + Worker requests  [+ AI Gateway cost/tokens]
        ├─ Anthropic Admin ── cost_report: $ by day/model   (skip if AI Gateway)
        ├─ MCP telemetry ──── Analytics Engine / D1 / KV  (queries by tool+source)
        └─ GitHub (optional)─ commits / PRs / issues for a Development tab
        │
        ▼
CF KV namespace: CONCERTS_DASHBOARD
   keys:  dashboard:snapshot            ← latest JSON (48h TTL)
          dashboard:history:YYYY-MM-DD  ← daily archive
          dashboard:timeseries          ← per-day series for the Trends view
        │
        ▼
data endpoint   GET /dashboard/data/    (reads KV, stamps dataAge, returns JSON)
   — Pages Function  website/functions/dashboard/data.ts        (if Pages)
   — or Worker route handler inside the SPA's serving Worker     (if Worker)
        │
        ▼
React /dashboard route   — fetch('/dashboard/data/') on mount → render
        │
        ▼
Cloudflare Access (Zero Trust) fences /dashboard/*  — Google SSO, allowlist=you
```

**Why a standalone Worker (not folded into the SPA Worker):** only standalone
Workers get cron triggers. The refresh Worker writes KV; the SPA's serving layer
only ever *reads* KV at `/dashboard/data/`. They share one KV namespace.

---

## KV Data Contract

The Worker writes this to `dashboard:snapshot`; the data endpoint serves it
verbatim; the React route consumes it. **All three must agree.** Every section
is independently nullable so one dead source never blanks the page.

```typescript
interface ConcertsDashboardSnapshot {
  refreshedAt: string;            // ISO 8601 UTC
  ga: GaSection | null;           // null if GA_SA_KEY_JSON unset or all GA calls fail
  cloudflare: CloudflareSection;  // always present (zeros on failure)
  anthropic: AnthropicSection | null;  // null if not configured / AI Gateway path
  mcp: McpSection | null;         // null until MCP telemetry store exists
  github: GitHubSection | null;   // optional Development tab; null if unused
  sourceStatus: {
    ga: 'ok' | 'error' | 'not_configured';
    cloudflare: 'ok' | 'error';
    anthropic: 'ok' | 'error' | 'not_configured';
    mcp: 'ok' | 'error' | 'not_configured';
    github: 'ok' | 'error' | 'not_configured';
  };
  fetchErrors: string[];
  dataAge: 'fresh' | 'stale';     // stamped by the data endpoint at serve time
}

interface GaSection {
  website: {
    sessions7d: number; sessions30d: number; sessions90d: number;
    byChannel: Record<string, number>;     // sessionDefaultChannelGroup (30d)
    byCountry: Record<string, number>;      // country (30d, top 6)
    topReferrers: Array<{ source: string; sessions: number }>; // sessionSource (30d)
    topPages: Array<{ page: string; views: number }>;          // pagePath (30d, top 8)
  };
  // The SPA-engagement analog of Pitch's "app telemetry" — sourced from the
  // custom GA4 events the Concerts app already fires. DISCOVER(3): replace these
  // placeholder keys with the real event taxonomy in Phase 0.
  engagement: {
    byScene: Record<string, number>;        // e.g. eventCount per "scene" event
    searches30d: number;                     // if a search event exists
    // ...add per-event/per-param breakdowns once the taxonomy is known
    [k: string]: unknown;
  };
}

interface CloudflareSection {
  requests7d: number; requests30d: number;        // httpRequests1dGroups
  workerRequests7d: number; workerRequests30d: number; // workersInvocationsAdaptive
  // Present only if Anthropic is proxied through AI Gateway (DISCOVER(4)).
  aiGateway: {
    requests30d: number; costUsd30d: number;
    tokensIn30d: number; tokensOut30d: number;
  } | null;
}

interface AnthropicSection {            // direct Admin-API path (skip if AI Gateway)
  costUsdToday: number;
  costUsd7d: number;
  costUsd30d: number;
  costUsdMonthToDate: number;
  capUsd: number | null;                // your configured monthly cap (static config)
  byModel30d: Record<string, number>;   // model → $ (if cost_report exposes it)
  series: Array<{ date: string; costUsd: number }>; // daily, for the trend + cap line
}

interface McpSection {
  queries7d: number; queries30d: number;
  byTool: Record<string, number>;       // tool name → call count (30d)
  bySource: { spa: number; external: number }; // in-SPA vs Claude/other clients
  series: Array<{ date: string; queries: number }>;
}

interface GitHubSection {               // optional — same shape Pitch uses, trimmed
  velocity: { commitsLast7d: number; commitsLast30d: number; mergedPrsLast30d: number };
  issues: { open: number; byPriority?: Record<string, number> };
  recentPrs: Array<{ number: number; title: string; mergedAt: string }>;
}
```

---

## The four data sources

### 1. GA4 — ports verbatim, config-only

The Worker's `fetchGA()`, the Web-Crypto JWT signing, the domain-wide-delegation
OAuth exchange, and `runReport` plumbing are **reused unchanged** from Pitch.
Only two things differ:

- **Property ID** — `GA_PROPERTY` constant. DISCOVER(1).
- **The app-event block** — Pitch reads `app_launched`/`pitch_created`/…;
  Concerts reads its own `byScene` custom events. DISCOVER(3). The *website*
  block (sessions/channels/countries/pages/referrers) is generic and stays as-is.

**Credentials carry over for free.** The service account, its DWD authorization,
and the `pitch-dashboard-readers@morper.net` Google Group already hold
**account-level** Viewer on the GA account — which includes the Concerts
property. No new GCP/Workspace setup. Just verify (see Appendix A) and set the
same `GA_SA_KEY_JSON` + `GA_IMPERSONATE_SUBJECT` Worker secrets.

### 2. Cloudflare — ports verbatim (+ optional AI Gateway)

`fetchCloudflare()` reuses the same account-level GraphQL query
(`httpRequests1dGroups` + `workersInvocationsAdaptive`) with the same
`CF_API_TOKEN` (Analytics:Read). New account? No — same Cloudflare account, so
even the `CF_ACCOUNT_ID` is identical.

**If Anthropic runs through AI Gateway (recommended):** extend this fetcher with
the AI Gateway analytics dataset (CF GraphQL exposes per-gateway cost, tokens,
requests, errors). This collapses source #4 into source #2 — one token, one
query, and AI Gateway *also* gives you the spend-capping + caching you want.
DISCOVER(4): confirm gateway name + the exact GraphQL dataset/field names
against current CF docs (the `cloudflare` skill / `search_cloudflare_documentation`).

### 3. Anthropic spend — net-new

If **not** using AI Gateway, `fetchAnthropic()` calls the **Anthropic Admin API
Cost report** to get spend by day. This requires an **Admin API key**
(`sk-ant-admin…`), which is org-scoped and distinct from a regular API key —
created by an org admin in the Console. Store it as the `ANTHROPIC_ADMIN_KEY`
Worker secret.

> ⚠️ The Usage & Cost Admin API surface evolves. Before finalizing the fetcher,
> verify the current endpoint, params, auth headers, and response shape via the
> `claude-api` skill / Anthropic docs. The starter codes the cost-report call as
> a best-effort stub with a clear `TODO(concerts)` and a doc-check reminder.

`capUsd` is not an API value — it's your configured cap, hand-set in the Worker
(a `var`) so the trend chart can draw the cap line. Keep it in sync with however
spend is actually constrained (DISCOVER(4)).

### 4. MCP telemetry — net-new, needs instrumentation first

This is the only source with **no existing store to read**. MCP queries arrive
two ways:

- **In-SPA** ("ask" / query UI) — these *can* fire GA4 custom events, but GA is
  lossy/sampled and won't distinguish tools cleanly.
- **External clients (Claude, etc.)** — these hit the MCP Worker directly and
  **never touch GA**. The only place to count them is server-side.

**Therefore the MCP server must log each query somewhere queryable.** Recommended
for a Worker-based MCP server: **Cloudflare Workers Analytics Engine** — write
one data point per query with blobs `[tool, source]` and let the refresh Worker
query it via the Analytics Engine SQL/GraphQL API. Alternatives: a D1 table
(one row per query, or pre-aggregated daily counters) or KV counters. Whatever
the Concerts Claude finds cleanest given the existing MCP Worker — but it is a
**prerequisite** for the MCP tab, and a prime candidate for the "recommend
additional telemetry" pass. Until it exists, `mcp` stays `null` and the tab
shows a "Pending — MCP telemetry not yet instrumented" placeholder (same
graceful-null pattern GA uses in Pitch).

---

## Tabs (the UI)

Drop Pitch's App/Development-downloads/Strategy framing. Proposed Concerts tabs:

| Tab | Source | Contents |
| --- | --- | --- |
| **Overview** | GA + CF + Anthropic + MCP | Hero KPIs (sessions, MCP queries, 30d Anthropic spend vs cap, worker requests), data-freshness strip, top pages, sessions by channel |
| **Engagement** | GA custom events | Scenes by usage (bar), search volume, any interaction-event breakdowns — the Concerts analog of Pitch's App tab |
| **MCP** | MCP telemetry | Queries over time (line), by tool (bar), in-SPA vs external split (doughnut) |
| **Cost & Infra** | Anthropic + CF | Spend day/week/month vs cap (line + cap reference line), spend by model, CF edge/worker requests, AI Gateway tokens/cost (if used) |
| **Development** *(optional)* | GitHub | Commit/PR velocity, open issues, recent PRs — include only if useful |

**Trends view** (optional, ports from Pitch's `dashboard:timeseries`): per-day
sessions / MCP queries / Anthropic spend. The Worker's timeseries-merge logic is
reusable; swap the Pitch-specific series for these.

Charting: the Pitch dashboard uses Chart.js via CDN. In a React SPA, **Recharts**
(or `react-chartjs-2`) is the more idiomatic choice — your call. The data
contract is framework-agnostic, so this is purely a rendering decision.

---

## Auth — Cloudflare Access (identical to Pitch)

Configure once in the CF dashboard, zero code:

- Application domain: `concerts.morperhaus.org/dashboard*` (covers page + `/dashboard/data/`)
- Policy: Include → Google → restricted to your email
- Session: 24h

The `Cache-Control: private` on the data endpoint matters — keeps the snapshot
in the *browser* cache only, never the shared edge (so CF Access is always
honored). Ported as-is.

---

## Implementation Plan

### Phase 0 — Codebase audit (no dashboard code)
Resolve the five `DISCOVER` items (see Quick Start prompt). Output a findings
report + a telemetry-recommendations section. Lock the data contract (fill the
`engagement` keys, decide AI-Gateway-vs-Admin-API, decide the MCP store).
**Gate:** contract agreed before Phase 3.

### Phase 1 — Infra + auth
Create KV namespace `CONCERTS_DASHBOARD`. Bind it to the SPA serving layer.
Set up CF Access on `/dashboard*`. Ship the data endpoint (`data-endpoint.ts`,
right variant) + a `/dashboard` route shell that fetches and shows
loading/empty/error states. **Gate:** `/dashboard` requires Google login;
`/dashboard/data/` returns 503 (no snapshot yet); page degrades gracefully.

### Phase 2 — Dashboard UI
Build the tabs against a **seeded sample snapshot** in KV. Static loads instant;
dynamic sections show skeletons; null sections show "Pending" placeholders;
`fetchErrors` drives a partial-data banner; `dataAge:'stale'` drives a staleness
warning. **Gate:** full render from sample snapshot, no console errors.

### Phase 3 — Worker: GA + Cloudflare
Stand up `workers/dashboard-refresh/` from the starter. Wire GA (verify Appendix
A first) + CF. Set secrets, deploy, seed via the `?key=` trigger. **Gate:**
snapshot has real sessions + request counts; GA custom events populate
`engagement`.

### Phase 4 — Worker: Anthropic + AI Gateway
Implement whichever spend path Phase 0 chose. Set `ANTHROPIC_ADMIN_KEY` (or
extend the CF query for AI Gateway). Set `capUsd`. **Gate:** Cost & Infra tab
shows real spend vs cap.

### Phase 5 — Worker: MCP telemetry
Implement the MCP instrumentation from Phase 0 (Analytics Engine / D1 / KV),
then `fetchMcp()` to read it. **Gate:** MCP tab shows real query counts split by
tool and SPA-vs-external.

---

## Edge cases (all inherited from the Pitch pattern)

- **No snapshot yet** → endpoint 503 → "No data yet, first refresh 06:00 UTC".
- **One source down** → zeros/null for it + `fetchErrors` entry + partial-data banner; snapshot still written.
- **Snapshot >26h old** → `dataAge:'stale'` → staleness warning.
- **GA / Anthropic / MCP not configured** → that section `null` → "Pending" placeholder, never a crash.
- **CF Access session expired** → transparent Google re-auth.
- **Admin/PAT/SA key expired** → that source errors, rest of dashboard fine; rotate via `wrangler secret put`.

---

## Appendix A — GA access verification (config-only)

Because the SA + Google Group already hold **account-level** Viewer, the Concerts
property should already be reachable. Verify before writing `fetchGA()`:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=".secrets/<the-same-ga-sa-key>.json"
unset GOOGLE_CLOUD_PROJECT
pip3 install google-analytics-data --quiet
python3 - <<'EOF'
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric
client = BetaAnalyticsDataClient()
req = RunReportRequest(
    property='properties/<CONCERTS_GA4_PROPERTY_ID>',   # DISCOVER(1)
    date_ranges=[DateRange(start_date='7daysAgo', end_date='today')],
    metrics=[Metric(name='sessions')])
r = client.run_report(req)
print('SUCCESS — sessions(7d):', r.rows[0].metric_values[0].value if r.rows else '0')
EOF
```

`SUCCESS` → set `GA_SA_KEY_JSON` + `GA_IMPERSONATE_SUBJECT` Worker secrets and
proceed. `403 PERMISSION_DENIED` → the group's Viewer was granted at the
*property* level on Pitch instead of the *account* level; re-grant the group at
the GA **Account** level (Admin → Account Access Management) and it inherits to
Concerts. Full troubleshooting table: see the Pitch spec's Appendix A.

---

## Revision History
- Initial port from the Pitch hosted-dashboard spec. Four sources retargeted
  (GA property/events, CF, Anthropic spend, MCP telemetry); desktop-app sources
  removed.
