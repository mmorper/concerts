# Year One — The Technical Learnings Article + Infographic

*Working doc for the first-anniversary LinkedIn article and its stats infographic. The build
started Dec 27, 2025, so the anniversary is **Dec 27, 2026**. This is the follow-up to the
"Claude Code Is a Misnomer" article.*

**Focus (from Mike):** only the technical lessons, from a non-developer. Where I started,
where I am now: first release to latest. Commits → PRs → connecting services. Not a tour of
the concert stats.

---

## Then vs. now — the numbers

"Then" is the v1.0.0 commit (`f3a5554`, Dec 31, 2025, four days in). "Now" is `main` on
Nov 28, 2026. Every number below was counted from git or GitHub, not estimated.

| | v1.0 (Dec 31, 2025) | Now (Nov 2026) | Change |
|---|---|---|---|
| Lines of code (TS/JS/Python/Swift, tests excluded) | 7,339 | 105,475 | **14×** |
| Automated tests | 0 | **2,563** (2,464 JS/TS + 99 Python) | 0 → 2,563 |
| Test files | 0 | 154 | |
| Lines of documentation | 8,251 | 97,352 | **≈ as many lines of docs as code** |
| Docs (markdown files) | 21 | 196 | |
| Specs | 13 | 115 | |
| External services / APIs | ~5 | **~22** | see list below |
| CI/CD workflows (GitHub Actions) | 0 | 14 | |
| Cloudflare Workers (server code) | 0 | 5 | |
| Claude skills + slash commands | 0 | 33 (16 skills, 17 commands) | |
| Platforms | 1 (web) | 3 (web, Raspberry Pi, Apple TV) | |

### GitOps, by the numbers

| Stat | Value |
|---|---|
| Commits | **1,302** over **192** active days |
| Busiest day | **87 commits** (Nov 2, 2026 — the photos and videos release) |
| Releases | 49 named releases, v1.0 → v7.0 |
| Commits made by bots (the archive committing to itself) | 199 from GitHub Actions + 50 from Dependabot |
| Issues opened / closed | **280 / 228** |
| Epics | **21** |
| Pull requests opened / merged | **455 / 404** |
| Dependabot PRs | 94 |
| First GitHub issue | **Feb 2, 2026** (day 37): "Venue photos broken" |
| First pull request | **Apr 19, 2026** (day 113). For the first four months I committed straight to `main`. |
| Commit types | 246 `feat`, 228 `fix`, 227 `docs`, 152 `content`, 100 `data` — nearly as many docs commits as features |

### Services connected

**v1:** Google Sheets, Google Maps geocoding, TheAudioDB, Last.fm, OpenStreetMap tiles.

**Now:** Google Sheets, Google Places, GA4 Data API, Chrome UX Report, Spotify, Deezer,
Apple Music / iTunes, MusicBrainz, Cover Art Archive, Wikidata / Wikimedia, TheAudioDB,
setlist.fm, Ticketmaster, Anthropic (Claude API), Cloudflare (Pages, Workers, R2,
Turnstile), GitHub API + Actions, Ahrefs, Semrush, Bluesky, Mastodon, Instagram, Shazam.

### Milestones on the timeline (for the article and the infographic)

| Date | Milestone |
|---|---|
| Dec 27, 2025 | First commit: "Initial project structure". Five "phases" in one day. |
| Dec 31 | v1.0.0 |
| Jan 7, 2026 | First skill (design system) and the first `/spec` + `/implement` commands |
| Feb 2 | First GitHub issue, first CI workflow |
| Mar 8 | Liner notes: Claude writing as a product marketer |
| Apr 19 | First pull request: the animated video pilot (Social Distortion), the seed of Virtru Decks |
| Jun 16 | MCP server: the archive becomes something you add to Claude |
| Jun 20 | v5.0: Ask the Archive, chat on top of the MCP tools |
| Aug | 321 commits in one month, the busiest |
| Oct 10 | The steward skill: the rules for how a Claude session carries a PR to done |
| Oct 31 | v6.1: "The Archive Posts Itself" — automated social posting |
| Nov 21 | Independent QA by a different model; Now Spinning starts |
| Nov 27 | v7.0 "Now Spinning": a turntable → Raspberry Pi → Apple TV |

---

## Article structure (draft outline)

**Working title options**
- "From a Google Sheet to three platforms"
- "1,302 commits later: what a non-developer learned building with agents"
- "From committing to main to multi-agent QA"

**Framing note (Mike):** don't lean on "I can't read the code". It doesn't matter anymore and
reads as a limitation. Frame around what got built and how the work is run.

**Hook:** "A year ago I didn't know what a pull request was. This week my turntable told my
Apple TV what song was playing — and a different AI checked the work before I merged it."

### 1. Where I started
Holiday project, a Google Sheet, 7,339 lines of code. No tests, no CI, no
issues, everything pushed straight to `main`. (Short: the first article told this part.)

### 2. Where I am now
The then/now table, as prose or a single image.

### 3. What the agent learned to do (the capability arc)
- **Write in the voice of a developer.** Commit prefixes, PR descriptions, release notes,
  changelogs. Lesson: the agent follows conventions you write down (`.claude/readme-maintenance.md`
  is the voice guide).
- **Write in the voice of a product marketer.** Liner notes, What's Playing. Lesson: a voice
  skill plus examples, then iterations of tuning (v4.6.1). Two voices in one repo, kept apart.
