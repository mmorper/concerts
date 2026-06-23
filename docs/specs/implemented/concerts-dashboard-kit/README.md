# Concerts Operator Dashboard — Port Kit

A self-contained bootstrap package for building an operator dashboard for
**Morperhaus Concerts** (`concerts.morperhaus.org`), ported from the proven
Pitch dashboard (`pitch.morperhaus.org/dashboard/`).

It is **not** about concert data (artists/venues/setlists). It is an operator
console: **web traffic, SPA engagement, MCP usage, and Anthropic/Cloudflare
cost & infra.**

## What's in here

| File | What it is |
| --- | --- |
| `concerts-dashboard-spec.md` | **The spec — source of truth.** Architecture, the KV data contract, the four data sources, phased implementation plan, GA setup appendix. Start here. |
| `worker-starter/src/index.ts` | The refresh Worker, adapted from Pitch. The GA JWT/OAuth engine + CF Analytics + KV snapshot pattern are **ready to use**; Anthropic + MCP + custom-event fetchers are stubbed with `TODO(concerts)` markers. |
| `worker-starter/wrangler.toml` | Worker config (cron + KV binding + secrets registry), with Concerts placeholders. |
| `data-endpoint.ts` | The KV→JSON read endpoint, in two forms (Pages Function **and** Worker-route handler) — pick the one that matches how the SPA is served. |

## How to use it (hand this to Claude Code in the Concerts repo)

1. Copy this whole folder into the Concerts repo, e.g. `docs/specs/future/`
   for the spec and `workers/dashboard-refresh/` for the starter.
2. Open a fresh Claude Code session **in the Concerts repo** and paste the
   "Implementation Quick Start" prompt from the top of `concerts-dashboard-spec.md`.
3. That prompt deliberately begins with a **codebase-audit phase** (Phase 0):
   Claude inventories how the SPA is served, where GA/gtag is configured, how
   Anthropic is called, whether AI Gateway is in use, and where MCP queries
   could be logged — then fills the four `DISCOVER` blanks in the spec before
   writing code. This is where your "recommend additional admin telemetry"
   ask lives.

## The five things only you / the Concerts repo can resolve

The spec marks each of these `DISCOVER` — Claude resolves them from the repo in
Phase 0, except where noted you must supply a credential:

1. **GA4 property ID** for `concerts.morperhaus.org` (find the `G-XXXXXXX`
   measurement ID in the SPA's gtag config → map to its numeric property ID).
2. **How the SPA is served** (Worker-rendered vs Pages) → which `data-endpoint.ts`
   variant to use and where the dashboard route lives in the React app.
3. **The custom GA4 event taxonomy** the SPA already fires (event names + params
   for "scenes": timeline / venues / artists / ask / search / etc.).
4. **Anthropic spend path** — AI Gateway (recommended; unlocks CF-side cost
   analytics) **or** direct Anthropic Admin API (needs an `sk-ant-admin…` key).
5. **Where MCP queries get logged** so both SPA and external (Claude) clients are
   captured — Analytics Engine / D1 / KV. Almost certainly requires *adding*
   instrumentation to the MCP Worker.

## What carries over for free (do not rebuild)

- The GA service account `pitch-dashboard-ga@pitch-analytics-mcp.iam.gserviceaccount.com`,
  its domain-wide-delegation authorization, and the `pitch-dashboard-readers@morper.net`
  Google Group **already have account-level Viewer on the GA account** — which
  includes the Concerts property. So GA auth is config-only: new property ID,
  same key. (Verify with the one-liner in the spec's GA appendix.)
- The same Cloudflare account + a CF Analytics:Read token.
- The same Cloudflare Access + Google-SSO auth model (just point the policy at
  `concerts.morperhaus.org/dashboard*`).

## What gets ripped out vs. Pitch

Gone: app downloads / DMG-ZIP / auto-update / install base / release mirror /
code-coverage / the hand-authored Pitch "Strategy" tab (compass, milestones,
release cadence). Concerts is a web app — none of that exists.
