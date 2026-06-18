# Ask the Archive — In-App Conversational Client

**Status:** Planned
**Target Version:** next major
**Priority:** High
**Estimated Complexity:** Large (backend service + frontend chat system + nav-system refactor)
**Dependencies:** Builds on the MCP tools from Epic #102. Reconciles with / supersedes the invocation surface of #134.
**Tracking issue:** Epic — see sub-issues below.
**Visual references** (open in a browser):
- [`mock-chat.html`](./mock-chat.html) — the exhibit answer model, Containers A & B, invocation tiers
- [`mock-dock.html`](./mock-dock.html) — the wayfinding dock (eyebrow + persistent pill), per-scene behavior

---

## Executive Summary

The MCP "Ask the Archive" capability is real but reachable only by the small minority of
visitors who run an MCP-capable AI client (Claude Desktop, Cursor, …) and know how to wire
a connector. **The other ~99% of concert-goers — the actual audience — never get to talk to
the archive at all.**

This feature brings the conversational layer *into the site itself*: a visitor can ask the
archive a question and get an answer, with no account, no connector, no understanding of
what an MCP even is.

The hard design constraint is that it must not feel like a bolted-on chatbot. So the
governing idea is:

> **An answer is a composed exhibit, not a chat bubble.** Each reply is assembled from the
> site's own materials — artist photo, genre-colored spine, first-person prose, deep-link
> show chips, venue map tile. The conversation reads like the archive composing little pages
> on demand. And it's invoked from a **wayfinding dock** that unifies the bottom-center
> navigation lane rather than competing with it.

---

## Design Principles

1. **Exhibits, not bubbles.** No avatars, no "typing…" theater, no bot persona. The archive
   has a voice (first person, music-journalist register — inherited from
   `.claude/skills/liner-notes-voice/SKILL.md`), not a mascot.
2. **Tool-grounded truth.** Every number/fact in an exhibit comes from the deterministic
   tools. The model writes the connective prose; it never invents a stat. A wrong concert
   count in the archive's own voice would damage the brand more than the feature helps.
3. **Restraint.** Persistence is earned by being *useful furniture*, not an aggressive CTA
   (cf. #134: "an aggressive CTA spends that trust"). The dock is wayfinding; Ask rides on it.
4. **Close the loop the MCP can't.** Every exhibit ends in navigation *into the real scenes*
   — the one thing an external Claude client cannot do.

---

## Architecture

### Backend — a tool-grounded agent loop (NOT the single-shot `query` tool)

The existing [`query` tool](../../../workers/mcp-server/src/tools.ts) is a single-shot RAG
call (stuff `concerts.json` → one Haiku call → text). That is the wrong engine for chat.

This feature is a **multi-turn agent loop** that calls the **6 deterministic tools** as
Anthropic tool-use:

- Reuse the **pure tool functions** already in
  [`workers/mcp-server/src/tools.ts`](../../../workers/mcp-server/src/tools.ts) and the data
  layer in [`data.ts`](../../../workers/mcp-server/src/data.ts) — they're written to be
  callable in isolation (see `tools.test.ts`).
- A new chat endpoint (HTTP + **SSE streaming**) runs the loop: Claude Messages API with the
  tools defined as `tools`, looping on `tool_use` until stop.
- **Model:** Haiku 4.5 (knob — revisit only if tool-calling reliability disappoints).
- **Prompt caching** on the system prompt + tool definitions — mandatory for cost.
- **Numbers from tools, prose from model.** The exhibit's structured data (photo, shows,
  deep-links, stats) comes from tool output; the model contributes voice + which exhibit to
  render.
- **Session-ephemeral memory** — multi-turn within a visit; no cross-reload persistence in v1.

### Exhibit schema + rendering

Define a small set of exhibit kinds, each rendered by a frontend component from tool output:

| Kind | Built from | Atoms |
|------|-----------|-------|
| Artist | `get_artist_history` / `search_concerts` | photo, genre spine, prose, show chips, deep-link |
| Venue | `get_venue_history` | map tile (lat/lng), prose, deep-link |
| Ranking / list | `search_concerts` | rows w/ photo + count, deep-link |
| Serendipity | `surprise_me` | single highlighted show |
| Plain answer | any | prose + optional stat strip |
| Disambiguation | resolver "few matches" | choice chips |
| Refusal / empty | refusal patterns | quiet prose, fallback suggestions |

**Streaming UX:** scaffold the card → stream the prose → resolve chips/photo as tool data
lands. The exhibit can't stream token-by-token, so the prose streams inside a stable frame.

### Cost & abuse controls — **hard gate, in scope, not optional**

A public, unauthenticated LLM endpoint is a free-proxy target. Required before any public
exposure:

