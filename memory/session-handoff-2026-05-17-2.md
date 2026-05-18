# Session Handoff — 2026-05-17 (afternoon/evening session)

Picks up from `session-handoff-2026-05-17.md` (the morning handoff written before this session). This session **shipped W1** end-to-end and **resolved every open architectural question for W2**. The MCP epic is now fully de-risked for implementation.

## What Was Completed

### W1 (#104) — meta-injector restructure + caching — shipped to production

PR [#118](https://github.com/mmorper/concerts/pull/118) merged (squash commit `619a720`). Worker version `d3706583` live on production.

- Moved `workers/meta-injector.js` → `workers/meta-injector/worker.js` and `workers/wrangler.toml` → `workers/meta-injector/wrangler.toml` (`main = "worker.js"`). Creates room for `workers/mcp-server/` in W2.
- Added `cachedJsonFetch(url, ctx)` helper using `caches.default` (300s TTL, `ctx.waitUntil(cache.put(...))`). All 10 same-origin JSON fetches now go through it; `ctx` threaded through 8 inject functions.
- Updated `package.json` `deploy:worker` to use `npx wrangler` (discovered mid-session that `wrangler` wasn't on the local PATH — `npx` works whether globally installed or not).
- Updated active doc refs: `workers/README.md`, `docs/SEO.md`, `docs/BUILD.md`, `.claude/commands/seo.md`.
- New scratch file [`docs/specs/future/mcp-test-anchors.md`](../docs/specs/future/mcp-test-anchors.md) — test anchors for W3 (#106) + `venues-metadata.json` field inventory for `get_venue_history`.

**Verification**: byte-identical curl responses pre/post-deploy on 5 probes (Googlebot UA on `/`, `?scene=artists`, `?scene=venues`, `?scene=geography`, human UA passthrough). `wrangler tail` CPU sample: cold first-hit 14ms, warm 5–9ms, p99 14ms, over-10ms rate dropped from spike #110's 2/3 → 2/12.

### MCP spec amendment landed — agentic layer + query escape hatch

Commit `a3a29f2` then `ce3b886` on `main`. Added "Addendum 2026-05-17: Agentic Layer" section at the top of [`docs/specs/future/global-mcp-server.md`](../docs/specs/future/global-mcp-server.md) (after the scope-lock section). The amendment is self-contained — it does not modify the "6 Tools" section below it.

Covers:
- **Three-layer tool classification** — deterministic (4 tools) / build-time-enriched hybrid (2 tools) / runtime LLM (1 tool, the new `query` escape hatch).
- **Build-time narration pipeline** — `scripts/generate-narrations.ts` writes `public/data/narrations/{venues,artists}.json`; per-entity hash gate; decoupled from `build-data`.
- **Resolved decision on `query` escape hatch** — IN scope for v1 under hard $10/month cap; 250K tokens/day + 8 calls/day; KV-backed enforcement (see Key Decision #3 below for the full pattern).
- **W2 (#105) scope changes** — narrations data-access helper, new generation script, KV namespace declaration, prompt file location.
- **Cost model** — ~$30–50/year build-time + ~$108/year worst-case query = ~$150/year all-in.

Cross-comments posted on epic #102: [first](https://github.com/mmorper/concerts/issues/102#issuecomment-4472792611) (initial amendment) and [second](https://github.com/mmorper/concerts/issues/102#issuecomment-4472875225) (query resolution).

## Releases Shipped

(none this session — the Worker deploy via `npm run deploy:worker` is not a versioned release; it's a direct edge-Worker push. Repository version stays at v4.6.1.)

## In Progress / Pending

Nothing actively in flight — clean stopping point.

Two small follow-ups that are tomorrow's-coffee-quick:

- **Verify Haiku 4.5 pricing** before W2 implementation. Spec assumes $1/MTok input, $5/MTok output. Check https://www.anthropic.com/pricing — if drifted, update cap math at [`docs/specs/future/global-mcp-server.md:121`](../docs/specs/future/global-mcp-server.md#L121) (worst-case calc) and re-derive token cap if needed.
- **Owner verify on #113 (carried over)**: confirm Google Cloud Console HTTP referrer restrictions on the 2 client-side API keys, then close GH secret-scanning alerts #1 and #2 as design-intentional.

## Key Decisions

1. **MCP adopts a three-layer architecture, not "runtime LLM everywhere."** Deterministic tools for counts/filters/lookups (4 tools); hybrid (deterministic list + build-time-baked narration) for `get_artist_history` and `get_venue_history`; runtime LLM only for the new `query` escape hatch. **Why**: runtime LLM-on-every-call would add 500ms–2s latency and ~$0.04/call to a personal-scale archive that's already up against a 10ms free-tier CPU ceiling. The asymmetric data (most queries are deterministic, narration sounds formulaic from templates) made the three-layer split natural.

2. **Build-time agentic narration, hash-based per-entity, decoupled from `build-data`.** Haiku writes prose into `public/data/narrations/{venues,artists}.json`; each entity stores `{narration, inputHash, generatedAt, promptVersion}`. `npm run generate:narrations` regenerates only entities whose hash drifted. **Why**: the dataset is nearly static (182 concerts, adds ~handful/year). Cadence-based regen is wasteful. Hash-based is self-correcting + cost-amortized — steady state $0, new concert $0.04, prompt rewrite $13. NOT wired into `build-data` so the default pipeline stays Anthropic-free.

3. **`query` escape hatch IN scope for v1 with hard $10/month ceiling.** Dual daily caps (250K tokens + 8 calls, whichever trips first), enforced by the MCP Worker via Cloudflare KV. Pre-flight read refuses if over; post-flight write via `ctx.waitUntil`. KV is eventually-consistent so a one-call overage at the boundary is possible — acceptable at this scale; revisit with Durable Objects if usage justifies. **Why**: covers freeform questions the 6 tools can't ("artists I've seen in both LA and SF in the same year") without unbounded cost. Owner explicitly chose this with the $10/month constraint.

4. **W1 caching gains are real but smaller than the cross-comment predicted.** Cross-comment on #110 said 16ms → 2-3ms; actual is 16ms → 14ms cold / 5-9ms warm. `caches.default` skips the fetch but not the `JSON.parse`. Documented honestly in the PR body. Architecture risk reduced from "consistent ≥10ms" to "occasional" — enough for W2 to coexist on free tier. Further gains would need an in-isolate parsed-JSON cache; out of W1 scope.

5. **`mcp-test-anchors.md` placed at `docs/specs/future/` for W3 pickup.** Includes `venues-metadata.json` field inventory which flagged that **`capacity`, `neighborhood`, and `description` are not in the schema** — narration template can't depend on them. This finding directly motivated Key Decision #2 (build-time agentic narration over template-only narration).

## Relevant GitHub Issues

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #102 | [Epic] Morperhaus MCP Server | Open (substantively re-scoped) | Two cross-comments added today. Amendment landed in spec. |
| #104 | [MCP W1] Directory restructure + test anchors | **Closed (PR #118 merged)** | Site response unchanged + CPU sample documented |
| #105 | [MCP W2] Scaffold + data layer | Open, **fully de-risked** | Scope expanded by amendment: KV namespace, narrations data access, query prompt file |
| #106 | [MCP W3] Implement all 6 tools | Open, blocked on W2 | Test anchors recorded for it in `mcp-test-anchors.md` |
| #107 | [MCP W4] Polish, deploy, verify | Open, blocked on W3 | |
| #108 | [Epic] Architecture Risk Review Sprint | Open, substantively complete | Could close after summary table fill-in. All 5 spikes closed in prior session. |
| #114, #115, #116 | Plain follow-ups from architecture review | Open | Parallel work, untouched today |
| #117 | PR: rubric + handoff | Merged earlier | |
| #118 | PR: W1 restructure + caches.default | **Merged this session** (squash `619a720`) | |

## Next Steps for Next Session

In recommended order:

1. **Verify Haiku 4.5 pricing** (5 min) — quick check at https://www.anthropic.com/pricing. If pricing drifted from $1/MTok in / $5/MTok out, update the spec's cap math and rederive the 250K-token/day cap if needed. Cleanest done before touching W2 code.

2. **Close epic #108** (5 min) — architecture risk sprint substantively complete (all 5 spikes closed). Fill in the issue's summary table with final spike outcomes, close. Houseclean.

3. **Start W2 ([#105](https://github.com/mmorper/concerts/issues/105))** — branch off `main`:
   ```bash
   git checkout main && git pull
   git checkout -b mcp/w2-scaffold
   ```
   Spec checkpoint: read the "Addendum 2026-05-17: Agentic Layer" section of `docs/specs/future/global-mcp-server.md` end-to-end before starting; it has the full data-layer + tool-layer + query-tool wiring. Then in approximate dependency order:
   - **Scaffold** `workers/mcp-server/` directory. Look at `workers/meta-injector/` for the deployment pattern (wrangler.toml shape, package.json `deploy:worker` style).
   - **Wrangler config** — declare `MCP_QUERY_USAGE` KV namespace, add `mcp.morperhaus.org/*` route (or `concerts.morperhaus.org/mcp*` per the spec's "Deployment" section).
   - **Set ANTHROPIC_API_KEY as a wrangler secret** — `cd workers/mcp-server && npx wrangler secret put ANTHROPIC_API_KEY`.
   - **Data-access helpers** — read `concerts.json`, `venues-metadata.json`, etc. with the same `caches.default` pattern from W1. Add `getNarration(kind, slug)` that reads `narrations/{kind}.json` and returns `null` on miss.
   - **`scripts/generate-narrations.ts`** — the build-time narration generator. Hash design is in the spec; venues hash inputs and artists hash inputs are both listed. Output to `public/data/narrations/{venues,artists}.json`. Add `npm run generate:narrations` script. Do NOT wire it into `build-data`.
   - **`workers/mcp-server/prompts/query.md`** — runtime query tool prompt. Includes refusal patterns for non-archive questions + "I think..." output framing.

4. **Optional parallel anytime** — issues #114, #115, #116 (no spike methodology needed); owner verify on #113.

## Files to Know About

- [`docs/specs/future/global-mcp-server.md`](../docs/specs/future/global-mcp-server.md) — **read this first**. The "Addendum 2026-05-17: Agentic Layer" section near the top supersedes/clarifies the "6 Tools" section below it. The amendment is the source of truth for W2 scope.
- [`docs/specs/future/mcp-test-anchors.md`](../docs/specs/future/mcp-test-anchors.md) — test anchors for W3 + `venues-metadata.json` field inventory (narration-usable field population analysis).
- [`workers/meta-injector/worker.js`](../workers/meta-injector/worker.js) — reference for the `cachedJsonFetch(url, ctx)` pattern W2 should reuse. Look at lines 47-62 for the helper definition.
- [`workers/meta-injector/wrangler.toml`](../workers/meta-injector/wrangler.toml) — reference for the deployment shape (account ID, env stanza). MCP Worker's `wrangler.toml` will mirror this pattern + add KV namespace.
- `.env` — has `CLOUDFLARE_API_TOKEN` and `ANTHROPIC_API_KEY`. Source before any wrangler commands: `set -a && source .env && set +a`.

## Environment Notes (carried forward)

- Working tree clean on `main`; up to date with `origin/main` (post-merge fast-forward done).
- `wrangler` is NOT installed globally on this Mac. Use `npx wrangler ...` everywhere. The W1 deploy script now uses `npx`.
- Untracked dirs `.claude/projects/`, `docs/specs/future/hyperframes-poc/`, `video/` are pre-existing and not in scope for the MCP work — leave alone.
- User in mid-transition from iPad+Codespaces to local macOS+Claude Code CLI (per [[project-dev-environment-transition]]). Expect occasional local/cloud state mismatches.
- HyperFrames pilot remains paused (per [[project-hyperframes-pilot-paused]]) — out of MCP-work scope.
