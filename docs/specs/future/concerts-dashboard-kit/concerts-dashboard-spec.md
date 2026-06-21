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
| **Optionals (all in)** | Spend-alert status (#164), Development tab, Trends view, Uptime/error monitoring | Owner wants the full set; value-first phasing — see [Phasing](#phasing-pragmatic-re-cut). |
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

## Phasing (pragmatic re-cut)

The full scope is broad; build it value-first and avoid over-engineering. The guiding principle:
**lead with exact, server-side data we already have** (`ask_turns`, Cloudflare GraphQL) — it needs
no new instrumentation and isn't subject to GA's sampling/thresholding at our traffic. GA-shaped and
new-subsystem work comes *after*, once data has accrued. **Phases 0–2 are the product**; everything
after is additive.

> ⚠️ **Capture limits — be honest about these (don't build around them):**
> - **No per-user journeys / identity.** GA4 is aggregate + sampled + consent-gated; `ask_turns` is
>   per-turn, not per-person. Aggregate funnels only.
> - **GA4 custom dimensions are not retroactive** — "what's getting clicked" starts at zero the day
>   we register them. → **Register them in Phase 0** so history accrues while we build.
> - **Spend from `ask_turns` is an estimate** (tokens × price table), great for trend/cap, not
>   invoice-accurate. AI Gateway/Admin API only if accounting-grade is ever needed.
> - **Low-traffic noise** — fine-grained GA breakdowns get sampled/withheld; show "low data" guards.
> - **Wishlist/gap split is heuristic** (depends on refusal-reason quality) — flavor, not fact.
> - **No impressions logged** → rank entities by clicks, not CTR. Don't add impression events.

| Phase | Milestone | Why here |
|---|---|---|
| **0** | **Config-only, no code** | Highest leverage / lowest effort. |
| **1** | **Operator MVP** — Overview from Cloudflare + `ask_turns` only | Exact data we already have; the quick win. |
| **2** | **Control surface** (#158/#164) | Contained, reuses Access, high daily value. |
| **3** | **Engagement** (GA) | Needs Phase-0 dims to have accrued data. |
| **4** | **MCP external** instrumentation | Small net-new code in mcp-server. |
| **5** | **Archive Health + Demand×Coverage** | Coverage from `public/data`; quadrant needs Phase-3 data. |
| **6** | **Topics & Gaps depth · Trends · Development** | Delight/texture; Trends back-fills for free. |

**Cut to avoid over-engineering:** start the intent view as top-N query frequency (no LLM classifier
unless it proves too coarse); skip `setlist_song_clicked` unless #22 ships; no per-impression CTR;
no AI-Gateway migration or per-IP-reset until needed; let `dashboard:history:*` back-fill Trends
rather than building a pipeline; keep the Development tab trivial or drop it.

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

| Tab | Phase | Source | Contents |
| --- | --- | --- | --- |
| **Overview** | P1 | CF + `ask_turns` (GA added P3) | Three-job hero: **spend vs cap** (cost control), **traffic**, **Topics of Interest** (top ask themes). Data-freshness strip, error glance; channels/countries/referrers/pages added in P3. |
| **Cost & Control** | P2 | spend + #158 + #164 | Spend day/week/month vs cap (line + cap reference), by model, by surface (ask/mcp). **Live controls:** mode toggle, admin-IP management, current-day spend, tripwire/alert status. |
| **Engagement** | P3 | GA custom events | Scenes by usage (bar), search volume + top terms, **what's getting clicked** (top artists/venues/songs/setlists), audio attention, device split, Ask funnel. |
| **MCP & Ask** | P4 | `ask_turns` + `mcp_queries` | Queries over time (line), by tool (bar), in-SPA vs external split (doughnut), outcomes, **Ask-as-navigation** (deep-link pass-through). |
| **Archive Health** | P5 | `public/data/*` + P3 clicks | One coverage bar per enrichment stage (all equal), last-build timestamp, **Demand × Coverage** quadrant + enrichment backlog. |
| **Topics & Gaps** | P6 | `ask_turns` + GA search | Question **intent mix**, most-asked topics, **content gaps** (asked + unanswerable, entity exists), **wishlist** (asked re: shows not in the archive), zero-result searches, suggested-prompt CTR. See Appendix D. |
| **Trends** | P6 | `dashboard:history:*` | Per-day sessions / MCP queries / spend (back-fills from daily history). |
| **Development** | P6 | GitHub | Commit/PR velocity, open issues by label, recent PRs. Kept trivial or dropped. |

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

Value-first ordering (see [Phasing](#phasing-pragmatic-re-cut)). **Phases 0–2 are the product**;
3–6 are additive.

### Phase 0 — Config-only, no code  *(do first)*
- Resolve `DISCOVER(1)` GA numeric property id (map the `G-XXXX` gtag id) and `DISCOVER(2)` serving
  topology (Pages vs Worker → which `data-endpoint.ts` variant + `/dashboard` route home + how
  `/dashboard*` coexists with the `/*` meta-injector).
- **Register the GA4 event-scoped custom dimensions** now (Appendix B params) so history starts
  accruing — they are *not* retroactive.
- Set up CF Access on `/dashboard*` + `/api/ask/admin*`. Verify `ask_turns` SQL access (Appendix A
  for GA). Decide the monthly `capUsd`. Confirm `public/data` fields for Archive Health.
- **Gate:** unknowns resolved, custom dims live, Access policy in place, data contract locked.

### Phase 1 — Operator MVP  *(the quick win — exact server-side data only)*
Create KV `CONCERTS_DASHBOARD`; stand up `workers/dashboard-refresh/` + the data endpoint + a
`/dashboard` route shell behind Access. Sources: **Cloudflare GraphQL** (traffic / worker requests /
5xx) + **`ask_turns`** (spend µUSD vs cap, ask volume, outcomes, top topics by raw query frequency).
One **Overview** page. No GA, no new instrumentation, no sampling.
**Gate:** `/dashboard` requires Google login, renders real spend + traffic + ask volume from the
daily snapshot; degrades gracefully (503 before first refresh).

### Phase 2 — Control surface (#158 / #164)
Add the Access-gated `/api/ask/admin/*` JSON endpoints (state / mode / ips) and wire the live control
widgets: mode toggle, admin-IP management, current-day spend, tripwire/alert status. Reuse existing
Access; HTML `admin.ts` stays as interim UI.
**Gate:** mode + admin-IP changes work end-to-end; tripwire status reflects reality.

### Phase 3 — Engagement (GA)
Now Phase-0 dims have accrued data. Add the **Engagement** tab from GA: scenes, search volume + top
terms, what's-getting-clicked (artists/venues/songs/setlists), audio attention, device split, Ask
funnel. Add the website block (channels/countries/referrers/pages) to Overview.
**Gate:** engagement populates with "low data" guards where sampling bites.

### Phase 4 — MCP external instrumentation
Add Analytics Engine `writeDataPoint([tool, source])` to `morperhaus-mcp`; `fetchMcp()` unions
`mcp_queries` (external) + `ask_turns` (spa). Build the **MCP & Ask** tab + Ask-as-navigation.
**Gate:** real counts split by tool and spa-vs-external.

### Phase 5 — Archive Health + Demand × Coverage
`fetchArchiveHealth()` over `public/data/*` (Appendix C); join Phase-3 click data for the
**Demand × Coverage** quadrant + enrichment backlog.
**Gate:** coverage per stage + the "enrich next" list render.

### Phase 6 — Topics & Gaps depth · Trends · Development
Topics & Gaps starting with **top-N query frequency** (add the nightly intent classifier / wishlist
clustering only if frequency proves too coarse — Appendix D). Trends back-fills from
`dashboard:history:*`. Development tab kept trivial (or dropped).
**Gate:** additive tabs render; no new subsystem built that isn't earning its keep.

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

## Appendix D — Usage-insight enhancements

Higher-leverage analytics that turn raw counts into *decisions*. Most are cheap (GA custom
dimensions + Analytics Engine SQL over `ask_turns`); a couple need small additions, noted.

**1. Mine the questions (highest value).** The `ask_turns` ledger carries query text + outcome +
exhibit kind — a direct read on intent.
- **Content gaps** — cluster questions that were **refused / returned no exhibit** *and* GA searches
  with `results_found = 0`, where the entity **exists** in the archive → a prioritized enrichment
  queue (powers the Topics & Gaps "content gaps" panel and feeds Demand × Coverage below).
- **Wishlist** — questions about concerts **not** in the archive ("did you see Nirvana?") → an
  on-brand "shows people wish I'd been to" list and a liner-notes story hook.
- **Intent taxonomy** — a cheap nightly LLM batch labels each question (lookup / counting /
  comparison / recommendation / "have you seen" / on-this-day). Small, bounded cost; surfaces what
  the chat is *for* and which intents fail most. (New: a scheduled classify step writing back to a
  small KV/D1 table or an `ask_turns` enrichment.)
- **Suggested-prompt performance** — rank `ask_suggested_prompt_clicked` (`prompt`, `position`) by
  CTR; retire dead prompts, promote winners.

**2. Demand × Coverage (the "what to fix next" quadrant).** Join Engagement clicks (popularity)
against Archive Health coverage. The **high-demand + low-coverage** quadrant is the prioritized
enrichment backlog — the single most actionable cross-tab. Requires the per-entity click dims
(Appendix B) + the coverage rows (Appendix C); no new collection.

**3. Ask-as-a-navigation engine.** `ask_deeplink_clicked` → `target_scene`: measures whether the
chat drives people *into* the archive (pass-through %, scene entries originating from Ask). High
pass-through ⇒ invest in Ask as a discovery surface.

**4. Engagement depth.** Audio completion rate / skip-within-5s from `artist_preview_played` +
`artist_preview_paused.playback_duration`; per-impression click rates (normalize by views);
**device split** via the `device_type` param already on most events.

**5. Texture (later).** Day/hour heatmap and tour-announcement spikes; decade/era interest from
`timeline_year_selected` + genre-timeline scrubbing; geo ↔ archive match (do LA visitors click LA
venues?); human-vs-agent question comparison once external MCP is instrumented; liner-notes
readership **by detector type** (which editorial patterns resonate); Search Console inbound queries
(if the property is granted).

**New data dependencies introduced by this appendix:**
- GA4 **event-scoped custom dimensions** for the entity params (Appendix B) — config, no code.
- A nightly **question-intent classification** job (bounded LLM cost) — feeds intent + gap/wishlist
  clustering.
- `setlist_song_clicked` event for per-song-in-setlist engagement (relates to #22).

## Revision History
- **Pragmatic re-cut:** Reordered to value-first phases 0–6 (Phases 0–2 = the product): config-only
  first, then an Operator MVP from exact server-side data (Cloudflare + `ask_turns`), then control,
  then GA engagement, MCP external, Archive Health, and finally Topics/Trends/Dev. Documented honest
  capture limits and an over-engineering cut-list. Tab table re-keyed to phases.
- **Usage-insight pass:** Added the Topics & Gaps tab (intent mix, content gaps, wishlist,
  zero-result searches, prompt CTR), Demand × Coverage quadrant (Archive Health), Ask-as-navigation
  (MCP & Ask), and Engagement depth (audio attention, device split, what's-getting-clicked).
  Captured the analytics roadmap in Appendix D with its new data dependencies.
- **Final (this revision):** Locked owner decisions — Archive Health tab, active control panel
  (#158), spend bootstrapped from `ask_turns` (AI Gateway later), all optionals in (phased v1/v1.1),
  primary jobs (cost/traffic/topics), Concerts reskin, same Google SSO. Filled the GA taxonomy
  (Appendix B) and enrichment stages (Appendix C) from the live repo. Added the live control plane
  and Topics/Monitoring/ArchiveHealth contract sections.
- Initial port from the Pitch hosted-dashboard spec.
</content>
</invoke>
