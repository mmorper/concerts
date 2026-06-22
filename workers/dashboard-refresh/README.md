# concerts-dashboard-refresh (Phase 1 — #171 · Phase 3 GA — #173)

Daily Worker that writes the operator-dashboard snapshot to KV. Sources, each independently
try/caught:
- **Cloudflare GraphQL** (traffic / worker requests) + the **`ask_turns`** Analytics Engine ledger
  (spend, ask volume, outcomes, top topics) — exact, server-side, no sampling (Phase 1).
- **GA4 Data API** (Phase 3) — website report + the Concerts custom-event taxonomy (scenes, Ask
  funnel, interactions, search, "what's getting clicked", device split). **Optional:** without
  `GA_PROPERTY` + `GA_SA_KEY_JSON` the `ga` section is `null` / `sourceStatus.ga = "not_configured"`.

Reads: snapshot → `functions/dashboard/data.ts` (Pages Function) → React `/dashboard` route.

> ⏰ **GA4 custom dimensions are not retroactive.** Register the 7 event-scoped dimensions
> (artist_name, venue_name, track_name, scene_name, device_type, search_term, target_scene) in the
> GA console ASAP — the "what's getting clicked" breakdowns only carry data from registration onward.

## One-time setup
```bash
# 1. Create the shared KV namespace, paste the id into wrangler.toml AND bind the same id on the Pages project.
npx wrangler kv namespace create CONCERTS_DASHBOARD

# 2. Secret: account token with Analytics:Read + Account Analytics (covers GraphQL + the AE SQL API).
npx wrangler secret put CF_API_TOKEN
#    Optional: enable the manual refresh trigger.
npx wrangler secret put REFRESH_KEY
#    Phase 3 GA (optional): set GA_PROPERTY in wrangler.toml, then the SA key (+ optional subject).
npx wrangler secret put GA_SA_KEY_JSON
npx wrangler secret put GA_IMPERSONATE_SUBJECT

# 3. Deploy (cron runs 06:00 UTC; or trigger manually with the key).
npx wrangler deploy
curl "https://concerts-dashboard-refresh.<subdomain>.workers.dev/?key=<REFRESH_KEY>"
```

## Seed the sample snapshot (preview the UI before the first real refresh)
```bash
npx wrangler kv key put --namespace-id=<CONCERTS_DASHBOARD_KV_ID> \
  "dashboard:snapshot" --path=./sample-snapshot.json
```

## Test
```bash
npm install && npm test   # vitest — covers the pure helpers (normalizeQuery, topTopics, spendWindows)
```

## Next phases
MCP-external instrumentation (#174), Archive Health (#175), Topics & Gaps depth / Trends /
Development (#176) extend the snapshot contract.
