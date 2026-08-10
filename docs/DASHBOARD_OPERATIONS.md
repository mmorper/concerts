# Operator Dashboard — Operations Guide

Ongoing administration of the **internal** operator console at
`https://concerts.morperhaus.org/dashboard`. This is a private tool (Cloudflare Access, owner
only) — it is intentionally not linked from the site or any public material.

- **First-time setup** (one-time): [`DASHBOARD_GO_LIVE.md`](./DASHBOARD_GO_LIVE.md).
- **Secrets — where they live & how to rotate:** [`SECRETS.md`](./SECRETS.md).
- **Design / data contract:** [`specs/implemented/concerts-dashboard-kit/`](./specs/implemented/concerts-dashboard-kit/).

---

## Architecture in one paragraph

A daily cron in the **`dashboard-refresh`** worker pulls from Cloudflare (traffic + 5xx, scoped
to `concerts.morperhaus.org`), GA4 (sessions/engagement), the `ask_turns` Analytics Engine ledger
(spend + Ask volume), `mcp_queries` (external MCP), and GitHub, then writes a single
`dashboard:snapshot` JSON to the **`CONCERTS_DASHBOARD`** KV namespace. The `/dashboard` Pages
function reads that snapshot. The **`ask-chat`** worker serves the live Cost & Control admin API.
Nothing blocks the page if a source fails — that section shows "pending" and the error is listed.

## Access

- URL: `https://concerts.morperhaus.org/dashboard`
- Gate: **Cloudflare Access** → Google SSO, restricted to `mike@morper.net`, 24h sessions.
- The **same** Access application also fences `/api/ask/admin*` (shared AUD), so one login covers
  the dashboard and the live admin API. Don't create a second app — `ask-chat` verifies that AUD.

## Daily refresh (the cron)

- Schedule: **`0 6 * * *`** (06:00 UTC), defined in `workers/dashboard-refresh/wrangler.toml`.
- A snapshot older than **26h** shows a **stale** badge on the Overview.

### Manual refresh (on demand)

Requires the `REFRESH_KEY` secret (see SECRETS.md). Streams back the snapshot it just wrote:

```bash
curl "https://concerts-dashboard-refresh.morps.workers.dev/?key=<REFRESH_KEY>"
```

(The `*.workers.dev` URL is harmless without the key; the key is the gate.)

## Reading "Source status" (bottom of Overview)

| Status | Meaning | Action |
|--------|---------|--------|
| `ok` | source configured and returning data | none |
| `not_configured` | feature intentionally skipped (e.g. `github` with no `GH_TOKEN`) | none, unless you want it |
| `error` | an API/schema failure for that one source | read the **"Partial data"** banner — it names the source + error |

Most `error` cases are a **field-name mismatch** against a live API (GA / CF GraphQL / GitHub
shapes are doc-verified, not always live-tested). The fix is usually a one-line query tweak in
`workers/dashboard-refresh/src/index.ts`, then redeploy + manual refresh. A dead source never
blanks the page.

`archiveHealth` is the exception to "one source, one failure": it fetches **nine** files from
`public/data/` and any one of them 404-ing fails the whole section. So an `archiveHealth: error`
right after a data change usually means a file stopped being published, not that a formula broke —
check the `DATA_FILES` list in `index.ts` against what `public/data/` actually ships. Coverage
formulas themselves degrade quietly instead: a file that parses but is missing the block a stage
reads shows `0 / 0`, never an error.

## Admin-IP allowlist (Cost & Control tab)

Allowlisted IPs **bypass the public rate limits and the daily spend cap** on `/api/ask/chat`, so
you can test/debug Ask without burning budget. Managed live from the tab (no redeploy):

- Stored in `ASK_CONTROL` KV under `admin:ips`; read on the turn path with a ~60s isolation cache,
  so a change takes effect within ~a minute.
- `ASK_ADMIN_IPS` (comma-separated env on `ask-chat`) is an optional **break-glass bootstrap**,
  unioned with the KV list.
- Add your current public IP (`curl -s ifconfig.me`) via the tab's **Add** field.
- Admin turns are still recorded in the `ask_turns` ledger; they just skip the gates.
- **Not yet built:** *per-IP reset* (surgically clearing one visitor's spend counter) — needs a
  `SpendCounter.reset()` RPC. The tab labels it "planned".

## Spend caps (keep two values in sync)

| Value | Where | Role |
|-------|-------|------|
| `ASK_MONTHLY_USD` | `workers/ask-chat/wrangler.toml` `[vars]` | **the real cap** enforced on every turn |
| `CAP_USD` | `workers/dashboard-refresh/wrangler.toml` `[vars]` | the cap the dashboard *displays* |

Change both together, then **redeploy** the affected worker(s) — `[vars]` are baked at deploy time.

## Deploys (workers DO auto-deploy on merge)

Every Worker ships from CI on merge to `main`, each gated on its own tests and filtered to its
own directory — `ask-chat`, `dashboard-refresh`, `mcp-server` (#261) and `meta-injector` (#262).
Nothing here needs a manual `wrangler deploy` any more.

The `/dashboard` **frontend** ships automatically via Cloudflare Pages on merge to `main`.

**A deploy is not a refresh.** The dashboard renders a KV snapshot, so a change to how a metric is
computed does not appear until the next 06:00 UTC cron — or a **manual refresh** (above), which is
what you want after merging a coverage change.

Manual deploy is still the escape hatch when CI cannot run:

```bash
cd workers/dashboard-refresh && npx wrangler deploy
```

> If `wrangler` fails with `Authentication error [code: 10000]`, your shell has a stale
> `CLOUDFLARE_API_TOKEN` exported (from the root `.env`) overriding your `wrangler login`.
> `unset CLOUDFLARE_API_TOKEN` (or prefix `env -u CLOUDFLARE_API_TOKEN`) and retry.

## Recovering a bad snapshot

If a refresh writes a corrupt/partial snapshot, either trigger a **manual refresh** (above) or
delete the `dashboard:snapshot` key in the `CONCERTS_DASHBOARD` KV namespace (Cloudflare dashboard
→ Workers & Pages → KV) — the next 06:00 UTC cron rebuilds it from scratch.
