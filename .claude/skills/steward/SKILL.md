# Steward Skill

**Purpose:** How to drive a pull request in this repo to green — what to run
before pushing, and how to read a red check here.
**Loaded:** Before acting on CI or review events on a PR you opened or were
asked to drive.

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

## Noise

- `cloudflare-workers-and-pages[bot]` preview comments — no action.
- Dependabot PRs are not ours to drive unless the owner asks. If one is red,
  the usual cause is main (step 1 above), not the bump.

## Conventions

Commit prefixes, deep-link rules and the scene roster are in `CLAUDE.md`. Don't
restate them here.
