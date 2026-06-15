# Session Handoff — 2026-06-15

Supersedes `session-handoff-2026-05-17-2.md`. That handoff predates **two** developments it has no awareness of: the cloud data-enrichment workstream (PR #119, opened 2026-06-13) and the start of MCP W2 (scaffold, which sat uncommitted on this Mac until today). This session re-orients around both and locks a go-forward sequence.

Context: owner is back on local macOS + Claude Code CLI after a stretch of iPad/cloud work (per [[project-dev-environment-transition]]). Today opened with stranded local work and git confusion — now resolved.

## What Was Completed This Session

### Rescued the MCP W2 scaffold (was local-only, uncommitted)

The `workers/mcp-server/` scaffold existed only in this Mac's working tree — never committed, never pushed, no PR. Now safe:

- Commit `3e87d58` `feat(mcp): scaffold W2 MCP server worker (#105)` — `workers/mcp-server/` source (`index.ts`, `data.ts`, `tools.ts` stub, `types.ts`, `prompts/query.md`, `wrangler.toml`, `tsconfig.json`), the `deploy:mcp-server` npm script, and a +5-line spec edit. `node_modules`/`package-lock.json` correctly gitignored.
- Discarded stale `public/data/*.json` local edits (branch was ~30 commits behind `main`'s automated refreshes — working-tree copies were just older).
- Merged `origin/main` (merge `33c3169`, no conflicts — scaffold and data refreshes touched disjoint files).
- Pushed `mcp/w2-scaffold` — it now exists on GitHub and tracks `origin/mcp/w2-scaffold`. Plain `git pull` works there now.

### Git hygiene fixed

`mcp/w2-scaffold` had no upstream (the cause of the morning's `git pull` failure). Upstream now set.

## Two Active Workstreams

### 1. Cloud data-enrichment pipeline → GitHub Actions — **PR #119, code-complete**

Moves the weekly data refresh and liner-notes generation off the local machine into GitHub Actions (built as Actions, **not** Cloudflare Workers — pipeline needs puppeteer/sharp/googleapis). Two independent workflows: `data-refresh.yml` (Mondays 07:00 UTC, $0, no Anthropic) and `liner-notes.yml` (Mondays 08:00 UTC, the only Anthropic spend, commits prose to `main` with no review gate). +182/−37 across 3 files. Open, non-draft.

- **Nothing left to write — it's a config + merge task.** Activation steps tracked in **issue #120** (in order: add ~11 repo secrets → enable failure email → merge → smoke-test both workflows).
- Spec: `docs/specs/future/scheduled-data-pipeline-refresh.md`.

### 2. MCP Server — epic #102

| Window | Issue | Status |
|--------|-------|--------|
| W0 transport POC | — | ✅ done |
| W1 restructure + caching | #104 | ✅ shipped (PR #118) |
| W2 scaffold + data layer | #105 | 🟡 **~70%** — scaffold landed today; `index.ts` still missing the W2 acceptance items: CORS headers, `explore_archive` prompt, runtime error wrapper. `wrangler dev` not yet verified. `tools.ts` is an intentional stub (tools are W3). |
| W3 all 6 tools + Vitest | #106 | ⬜ not started (the core build) |
| Agentic layer | (in #105 addendum) | ⬜ `scripts/generate-narrations.ts` (build-time Haiku narration, hash-based regen) + runtime `query` tool (Anthropic + KV-capped $10/mo) |
| W4 polish + deploy | #107 | ⬜ deploy, README, Claude Desktop, live E2E |

## Go-Forward Sequence (decided this session)

**Finish #119 first, then resume MCP.** Rationale: #119 is code-complete (a today-sized config+merge task) vs MCP having the bulk of its build ahead; it removes the local-machine dependency that caused today's stranded-work problem; and it provisions `ANTHROPIC_API_KEY` + the Actions runner that the MCP **agentic layer** will later reuse.

1. **#119** — work issue #120: add secrets → enable failure email → merge → smoke-test (Data Refresh run + Liner Notes `dry-run`). Confirm owner still accepts liner-notes committing to `main` with no review gate.
2. **MCP W2 finish** — add CORS + `explore_archive` prompt + error wrapper to `index.ts`, verify `wrangler dev`, open the W2 PR from `mcp/w2-scaffold`.
3. **MCP W3 (#106)** — the 6 tools + Vitest snapshots (test anchors in `docs/specs/future/mcp-test-anchors.md`).
4. **MCP agentic** — `generate-narrations.ts` + `query` tool (reuses #119's `ANTHROPIC_API_KEY`).
5. **MCP W4 (#107)** — deploy, README, Claude Desktop, E2E.

## Carried-Over Follow-ups (still valid)

- **Verify Haiku 4.5 pricing** before the agentic layer — spec assumes $1/MTok in, $5/MTok out at [`global-mcp-server.md:121`](../docs/specs/future/global-mcp-server.md#L121). Re-derive the 250K-token/day cap if drifted.
- **Close epic #108** (architecture risk sprint — substantively complete, all 5 spikes closed; fill summary table).
- **Owner verify #113** — Google Cloud Console HTTP referrer restrictions on the 2 client-side keys, then close secret-scanning alerts #1/#2 as design-intentional.

## Environment Notes

- `wrangler` is NOT installed globally — use `npx wrangler ...`. The `deploy:worker` and `deploy:mcp-server` scripts already use `npx`.
- `.env` has `CLOUDFLARE_API_TOKEN` and `ANTHROPIC_API_KEY`. Source before wrangler commands: `set -a && source .env && set +a`.
- Branch `mcp/w2-scaffold` now pushed and tracking `origin/mcp/w2-scaffold`.
- Untracked dirs (`.claude/projects/`, `docs/specs/future/hyperframes-poc/`, `video/`, `public/data/narrations/`) are out of scope — leave alone. HyperFrames pilot remains paused (per [[project-hyperframes-pilot-paused]]).