- **Create and publish content with code.** Generated share images, deep links to a single
  night (`/?scene=artists&artist=…&show=…`), scheduled posts to Bluesky / Mastodon /
  Instagram, with a kill switch. Lesson: publishing automation needs a stop button before it
  needs a go button.
- **Animated posts → Virtru Decks.** The April video pilot (first PR in the repo) taught the
  pipeline: data → storyboard → render → voiceover. It became the day-job plugin where
  employees use an agent to build on-brand presentations that can be animated and narrated.
  **Deployed company-wide**; very well received, with feedback on its value still arriving
  every week. *The side project trained the day job.*
- **Skills and voices → Marketing Sherpas.** Learning to write skills, and to make one agent
  write in several voices, led directly to Marketing Sherpas: a suite of agent plugins with
  ~40 skills and a shared canonical context library, now used by the marketing department.
  It would not exist without this project.
- **How MCP actually works.** Plain-English explainer: the archive exposes tools
  (`search_concerts`, `get_artist_history`, `on_this_day`…); Claude decides which to call and
  reads the results. Ask the Archive is the same tools behind a chat box. Worth one simple diagram.
- **Leaving the screen: the turntable.** A Raspberry Pi listens to the record, identifies it,
  matches it to the archive, and an Apple TV app shows it. Software, hardware, and two more
  languages (Python, Swift) added without slowing down.

### 4. Lessons learned
1. **Riff with the robot.** Don't be super prescriptive at the start. Explore with the agent,
   ask what it would do, let it push back.
2. **Land on an approach, then write the spec.** The riffing ends; the spec becomes the source
   of truth. (115 specs.)
3. **Break the spec into issues.** GitHub issues and epics make the work trackable and
   resumable across sessions. (280 issues, 21 epics.)
4. **Documentation is critical, user docs included.** 97k lines of docs vs. 105k lines of
   code. Docs are how the next session, and the next person, knows what's true.
5. **GitOps: I knew nothing about it a year ago.** Commits → branches → PRs → CI → automated
   deploys. First PR on day 113; 455 since. The bot commits more than some humans.
6. **Use the most capable model to build out the spec; let others write code.** Planning and
   architecture get the strongest model; implementation can be cheaper and faster.
7. **QA with a different agent — against the spec, not the PR.** The author grades its own
   homework kindly. A second model, on a different model family, checking what was *asked*
   rather than what was *built*. Since Nov 21 every PR gets this pass; the owner still merges.
8. **Give agents expert hats.** Designer, UX researcher, architect, during spec and mock-up
   stages. Ask for mocks before code (see `docs/mock-ask-the-archive.html`).
9. **Guardrails over trust.** Tests went 0 → 2,563. Validation that fails when the README
   stats drift, the social kill switch, Dependabot, independent QA. Nobody reviews 105k lines
   by eye, so the system checks itself, whoever (or whatever) wrote the code.

### 5. Close
What it means for non-developers in product and marketing roles: the bottleneck moved from
"can you code" to "can you say what you want, check whether you got it, and run a process."

---

## Other ideas to consider

- **A "what broke" section.** Credibility. Candidates: the Google Places photo URLs that
  expired (issue #1), rollbacks (`/release-undo` exists for a reason), the four months
  without PRs.
- **The bot as a contributor.** 249 commits by bots — the archive maintains itself. Strong
  infographic stat.
- **Docs ≈ code.** Probably the most surprising single stat for engineers *and* non-engineers.
  Could be the infographic's hero.
- **Cost — confirmed, sharing it.** $20/month for the first ~6 months, then the $100/month
  Max plan: about **$720 for the year**. "No regrets." Pairs well with the then/now table.
- **The day-job spillover as its own section.** Virtru Decks (company-wide) and Marketing
  Sherpas (marketing department) are the "so what" for LinkedIn readers.
- **Carousel instead of one long article**, or both: article for depth, carousel to travel.

---

## The infographic

Now technical, so the concept changes from the music theme to "then vs. now", still dressed
in the archive's look.

**Concept A — The Pressing (recommended).** Two records side by side: a 7" single labelled
"v1.0 · Dec 2025" and a 12" LP labelled "v7.0 · Nov 2026", with the stats on each label. The
size difference *is* the chart. Tracklist strip underneath = the milestone timeline.

**Concept B — The Git Graph.** A real commit graph for the year, rendered as a subway map:
`main` as the line, stations at each release, branches appearing at day 113 when PRs start.
Stats in the margins. Very technical, very shareable with engineers.

**Concept C — Then / Now split card.** Classic two-column comparison, big numbers:
0 → 2,563 tests, 7k → 105k lines, 5 → 22 services, 0 → 455 PRs. Easiest to read at
thumbnail size.

**Chosen: Concept A, The Pressing.**

**Must-have numbers:** ~$720 for the year · 2 day-job products spun out · 1,302 commits · 455 PRs · 280 issues · 21 epics · 0 → 2,563 tests ·
7,339 → 105,475 lines · 97k lines of docs · ~5 → ~22 services · 3 platforms · 49 releases ·
0 lines written by hand.

**Format:** 1080×1350 single image for the article header, plus a 6–8 slide carousel PDF
(one lesson or stat per slide). Build as HTML in the site's design system, export PNG + PDF.

---

## Still to pull before publishing

- Number of distinct models/agents used, and the QA-pass count since Nov 21
- Virtru Decks: no hard numbers; use "deployed company-wide, feedback arriving weekly"
- Confirm "0 lines written by hand" is literally true
