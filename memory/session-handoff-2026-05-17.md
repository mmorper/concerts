# Session Handoff — 2026-05-17

Long session that started in HyperFrames pilot territory and pivoted to closing out the architecture risk review sprint. **W1 (#104) is now unblocked** — the architecture risk sprint is substantively complete.

## What Was Completed

### HyperFrames video pilot — shelved with full preservation

- Built and rendered the Social Distortion Thread pilot with audio track added (`09f065d` on `pilot/hyperframes-poc`)
- Tagged the final pilot state for permanent reference: `pilot/social-distortion-thread-v1` at `09f065d`
- Branch `pilot/hyperframes-poc` left intact on origin, unmerged (per pilot review workflow #100)
- Created `.claude/context.md` "Paused Initiatives" section so the pilot is discoverable from the standard project entry-point doc (`c8fa476`)
- Pattern library + postmortem + handoff doc all already on the pilot branch from previous work

### MCP architecture risk sprint — closed

All 5 spikes ran and closed today:

- **#113** (secrets-leak audit) — **Medium**: 2 Google API keys in history are intentional client-side keys per Google's spec; protected by HTTP referrer restrictions. Owner needs to verify Cloud Console restrictions still intact, then close GH alerts #1 and #2 as design-intentional.
- **#109** (API key exposure) — **Critical-by-rubric, accepted as bounded risk**: Ticketmaster key confirmed in production JS bundle (`g2RyG…lE7B0`). Public-tier API has no referrer restrictions available, only 5000/day rate limit. Decoupled from MCP scope (no Worker proxy filed) per the scope lock below. Setlist.fm NOT in bundle — different finding, skipped per owner.
- **#110** (cold-start CPU) — **Critical, caching folded into W1**: Live `wrangler tail` measurement showed venue-route CPU at 11–16 ms (over 10 ms free-tier limit) on 2 of 3 venue probes. Artist routes 3–5 ms. `caches.default` work joins W1 scope (#104) rather than separate follow-up.
- **#111** (route collision) — **Waived**: Empirically verified by deploying a stub Worker at `concerts.morperhaus.org/spike-111-test*` on the production zone. All 4 probes returned the expected Worker. CF route specificity works as documented. Stub deployed, tested, deleted with zero residual state. `mcp/*` route arrangement in the MCP spec is safe.
- **#112** (repo-bloat projection) — **Walked back to Medium-observation, no action**: Initially classified High at 52 MB pack growth in 70 days. Reframed under owner's three operational constraints (no app perf hit, no CF cost, easy rollback) — bloat affects developer/CI experience only, not the application. Driver is OG images for liner notes (not data JSON files as hypothesized). No follow-up filed; revisit triggers documented.

### MCP scope locked in spec

Added explicit "Scope (locked 2026-05-17)" section to `docs/specs/future/global-mcp-server.md` (`08af4ab`):

- ✅ In scope: query/filter/narrate over `public/data/*.json`
- ❌ Out of scope: outbound API calls to Ticketmaster, setlist.fm, Spotify, Google Places, etc.
- ❌ Out of scope: proxying or relaying any client-side key from the main site
- Dissolves the W1-blocking framing around the TM key leak

### PR #117 squash-merged

- Rubric + 05-10 sprint handoff merged to main (squash commit `229d826`)
- Branch `claude/architecture-risk-review-sTxNX` retained for issue-body URL stability (`deleteBranchOnMerge: false`)
- Added "Update 2026-05-17" note to top of 05-10 handoff (`0820f49`)

### Caching work folded into W1

- Cross-comment on #104 adding `caches.default` wrap to W1 scope
- Specific design: 300s TTL, `ctx.waitUntil(cache.put(...))` pattern, cache key derived from URL
- Expected p99 CPU drops from 16 ms → 2–3 ms

## Releases Shipped

(none this session)

## In Progress / Pending

Owner-facing follow-ups (low urgency, not blocking):

- **#113**: verify Google Cloud Console that HTTP referrer restrictions are still intact on the 2 client-side API keys (`AIzaSyAl…TTik`, `AIzaSyCY…lyV9o`). Then close GH secret-scanning alerts #1 and #2 as "Used in tests" / "False positive — design intentional."
- **Secrets rotation (lower urgency)**: Google OAuth client secret + 2× refresh tokens were exposed in this conversation when `.env` was read mid-session. CF + Anthropic keys were rotated immediately. Google tokens / OAuth credentials still pending rotation.

## Key Decisions

1. **MCP scope locked as read-only over cached JSON** — no upstream API calls in the Worker. Codified in spec. Pre-empts scope creep toward "proxy upstream APIs through the MCP Worker." Dissolves the W1 blocking concern from #109.
2. **#109 classified Critical-by-rubric but accepted-as-bounded-risk** — Public-tier Ticketmaster API has no restriction options; the only protection is the 5000/day rate limit. Worst case = TM Tour Dates feature breaks intermittently if scraped. No PII, no financial exposure. Rotation deferred indefinitely; would just re-leak into next build.
3. **#112 reclassified Medium-observation from High** — original High classification was based on raw MB growth without considering whether the growth hits surfaces the user cares about. It doesn't (developer/CI git experience only). The "fixes" introduce build-time failure modes for benefits the user explicitly doesn't value.
4. **#110 caching scope joins W1 rather than a separate flight** — W1 already restructures the meta-injector; doing caching at the same moment = one coherent change, one test cycle, one rollback boundary, less risk surface.
5. **#111 verified empirically on the production zone, not via wrangler dev or staging hostname** — Modified the spike's approach to use a totally-safe path (`/spike-111-test*`) on the prod zone. Tests the real CF edge router with zero infra setup and zero production traffic impact. Stub deployed-tested-deleted in 15 minutes.
6. **PR #117 squash-merged with branch kept alive** — `deleteBranchOnMerge: false` on the repo, so issue-body branch-relative URLs continue to resolve indefinitely.
7. **HyperFrames pilot shelved with three durability layers** — git tag (immune to branch deletion), `.claude/context.md` "Paused Initiatives" section (discoverability), HANDOFF.md on the pilot branch (resumption instructions).
8. **`CLOUDFLARE_API_TOKEN` rotated mid-session due to `.env` exposure** — new token in `.env`, the old build token left untouched in CF Pages CI. Local dev and CI are now using separate tokens.

## Relevant GitHub Issues

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #102 | [Epic] Morperhaus MCP Server | Open (in-flight) | W1 next |
| #104 | [MCP W1] Directory restructure + test anchors | **Open, unblocked** | Caching work joined the scope per #110 finding |
| #105 | [MCP W2] Scaffold + data layer | Open | Blocked on W1 completion |
| #106 | [MCP W3] Implement all 6 tools | Open | Blocked on W2 |
| #107 | [MCP W4] Polish, deploy, verify | Open | Blocked on W3 |
| #108 | [Epic] Architecture Risk Review Sprint | Open (substantively complete) | All 5 spikes closed; epic can be closed after summary table fill-in |
| #109 | [Spike] API key exposure audit | **Closed today** | Bounded risk accepted |
| #110 | [Spike] Worker cold-start measurement | **Closed today** | Caching → W1 |
| #111 | [Spike] MCP route collision rehearsal | **Closed today** | Waived |
| #112 | [Spike] Repo-bloat projection | **Closed today** | Medium-observation, no action |
| #113 | [Spike] Git history secrets-leak audit | **Closed today** | Medium (intentional client-side keys); owner Cloud Console verify pending |
| #114, #115, #116 | Plain follow-ups from architecture review | Open | Parallel work, untouched |
| #117 | PR: rubric + handoff | **Merged today** (squash 229d826) | |
| #98, #99, #100 | HyperFrames pilot issues | Open | Pilot shelved separately |

## Next Steps for Next Session

W1 is the natural next move. Specific steps in priority order:

1. **Branch for W1**: `git checkout -b mcp/w1-restructure` off `main`
2. **Restructure the meta-injector**: move `workers/meta-injector.js` to a `workers/meta-injector/` directory layout (probably `workers/meta-injector/index.js` + companion files; W1 issue #104 has details — re-read it before starting)
3. **Add `caches.default` wrapper** around the JSON fetches (`venues-metadata.json`, `concerts.json`, any others). Cache key derived from URL or route. TTL 300s. Use `ctx.waitUntil(cache.put(cacheKey, response.clone()))` so cache population doesn't block the response.
4. **Test locally** via `wrangler dev` (auth is set up now — `CLOUDFLARE_API_TOKEN` is in `.env`)
5. **Deploy** via `npm run deploy:worker` (or `cd workers && wrangler deploy`)
6. **Verify** the CPU drop: rerun the `wrangler tail` + curl probes from spike #110 method. Confirm p99 CPU on venue routes drops from 16 ms → ~2-3 ms.
7. **PR to main**, ship.
8. **After W1 lands**: close epic #108 (architecture sprint complete, summary table filled in), start W2 (#105 MCP Worker scaffolding).

### Optional, parallel anytime

- Pick up #114, #115, #116 — plain follow-ups from the architecture review. No spike methodology needed.
- Owner verify on #113 + close GH alerts #1, #2

## Files to Know About

- **`docs/specs/future/global-mcp-server.md`** — has new "Scope (locked 2026-05-17)" section near the top. Read this first if anyone questions whether MCP should make outbound API calls — the answer is durably "no."
- **`workers/meta-injector.js`** — target of W1 restructure + caching. Currently has zero `caches.` references; that's the gap.
- **`workers/wrangler.toml`** — has the account_id for the production zone. Re-use for W1.
- **`memory/session-handoff-2026-05-10.md`** — prior sprint handoff. Has the rubric reference + suggested spike execution order (now all run).
- **`.claude/context.md`** — has both the "In-flight Gate (blocking MCP work)" block (gate state) and the new "Paused Initiatives" block (HyperFrames pilot). Standard session entry-point doc.
- **`.env`** — new `CLOUDFLARE_API_TOKEN` and `ANTHROPIC_API_KEY` (both rotated 2026-05-17 due to mid-session exposure). Don't `cat` this file in conversations going forward.

## Environment notes (for the picking-up session)

- User is mid-transition from iPad + Codespaces to local macOS + VS Code + Claude Code CLI. Some inconsistencies between local state and cloud state are expected.
- `wrangler` is now properly auth'd locally — `CLOUDFLARE_API_TOKEN` in `.env`. Source it (`set -a && source .env && set +a`) before any wrangler commands in Bash tool calls.
- `gh` CLI is auth'd via separate credentials (works independently).
- Working tree clean on `main`. Pilot work isolated on `pilot/hyperframes-poc` (untouched).
