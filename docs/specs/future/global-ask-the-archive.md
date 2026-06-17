# Ask the Archive — Site Presence

**Status:** Planned
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** None (independent of deep-links PR #133). Part of Epic #102.
**Tracking issue:** #134
**Visual reference:** [`docs/mock-ask-the-archive.html`](../../mock-ask-the-archive.html) (open in a browser)

---

## Executive Summary

The MCP "Ask the Archive" capability is live but invisible to the people most likely to
want it: visitors to the main site never learn they can bring 40 years of concerts into
Claude and *talk to* the archive they just explored. The only discovery paths today are
the raw URL and `llm.txt`.

This feature closes that gap with two moves, kept deliberately within the site's editorial
restraint:

- **A — First-class nav destination.** "Ask the Archive" joins the existing navigation in
  all three surfaces where the site has chrome (desktop right rail, mobile bottom nav,
  secondary-page `PageNav`), so it's discoverable from anywhere without interrupting the
  experience.
- **B — One earned moment.** A new invitation at the very end of the scroll, after the
  final scene — the one place a call-to-action feels earned rather than sold.

**Design north star:** the site's signature conceit is *the archive speaking in first
person*. The MCP feature is that voice made interactive. Never say "MCP," "connector," or
"API" to a human — say **"Ask the Archive."**

---

## Design Philosophy

The site earns trust through quiet craft; an aggressive CTA spends that trust. So:

- Ride the **existing** "destinations" system (Liner Notes, What's Playing) rather than
  inventing new chrome.
- Give B exactly **one** earned moment — not a popup, not a per-scene banner.
- Keep all copy in the archive's first-person voice.

---

## Part A — Nav Destination

"Ask the Archive" becomes a peer of the existing nav links, pointing to the canonical
`/ask` page (see Prerequisite). It appears in three surfaces:

### A1 — Desktop right rail
**File:** [`src/components/SceneNavigation.tsx`](../../../src/components/SceneNavigation.tsx)

Today the rail is: `[5 scene dots]` → divider → vertical **Liner Notes** link.

**New layout — bracket the dots so they stay centered:**

```text
   Ask the Archive   ← new, vertical text, with a small indigo "live" dot
   ───────────────   ← divider
      • • • • •       ← 5 scene dots (primary wayfinding, TRUE center)
   ───────────────   ← divider (existing)
     Liner Notes      ← existing, vertical text
```

- "Ask the Archive" sits **above** the dots, in the prime first-read position.
- Symmetric dividers contain the dots; they read as deliberate, not an afterthought.
- **Build note (centering):** the two vertical labels have unequal heights ("Ask the
  Archive" is longer than "Liner Notes"), so a naive flex column shifts the optical
  center. Anchor the **dots** to viewport center (the rail container is already
  `top-1/2 -translate-y-1/2`) and position the labels as offsets above/below, so the dots
  land at true center regardless of label length.
- **Theme-aware color:** reuse the existing `[1, 5].includes(activeScene)` light/dark text
  logic (lines 130, 147) — Scenes 1 (Timeline) and 5 (Artists) are light backgrounds.
- **Compact label:** the right-rail vertical label may shorten to **"Ask"** if "Ask the
  Archive" stacks too tall; the destination page carries the full title. (Build-time call.)
- **The "live" dot:** a small indigo dot (`#4f46e5`) marks Ask as the interactive one.
  Keep it subtle — a quiet glow, sized to the site's restraint. Validate it doesn't read
  as "notification badge."

### A2 — Mobile bottom nav
**File:** same component, `NAV_LINKS` array (line 7) + the `motion.nav` (lines 161–192).

- Add `{ to: '/ask', label: 'Ask', event: 'ask_archive_nav_clicked' }` to `NAV_LINKS`.
- On mobile the rail collapses, so the bottom pill is the only persistent chrome — Ask
  must live here. Lightly emphasize it (the mock highlights the "Ask" pill) so it reads as
  the newest invitation. Order: Liner Notes · What's Playing · **Ask** · About.

### A3 — Secondary-page header
**File:** [`src/components/liner-notes/PageNav.tsx`](../../../src/components/liner-notes/PageNav.tsx)

- Add an "Ask the Archive" `Link` to the link group (alongside Liner Notes · What's
  Playing · How It Works · About), respecting the existing `theme` (dark/light) classes
  and the `current !== …` self-hide pattern.
- Closes the loop: someone reading "About" / "How It Works" is exactly who's curious
  enough to want to talk to the archive.

> **Note:** `NAV_LINKS` (mobile nav) and `PageNav` are separate link lists today and don't
> all agree (e.g. "How It Works" is in `PageNav` but not the mobile nav). This spec adds
> Ask to each independently rather than unifying them — unification is out of scope.

---

## Part B — End-of-Scroll Invitation

**New component:** `src/components/AskInvitation.tsx` (or similar), rendered as the panel
**after** `<ArtistScene>` inside the snap container in
[`src/App.tsx`](../../../src/App.tsx) (after line 319, still inside the
`.snap-y snap-mandatory` div at line 285).

### Behavior
- A full-viewport snap section that the user reaches by scrolling **past** the final
  Artists scene — so it appears only when the journey is actually complete.
- It is **not** a scene and gets **no** scene dot. `SceneNavigation` caps `activeScene` at
  `scenes.length` (5), so scrolling into this panel keeps the Artists dot active — correct
  and intended.
- Card entrance animates in on intersection (fade + rise, matching the landing page's
  `rise` keyframe idiom). **Respect `prefers-reduced-motion`** — no transform/opacity
  animation when set (mirror the landing page's reduced-motion handling).

### Content (first-person voice)
- Eyebrow: "You've reached the present"
- Headline (Playfair Display): **"That's forty years. Now ask me about it."** *(locked
  default — see Voice alternates)*
- Body: "You've been reading the archive. Inside Claude, you can talk to it — your history
  with a band, every show at a venue, or just 'surprise me.'"
- **Primary CTA:** "Ask the archive →" → `/ask`
- **Secondary path:** "or add `concerts.morperhaus.org/mcp` in Claude" (quieter, for
  people who know what to do with a connector URL)

### Background — DECIDED: dark "fin" coda
B sits on a **dark** indigo→purple gradient (as mocked). Chosen for two reasons: it's the
more memorable ending after the light Artists mosaic, and it visually rhymes with the dark
`/ask` landing page the CTA leads to (continuity through the click).

**Required refinement — soften the seam.** The Artists scene (Scene 5) immediately before
this card is **light** (`#fafaf9`), so the light→dark transition must read as deliberate,
not abrupt. Handle it with one of: a gradient fade at the bottom of the Artists scene, an
eased dark-panel entrance as it scrolls in, or a brief dark vignette. The jump itself is
the thing to design away — the destination (dark) is fixed.

### Voice alternates (pick during build)
1. "That's forty years. Now ask me about it." *(default)*
2. "You've been reading. Now you can ask."
3. "Forty years of shows. What do you want to know?"

---

## Canonical `/ask` — already works; dedupe is cleanup, not a blocker

`/ask` already exists, is already declared canonical, and is already linked from the
changelog ([`src/data/changelog.json`](../../../src/data/changelog.json)). So pointing this
feature's CTAs at `/ask` is safe **today** — no Phase 0 gate.

How it's wired:

- `public/ask.html` — **generated at build time** by `scripts/gen-mcp-landing.ts`, which
  imports the **same** `renderLandingPage()` the worker uses. Served by Pages at `/ask`
  (clean human URL on the main domain, no worker hop).
- [`workers/mcp-server/src/landing.ts`](../../../workers/mcp-server/src/landing.ts) — the
  single source of truth, also rendered by the worker at `/mcp` and `/mcp/about`.

**There is already one source of truth** — the page structure/copy can't drift, by design.
The only residual is that the **stat numbers** are hardcoded in two spots (the generator's
`STATS` const and the worker's `serveLandingPage`), so they must be bumped together. Minor,
pre-existing, and not part of this feature. **No `/ask` work is needed here** — CTAs point
at `/ask` and it just works.

---

## Accessibility

- Rail/nav links: descriptive `aria-label`s (existing pattern), `min-w-[44px] min-h-[44px]`
  touch targets (existing pattern).
- The "live" indigo dot is decorative (`aria-hidden`); it must not be the only signal —
  the text label carries meaning.
- B card: real `<a>` for the CTA, focusable, visible focus ring; `prefers-reduced-motion`
  honored.
- Color contrast verified against whichever B background is chosen.

---

## Analytics

New events (follow existing `analytics.trackEvent` naming, snake_case):
- `ask_archive_nav_clicked` — `{ surface: 'rail' | 'mobile' | 'pagenav', from_scene? }`
- `ask_archive_invite_clicked` — `{ path: 'primary_cta' | 'connector_url' }`
- `ask_archive_invite_viewed` — fires when B scrolls into view (measures reach vs. clicks)

See `.claude/skills/analytics/SKILL.md` for conventions before adding.

---

## Testing Checklist

- [ ] Rail: dots remain at true vertical center with "Ask the Archive" above + "Liner
      Notes" below, at every scene (label-height offset handled).
- [ ] Rail label color flips correctly on light Scenes 1/5 vs dark 2/3/4.
- [ ] Mobile bottom nav shows Ask, emphasized; tap navigates to `/ask`.
- [ ] PageNav shows Ask on all four secondary pages, self-hide rule intact, both themes.
- [ ] B appears only after fully scrolling past Artists; entrance animation plays once.
- [ ] B respects `prefers-reduced-motion` (no motion).
- [ ] B CTA and connector URL both work; URL copy/visibility legible on chosen background.
- [ ] `/ask` resolves to the single canonical page from every CTA.
- [ ] All three analytics events fire with correct params.
- [ ] No console errors; no layout shift introduced on Scene 1 load.

---

## Implementation Plan

### Phase 1 — Nav destination (A)
- Modify `SceneNavigation.tsx`: rail (Ask above dots, centered) + `NAV_LINKS` (mobile).
- Modify `PageNav.tsx`: add Ask link.
- Wire the three analytics events.

### Phase 2 — End-of-scroll invitation (B)
- New `AskInvitation` component; mount after `<ArtistScene>` in `App.tsx`.
- Prototype dark vs light background; pick one.
- Intersection-triggered entrance + reduced-motion; `ask_archive_invite_viewed/clicked`.

### Phase 3 — Polish
- Tune the "live" dot weight, label length, B copy against the real scenes.
- Cross-device pass (notch safe-area on mobile nav already handled).

---

## Out of Scope (deliberately)

- Unifying the divergent `NAV_LINKS` / `PageNav` link lists.
- Contextual "Ask about this artist →" hooks on the gatefold (closes the loop the other
  direction; revisit once Claude prompt pre-seeding is feasible).
- An embedded live chat on `/ask` using the `query` tool (cost/auth/rate-limit — a future
  "big swing," not this feature).

---

## Questions for Review

1. ~~B background~~ — **DECIDED: dark coda, with a designed light→dark transition.**
2. **Rail label:** "Ask the Archive" vertical, or compact "Ask"? *(build-time call)*
3. **`/ask` dedupe mechanism** *(cleanup, not blocking)*: generate `public/ask.html` from
   `landing.ts`, or redirect `/ask` → the worker landing?

---

## Revision History

- **2026-06-16:** Initial specification. Author: Mike (with Claude Code).
- **Version:** 1.0.0
- **Status:** Planned
