# One Year of the Archive — Article + Infographic Brainstorm

*Working doc for the first-anniversary LinkedIn article and stats infographic.
Anniversary: the build started between Christmas and New Year's 2025, so the target date is
roughly Dec 26, 2026. The follow-up to `post-claude-code-misnomer.md`.*

---

## The facts we can use (pulled from the repo, Nov 28, 2026)

### What was built

| Stat | Value | Source |
|---|---|---|
| Releases shipped | **49** (v1.3.2 → v7.0.0) | `src/data/changelog.json` |
| Major versions | **7** | changelog |
| Busiest release day | **3 releases** on Mar 8, 2026 (Liner Notes, Deep Cuts, Mobile Polish) | changelog |
| First 3 weeks | **21 releases** (Jan 2 → Jan 20) | changelog |
| Specs written & implemented | **67** implemented, **25** still in the future folder | `docs/specs/` |
| Front-end code | ~37,500 lines in `src/` | `wc -l` |
| Pipeline + Workers code | ~70,000 lines in `scripts/` + `workers/` | `wc -l` |
| Test files | **142** | `test/`, `workers/` |
| Skills + slash commands | **37** | `.claude/` |
| CI / automation workflows | **14** | `.github/workflows/` |
| Cloudflare Workers | **5** (meta-injector, MCP server, ask-chat, dashboard, now-spinning) | `workers/` |
| Lines of code I wrote by hand | **0** (to verify — the honest number is the punchline) | — |

### What it holds

| Stat | Value |
|---|---|
| Concerts | **186** across 40+ years (1984 → present) |
| Artists | **261** |
| Venues | **80** in **36** cities |
| Setlists cached | **376** |
| Distinct songs indexed | **2,267** |
| Personal photos & videos | **172** |
| AI-written liner notes posts | **59** |
| Most-seen artist | **Social Distortion — 8 times** |
| Most-visited venue | **Pacific Amphitheatre — 17 shows** |
| Busiest concert year | **2022 — 14 shows** |
| Top cities | Washington DC (34), Los Angeles (24), Costa Mesa (18) |

### Stats we don't have yet (worth pulling before publishing)

- GA4: total visitors, countries, most-opened artist, most-asked question in Ask the Archive.
  (The GA connector failed to connect in this session — retry or pull by hand.)
- Claude usage: number of sessions, rough spend. The "what did it cost" number is one people
  always want.
- Social: posts the archive published itself since v6.1.0.
- MCP: how many people added the archive to Claude.

---

## The article: angle options

The first article was *"Claude Code is a misnomer"* — the tool, the workflow, the superpowers.
The anniversary piece should not repeat that. Pick one spine:

**A. "A year of building things I'm not qualified to build"** *(recommended)*
The arc from a holiday side project to a product with a data pipeline, AI writing, a public
MCP server, a chat interface, and a Raspberry Pi that knows what record is playing. Lessons
are framed for non-engineers (marketers, PMs) who now *can* build. Strongest for LinkedIn:
it's personal, has a clear before/after, and the lessons travel.

**B. "The project stopped being the point"**
What building taught me about my real job: specs as the product, taste as the bottleneck,
QA as a discipline. Less about the app, more about work.

**C. "Seven versions, one spreadsheet"**
A version-by-version tour (each major version = one lesson). Easy to structure, risks reading
like a changelog.

---

## Lesson candidates (pick 5–7)

Each one should be tied to a concrete moment in the archive's history.

1. **The spec is the product.** 67 specs shipped. The work moved from "build it" to "describe
   it precisely". Outcome over implementation, continued from the first article.
2. **Scope creep is the plan, if you can ship weekly.** 21 releases in the first three weeks.
   Small, frequent releases made ambition safe.
3. **Taste doesn't automate.** Claude can write liner notes; it took a voice skill and many
   rounds of tuning (v4.6.1) before they sounded like me. Judgment is the scarce input.
4. **Build the guardrails before you need them.** Tests (142 files), validation that fails when
   the README stats drift, a kill switch for social posting, independent QA on every PR by a
   different model. A non-engineer learns to trust process because you can't trust your eyes.
5. **Your data is more interesting than you think.** A pandemic Google Sheet turned into 2,267
   songs and 376 setlists. "Five Songs That Didn't Exist Yet" (v6.0.0) — the data told stories
   I never would have found.
6. **Make it talk.** v5.0 "Forty Years, Now a Conversation" and the MCP server: the archive is
   now something you ask, not something you browse. The interface trend, seen up close.
7. **Let it run itself.** v6.1 "The Archive Posts Itself": GitHub Actions write liner notes,
   post On This Day, refresh data. The project works while I sleep — and what that requires.
8. **Physical is the last mile.** v7.0 "Now Spinning": from web app to a Pi and a TV in the
   living room. Software that leaves the screen.
9. **What I still can't do.** Honest section: I still can't read the code. What broke, what I
   rolled back, what I'd do differently. Credibility for everything else.

Hooks to open with:
- "A year ago I'd never written a React component. Last week my record player started
  telling my TV what song was playing."
- "49 releases. 0 lines of code typed by me. 1 very patient wife."
- "I set out to list every concert I've been to. I ended up learning how software gets made."

---

## The infographic

### Concept options

**1. The Ticket Stub** *(recommended)*
A tall concert-ticket layout: "ADMIT ONE — The Morperhaus Archive, Year One". Perforated
edge divides "The Shows" (186 concerts, 261 artists, 80 venues, 40 years) from "The Build"
(49 releases, 67 specs, 5 Workers, 0 lines by hand). Fits the brand and is recognisable in a
LinkedIn feed at thumbnail size.

**2. The Setlist**
Styled like a taped-to-the-stage setlist: each "song" is a milestone with its version and
date. Encore = Now Spinning. Very on-theme; less room for numbers.

**3. The Liner Notes / Gatefold**
Echoes the artist gatefold from the site: left panel the music stats, right panel the build
stats, the vinyl in the middle as a timeline of the year's 49 releases.

**4. Two-timeline split**
Top: 1984 → 2026, the concerts. Bottom: Jan → Dec 2026, the releases. Same width, different
scale — "forty years of shows, one year of building".

### Must-have panels
- Hero numbers: 186 / 261 / 80 / 40 years
- Build numbers: 49 releases, 7 major versions, 67 specs, 142 test files
- Release cadence chart: the burst in January, the bursts in March and August
- "Most" callouts: Social Distortion ×8, Pacific Amphitheatre ×17, 2022 ×14
- Version names as a strip — they're good titles ("Mange Tout, 1984", "Five Songs That
  Didn't Exist Yet")

### Format notes
- LinkedIn: 1080×1350 (4:5) for the feed; a carousel PDF (one panel per slide) usually
  outperforms a single image.
- Build it as HTML in the site's design system, then export PNG + PDF. It could also live at
  `/year-one` on the site as a permanent page the article links to.

---

## Open questions for Mike

1. Which spine: A, B, or C?
2. Which infographic concept — and single image, carousel, or both?
3. Should the infographic also ship on the site (e.g. `/year-one`)?
4. Are the cost and usage numbers (Claude spend, sessions) ones you're willing to share?
5. Publish date — Dec 26 itself, or the week before so it doesn't land in the holiday dead zone?
