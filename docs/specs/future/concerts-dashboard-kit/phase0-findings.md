# Dashboard Phase 0 — Findings & Audit (#170)

Resolves the codebase-answerable parts of the Phase 0 config-only setup. **Console-only actions you
must do** (GA Admin, Cloudflare Zero Trust) are listed in [Owner action checklist](#owner-action-checklist).

Spec: `concerts-dashboard-spec.md`. Generated from the live repo at audit time.

---

## 1. GA4 — `DISCOVER(1)`

- **Measurement ID:** **`G-VKSC8MCN5N`** (hard-coded in `index.html`; also `VITE_GA_MEASUREMENT_ID`
  drives the in-app analytics service, which is **only enabled in PROD**).
- **Numeric property id:** ⚠️ **owner action** — not derivable from the repo. Get it from GA Admin →
  *Property Settings* → "PROPERTY ID" (a 9-digit number), or the Admin API. Set it as `GA_PROPERTY`
  in the refresh Worker.
- **Access carries over:** the existing service account + Google group hold account-level Viewer, so
  once the numeric id is set, verify with Appendix A's one-liner. No new GCP setup expected.

## 2. Serving topology — `DISCOVER(2)` ✅ resolved

- The SPA is served by **Cloudflare Pages** (project `concerts`).
- Two Workers sit on zone routes: **`concerts-meta-injector`** on `concerts.morperhaus.org/*`
  (injects meta tags for **bots**; **passes non-bot traffic straight through** to the Pages origin —
  see `workers/meta-injector/worker.js`) and **`morperhaus-mcp`** on `/mcp*`.
- No `public/_redirects`; client routes (`/about`, `/liner-notes`) work via SPA fallback + react-router.

**Recommendation (data endpoint):** use **Variant A — a Pages Function** at
`functions/dashboard/data.ts`, with the `CONCERTS_DASHBOARD` KV bound on the **Pages project**.
Because the meta-injector passes non-bot requests through to the Pages origin, the Function executes
normally; Cloudflare Access runs at the edge *before* either, so `/dashboard*` is fenced regardless.
The **React `/dashboard` route** is added to the existing SPA router.

**Confirm during Phase 1:** that Pages serves `index.html` for the `/dashboard` client route (add a
`public/_redirects` `/*  /index.html  200` if the SPA fallback doesn't already cover deep links).

## 3. MCP / Ask telemetry sources

- **`ask_turns`** Analytics Engine dataset is **live in prod** (#157). Schema (per
  `global-ask-the-archive-observability.md`): `blob1`=day, `blob2`=query, `blob3`=exhibit kind,
  `blob4`/`index1`=outcome, `double1–4`=tokens, `double5`=**cost µUSD**, `double6`=spend fraction.
  Read via the Analytics Engine SQL API. Example:
  ```sql
  SELECT blob1 AS day, SUM(double5)/1e6 AS usd, COUNT() AS turns
  FROM ask_turns WHERE timestamp > NOW() - INTERVAL '30' DAY GROUP BY day ORDER BY day
  ```
- **External MCP tool-calls:** `morperhaus-mcp` only keeps the `MCP_QUERY_USAGE` KV (cap counters) —
  **no per-tool/per-source telemetry yet.** Net-new `writeDataPoint([tool, source])` is Phase 4 (#174).

## 4. Spend cap (`capUsd`)

- Current live cap: **`ASK_MONTHLY_USD = "25"`** (ask-chat; daily cap derived ≈ $0.83/day), per-IP
  `ASK_IP_DAILY_USD = "0.15"`. **Recommendation:** set the dashboard `capUsd = 25` to mirror it; keep
  the two in sync. (mcp-server has its own query-cap; surface separately.)

## 5. Archive Health coverage — actuals (computed from `public/data/*`)

Counts: **183 concerts · 280 artists (metadata) · 79 venues · 257 artists (discography)**.

| Stage | Coverage | Source / note |
| --- | --- | --- |
| Concert genre | **100%** (183/183) | `concerts.json · genreNormalized` |
| Artist genres | **68%** (190/280) | `artists-metadata.json · genres[]` — the opener/headliner gap lives here |
| Artist image | **97%** (271/280) | `artists-metadata.json · image` |
| ~~Artist bio~~ | **n/a** | ⚠️ **no `bio` field** in `artists-metadata.json` (keys: name, image, genres, formed, website, source). Drop "bio" from the metric or add a bio enrichment first. |
| Audio previews (≥2 of 5) | **100%** (258/258) | `artists-top-tracks.json · tracks[].previewUrl` |
| Venue photos | **100%** (79/79) | `venues-metadata.json · photoUrls` |
| Venue geocode | **100%** (79/79) | `venues-metadata.json · location` |
| Setlists | **86%** (158/183 concerts) | `setlists-cache.json · entries[]` (369 per-artist entries) |
| Discography covers | **100%** (11,289 albums) | `discography.json · albums[].coverUrl` |
| Liner notes | 51 posts published | `liner-notes.json` (coverage = published/analyzed, computed at gen time) |

**Implication:** the live archive is in great shape — the only real gaps are **artist genres (68%)**
and **setlists (86%)**. That makes the Demand × Coverage quadrant (#175) genuinely useful (it'll point
at low-genre / no-setlist artists), and means "bio" should be dropped from Archive Health unless a bio
source is added.

## 6. GA4 custom dimensions to register — ⚠️ owner action

Register these **event-scoped custom dimensions** (GA Admin → *Custom definitions* → *Create custom
dimension*). They are **not retroactive** — register now so history accrues before Phase 3.

| Dimension name | Event parameter | Powers |
| --- | --- | --- |
| Artist name | `artist_name` | most-opened artists, demand×coverage |
| Venue name | `venue_name` | most-clicked venues |
| Track name | `track_name` | most-played songs |
| Scene name | `scene_name` | scenes by usage |
| Device type | `device_type` | device split |
| Search term | `search_term` | top searches / zero-result |
| Target scene | `target_scene` | Ask-as-navigation |

## 7. Cloudflare Access — ⚠️ owner action

In Cloudflare Zero Trust → Access → Applications, add a self-hosted app:
- Domains: `concerts.morperhaus.org/dashboard*` **and** `concerts.morperhaus.org/api/ask/admin*`
- Policy: Include → Emails → `mike@morper.net`; Session 24h.

---

## Owner action checklist
- [ ] GA Admin → get the **numeric property id** (for `G-VKSC8MCN5N`) → set `GA_PROPERTY`.
- [ ] GA Admin → **register the 7 custom dimensions** above (do this ASAP — not retroactive).
- [ ] Cloudflare Zero Trust → **Access app** on `/dashboard*` + `/api/ask/admin*`.
- [ ] Confirm `capUsd = 25` (or adjust) for the dashboard.
- [ ] (Phase 1) create KV `CONCERTS_DASHBOARD` + bind to the Pages project.

## Resolved in this audit (no action needed)
- ✅ GA measurement ID, serving topology + data-endpoint approach, `ask_turns` schema/SQL, archive
  coverage actuals, spend-cap value to mirror, the "bio" gap, the data-endpoint variant choice.
</content>
