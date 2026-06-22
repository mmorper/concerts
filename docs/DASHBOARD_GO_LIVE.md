# Operator Dashboard — Go-Live Runbook

**Goal:** take the dashboard from "code-complete, fail-closed shell" to **live, hydrated data** at
`https://concerts.morperhaus.org/dashboard`.

Everything below is **manual console / CLI work** — the code is done (Phases 1–6, Epic #159). Do these
once, in order. Anything marked **(optional)** can be skipped or deferred; the rest of the dashboard
still works without it (each data source degrades to a "pending" placeholder).

> **Prereqs:** the `wrangler` CLI logged in to the Cloudflare account
> `6db8591bbcba4588ae4ef9c3839cd209` (`npx wrangler login`), and access to the GA4 property
> `G-VKSC8MCN5N` and the Cloudflare Zero Trust dashboard.

---

## Step 0 — Get the code onto `main`

The deploys below pull from `main`. Phase 4 (#183) is already merged. **Phase 6 (#184) is an open,
CI-green draft** — it must be merged first or `dashboard-refresh` will deploy without the Topics /
Trends / Development / Monitoring sections.

- [ ] Merge **PR #184** (tell me "merge 184" and I'll mark-ready + squash-merge), then locally:
  ```bash
  git checkout main && git pull origin main
  ```

---

## Step 1 — Create the KV namespace (the dashboard's data store)

- [ ] Create it:
  ```bash
  cd workers/dashboard-refresh
  npx wrangler kv namespace create CONCERTS_DASHBOARD
  ```
  It prints something like `id = "abc123…"`. **Copy that id.**

- [ ] Paste the id into `workers/dashboard-refresh/wrangler.toml`, replacing the placeholder:
  ```toml
  [[kv_namespaces]]
  binding = "CONCERTS_DASHBOARD"
  id = "abc123…"   # ← was <CONCERTS_DASHBOARD_KV_ID>
  ```
  Commit that one-line change to `main`. *(Or paste the id to me and I'll commit it.)*

- [ ] **Bind the SAME namespace on the Pages project** so the data endpoint can read it:
  Cloudflare dashboard → **Workers & Pages → `concerts` (Pages) → Settings → Bindings → KV namespace**
  → **Add binding**: Variable name **`CONCERTS_DASHBOARD`**, Namespace = the one you just created.
  Add it for **Production** (and Preview if you want previews to show data).

---

## Step 2 — Create the Cloudflare API token (traffic, spend, 5xx)

- [ ] Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**:
  - **Permissions:** `Account` · `Account Analytics` · `Read` *(this one permission covers the GraphQL
    traffic query, the `ask_turns`/`mcp_queries` Analytics Engine SQL API, and the 5xx monitoring query)*
  - **Account Resources:** Include → your account (`6db8591bbcba…`)
  - Create, then **copy the token value**.

- [ ] Set it on the refresh Worker:
  ```bash
  cd workers/dashboard-refresh
  npx wrangler secret put CF_API_TOKEN     # paste the token when prompted
  ```

---

## Step 3 — Cloudflare Access (fences the console + admin API)

There is **already an Access application** protecting `/api/ask/admin*` (its AUD is baked into
`workers/ask-chat/wrangler.toml`). **Add the dashboard path to that same app** so one Google login
covers both and the AUD stays unchanged.

- [ ] Cloudflare **Zero Trust → Access → Applications** → open the existing app (the one whose
  Application Audience (AUD) tag is `0b00770581a186384e8a097dae26cc59e80e9e7d60a8b04595dd924256503203`).
- [ ] Add a **public hostname / path**: `concerts.morperhaus.org/dashboard*`
      *(so the app now covers `…/dashboard*` **and** `…/api/ask/admin*`)*.
- [ ] Confirm the **policy**: Include → **Emails → `mike@morper.net`**, Session duration 24h.

> ⚠️ Do **not** create a *new* app with a different AUD — `ask-chat` verifies the existing AUD, so a
> mismatch would break the Cost & Control tab's live admin calls.

---

## Step 4 — Google Analytics (Engagement, Trends sessions, Topics search, Demand×Coverage)

### 4a. Register the 7 custom dimensions — ⏰ DO THIS FIRST, IT IS NOT RETROACTIVE

GA Admin → **Custom definitions → Create custom dimensions**. For each, **Scope = Event**, and set the
**Event parameter** exactly as shown:

| Dimension name | Event parameter | Powers |
|---|---|---|
| Artist name | `artist_name` | most-opened artists · Demand×Coverage |
| Venue name | `venue_name` | most-clicked venues |
| Track name | `track_name` | most-played songs |
| Scene name | `scene_name` | scenes by usage |
| Device type | `device_type` | device split |
| Search term | `search_term` | top searches |
| Target scene | `target_scene` | Ask-as-navigation |

- [ ] All 7 created. *(These start collecting from today — the sooner the better.)*

### 4b. Get the numeric property id

- [ ] GA Admin → **Property Settings → "PROPERTY ID"** (a 9-digit number for `G-VKSC8MCN5N`). Set it:
  ```bash
  cd workers/dashboard-refresh
  npx wrangler secret put GA_PROPERTY       # paste the 9-digit number
  ```

### 4c. Set the service-account key (reuse the Pitch dashboard SA)

- [ ] Use the **same** GA service-account JSON key you use for the Pitch dashboard (it already holds
  account-level Viewer, which includes this property). Set it as a secret — paste the **entire JSON**:
  ```bash
  npx wrangler secret put GA_SA_KEY_JSON
  ```
- [ ] **(optional)** If that SA accesses GA via domain-wide delegation impersonating a user/group:
  ```bash
  npx wrangler secret put GA_IMPERSONATE_SUBJECT     # e.g. pitch-dashboard-readers@morper.net
  ```

> **Verify access first (optional):** run the one-liner in the spec's *Appendix A* with the SA key and
> the numeric property id — a `SUCCESS` means the creds work before you deploy.

---

## Step 5 — Optional extras

- [ ] **(optional) Development tab** — a GitHub token for `mmorper/concerts`:
  Create a fine-grained PAT (repo `mmorper/concerts`, read-only: Contents, Issues, Pull requests), then
  ```bash
  cd workers/dashboard-refresh && npx wrangler secret put GH_TOKEN
  ```
- [ ] **(optional) Manual refresh trigger** — lets you hydrate on demand instead of waiting for the
  06:00 UTC cron:
  ```bash
  cd workers/dashboard-refresh && npx wrangler secret put REFRESH_KEY    # any random string
  ```
- [ ] **(optional) Spend alerts (#164)** — turn the tripwires from log-only into real pushes:
  ```bash
  cd workers/ask-chat && npx wrangler secret put NOTIFY_WEBHOOK_URL      # ntfy/Pushover-style URL
  ```

---

## Step 6 — Deploy the three workers

Workers **do not auto-deploy on merge** — deploy each manually from `main`:

- [ ] **ask-chat** (live admin API for Cost & Control; also writes the `ask_turns` ledger):
  ```bash
  cd workers/ask-chat && npx wrangler deploy
  ```
- [ ] **dashboard-refresh** (the daily snapshot builder):
  ```bash
  cd workers/dashboard-refresh && npx wrangler deploy
  ```
  Note the **`*.workers.dev` URL** it prints — you'll use it in Step 7.
- [ ] **mcp-server** (starts the external tool-call collector — ⏰ not retroactive, history begins now):
  ```bash
  cd workers/mcp-server && npx wrangler deploy
  ```

---

## Step 7 — Hydrate

The snapshot is built by the daily **06:00 UTC** cron. To see data **immediately** instead of waiting:

- [ ] **Trigger a refresh now** (requires `REFRESH_KEY` from Step 5):
  ```bash
  curl "https://concerts-dashboard-refresh.<your-subdomain>.workers.dev/?key=<REFRESH_KEY>"
  ```
  It returns the full snapshot JSON it just wrote to KV. *(Use the workers.dev URL from Step 6.)*

- [ ] **(optional) Preview with sample data before real data exists** — seed the bundled sample so you
  can click through the UI right away:
  ```bash
  cd workers/dashboard-refresh
  npx wrangler kv key put dashboard:snapshot --path=sample-snapshot.json --namespace-id=<KV_ID>
  ```
  The next real refresh overwrites it.

---

## Step 8 — Verify

- [ ] Visit **`https://concerts.morperhaus.org/dashboard`** → you should hit a **Google login** (Access),
  then land on the **Overview**.
- [ ] Check the **Source status** strip at the bottom of Overview. Each source should read **`ok`**
  (or `not_configured` for anything you intentionally skipped, e.g. `github`).
- [ ] If any source shows **`error`**, note which one and the **"Partial data"** banner text, and send it
  to me — that's the expected place for a first-hydration **schema mismatch** (see below) and I'll patch it.

---

## What to expect after hydration

### Lights up immediately (first refresh — server-side data we already have)
- **Overview** — spend vs cap, traffic (Cloudflare), ask volume + topics, the **Reliability** glance.
- **Cost & Control** — live mode toggle, current-day spend, admin-IP list, tripwire status (ask-chat admin API).
- **Topics & Gaps** — intent mix, most-asked topics, **content gaps & wishlist**. *(`ask_turns` is already
  live in prod, so this has real data the moment the worker is deployed + KV bound.)*
- **Archive Health** — coverage bars per enrichment stage (from `public/data`).
- **MCP & Ask** — the **in-SPA** side is real; the **external** side reads *"pending instrumentation"*
  until external MCP clients start hitting the freshly-deployed `mcp-server` (then it grows over days).

### Fills in once GA is configured (Step 4) — and accrues over days
- **Engagement** tab — scenes, search, **what's-getting-clicked** (artists/venues/songs/setlists), device split.
- **Overview GA panels** — channels / countries / pages / referrers.
- **Trends** — the **sessions** and **spend** lines back-fill ~30 days immediately (those metrics are
  retroactive); the **MCP** line accrues forward.
- **Demand × Coverage** quadrant — populates once the `artist_name` dimension has data.

### ⏰ Not retroactive — these start near-empty and grow forward
- The 7 GA **custom-dimension** breakdowns (what's-getting-clicked, search terms, Ask-as-navigation,
  Demand×Coverage) collect only from the moment you registered the dimensions in Step 4a.
- **External MCP tool-calls** (`mcp_queries`) collect only from the `mcp-server` deploy in Step 6.
- So give the click-level panels **a few days to a couple of weeks** to look meaningful.

### Stays "pending" on purpose (out of scope this round)
- Topics & Gaps **zero-result searches** and **suggested-prompt CTR** — these need two extra GA
  dimensions (`results_found`, `prompt`) that aren't in the planned 7. The panels carry a note saying so.

### Expect one shake-out pass
Phases 3–6 were all built and validated against `sample-snapshot.json`, never against live API
responses. The GA Data API field names, the CF GraphQL **5xx** dataset, and the GitHub shapes are
verified against docs, not live calls — so **budget for one short "schema reconciliation" pass** after
the first real refresh. The **Source status** strip and **Partial data** banner are exactly how you'll
spot it: any source showing `error` is a field-name tweak away from green. Send me what's red and I'll
fix it fast.

### Ongoing
- The cron rebuilds the snapshot every **06:00 UTC**. A snapshot older than **26h** shows a **stale**
  badge. One dead source never blanks the page — it just shows that section as pending and lists the
  error in the banner.

---

## Quick checklist (tear-off)

```
[ ] 0. Merge PR #184 → git pull main
[ ] 1. wrangler kv namespace create CONCERTS_DASHBOARD → paste id in wrangler.toml + bind on Pages
[ ] 2. Create CF API token (Account Analytics:Read) → wrangler secret put CF_API_TOKEN
[ ] 3. Add /dashboard* to the existing Access app (email mike@morper.net)
[ ] 4a. Register the 7 GA custom dimensions   ⏰ not retroactive
[ ] 4b. wrangler secret put GA_PROPERTY  (9-digit id)
[ ] 4c. wrangler secret put GA_SA_KEY_JSON  (+ optional GA_IMPERSONATE_SUBJECT)
[ ] 5. (optional) GH_TOKEN · REFRESH_KEY · NOTIFY_WEBHOOK_URL
[ ] 6. wrangler deploy: ask-chat · dashboard-refresh · mcp-server   ⏰ mcp-server not retroactive
[ ] 7. curl the workers.dev /?key=REFRESH_KEY  (or wait for 06:00 UTC)
[ ] 8. Open /dashboard, log in, check Source status = ok
```
