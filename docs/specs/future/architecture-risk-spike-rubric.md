# Architecture Risk Spike — Rubric

The single source of truth for how spikes in the **Architecture Risk Review Sprint** (epic) are run, judged, and closed. Linked from every spike issue.

---

## Spike Anatomy

Every spike issue body must contain these five sections. If a section is missing, the spike is not ready to start.

1. **Hypothesis** — what we suspect is true (one sentence).
2. **Method** — exactly how we will check (commands, tools, files).
3. **Pass/Fail Bar** — measurable threshold for each severity tier (numbers, not adjectives).
4. **Time-box** — default 2h, hard cap 4h. Beyond 4h the spike must be split.
5. **Deliverable** — a closing comment on the issue with: what was measured, severity classification, and either a follow-up issue link or an explicit waiver.

---

## Severity Tiers

Findings are classified into one tier. The tier dictates the action — no judgment calls.

| Tier | Meaning | Required Action |
|------|---------|-----------------|
| **Critical** | Active risk to users, secrets, or production stability | Stop scheduled work. Fix before next merge to `main`. |
| **High** | Latent risk that will compound or blocks near-term planned work (e.g. W1, MCP) | File a follow-up issue. Schedule before next release. |
| **Medium** | Real but acceptable at current scale | File a follow-up issue with `revisit-at-2x` label. No scheduled fix. |
| **Low** | Curiosity finding, no action warranted | Note in spike comment. Do **not** file a follow-up. |
| **Waived** | Bar was met, or risk is judged acceptable as-is | Close spike with a one-paragraph rationale. No follow-up. |

If a spike produces multiple findings of mixed severity, the spike's overall classification is the **highest** finding.

---

## Stop Rule

When the time-box expires:

- If the pass/fail bar is **clear** — close the spike, classify the finding, take the required action.
- If the bar is **unclear** — write up what was learned, classify at the highest severity supported by the data so far (default **High** when uncertain), and close. **Do not extend the time-box** without explicit reset on the epic.

The point of a spike is to convert uncertainty into a decision, not to keep digging.

---

## Sprint-Level Rules

- **W1-blocker spikes are gating.** No work on `mcp/w1-restructure` may start until every spike labeled `blocks-w1` is closed.
- **One spike in progress at a time** unless they're trivially independent (e.g. a `git log` audit and a `wrangler tail` measurement).
- **Each spike closes with a comment** linking to its written finding (in-issue or PR). A spike with no comment is not closed.
- **Sprint retro** — when all spikes are closed, the epic is updated with a summary block listing each spike, its severity, and its follow-up (or waiver). Then the epic is closed.

---

## Out of Scope for Spikes

A spike is for **measurement and decision-making**, not implementation. Do not fix the problem inside the spike issue. If a fix is small enough that it's faster to do it than to file a follow-up, do it as a separate PR and link it from the spike's closing comment.

The exception: a **Critical** finding may include the minimum patch needed to remove the active risk (e.g., rotating a leaked key) before the spike is closed.
