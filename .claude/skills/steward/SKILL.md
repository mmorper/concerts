# Steward Skill

**Purpose:** How to drive a pull request in this repo to green and through QA:
what to run before pushing, how to read a red check, and the independent QA
pass every PR gets before it's ready to merge.
**Loaded:** When you open a PR, and before acting on CI or review events on a PR
you opened or were asked to drive.

---

## Before every push

```bash
npm run typecheck:all   # app + scripts (tsconfig.scripts.json) — CI runs both
npm run test:run        # root suite; excludes workers/** by design
npm run validate:docs   # README / ROADMAP / CLAUDE.md prose vs code and data
```

Touched `workers/<name>/`? Run that Worker's own tests from its directory —
each has its own vitest config and its own CI workflow (`test/README.md`).

## Reading a red check

1. **Check main first.** Automated data commits (`data: refresh enrichment
   pipeline`, `content: … [automated]`) are pushed with `GITHUB_TOKEN` and do
   not trigger CI on push. A test they broke shows up as red on whichever PR runs
   next. Look at the daily scheduled CI run on main, or run the failing test on
   `origin/main`, before assuming the PR caused it.
2. **Data-coupled tests move with the data, on purpose.** Several pipeline tests
   assert counts against the committed files in `public/data/` (e.g.
   `liner-notes-discography.test.ts` against `album-eras.json`). When one
   drifts, find what the data commit changed and whether that change is right
   before re-baselining the number. On 2026-10-10 the "just update the count" fix
   would have hidden four artists silently losing their defining album.
3. Never skip or loosen an assertion to get green.

## Before a PR is ready: an independent QA pass

Every PR you open gets one, including PRs a command opens (such as `/media-add`).
Start it yourself; the owner shouldn't have to ask. The rubric is
`.claude/skills/qa-review/SKILL.md`.

1. **Open the PR as a draft, then start QA.** Use a new cloud session (the
   claude-code-remote `create_session` tool) whose prompt contains:
   - the rubric, verbatim
   - the scope: PR number, branch, head commit, base, and the spec section or
     issue it implements (or, for a PR with neither, its purpose)
   - this session's id, for its report

   Leave out your PR description and your reasoning: QA forms its own view first.
2. **Use a different model from your own** (e.g. Sonnet when you are Opus), and
   **pass `model` explicitly**: `create_session` otherwise inherits yours.
   Correlated blind spots are the main weakness of a model reviewing its own
   kind's work. On 2026-11-21 a Sonnet pass found two real gaps after two Opus
   passes had found none.
3. **Act on the verdicts.** A QA finding is information to verify, not an order:
   check it against the code, fix what's real, and say why when you disagree.
   Anything beyond the PR's scope goes to the owner, not into the PR.
   - Fix every blocking item.
   - Fix should-fix items unless the owner says otherwise. If one is the
     owner's decision (a spec contradiction, a product choice), ask them.
   - Carry nits with a push you're making anyway. A nit never starts a push.
4. **Ask QA to re-check only what you changed.** Give it the new head commits.
   A PR gets three rounds at most: round 1 is the first review, and rounds 2
   and 3 are re-checks. After that, open disagreements go to the owner.
5. **Commits after a verdict:**
   - One that changes behaviour needs a re-check.
   - One that only merges a base branch in, or only changes a comment: say so,
     and show `git diff --stat` between the reviewed commit and the new head.
6. **Only then mark the PR ready for review and tell the owner.** You take it out
   of draft. Give each PR's verdict, the merge order for a stack, and what is
   still theirs to check live: QA can't reach hardware, devices or the Workers
   runtime.

**If you can't start a cloud session** (a local CLI without the remote tools),
use a subagent with a fresh context and the same brief, passing the Agent tool's
`model` override so it's a different model. A subagent can't post or message:
post its report on the PR yourself, headed as a subagent's QA review, and tell
the owner it wasn't a separate session.

**Not covered:**
- **Dependabot PRs:** they get CI.
- **Automated data commits:** they go straight to `main`, with no PR.
- **`/hotfix`:** it pushes straight to `main`, with no PR. It's the owner's
  emergency path.
- **The release PR `/release` opens and merges:** the owner invoking `/release`
  is the authorisation to merge it. It carries only version and changelog
  bookkeeping for work that has already been through QA. If it carries anything
  else, give that a QA pass first.
- **Anything the owner says to skip.**

## Noise

- `cloudflare-workers-and-pages[bot]` preview comments — no action.
- Dependabot PRs are not ours to drive unless the owner asks. If one is red,
  the usual cause is main (step 1 above), not the bump.

## Conventions

Commit prefixes, deep-link rules and the scene roster are in `CLAUDE.md`. Don't
restate them here.
