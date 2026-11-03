# `query` Era Context

**Status:** Implemented — Option A + C
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** `album-eras.json` (shipped v5.4)

---

## Executive Summary

The `query` escape hatch — the only tool that calls an LLM at request time — receives
`concerts.json` and nothing else. It has never seen `album-eras.json`.

So the freeform tool is blind to the newest and most distinctive data in the archive. Ask it
*"which bands did I catch before they broke?"* — the exact question the v5.4 join was built to
answer — and it is counting over a file with no album data in it. Best case it says it can't.
Worst case it answers from the model's own memory of when records came out, which is precisely
the failure mode every other tool here is engineered to prevent.

This is a **cost decision, not a design problem.** The change is one string in `runQuery`. What
needs deciding is whether the per-call context increase is worth it on a public, budget-capped
endpoint.

---

## The measurement

Token counts are `chars / 3.6`, the ratio this repo's existing cost estimates use. Measured
2026-08-19 against the shipped data files.

> **Correction, 2026-08-19 (during implementation).** The first version of this spec measured
> `concerts.json` as read from disk — 128,155 chars, ~35,600 tokens. That is not what `query`
> sends. `runQuery` sends `JSON.stringify(data.concerts)`: minified, and the array only,
> without the `metadata` block. The real payload is **~25,200 tokens**, so the baseline was
> overstated by ~40% and every conclusion drawn from it was wrong in the same direction.
> The corrected table and budget analysis below replace the originals. Pinned by
> `workers/mcp-server/src/query-budget.test.ts`, which measures the real files rather than a
> fixture, so this can't drift back into estimation.

| Context | Tokens | Note |
|---|---:|---|
| `concerts.json` as sent (minified array) | ~25,200 | baseline |
| `album-eras.json` in full | ~154,400 | **6× the current context — out of the question** |
| Compact era projection | ~4,100 | +16.2% on baseline |

The projection is a tuple per concert, dropping mbids, cover URLs, match tiers, percentiles and
the whole `artists` block — none of which a freeform counting question can use:

```json
["concert-21", ["depeche-mode", "current", "Music for the Masses", 264, "Violator", 1, 20]]
```

`[artistKey, cycleBucket, currentAlbum, daysSinceRelease, definingAlbum, aheadFlag, monthsAway]`

### What it costs in practice

The `query` budget is **250K tokens/day or 8 calls/day**, whichever trips first
(`QUERY_DAILY_TOKEN_CAP` / `QUERY_DAILY_CALL_CAP`), and usage counts input **plus** output
against the token ceiling. Worst case per call is the payload plus `max_tokens` (1,024).

| | Tokens per call | 8 calls | Under 250K? | Headroom | Cost per call |
|---|---:|---:|---|---:|---:|
| Before | ~26,200 | ~210K | yes, 40K spare | ~19% | $0.025 |
| With projection | ~30,300 | ~243K | yes, 7K spare | **~3%** | $0.029 |

**The call cap binds first, in both rows** — so the projection costs **zero queries per day**,
not one. The earlier "one query per day" figure came from the overstated baseline.

What it does cost is margin. Per-call headroom against the implied `250K / 8 = 31,250` budget
falls from ~19% to ~3%: the archive can grow only a few percent before the token cap starts
cutting off the eighth call of the day. That is a real cost, just a different one — and it is
now a failing test rather than a surprise, which is the point of
`query-budget.test.ts`.

---

## Options

**A. Ship the projection unconditionally.** One string in `runQuery`, every freeform question
gains era awareness. Costs a query a day, every day — including the majority of questions that
never touch album cycles.

**B. Ship it conditionally.** Include the projection only when the question smells like a career
question (`before they broke`, `early`, `album`, `debut`, `touring`…). Preserves the budget for
unrelated questions, at the cost of a keyword heuristic that will misfire in both directions — and
a question that *silently* got the thin context is indistinguishable, to the reader, from one that
got the full one.

**C. Don't ship it; route instead.** Sharpen `query`'s prompt to defer career questions to
`get_career_position` / `get_career_shape`, the way it already defers clean matches to the other
deterministic tools. Zero cost, and the deterministic tools give better answers than runtime
counting — but only for questions those two tools' shapes can hold. *"Which bands did I see in
their first year AND at the Palladium?"* falls between them and stays unanswerable.

**Chosen: A, with C's prompt change alongside it.** The measurement is what moved this — at an
estimated 14K tokens the conditional complexity of B would have been worth arguing for; at 4.1K,
costing no queries at all, it is not. The deferral rule in C is worth having regardless, because a
deterministic answer beats a hedged runtime count whenever one exists.

---

## What shipped

1. **`projectEras(eras)`** in `tools.ts` — the tuple map above. Pure, no I/O, returns `null`
   rather than `{}` when era data is unreadable: an empty map would read to the model as "no
   album data exists for these shows", which is a different and false claim from "none was
   given". `runQuery` omits the whole block in that case and behaves exactly as it did pre-change.
2. **`runQuery`** appends the projection under its own heading, keyed by concert id so the model
   joins back to `concerts.json` for artist, venue, date and city.
3. **`prompts/query.md`** documents the tuple field order (which must change here and in
   `EraProjection` together or in neither), and carries two cautions: `definingAlbum` is a
   *heuristic* — top-track share, not a fact — so claims resting on it hedge harder than claims
   resting on dates; and a concert id missing from the projection means "couldn't be placed",
   never "no albums".
4. **The deferral list** gained `get_career_position`, `get_career_shape`, and `cycleBucket`
   search, with the rule: defer when the question *is* one of those, answer it when it combines
   them with a venue, city, year or genre that none of them cover.
5. **`getAlbumEras` stays LAZY.** `query` is capped in the single digits per day, so a cold fetch
   on that path is cheap; promoting it to LOAD would make every other tool pay for it.

## Open question — now sharper

Should `QUERY_DAILY_TOKEN_CAP` rise? Before this change the answer was "no hurry". Now the
per-call headroom is ~3%, so the next few percent of archive growth pushes the token cap in front
of the call cap and quietly costs the eighth query of the day.

`query-budget.test.ts` fails while there is still room to act rather than at the moment users
start getting refused. Raising the cap remains a spend decision, deliberately not bundled here.

---

- **Author:** via Claude Code
- **Status:** Implemented 2026-08-19. Baseline measurement corrected during implementation — see
  the correction note under §The measurement.
