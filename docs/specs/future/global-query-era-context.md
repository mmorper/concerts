# `query` Era Context

**Status:** Proposed — awaiting decision
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

| Context | Tokens | Note |
|---|---:|---|
| `concerts.json` (today's payload) | ~35,600 | baseline |
| `album-eras.json` in full | ~154,400 | **4.3× the entire current context — out of the question** |
| Compact era projection | ~4,100 | +11.5% on baseline |

The projection is a tuple per concert, dropping mbids, cover URLs, match tiers, percentiles and
the whole `artists` block — none of which a freeform counting question can use:

```json
["concert-21", ["depeche-mode", "current", "Music for the Masses", 264, "Violator", 1, 20]]
```

`[artistKey, cycleBucket, currentAlbum, daysSinceRelease, definingAlbum, aheadFlag, monthsAway]`

### What it costs in practice

The `query` budget is **250K tokens/day or 8 calls/day**, whichever trips first. The token cap
already binds before the call cap:

| | Tokens per call | Calls before the daily cap | Input cost per call |
|---|---:|---:|---:|
| Today | ~35,600 | ~7 | $0.036 |
| With projection | ~39,700 | ~6 | $0.040 |

**The real price is one query per day**, and about four tenths of a cent per call. That is the
whole decision.

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

**Recommendation: A, with C's prompt change alongside it.** The measurement is what moved this —
at an estimated 14K tokens the conditional complexity of B would have been worth arguing for; at
4.1K it is not. Buying era-awareness for every freeform question at the price of one query per day
is a good trade, and the deferral rule in C is worth having regardless, because a deterministic
answer beats a hedged runtime count whenever one exists.

---

## Implementation sketch (if A is chosen)

1. `projectEras(eras)` in `tools.ts` — the tuple map above. Pure, testable, no I/O.
2. `runQuery` takes the projection and appends it to the user content under its own heading.
3. `prompts/query.md` gains a section on what the era data is and — critically — that
   `definingAlbum` is a *heuristic* (top-track share), so claims resting on it get hedged harder
   than claims resting on dates.
4. The deferral list in `prompts/query.md` gains `get_career_position` and `get_career_shape`.
5. `getAlbumEras` moves from LAZY to… **no.** It stays lazy: `query` is rate-limited to single
   digits per day, so a cold fetch on that path is cheap and the eager list stays honest.

## Open question for the decision-maker

Does the ~1 query/day reduction in the daily cap matter, or should the cap rise to compensate?
Raising it is a separate spend decision and deliberately not bundled here.

---

- **Author:** via Claude Code
- **Status:** Proposed 2026-08-19 — no code written pending the decision
