# concerts-dashboard-refresh (Phase 1 — #171)

Daily Worker that writes the operator-dashboard snapshot to KV from the two exact, server-side
sources we already have: **Cloudflare GraphQL** (traffic) + the **`ask_turns`** Analytics Engine
ledger (spend, ask volume, outcomes, top topics). No GA, no new instrumentation.

Reads: snapshot → `functions/dashboard/data.ts` (Pages Function) → React `/dashboard` route.

## One-time setup
```bash
# 1. Create the shared KV namespace, paste the id into wrangler.toml AND bind the same id on the Pages project.
npx wrangler kv namespace create CONCERTS_DASHBOARD

# 2. Secret: account token with Analytics:Read + Account Analytics (covers GraphQL + the AE SQL API).
npx wrangler secret put CF_API_TOKEN
#    Optional: enable the manual refresh trigger.
npx wrangler secret put REFRESH_KEY

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
GA engagement (#173), MCP-external instrumentation (#174), Archive Health (#175),
Topics & Gaps depth / Trends / Development (#176) extend the snapshot contract.