- **Turnstile** on session start (skill: `turnstile-spin`).
- **KV daily cap** — extend the existing `MCP_QUERY_USAGE` pattern (tokens/day + calls/day,
  pre-flight refuse, post-flight write via `ctx.waitUntil`). **Target ceiling: $25/month** (knob).
- **Per-session rate limit** and **input-length cap.**
- **Refusal patterns** for off-topic / jailbreak attempts (reuse
  [`prompts/query.md`](../../../workers/mcp-server/prompts/query.md)); "I think…" hedging
  framing inherited from the archive voice.

### Kill switch & incident response (phone-first)

A kill switch must be **runtime state, never a code constant** — no redeploy mid-incident, and
it must be operable from a phone with no terminal. Three tiers of suppression, defense-in-depth:

1. **Automatic cap** — the daily KV cost cap auto-suppresses when budget is exhausted. The
   always-on circuit-breaker that works even if no one is watching.
2. **Manual global brake** — a KV mode-flag `ask:mode` ∈ `{ on, paused, deterministic-only }`,
   read pre-flight by the Worker (same path as the cap check; cache ≤10s so flips land in seconds).
   - `paused` → backend refuses the LLM loop, returns a **graceful** "Ask is resting" exhibit
     (never a 500); frontend collapses the dock to its resting state.
   - `deterministic-only` → kill only the LLM agent loop; keep answering from the cheap tools.
   - **Fail-safe:** absent/unreadable flag → default `on` (the cost cap is the independent
     ceiling, so a KV blip can't take the feature down while spend stays bounded).
3. **Surgical block** — Cloudflare WAF / Rate-Limiting Rules by IP/ASN/pattern, at the edge,
   before the Worker runs. For a single bad actor — don't punish everyone with the global brake.

**Phone-first control — `/ask/admin`, behind Cloudflare Access:** a tiny page on the same Worker
showing current mode + today's spend + call count, with `On` / `Deterministic-only` / `Pause`
buttons that flip the `ask:mode` KV key. Auth via **Cloudflare Access (Zero Trust)** — not a URL
token (tokens leak; Access adds SSO + an audit log of who flipped it). Bookmark to the home screen
= a 3-tap break-glass app. Doubles as the status dashboard.

**Detection = the remedy:** the spend tripwire (≥80% of cap) **pushes a notification to the phone
with a deep link to `/ask/admin`**, so alert and fix are one swipe apart. Workers Logs / Logpush on
request volume, `ask_cap_hit`, and refusal rate back it up.

**Incident runbook (one line):** suppress → open `/ask/admin` (or *"Hey Siri, pause Ask the
Archive"* via an optional iOS Shortcut) → tap **Pause**. CLI fallback: `wrangler kv key put ask:mode paused`.

---

## UX — Answer containers

### Container A — full-canvas `/ask`
The destination opens on the dark coda gradient (continuity from #134's end-of-scroll card).
Suggested-prompt chips teach a non-technical visitor what's askable and kill the blank-box
freeze. Best for the deliberate visitor who arrived to ask.

### Container B — Spotlight overlay
A focused, Spotlight-style overlay summoned over whatever scene you're on. It is an **overlay,
not a route** — the scene stays mounted, dimmed and blurred behind; `esc` returns you exactly
where you were. It is **one element that morphs**: command-bar → reading surface as the first
exhibit lands. Capped at ~70vh with internal scroll; **"Open full view ↗"** promotes the same
conversation into Container A when it outgrows the box. **Mobile = A** (overlays are too tight).

### Suggested prompts
Shown at the empty state (both containers); **disappear** the moment the first exhibit lands
to reclaim real estate; reappear only on clear-to-empty.

---

## UX — The wayfinding dock (supersedes #134's invocation surface)

The bottom-center lane is contested on 5 of 6 scenes (verified in code). Rather than fight it,
**unify it into one composed control:**

```
        <scene instruction>      ← EYEBROW — adapts per scene, fades on scroll
   ╭───────────────────────╮
   │ ● Ask the archive…  ⌘K │   ← PILL — the persistent Ask anchor
   ╰───────────────────────╯
```

- **The pill persists** (calm, always there). **The eyebrow breathes** — full strength when
  the user settles, dimmed near-zero while actively scrolling. This is the synthesis of
  "persistent control" + "no standing-CTA nag."
- **Eyebrow behavior mirrors the scene's existing instruction:** passive where it was a
  scroll cue (Hero: *Scroll to explore*), a real link where it was a nav target
  (Map: *The Music ↓*).
- **Theme-aware** — light scenes (1 Hero, 5 Genres) get the light treatment.
- **Bloom transition:** tapping the pill expands it *in place* into the Spotlight (shared-
  element). Honors `prefers-reduced-motion` (cross-fade, not scale).

### Per-scene degrade rules
| Scene | Bottom-center content today | Dock behavior |
|-------|-----------------------------|---------------|
| 1 · Hero | "↓ Scroll to explore" | eyebrow = scroll cue (passive) |
| 2 · Venues | nothing | **free lane** — dock takes it |
| 3 · Map | nav pill + stats + "tap to explore" | eyebrow = *The Music ↓* (link); **stats suppressed**; "tap to explore" → transient on-map hint |
| 4 · Bands | centered text | eyebrow = nav cue |
| 5 · Genres | timeline slider (owns the lane) | **dock yields** → Ask lives on the rail dot |
| Artists / gatefold | stats + gatefold hint | eyebrow = nav cue; gatefold hint coexists/relocates |

> **Map stats decision:** the "183 shows · 32 cities" line is **suppressed**, not rehomed —
> it duplicates what the scene already conveys.

### Mobile
Desktop-first. On phones the fixed bottom nav owns the floor, so mobile keeps the
**nav-pill "Ask" entry** from #134 (tapping opens the full-screen `/ask`). No floating dock.

---

## Invocation tiers (loudest → quietest)

1. **The dock pill** (desktop) / **nav "Ask"** (mobile) — the standing, legible "type here" cue.
2. **The earned moment** — #134's end-of-scroll invitation card, repurposed to **open the
   Spotlight** (it no longer just links to `/ask`).
3. **Power keys** — `⌘K` from anywhere, `/` to focus like search.
4. **First-visit reveal** — a one-time full-bar reveal on the first scroll-pause of a session
   (localStorage-gated), then it adopts dwell behavior.

---

## Relationship to #102 and #134

- **#102 (MCP epic):** reuses its deterministic tool functions + data layer as the agent's tools.
- **#134 (site presence):** this **supersedes #134's Part A invocation surface** (the rail/nav
  "Ask" link becomes the dock); **#134's Part B end-of-scroll card is repurposed** as a
  Spotlight trigger. #134 can be closed or rescoped to "end-of-scroll card only" once this lands.

---

## Accessibility

- Overlay focus management (trap, restore on `esc`), visible focus rings, real `<a>`/`<button>`.
- `aria-label`s on dock pill + eyebrow; the live dot is decorative (`aria-hidden`) — text carries meaning.
- `prefers-reduced-motion` honored (bloom, eyebrow fade, exhibit entrance).
- Contrast verified on both light and dark scenes; `min-w-[44px] min-h-[44px]` targets.

---

## Analytics

snake_case, per `.claude/skills/analytics/SKILL.md`:
- `ask_opened` — `{ surface: 'dock' | 'kbd' | 'endscroll' | 'navpill' | 'firstvisit' }`
- `ask_question_sent` — `{ turn_index, char_len }`
- `ask_exhibit_shown` — `{ kind }`
- `ask_deeplink_clicked` — `{ kind, target_scene }`
- `ask_full_view_opened` — Container B → A promotion
- `ask_cap_hit` — daily budget refusal

---

## Implementation phases (→ sub-issues)

1. **Chat backend service** — agent loop Worker, tool-grounding, Haiku + caching, SSE; **+ all
   abuse/cost controls** (Turnstile, KV cap, rate limit, refusals). *Ships behind a flag; no UI.*
2. **Exhibit schema + answer-rendering components** — the card kinds + streaming render.
3. **Spotlight overlay (B) + `/ask` canvas (A)** — container shells, morph/escalation, mobile fallback.
4. **Wayfinding dock** — bottom-center nav-system refactor: eyebrow grammar, per-scene degrade,
   dwell behavior, theme-awareness, Map stats suppression, Genres yield.
5. **Invocation tiers + bloom + #134 reconciliation** — shortcuts, first-visit reveal,
   end-of-scroll card → Spotlight, supersede #134 Part A.

---

## Out of Scope (deliberately)

- **Live canvas-steering** (flying the map / filtering the mosaic *as you type*) — the tempting
  over-build. Exhibits **link into** scenes; they don't puppet them. A later swing if it earns it.
- **Cross-reload conversation persistence.**
- **Semantic search / Vectorize** — a complementary OSS use, tracked separately, not the chat brain.
- **Self-hosted / OSS chat model** — decided: Anthropic Haiku (tool-grounding + voice + cost
  all favor it at this scale).
- **Contextual "Ask about this artist →" gatefold hooks** — closes the loop the other direction; revisit later.

---

## Open knobs (defaults set; override anytime)

- **Cost ceiling:** $25/month.
- **Model:** Haiku 4.5.
- **Dwell threshold:** ~800ms–1s of scroll-stillness to bloom the eyebrow / reveal.
- **Conversation length** before forcing "Open full view": ~2–3 exchanges.

---

## Revision History

- **2026-06-17:** Initial specification. Author: Mike (with Claude Code). Status: Planned. v1.0.0.
