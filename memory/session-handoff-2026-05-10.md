# Session Handoff — 2026-05-10

## What Was Completed

- **Architecture risk review** — full walkthrough of workers, services, build pipeline, data layout, MCP spec. Surfaced ~15 latent risks; cut to the ones worth tracking.
- **Spike rubric** — `docs/specs/future/architecture-risk-spike-rubric.md` (`9e28845`). Defines spike anatomy (5 sections), severity tiers (Critical/High/Medium/Low/Waived), and the stop rule.
- **Sprint epic** — #108, with all 8 child issues linked as sub-issues and a final summary table that gets filled in at sprint close.
- **5 spike issues** (each with hypothesis, method, pass/fail bar, time-box, deliverable): #109, #110, #111, #112, #113.
- **3 plain follow-up issues** for findings concrete enough to act on without spike methodology: #114, #115, #116.
- **PR #117** — opened against `main` for the rubric. NOT auto-merged (see decision #5 below).

## Releases Shipped

(none this session)

## In Progress / Pending

- **PR #117** awaits review/merge. Intentionally left open; see decision #5.
- **All 5 spikes pending execution.** Suggested order in epic #108. First up: #113 (45m).
- **Epic summary table** in #108 has placeholders to fill in as spikes close.

## Key Decisions

1. **Rubric is deliberately lightweight** — 5 sections per spike, 5 severity tiers, hard stop rule. The user pushed back on over-engineering ("I'm not trying to over engineer or feature creep this"). Resisted creating a heavier sprint apparatus (no separate retro doc, no Slack-style ceremony, no per-spike sub-spec). The rubric is the only meta-doc.
2. **Pass/fail bars are objective thresholds, not judgment calls.** This is forced by the single-maintainer constraint — no second reviewer means no room for "use your judgment" tiers. Every spike issue specifies measurable numbers (CPU ms, MB of pack growth, presence/absence of strings).
3. **Cut from the spike list** (deliberate, documented in epic #108 "Out of Scope"):
   - **Liner-notes pipeline cost/idempotency** — no evidence of a cost problem yet. File a spike if/when one appears.
   - **Component sprawl refactors** (Scene4Bands.tsx 1131 lines, analyze.ts 1283, etc.) — real but not a spike. File individually if/when they bite.
   - **Observability / Sentry** — separate planning effort.
4. **Distinguished spikes from plain follow-ups.** Some findings from the architecture review were concrete enough that no spike methodology was needed — they went straight to bug/chore issues (#114, #115, #116). The cascade payload bomb, the unused 4.7 MB discography.json, and the missing CI gate all fall in this bucket.
5. **PR #117 opened but not merged.** Reason: if the first spike (#113, ~45m) surfaces something that changes how the rubric is phrased, easier to amend before merge. After #113 closes with no rubric impact, merge is fine.
6. **Suggested execution order encodes a fast-feedback principle.** Cheapest, most binary spikes first (#113 secrets-leak 45m, #109 API keys 1h), then the one with a hard external deadline (#112 repo-bloat MUST run before next venue-photos cron), then the W1-gating measurements (#110, #111).
7. **Branch links in issue bodies use the branch path** (`../blob/claude/architecture-risk-review-sTxNX/...`). They keep working post-merge as long as the branch isn't deleted. No link rewrites needed.

## Relevant GitHub Issues

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #102 | [Epic] Morperhaus MCP Server | Open (in-flight) | The work this sprint derisks. |
| #104 | [MCP W1] Directory restructure | Open (blocked) | All 3 W1-blocker spikes must close before W1 starts. |
| #108 | [Epic] Architecture Risk Review Sprint | Open (this session) | Parent for all spike work. |
| #109 | [Spike] API key exposure audit | Open (this session) | W1 blocker. 1h. **Run 2nd.** |
| #110 | [Spike] Worker cold-start measurement | Open (this session) | W1 blocker. 2h. **Run 4th.** |
| #111 | [Spike] MCP route collision rehearsal | Open (this session) | W1 blocker. 3h. **Run 5th.** |
| #112 | [Spike] Repo-bloat projection | Open (this session) | 1h. **Run 3rd — before next venue-photos cron.** |
| #113 | [Spike] Git history secrets-leak audit | Open (this session) | 45m. **Run 1st — fastest binary outcome.** |
| #114 | Cascade page loads ~2 MB JSON in one burst | Open (this session) | Plain perf bug, parallel work. |
| #115 | discography.json 4.7 MB shipped but unused | Open (this session) | Plain chore, parallel work. |
| #116 | No CI gate on PRs | Open (this session) | Plain ops chore, parallel work. |
| #117 | PR: docs: add architecture risk spike rubric | Open | Awaits user merge decision. |

## Next Steps for Next Session

1. **Confirm PR #117 status** — merged or still open. If still open, decide whether to proceed (spikes can run with rubric on a branch).
2. **Run #113 first** (45m). Use the method block in the issue. Comment with grep output + Secret Scanning state + severity classification.
3. **Run #109 second** (1h). If finding is **Critical**, rotate the keys before closing the spike. Don't bundle in a Worker proxy implementation — that's the follow-up.
4. **Run #112 third** (1h). Hard deadline: must take baseline before the next venue-photos cron (`.github/workflows/refresh-venue-photos.yml`, runs every 7 days at 00:00 UTC). Last automated commit was 2026-05-10.
5. **Run #110, then #111** (2h + 3h). After both close, W1 (#104) is unblocked.
6. **For each spike**: post the closing comment with measured numbers + severity tier. If High or Critical, file the follow-up issue and link it from the spike comment.
7. **In parallel, anytime**: pick up #114, #115, #116. No spike methodology needed.
8. **Sprint close**: update the summary table in #108 with each spike's outcome row, then close the epic.

## Files to Know About

- `docs/specs/future/architecture-risk-spike-rubric.md` — the rubric. Single source of truth for how spikes are run and judged. Linked from every spike issue.
- `docs/specs/future/global-mcp-server.md` — the MCP spec the sprint partly derisks. Spike #111 (route collision) may produce a follow-up to update its §"Route Collision — Step-by-Step" section.

## Context Not in Issues

- **User stance**: explicitly told me to be critical, not over-engineer, and "do what you think is best." Don't ask permission for routine sprint moves. Do ask before destructive or shared-state actions.
- **Single maintainer**: shapes the rubric. No "use your judgment" tiers. Bars must be measurable.
- **MCP gate context**: per `.claude/context.md`, W0 cleared 2026-05-09, W1 is next. The sprint sits between "W0 done" and "W1 starts" — that's the window for these spikes.
