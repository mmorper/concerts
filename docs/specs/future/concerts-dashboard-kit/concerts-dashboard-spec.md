# Concerts Operator Dashboard (concerts.morperhaus.org/dashboard)

**Status:** Final — ready to implement
**Type:** Architecture / Infrastructure (operator console, not a user-facing app feature)
**Priority:** Medium
**Estimated Complexity:** High
**Epic:** #159
**Ported from:** Pitch dashboard (`pitch.morperhaus.org/dashboard/`) — same architecture, same
CF account (`6db8591bbcba4588ae4ef9c3839cd209`), same GA service account, same Google-SSO Access model.

> **Look & feel:** Keep the Pitch dashboard's proven layout and component structure — do **not**
> materially redesign it. Reskin only: apply the Concerts app's design tokens (Playfair Display +
> Source Sans 3, the indigo/violet UI palette, genre jewel-tones for data-viz series). See
> [Design](#design--look--feel).

---

## Executive Summary

A standalone **operator console** at `concerts.morperhaus.org/dashboard/`, behind Cloudflare
Access (Google SSO, single user). A standalone Cloudflare Worker runs on a daily cron, fans out to
its data sources in parallel, and writes one JSON snapshot to Cloudflare KV. An Access-gated data
endpoint serves that snapshot; a React route in the SPA renders it. A small set of **live**
Access-gated JSON endpoints power the control surface (mode/spend/admin-IP), which must reflect
real-time state rather than the daily snapshot.

**This dashboard is operational + archive-health.** It is *not* a public concert-data showcase.
The three jobs it exists to do, in priority order:

1. **Cost control** — Anthropic spend per day/week/month vs. the configured cap, plus the live
   spend-cap state and the spend-alert tripwires (#164), and the controls to act on it (#158).
2. **Traffic** — GA4 web stats + the SPA's custom engagement events (the "scenes").
3. **Topics of interest** — what people actually ask and search: top themes from the `ask_turns`
   query ledger and the SPA's search events.

Supporting tabs round it out: **MCP & Ask** usage, **Archive Health** (enrichment-pipeline
coverage), **Development** (GitHub velocity), and a **Trends** view. The architecture is a port of
the Pitch dashboard; this spec documents **what changes** for Concerts and **what's deleted**
(everything tied to a desktop app: downloads, installs, auto-update, release mirror, code coverage,
the Pitch "Strategy" tab).

> **Distinct from** the user-facing "Ask the Archive" chat (Epic #138) and the public MCP server.
> This dashboard *observes and controls* those; it is not part of them.

---

## Decisions (locked)

These were open `DISCOVER`/design questions in the bootstrap. Resolved with the owner:

| # | Decision | Rationale |
|---|----------|-----------|
| **Scope** | Operational **+ an Archive Health tab** | Surface enrichment-pipeline coverage (data-ops), all stages weighted equally. |
| **Control** | **Active control panel**, not read-only | Fold #158 in: ask mode toggle, live spend vs cap, admin-IP management. Retires the standalone HTML admin page over time. |
| **Spend source** | **Bootstrap from `ask_turns` µUSD now; AI Gateway later** | Real spend series on day one, zero new credentials. AI Gateway is a documented fast-follow for authoritative org-wide cost. |
| **Optionals (all in)** | Spend-alert status (#164), Development tab, Trends view, Uptime/error monitoring | Owner wants the full set; phased v1 / v1.1 (see [Phasing](#phasing)). |
| **Primary jobs** | Cost control · traffic · topics of interest | Drives the Overview hero. |
| **Archive Health detail** | Follow the **data-enrichment pipeline** — one coverage row per stage | "Accommodate each" stage; no single headline metric. |
| **Auth** | Same Cloudflare Access + Google SSO as Pitch | Point the policy at `concerts.morperhaus.org/dashboard*`. Zero auth code. |
| **Serving (DISCOVER 2)** | Confirm in Phase 0 (see below) | `concerts-meta-injector` owns `/*` and `morperhaus-mcp` owns `/mcp*`; `/dashboard*` must slot in deliberately. Lean: a dedicated route on `/dashboard/data*` (more-specific wins, mirrors `/mcp*`). |

**Still genuinely unknown — resolve in Phase 0:**
- **GA4 numeric property id** for `concerts.morperhaus.org` (have the `G-XXXX` gtag id in
  `.env.example`; map to the numeric property id). `DISCOVER(1)`.
- **Exact serving topology** (Pages vs. Worker) → which `data-endpoint.ts` variant + where the
  `/dashboard` route ships. `DISCOVER(2)`.

---

## Phasing

The full scope is ambitious. Ship in two waves so daily operator value lands fast.

**v1 (core — the three jobs):**
Overview · Engagement · MCP & Ask · **Cost & Control** (spend + #158 controls + #164 alerts).

**v1.1 (fast-follow):**
Archive Health · Development · Trends · full uptime/error monitoring.

---

## Architecture

```
06:00 UTC daily (cron)            manual: GET /?key=<REFRESH_KEY>
        │                                  │
        ▼                                  ▼
workers/dashboard-refresh/   (standalone CF Worker — cron + manual trigger)
   secrets: CF_API_TOKEN, CF_ACCOUNT_ID, GA_SA_KEY_JSON, GA_IMPERSONATE_SUBJECT,
            GH_TOKEN?, REFRESH_KEY?   (no Anthropic admin key in v1 — spend from ask_turns)
        │
        ├─ GA Data API ───── sessions + channels + countries + pages + custom SPA events
        ├─ CF GraphQL ─────── edge + Worker requests + 5xx error rates [+ AI Gateway later]
        ├─ Analytics Engine ─ ask_turns ledger → spend µUSD series + ask topics + outcomes
        ├─ Analytics Engine ─ mcp_queries (NET-NEW instrumentation) → external tool-calls
        ├─ public/data/*  ─── enrichment coverage per stage  (Archive Health)
        └─ GitHub (optional)─ commits / PRs / issues  (Development tab)
        │
        ▼
CF KV namespace: CONCERTS_DASHBOARD
   keys:  dashboard:snapshot            ← latest JSON (48h TTL)
          dashboard:history:YYYY-MM-DD  ← daily archive
          dashboard:timeseries          ← per-day series for the Trends view
        │
        ▼
data endpoint   GET /dashboard/data/    (reads KV, stamps dataAge, returns JSON)  [snapshot — daily]
control endpoints  GET/POST /api/ask/admin/*   (live mode/spend/admin-IP — NOT the snapshot)
        │
        ▼
React /dashboard route  — fetch snapshot on mount; control panel polls the live admin endpoints
        │
        ▼
Cloudflare Access (Zero Trust) fences /dashboard/*  +  /api/ask/admin/*  — Google SSO, allowlist=you
```

**Two data planes, deliberately separate:**
- **Snapshot plane (daily):** everything in the KV `dashboard:snapshot`. Cheap, cacheable
  (browser-private), tolerant of one dead source.
- **Live plane (on demand):** the control surface (mode, current-day spend, admin-IP list, alert
  state). These must be *current*, so the dashboard reads the Access-gated `/api/ask/admin/*`
  endpoints directly — never the stale daily snapshot.

**Why a standalone refresh Worker:** only standalone Workers get cron triggers. It *writes* KV; the
SPA serving layer only ever *reads* KV at `/dashboard/data/`. They share one KV namespace.

---

## KV Data Contract (the snapshot)

The Worker writes this to `dashboard:snapshot`; the data endpoint serves it verbatim; the React
route consumes it. **All three must agree.** Every section is independently nullable so one dead
source never blanks the page.

```typescript
interface ConcertsDashboardSnapshot {
  refreshedAt: string;                 // ISO 8601 UTC
  ga: GaSection | null;
  cloudflare: CloudflareSection;       // always present (zeros on failure)
  spend: SpendSection | null;          // from ask_turns µUSD (v1); AI Gateway-augmented later
  mcp: McpSection | null;              // ask side from ask_turns; external side net-new
  topics: TopicsSection | null;        // derived from ask_turns queries + GA search events
  archiveHealth: ArchiveHealthSection | null;  // v1.1 — enrichment coverage
  github: GitHubSection | null;        // v1.1 — Development tab
  monitoring: MonitoringSection | null;        // 5xx + ask/mcp error outcomes
  sourceStatus: Record<
    'ga' | 'cloudflare' | 'spend' | 'mcp' | 'topics' | 'archiveHealth' | 'github' | 'monitoring',
    'ok' | 'error' | 'not_configured'
  >;
  fetchErrors: string[];
  dataAge: 'fresh' | 'stale';          // stamped by the data endpoint at serve time
}

interface GaSection {
  website: {
    sessions7d: number; sessions30d: number; sessions90d: number;
    byChannel: Record<string, number>;     // sessionDefaultChannelGroup (30d)
    byCountry: Record<string, number>;      // country (30d, top 6)
    topReferrers: Array<{ source: string; sessions: number }>; // sessionSource (30d)
    topPages: Array<{ page: string; views: number }>;          // pagePath (30d, top 8)
  };
  // Concerts custom events (real taxonomy — see Appendix B). eventCount per event, 30d.
  engagement: {
    byScene: Record<string, number>;        // scene_view, keyed by scene_name
    sceneNav: number;                        // scene_nav_clicked
    deepLinks: number;                       // deep_link_accessed
    interactions: Record<string, number>;    // counts for the high-signal interaction events
    searches: { count: number; topTerms: Array<{ term: string; n: number }> }; // artist_search_performed
    audioPreviews: number;                   // artist_preview_played
    ask: Record<string, number>;             // ask_* event counts (opened/sent/exhibit/refused/error/deeplink)
    // "What's getting clicked" — per-entity breakdowns from event params. Each requires the
    // param to be registered as a GA4 event-scoped CUSTOM DIMENSION (one-time config, no code).
    topArtists: Array<{ name: string; n: number }>;   // artist_card_opened.artist_name
    topVenues: Array<{ name: string; n: number }>;    // venue_node_clicked + map_marker_clicked.venue_name
    topSongs: Array<{ name: string; n: number }>;     // artist_preview_played.track_name
    topSetlists: Array<{ name: string; n: number }>;  // setlist_button_clicked.artist_name + venue_name
  };
}

interface CloudflareSection {
  requests7d: number; requests30d: number;             // httpRequests1dGroups
  workerRequests7d: number; workerRequests30d: number; // workersInvocationsAdaptive
  aiGateway: {                                          // null until AI Gateway is in the path
    requests30d: number; costUsd30d: number;
    tokensIn30d: number; tokensOut30d: number;
  } | null;
}

// SPEND — v1 source is the ask_turns µUSD ledger (ask-chat) + mcp query-cap usage.
// Authoritative org-wide cost via AI Gateway / Admin API is a documented fast-follow.
interface SpendSection {
  source: 'ask_turns' | 'ai_gateway' | 'admin_api';
  costUsdToday: number;
  costUsd7d: number;
  costUsd30d: number;
  costUsdMonthToDate: number;
  capUsd: number | null;                 // configured monthly cap (static config), drives the cap line
  byModel30d: Record<string, number>;    // model → $ (if the source exposes model)
  bySurface30d: { ask: number; mcp: number }; // ask-chat vs mcp-server query tool
  series: Array<{ date: string; costUsd: number }>; // daily, for the trend + cap line
}

interface McpSection {
  queries7d: number; queries30d: number;
  byTool: Record<string, number>;        // tool name → call count (30d)
  bySource: { spa: number; external: number }; // ask_turns (spa) vs mcp_queries (external clients)
  series: Array<{ date: string; queries: number }>;
}

// TOPICS OF INTEREST — derived: what people ask + search. A headline job.
interface TopicsSection {
  askTopics: Array<{ term: string; n: number }>;   // clustered/normalized ask_turns query text (30d)
  searchTerms: Array<{ term: string; n: number }>; // artist_search_performed search_term (30d)
  exhibitKinds: Record<string, number>;            // ask_turns exhibit kind (artist/venue/concert)
  refusalRate30d: number;                           // ask_refused / ask_question_sent
}

// ARCHIVE HEALTH — one row per enrichment stage (Appendix C). All stages weighted equally.
interface ArchiveHealthSection {
  lastBuildAt: string | null;            // newest fetchedAt/generated timestamp across data files
  stages: Array<{
    stage: string;                        // e.g. "Artist genres", "Venue photos", "Setlists"
    covered: number; total: number; pct: number;
    note?: string;                        // e.g. "openers 62% vs headliners 93%"
  }>;
}

interface GitHubSection {
  velocity: { commitsLast7d: number; commitsLast30d: number; mergedPrsLast30d: number };
  issues: { open: number; byLabel?: Record<string, number> };
  recentPrs: Array<{ number: number; title: string; mergedAt: string }>;
}

interface MonitoringSection {
  edge5xx30d: number;                     // CF GraphQL: 5xx responses
  worker5xx30d: number;
  askErrors30d: number;                   // ask_turns outcome=error / GA ask_error
  askRefusals30d: number;                 // GA ask_refused
  mcpErrors30d: number;                   // mcp_queries outcome=error (once instrumented)
}
```

---

## Data sources

### 1. GA4 — ports verbatim, config-only
The Worker's `fetchGA()`, Web-Crypto JWT signing, domain-wide-delegation OAuth exchange, and
`runReport` plumbing are reused unchanged. Two differences:
- **Property id** — `GA_PROPERTY` constant. `DISCOVER(1)`.
- **Engagement block** — fetch the real Concerts event taxonomy (Appendix B), not Pitch's app
  events. The website block (sessions/channels/countries/pages/referrers) is generic, stays as-is.

**Credentials carry over for free.** The SA, its DWD authorization, and the
`pitch-dashboard-readers@morper.net` group already hold **account-level** Viewer on the GA account —
which includes the Concerts property. Verify with Appendix A; set the same `GA_SA_KEY_JSON` +
`GA_IMPERSONATE_SUBJECT` secrets.

### 2. Cloudflare — ports verbatim (+ 5xx + optional AI Gateway)
`fetchCloudflare()` reuses the account-level GraphQL query (`httpRequests1dGroups` +
`workersInvocationsAdaptive`) with the same `CF_API_TOKEN` (Analytics:Read) and the **same account
id** (`6db8591bbcba4588ae4ef9c3839cd209`). Extend it to also pull **5xx counts** for the Monitoring
section. **AI Gateway:** if/when Anthropic is proxied through it, add the AI Gateway analytics
dataset here (per-gateway cost/tokens/requests) and populate `cloudflare.aiGateway` +
`spend.source = 'ai_gateway'`. Verify dataset/field names against current CF docs.

### 3. Spend — from the `ask_turns` ledger (v1), AI Gateway later
The `ask-chat` worker already writes a per-turn ledger to Cloudflare **Analytics Engine**
(`ASK_ANALYTICS → ask_turns`, **live in prod** as of #157), carrying query text, outcome, exhibit
kind, tokens, and **cost in µUSD** (`double5`). Schema in
`docs/specs/implemented/global-ask-the-archive-observability.md` §Problem 1. `fetchSpend()` queries
it via the Analytics Engine SQL API to build the daily cost series and the today/7d/30d/MTD windows.
Add the `mcp-server` query-tool spend once it logs tokens (Source #4). `capUsd` is static config
(hand-set `var`), kept in sync with the real caps (`ASK_MONTHLY_USD`, the per-IP `ASK_IP_DAILY_USD`).

> **Fast-follow:** when authoritative org-wide cost is wanted, route Anthropic through **AI Gateway**
> (cost via CF GraphQL — Source #2) or call the **Anthropic Admin API** `cost_report` with an
> `sk-ant-admin…` key. Flip `spend.source` accordingly; the contract is unchanged.

### 4. MCP & Ask telemetry — ask side built; external tool-calls net-new
- **Ask / in-SPA** — already captured in `ask_turns` (server-side, not lossy GA). Read directly.
- **External MCP clients (Claude, etc.)** — hit the `morperhaus-mcp` Worker directly and touch
  neither GA nor `ask_turns`. Today `mcp-server` only keeps `MCP_QUERY_USAGE` KV counters for
  cap enforcement — **no per-tool/per-source telemetry.** It's a Durable Object (`McpAgent`), so
  add an **Analytics Engine** binding and `writeDataPoint([tool, source])` per query (one new
  binding + a few lines). The refresh Worker then reads `mcp_queries` via the SQL API and unions it
  with the `ask_turns` (spa) side. Until the instrumentation ships, `mcp.bySource.external` is 0 and
  the tab notes "external tool-calls pending instrumentation."

### 5. Topics of Interest — derived (a headline job)
- **Ask topics** — cluster/normalize the `ask_turns` query text (30d). Start simple
  (lowercase + strip + top-N by frequency, optional light stemming); a smarter clustering pass is a
  later enhancement.
- **Search terms** — `artist_search_performed.search_term` from GA (30d).
- **Exhibit kinds / refusal rate** — straight from `ask_turns`. High refusal rate on a recurring
  topic = a gap worth filling.

### 6. Archive Health — enrichment-pipeline coverage (v1.1)
One coverage row per enrichment stage (Appendix C), computed from the generated `public/data/*.json`
the refresh Worker fetches (no new external APIs). All stages weighted equally. See Appendix C for
the exact files/fields and the coverage formula per stage.

### 7. GitHub — Development tab (v1.1)
Trim-down of Pitch's `fetchGitHub`: point at `mmorper/concerts`; pull commit velocity, open issues
(by label), recent merged PRs. Optional `GH_TOKEN` secret; null → tab hidden.

---

## Control surface (live plane — folds #158 + #164)

The dashboard is an **active control panel**, not just charts. The control widgets read/write the
**live** Access-gated JSON endpoints (added to `ask-chat`), *not* the daily snapshot:

- `GET /api/ask/admin/state` → `{ mode, spend, adminIps }` — machine-readable sibling of today's
  HTML admin page (`admin.ts`).
- `POST /api/ask/admin/mode` → set mode (`active` / `deterministic-only` / `paused`). *(exists)*
- `POST /api/ask/admin/ips` → `{ op: 'add' | 'remove', ip }` — manage the admin-IP allowlist
  (#158), stored in `ASK_CONTROL` KV (`admin:ips`), read on the turn path with a ~60s isolation
  cache; `ASK_ADMIN_IPS` env stays as a break-glass bootstrap.
- *(later, don't build yet)* `POST /api/ask/admin/reset-ip` — surgical per-IP `SpendCounter`
  reset; needs a `reset` method on the DO. Note it so the UI can offer it later.

**Alerts (#164):** surface the spend-cap tripwire state (ask-chat fires at 50/75/100% of the daily
cap; mcp-server at 80% of the query cap) and recent alert history. Setting `NOTIFY_WEBHOOK_URL` is
an operational action tracked in #164; the dashboard *displays* tripwire status regardless.

All of the above reuse the **existing Cloudflare Access** gate (fail-closed). Do not invent new
auth. The current HTML `admin.ts` page stays as the interim UI until the dashboard supersedes it.

---

## Tabs (the UI)

Drop Pitch's App / Downloads / Strategy framing.

| Tab | Wave | Source | Contents |
| --- | --- | --- | --- |
| **Overview** | v1 | all | Three-job hero: **spend vs cap** (cost control), **sessions** (traffic), **Topics of Interest** (top ask themes + searches). Data-freshness strip, error glance, top pages, sessions by channel. |
| **Engagement** | v1 | GA custom events | Scenes by usage (bar), search volume + top terms, interaction-event breakdowns, Ask funnel (opened→sent→exhibit/refused). |
| **MCP & Ask** | v1 | `ask_turns` + `mcp_queries` | Queries over time (line), by tool (bar), in-SPA vs external split (doughnut), outcomes. |
| **Cost & Control** | v1 | spend + #158 + #164 | Spend day/week/month vs cap (line + cap reference), by model, by surface (ask/mcp). **Live controls:** mode toggle, admin-IP management, current-day spend, tripwire/alert status. |
| **Archive Health** | v1.1 | `public/data/*` | One coverage bar per enrichment stage (all equal), last-build timestamp, notable gaps (e.g. opener genre coverage). |
| **Development** | v1.1 | GitHub | Commit/PR velocity, open issues by label, recent PRs. |
| **Trends** | v1.1 | `dashboard:timeseries` | Per-day sessions / MCP queries / spend. Ports Pitch's timeseries-merge logic. |

**Charting:** Pitch uses Chart.js via CDN. In the React SPA, **Recharts** is more idiomatic — your
call; D3 is already a dependency if consistency with the app's viz is preferred. The data contract
is framework-agnostic, so this is purely a rendering decision.

---

## Design — look & feel

Keep the Pitch dashboard's **layout, grid, card structure, and interaction patterns**. Reskin only:

- **Type:** Playfair Display for titles/stat numbers; Source Sans 3 for everything else
  (matches the app).
- **UI palette:** the app's indigo/violet system — `indigo-600` / `violet-600` for active controls,
  glassmorphism (`white/10`, `white/80`) for inputs and secondary actions, charcoal/stone neutrals.
  See `docs/design/color-specification.md` and the design-system skill.
- **Data-viz series:** use the genre jewel-tones (`@/constants/colors`, `GENRE_COLORS`) for
  categorical series where it reads well; never use genre colors for UI chrome.
- **Auth:** identical Cloudflare Access + Google SSO. Configure once in the CF dashboard:
  - Application domain: `concerts.morperhaus.org/dashboard*` **and** `/api/ask/admin*`
  - Policy: Include → Google → restricted to your email; Session 24h.
  - `Cache-Control: private` on the data endpoint keeps the snapshot in the *browser* cache only
    (never the shared edge), so Access is always honored.

---

## Implementation Plan

### Phase 0 — Codebase audit & contract lock (no dashboard code)
Resolve `DISCOVER(1)` GA numeric property id and `DISCOVER(2)` serving topology (Pages vs Worker →
which `data-endpoint.ts` variant + `/dashboard` route home + how `/dashboard*` coexists with the
`/*` meta-injector). Confirm the `ask_turns` schema/SQL access and the `public/data` fields for
Archive Health. Output a findings report; lock the data contract. **Gate:** contract agreed.

### Phase 1 — Infra + auth
Create KV `CONCERTS_DASHBOARD`; bind to the serving layer. Set up CF Access on `/dashboard*` and
`/api/ask/admin*`. Ship the data endpoint + a `/dashboard` route shell (loading/empty/error states).
**Gate:** `/dashboard` requires Google login; `/dashboard/data/` returns 503 (no snapshot yet);
degrades gracefully.

### Phase 2 — Dashboard UI (reskinned shell)
Build the v1 tabs against a **seeded sample snapshot** in KV, in the Concerts skin. Skeletons for
dynamic sections; "Pending" placeholders for null sections; `fetchErrors` → partial-data banner;
`dataAge:'stale'` → staleness warning. **Gate:** full render from sample, no console errors.

### Phase 3 — Worker: GA + Cloudflare
Stand up `workers/dashboard-refresh/` from the starter. Wire GA (website + the real engagement
events, Appendix B) + CF (requests + 5xx). Seed via the `?key=` trigger. **Gate:** snapshot has real
sessions, request counts, and populated `engagement`.

### Phase 4 — Spend + Control
`fetchSpend()` from `ask_turns` µUSD (today/7d/30d/MTD + daily series); set `capUsd`. Add the
Access-gated `/api/ask/admin/*` JSON endpoints (#158) and wire the Cost & Control tab's live
widgets + alert/tripwire status (#164). **Gate:** Cost & Control shows real spend vs cap and the
mode/admin-IP controls work end-to-end.

### Phase 5 — MCP & Ask telemetry
Add Analytics Engine `writeDataPoint([tool, source])` to `morperhaus-mcp`. `fetchMcp()` reads
`mcp_queries` (external) + `ask_turns` (spa). Build the Topics section from `ask_turns` queries + GA
search terms. **Gate:** MCP & Ask tab shows real counts split by tool and spa-vs-external; Overview
Topics panel populated.

### Phase 6 (v1.1) — Archive Health · Development · Trends · Monitoring
`fetchArchiveHealth()` over `public/data/*` (Appendix C); `fetchGitHub()`; port the timeseries
builder; finish the Monitoring section. **Gate:** all v1.1 tabs render real data.

---

## Edge cases (inherited from the Pitch pattern)

- **No snapshot yet** → endpoint 503 → "No data yet, first refresh 06:00 UTC".
- **One source down** → zeros/null + `fetchErrors` entry + partial-data banner; snapshot still written.
- **Snapshot >26h old** → `dataAge:'stale'` → staleness warning.
- **GA / spend / MCP / archive not configured** → that section `null` → "Pending" placeholder, never a crash.
- **CF Access session expired** → transparent Google re-auth.
- **Live control endpoint down** → control widgets show "unavailable", snapshot tabs unaffected.
- **Key expired (SA / PAT / CF token)** → that source errors, rest of dashboard fine; rotate via `wrangler secret put`.

---

## Appendix A — GA access verification (config-only)

Because the SA + Google Group already hold **account-level** Viewer, the Concerts property should be
reachable. Verify before writing `fetchGA()`:

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

`SUCCESS` → set the secrets and proceed. `403 PERMISSION_DENIED` → the group's Viewer was granted at
the *property* level on Pitch; re-grant at the GA **Account** level (Admin → Account Access
Management) and it inherits to Concerts.

---

## Appendix B — GA4 custom event taxonomy (engagement source)

Events the SPA fires (defined in `src/services/analytics.ts`). Query `eventCount` by `eventName`
over 30d for the Engagement tab; pull named params for breakdowns.

**Navigation:** `scene_view` (`scene_name`, `scene_number`) · `scene_nav_clicked`
(`from_scene`, `to_scene`) · `deep_link_accessed` (`scene`, `artist`, `venue`).

**Search (topics):** `artist_search_performed` (`search_term`, `results_found`, `selected_artist`).

**High-signal interactions:** `timeline_card_clicked` · `venue_node_clicked` · `map_marker_clicked` ·
`genre_tile_clicked` · `artist_card_opened` (`device_type`, `times_seen`) · `artist_tab_viewed`
(`tab_name`) · `setlist_button_clicked` · `liner_notes_badge_clicked` · `tour_badge_clicked`.

**Audio:** `artist_preview_played` (`track_position`, `source`, `device_type`) ·
`artist_preview_streaming_link_clicked`.

**Ask funnel:** `ask_opened` (`surface`) · `ask_question_sent` (`turn_index`, `char_len`) ·
`ask_exhibit_shown` (`kind`) · `ask_refused` · `ask_error` (`reason`) · `ask_deeplink_clicked`
(`kind`, `target_scene`) · `ask_suggested_prompt_clicked`.

> GA `ask_*` events count client interactions; the **`ask_turns` Analytics Engine ledger** is the
> authoritative server-side source for spend, query text, and outcomes (use it for Topics + Spend).

**"What's getting clicked" (per-entity breakdowns).** The events above already carry the entity in
their params — `artist_card_opened.artist_name`, `venue_node_clicked`/`map_marker_clicked.venue_name`,
`artist_preview_played.track_name`, `setlist_button_clicked.artist_name`+`venue_name`. To slice GA by
those *values* (e.g. "most-opened artists"), each param must be registered as a GA4 **event-scoped
custom dimension** (Admin → Custom definitions — one-time config, no code change). Tracked as a
Phase-0/Phase-3 setup task. **Gap:** clicks on an *individual song within a setlist* are not tracked
today (only "open setlist" fires); per-song-in-setlist engagement needs a small new event
(`setlist_song_clicked`) — relates to #22 (audio preview on setlist items).

---

## Appendix C — Enrichment stages → Archive Health coverage

One equally-weighted coverage row per stage. Computed from generated files (no new APIs).

| Stage | Script(s) | File · field | Coverage = |
| --- | --- | --- | --- |
| Concert metadata | `fetch-google-sheet.ts` | `concerts.json` · `date`, `headliner`, `venue` | valid concerts / total |
| Concert/artist **genres** | `enrich-concert-genres.ts`, `enrich-artists.ts` | `concerts.json` · `genreNormalized`; `artists-metadata.json` · `genres[]` | non-empty / total (split openers vs headliners — note ~62% vs ~93%) |
| Artist **metadata** (bio/photo) | `enrich-artists.ts` | `artists-metadata.json` · `bio`, `image` | non-empty / unique artists |
| Artist **audio previews** | `enrich-top-tracks.ts` | `artists-top-tracks.json` · `tracks[].previewUrl` | artists ≥2/5 previews / total |
| Venue **photos/geocode** | `enrich-venues.ts`, `geocode-venues.ts` | `venues-metadata.json` · `photoUrls`, `location` | venues w/ photo / total; venues w/ geocode / total |
| **Setlists** | `prefetch-setlists.ts` | `setlists-cache.json` | concerts w/ setlist / total (~87%) |
| **Discography** | `enrich-discography.ts` | `discography.json` · `albums[].coverUrl` | artists w/ ≥1 album / total; albums w/ cover / total |
| **Liner notes** | `liner-notes/*.ts` | `liner-notes.json` | published findings / analyzed findings (by detector) |

`lastBuildAt` = newest `fetchedAt`/generated timestamp across these files.

---

## Revision History
- **Final (this revision):** Locked owner decisions — Archive Health tab, active control panel
  (#158), spend bootstrapped from `ask_turns` (AI Gateway later), all optionals in (phased v1/v1.1),
  primary jobs (cost/traffic/topics), Concerts reskin, same Google SSO. Filled the GA taxonomy
  (Appendix B) and enrichment stages (Appendix C) from the live repo. Added the live control plane
  and Topics/Monitoring/ArchiveHealth contract sections.
- Initial port from the Pitch hosted-dashboard spec.
</content>
</invoke>
