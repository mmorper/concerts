# Ask the Archive — Observability & Discoverability

**Status:** Implemented (branch `ask-analytics-and-seo`, PR pending)
**Target Version:** next (post-v4.7.0)
**Priority:** Medium
**Estimated Complexity:** Medium (two workers + frontend events + static SEO files)
**Dependencies:** Builds on Epic #138 (Ask the Archive chat, #139–#143) and the MCP server (#102).
**Tracking issues:** #153 (analytics), #154 (spend alerts), #155 (AI discoverability) — all under Epic #138.

> **Note on provenance.** This spec was **reverse-engineered after implementation** to restore the
> audit trail (spec → issues → code) that the work skipped. It documents what shipped and *why*,
> including the decisions deliberately deferred. Treat it as the record of built behavior, not a
> forward plan.

---

## Executive Summary

The in-app chat (#138) and the MCP server (#102) are live, but three operational gaps remained once
they shipped:

1. **We couldn't see engagement or spend over time.** The `SpendCounter` DO enforces *today's* cap
   and forgets at the UTC rollover; question text was never stored. So "what do people ask, how
   much does it cost, how often" had no data source.
2. **Spend alerting was thin.** A single 80% webhook tripwire on the chat worker; the MCP `query`
   cap had no alert at all.
3. **AI agents couldn't discover the tools.** `llm.txt` never mentioned MCP or `/ask`; there was no
   `llms.txt`; the landing pages weren't in the sitemap.

This effort closed all three, with a deliberate eye toward a future `/dashboard` that will curate
this telemetry into a friendlier view than raw GA4 / Cloudflare consoles.

---

## Problem 1 — Engagement & Spend Analytics (#153)

### What was built

**Backend — a durable per-turn ledger → Cloudflare Analytics Engine** (`dataset = ask_turns`):

- `workers/ask-chat/src/telemetry.ts` (new) exposes `logTurn(env, turn)`, wired into the pump in
  `index.ts` so **exactly one row writes on every exit path** — `answered`, `deterministic`,
  `refused`, `cap`, `paused`, `error`. The outcome is threaded through the branches and written once
  in `finally`.
- **Row schema** (queryable via the Analytics Engine SQL API):
  - `blob1` = day (UTC), `blob2` = query text (≤512 chars), `blob3` = primary exhibit kind,
    `blob4` = outcome; `index1` = outcome (sampling/group key).
  - `double1–4` = input / output / cache-create / cache-read tokens; `double5` = cost µUSD;
    `double6` = spend fraction of the daily cap.
- The binding is **optional** (`ASK_ANALYTICS?`): absent in dev/test → `logTurn` is a no-op. It
  never throws into the request path (the answer has already streamed by the time it runs).

**Why Analytics Engine (not the DO, not KV):** the DO is a *ceiling enforcer*, not a historian — it
intentionally drops yesterday. Analytics Engine is free-tier, append-only, and SQL-queryable, which
is exactly what a spend/query *history* and a future dashboard need.

**Client — new GA4 events** (join the 9 existing ask events):

| Event | Params | Answers |
|-------|--------|---------|
| `ask_suggested_prompt_clicked` | `prompt`, `position` | Which canned prompts get used |
| `ask_closed` | `reason` (`promote`/`dismiss`), `turn_count` | Dwell (open→close), how far people get |
| `ask_error` | `reason` (`session_required`/`rate_limited`/`request_failed`/`stream`) | Friction |
| `ask_refused` | `turn_index` | Off-topic / cap-hit rate (distinct from errors) |

### Deferred (by design)

A public `/api/ask/stats` read endpoint was **not** built. The codebase deliberately keeps spend $
behind Cloudflare Access (`/api/ask/admin`); a public stats route would leak it. The future
`/dashboard` reads `ask_turns` via the Analytics Engine SQL API (server-side, with a CF token) and
client engagement via the GA4 Data API. If a live worker-number endpoint is wanted later, gate it
behind the same Access app as `/admin`.

---

## Problem 2 — Spend Alerting (#154)

### What was built

**Ask-chat worker — multi-threshold alerts** (`workers/ask-chat/src/notify.ts`):

- Milestones at **50 / 75 / 100%**, each latched once per day (`tripwire:{day}:{pct}` in
  `ASK_CONTROL` KV).
- Fires only the **highest crossed-but-unlatched** milestone per turn, so a single 0→100% jump
  sends one "100%" alert rather than three. Climbing gradually fires each level once.
- The 100% message reads "budget spent — Ask will refuse until tomorrow".

**MCP server — query-cap tripwire** (`workers/mcp-server/src/data.ts`):

- The `query` escape hatch ($10/mo, separate worker) previously refused silently at its cap. Now
  `recordQueryUsage` fires a once-a-day warning when usage crosses **80%** of either the token or
  call ceiling (latched in `MCP_QUERY_USAGE` as `query-tripwire:{day}`).
- Added optional `NOTIFY_WEBHOOK_URL` to the MCP worker's `Env`.

### Email vs. webhook (decision)

Transport stays the existing `NOTIFY_WEBHOOK_URL` push (ntfy/Pushover-style) — zero new infra. **To
receive alerts as email, point the webhook at an ntfy topic with email notifications enabled** (or
any webhook→email relay). Sending real email from the worker (Resend/MailChannels) is a possible
follow-up, not done here. **Recommended backstop:** an account-level billing alert in the Anthropic
Console — these tripwires watch the *self-imposed* caps, not the real bill.

---

## Problem 3 — AI Discoverability / SEO (#155)

### What was built

- **`public/llms.txt`** (new): concise link-index in the llmstxt.org format (H1 + blockquote summary
  + sectioned links) — the plural path crawlers actually probe. Points to the MCP server, `/ask`,
  the full `llm.txt`, and the data endpoints.
- **`public/llm.txt`**: new top-level **"AI Access (MCP Server & Ask the Archive)"** section right
  after the Overview — lists the MCP endpoint, all 9 tools + the `query` hatch, and the `/ask` chat,
  with the grounding caveat ("one person's history → 'not in the archive' = 'not attended'"). The
  prose sections of `llm.txt` are hand-maintained; `scripts/update-meta-tags.ts` only patches its
  stats block, so the new section persists across data refreshes.
- **`scripts/generate-sitemap.ts`**: added `/ask` (0.7) and `/mcp/about` (0.6); `sitemap.xml`
  regenerated to 501 URLs.
- **`public/robots.txt`**: a discovery-pointer comment to the AI docs + MCP endpoint. Already
  `Allow: /`; `/api/` (incl. the SSE backend) stays disallowed.

---

## Files Changed

**`workers/ask-chat/`** — `src/telemetry.ts` (new), `src/index.ts`, `src/types.ts`, `src/notify.ts`,
`wrangler.toml`
**`workers/mcp-server/`** — `src/data.ts`, `src/types.ts`
**Frontend** — `src/components/ask/AskConversation.tsx`, `src/components/ask/AskProvider.tsx`,
`src/hooks/useAskArchive.ts`
**SEO / static** — `public/llms.txt` (new), `public/llm.txt`, `public/robots.txt`,
`public/sitemap.xml`, `scripts/generate-sitemap.ts`

---

## Validation

- `tsc --noEmit` passes for `workers/ask-chat`, `workers/mcp-server`, and the frontend.
- `npm run generate:sitemap` regenerates cleanly with the two new entries verified present.

---

## Deployment Notes

Frontend + `llm.txt` / `llms.txt` / `sitemap.xml` / `robots.txt` auto-deploy on merge. The workers
deploy **manually**:

- **ask-chat:** `cd workers/ask-chat && npx wrangler deploy` — the `ask_turns` Analytics Engine
  dataset is created automatically on deploy (no migration).
- **mcp-server:** `npm run deploy:mcp-server`.
- **Alerts:** optional — `npx wrangler secret put NOTIFY_WEBHOOK_URL` in each worker dir. Absent →
  tripwires are log-only.

---

## Future Work / Dashboard Hook

This telemetry is the feedstock for the planned `/dashboard`:

- **Worker metrics** (queries, spend trend, top exhibit kinds, refusal/cap rates) → Analytics Engine
  SQL API over `ask_turns`.
- **Client engagement** (opens by surface, dwell, suggested-prompt usage) → GA4 Data API.
- If live worker numbers are surfaced, do it via an **Access-gated** endpoint (mirror `/admin`),
  never a public route.
