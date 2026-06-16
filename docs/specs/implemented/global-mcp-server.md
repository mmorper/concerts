# Morperhaus Concert Archive — MCP Server

**Status:** Planned
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None — standalone Cloudflare Worker alongside existing meta-injector

-----

## Executive Summary

The Morperhaus Concert Archive MCP server exposes 40 years of personal concert history as a
publicly accessible Model Context Protocol server. Any MCP-compatible AI client — Claude Desktop,
Claude Code, Cursor, and others — can connect and have a genuine conversation with the archive.

Every tool returns **narrated responses in the archive’s biographical voice** — first person,
music-journalist register, inherited from `.claude/skills/liner-notes-voice/SKILL.md`. This is
not a JSON faucet. It speaks as the archive.

Phase 1 ships 6 tools. All data is already publicly hosted. No new infrastructure. Stateless
Worker, read-only data, tiny blast radius.

-----

## Scope (locked 2026-05-17)

**The MCP server reads from `public/data/*.json` and returns what's there. It does not call upstream APIs at runtime.**

- ✅ In scope: query, filter, paginate, narrate over `concerts.json`, `artists-metadata.json`, `artists-top-tracks.json`, `setlists-cache.json`, `venues-metadata.json`, `facts.json`, `genres-timeline.json`
- ❌ Out of scope: outbound calls to Ticketmaster, setlist.fm, Spotify, Google Places, or any other upstream service
- ❌ Out of scope: proxying or relaying any client-side key from the main site
- Data freshness ceiling = whatever the existing build pipeline (`scripts/build-data.ts`, the venue-photos cron, etc.) produces. The MCP never widens that ceiling on its own.

**Why this matters:** keeps the Worker stateless, removes any need for upstream-API secret management inside the MCP, and bounds the blast radius to the same surface as the static site itself. Any future case for live API calls inside the MCP triggers a scope renegotiation, not a quiet expansion.

This decision was reached during the architecture risk review sprint (see [#108](https://github.com/mmorper/concerts/issues/108), spike [#109](https://github.com/mmorper/concerts/issues/109)) and dissolves the W1-blocking concern about "repeating the upstream-secret-leakage mistake one Worker over."

-----

## Addendum 2026-05-17: Agentic Layer

Decided after W1 ([#104](https://github.com/mmorper/concerts/issues/104)) shipped and before W2 ([#105](https://github.com/mmorper/concerts/issues/105)) began. Reshapes how narration is produced. Does not change the scope lock above — the MCP server still reads only from `public/data/*.json` at runtime. Haiku is invoked **at build time** to author narration prose; the MCP Worker itself remains a static-file reader.

### Why this exists

Two observations from W1's verification work pushed the design:

1. **Schema thinness**: `venues-metadata.json` has no `capacity`/`neighborhood`/`description` fields and only 12/78 venues have `notes`. `artists-metadata.json` has bios on only 5/279 artists. Templated narration over this data sounds formulaic at scale — a known weakness that won't go away by writing better templates.
2. **The 10ms CPU ceiling is tight**: post-W1 measurements show p99 cpuTime at 14ms even with `caches.default` warming. Runtime LLM calls would add 500ms–2s of latency and ~$0.04 per request — wrong cost shape for a personal-scale archive.

The pattern resolves both: move LLM work to build time, where it costs $13 once per full regen and zero per MCP request. The site is also already running build-time agentic content via the liner-notes pipeline ([.claude/skills/liner-notes-pipeline/SKILL.md](../../../.claude/skills/liner-notes-pipeline/SKILL.md)), so this fits the established architecture.

### Three layers

| Tool | Layer | Notes |
| --- | --- | --- |
| `get_archive_info` | **Deterministic** | Reads `facts.json`; templated prose |
| `search_concerts` | **Deterministic** | Filter + list; drop the "if a pattern is obvious" closing sentence in v1 |
| `on_this_day` | **Deterministic** | List by `MM-DD` |
| `surprise_me` | **Deterministic** | Angle selection is deterministic per the existing spec; angle prose stays templated (one short sentence per angle variant — doesn't benefit from agentic creativity) |
| `get_artist_history` | **Hybrid: deterministic list + build-time narration** | Show list deterministic; opening context line + closing arc read from `public/data/narrations/artists.json`. Template fallback if narration missing |
| `get_venue_history` | **Hybrid: deterministic list + build-time narration** | Same pattern. Reads from `public/data/narrations/venues.json` |
| `query` | **Runtime LLM** | New 7th tool — in scope for v1. See "Decision: runtime `query` escape hatch" below for caps, enforcement, and budget |

### Build-time narration pipeline

New script: `scripts/generate-narrations.ts`. **Not wired into `build-data`** — runs on its own. Keeps the default data pipeline Anthropic-free.

Output shape (`public/data/narrations/venues.json`):

```json
{
  "irvine-meadows": {
    "narration": {
      "context": "Irvine Meadows in Irvine, California — demolished in 2016 for residential development after hosting 16 shows from 1984 to 2003.",
      "closingArc": "One of the venues I returned to most through the late '80s amphitheater boom."
    },
    "inputHash": "sha256:a3f8...",
    "generatedAt": "2026-05-17T...",
    "promptVersion": 1
  }
}
```

Same shape for artists.

### Hash-based regeneration

The dataset is nearly static (182 concerts, adds maybe a handful per year). Cadence-based regeneration is wasteful. Trigger on change instead.

**Per-entity hash inputs:**

- **Venues**: `name, cityState, status, closedDate, notes, stats.totalConcerts, stats.firstEvent, stats.lastEvent, stats.uniqueArtists, top-3 headliners from concerts[]`
- **Artists**: `name, concert count, dateRange first–last, top venue + count, top tour year if discernible`

Each hash combines those fields + a `PROMPT_VERSION` constant. On `npm run generate:narrations`:

1. Walk every entity in source JSON
2. Recompute hash
3. Regenerate only entities where `currentHash != storedHash`
4. Write back to `narrations/{venues,artists}.json`

Steady-state cost: **$0** (no-op when nothing changed). New concert added: **~$0.04** (one entity regenerates). Prompt rewrite — bump `PROMPT_VERSION`: **~$13 once** (full regen of 78 venues + 256 artists).

### Decision: runtime `query` escape hatch (resolved 2026-05-17)

**In scope for v1.** A 7th tool for freeform questions that don't fit the other 6 — e.g., *"artists I've seen in both LA and SF in the same year"*. Hard to write as a fixed tool, trivial for an LLM with the concerts JSON in context.

#### Budget

Hard cap: **≤ $10/month**. Two daily limits, whichever trips first:

- **250K tokens/day combined** (input + output, recorded from Anthropic API response's `usage` field, not estimated)
- **8 calls/day**

Either limit reached → tool returns a polite refusal (*"today's query budget is spent — try a deterministic tool, or come back tomorrow"*) without calling Anthropic.

**Math** (Haiku 4.5 assumed pricing: $1/MTok input, $5/MTok output — verify current pricing before W2 implementation):

- Typical call: ~50K input + ~500 output ≈ **$0.06/call**
- Worst-case day at cap: 250K × ($1 + $5)/2 = $0.75 — but realistic 95/5 input/output blend = **~$0.30/day = $9/month**
- The 8-calls/day cap prevents the failure mode where one runaway request elaborates to 100K output tokens and eats the daily budget in a single hit

#### Enforcement (Worker-side)

State lives in **Cloudflare KV**, key `query-usage:YYYY-MM-DD`, value `{tokens: N, calls: N}`, TTL 48h (self-cleaning).

Per-request flow inside the Worker:

1. **Pre-flight**: read today's KV record. If `tokens >= 250000` OR `calls >= 8`, return refusal immediately — never call Anthropic.
2. **Call**: hit Anthropic with the user's question + concerts.json context.
3. **Post-flight**: update KV with `{tokens: previous + usage.input_tokens + usage.output_tokens, calls: previous + 1}`. Use `ctx.waitUntil(...)` so the write doesn't block the response.

**Concurrency note**: KV reads are eventually consistent (~60s propagation). Two simultaneous calls could both see "under cap" and both proceed. For this scale (8/day) the worst case is a one-call overage — acceptable. If usage ever justifies it, swap KV for a Durable Object for atomic counters; out of scope for v1.

**Free-tier headroom**: KV free tier is 100K reads/day + 1K writes/day. At 8 calls/day we use 8 reads + 8 writes. Effectively unmetered.

#### Other guardrails (kept from open-question draft)

- **Max input size**: send `concerts.json` only (~50K tokens). Do NOT include venues-metadata.json or artists-metadata.json — those bloat context without helping freeform queries answer better.
- **Refusal patterns**: prompt instructs the model to refuse non-archive questions ("politics", "weather", "code help") with a one-line redirect.
- **Output framing**: prompt instructs *"I think..."* / *"my count says..."* rather than authoritative claims — runtime LLM may miscount; the user should know.

#### What this opens up

Questions like *"which years did I see the most ska shows?"* or *"artists I saw exactly twice"* now have an answer path. Deterministic tools stay primary; `query` is the escape hatch when none of the other 6 fit.

### W2 (#105) scope changes

- Data-access helpers read `narrations/{venues,artists}.json` alongside source JSON; expose a `getNarration(kind, slug)` lookup that returns `null` on miss so callers can fall back to templates.
- `scripts/generate-narrations.ts` lands as a W2 deliverable (or split as a parallel work stream — owner's call). Includes the hash logic and the Anthropic client wiring.
- Narration prompt file lives at `scripts/narrations/prompt.md` (or similar) — kept separate from code so prompt-only edits don't trigger a full repo review.
- `public/data/narrations/.gitkeep` + add `narrations/*.json` to the data refresh contract.
- **`query` tool wiring**: KV namespace `MCP_QUERY_USAGE` declared in `workers/mcp-server/wrangler.toml`; bound to the Worker. Anthropic SDK or raw `fetch` to `api.anthropic.com` (lightweight enough that a SDK may be overkill in a Worker). `ANTHROPIC_API_KEY` stored as a Wrangler secret, not in source.
- **`query` tool prompt** lives at `workers/mcp-server/prompts/query.md` — separate file so prompt-only edits stay small. Includes refusal patterns + "I think..." framing instructions.

### Cost model

| Event | Frequency | Cost |
| --- | --- | --- |
| Routine MCP query | Per request | $0 (build-time prose, no runtime LLM) |
| Add one concert + regen | Weekly-ish | ~$0.04 |
| Prompt iteration (bump version) | Quarterly-ish | ~$13 |
| Full cold regen | ≤ twice/year | ~$13 |
| Annual estimate (steady state) | — | **~$30–50** |

The `query` escape hatch (see "Decision" above) adds **≤ $10/month** capped — at 8 calls/day × $0.06 = $14.40/month worst case before the token cap kicks in, ~$9/month at the realistic input-heavy mix. Combined ceiling: **~$40/year build-time + ~$108/year query = ~$150/year all-in** for the entire MCP server.

### What this addendum does NOT change

- Scope lock above — still no outbound *data* APIs at runtime. Haiku-at-build-time is build infrastructure, not a runtime upstream dependency.
- The 6 tool descriptions in "The 6 Tools" — those still describe externally-observable behavior. The addendum changes how the prose inside the response is produced, not what's returned.
- W1 — already shipped. The restructure and `caches.default` work stand independently.

-----

## Voice

All narration inherits from `.claude/skills/liner-notes-voice/SKILL.md`. That file is the
source of truth for voice rules — do not duplicate its contents here or in the server prompt.
When the skill evolves, server voice evolves with it.

**Enrichment reality** (confirmed from repo inspection in the preceding design session):

- `artists-metadata.json` — genres, formed year, website. No bios. Only 5/279 artists have data.
- `artists-top-tracks.json` — top tracks for 257/279 artists. Rich and reliable.
- `setlists-cache.json` — 78% concert coverage. Keyed by `concertId`.
- `venues-metadata.json` — 941K. Richest enrichment file. Load lazily per tool.
- `facts.json` — 4K of pre-computed stats. Perfect backbone for `get_archive_info`.

When enrichment is absent: don’t pad. Move on.

-----

## Architecture

### Deployment

The server runs as a **separate Cloudflare Worker** at `concerts.morperhaus.org/mcp`.

```
concerts.morperhaus.org
  ├── /*          → concerts-meta-injector Worker (existing, SEO/bot handling)
  └── /mcp*       → morperhaus-mcp Worker (new, this spec)
```

Cloudflare resolves route conflicts by specificity — `/mcp*` wins over `/*` for MCP requests.
Both Workers coexist on the same zone without modification to the meta-injector.

### Worker Directory Structure

Current layout is flat (`/workers/*.js`). This spec introduces subdirectories for both Workers:

```
/workers/
  ├── meta-injector/          # Rename from existing flat files
  │   ├── worker.js
  │   └── wrangler.toml
  └── mcp-server/             # New — this spec
      ├── package.json
      ├── wrangler.toml
      └── src/
          ├── index.ts
          ├── data.ts
          ├── tools.ts
          └── types.ts
```

**Meta-injector migration is a separate gate** — see Window 1.

### Data Flow

```
MCP client (Claude Desktop, Claude Code, Cursor, etc.)
    │
    │  HTTP POST — Streamable HTTP transport
    ▼
concerts.morperhaus.org/mcp
    │
    ▼
Cloudflare Worker (morperhaus-mcp)
    │
    ├── ALWAYS (cold start, ~215K total)
    │   ├── concerts.morperhaus.org/data/concerts.json        ~124K
    │   ├── concerts.morperhaus.org/data/facts.json           ~4K
    │   └── concerts.morperhaus.org/data/artists-metadata.json ~85K
    │
    └── LAZY (fetched on first tool use that needs them)
        ├── concerts.morperhaus.org/data/artists-top-tracks.json  ~748K
        ├── concerts.morperhaus.org/data/setlists-cache.json      ~815K
        └── concerts.morperhaus.org/data/venues-metadata.json     ~941K
```

**SKIP** (not useful for text-based MCP):

- `geocode-cache.json` — lat/lng only
- `venue-photos-cache.json` — photo URLs only
- `liner-notes.json` — app UI content
- `discography.json` — too large, low marginal value given top-tracks coverage

### Lazy-Load UX: Background Prefetch on First Hot Path

The naive lazy-load approach pays the full fetch latency on first call. For a 941K venues
file that’s a noticeable pause on the first venue question. Mitigate with opportunistic
prefetch via `ctx.waitUntil`:

```typescript
// On first successful tool call, warm lazy caches in the background
// User gets fast response; next call finds caches hot
if (isFirstRequest) {
  ctx.waitUntil(prefetchLazyFiles())
}
```

The first caller still pays latency on the specific lazy file their tool needs.
The second caller (and subsequent callers) hit warm caches across the board. This is
a “good enough” tradeoff — no cold start for common follow-up queries without paying
the full cold-start cost up front.

### Transport

**Cloudflare `agents/mcp` SDK** (`McpAgent` class) — not the raw `@modelcontextprotocol/sdk`.

The raw MCP SDK’s `StreamableHTTPServerTransport` uses Node streams unavailable in the
Workers runtime without `nodejs_compat`. Cloudflare’s `agents/mcp` is the correct adapter.

### Caching

**Cloudflare Cache API with 5-minute TTL** for all data files.

```typescript
async function fetchWithCache(url: string, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default
  const cached = await cache.match(url)
  if (cached) return cached

  const response = await fetch(url)
  const toCache = response.clone()
  ctx.waitUntil(cache.put(url, toCache))
  return response
}
```

TTL set via `Cache-Control: max-age=300` on the cached response.

-----

## Cloudflare Configuration

### wrangler.toml

```toml
name = "morperhaus-mcp"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[[routes]]
pattern = "concerts.morperhaus.org/mcp*"
zone_name = "morperhaus.org"

[vars]
DATA_BASE_URL = "https://concerts.morperhaus.org/data"
```

### Route Collision — Step-by-Step

1. Open Cloudflare dashboard → Workers & Pages → your zone (`morperhaus.org`)
1. Go to **Workers Routes**
1. Confirm `concerts.morperhaus.org/*` is assigned to `concerts-meta-injector`
1. After deploying `morperhaus-mcp`, confirm `concerts.morperhaus.org/mcp*` appears
   as a separate route assigned to the new Worker
1. Cloudflare applies the **most specific matching route** — `/mcp*` takes precedence
   over `/*` for any request to `/mcp` or `/mcp/...`
1. Test: `curl https://concerts.morperhaus.org/` should still hit the meta-injector
1. Test: `curl -X POST https://concerts.morperhaus.org/mcp` should hit the MCP Worker
1. If routes conflict, manually reorder in the dashboard (more specific first)

### CORS Headers

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
}
```

`Mcp-Session-Id` is required in both `Allow-Headers` and `Expose-Headers` for Claude
Desktop’s session handshake to complete. Omitting it causes silent failure.

-----

## Server Identity

```
Name: Morperhaus Concert Archive
Description: 40 years of live music — 1984 to the present. Ask about artists, venues,
             decades, or just say "surprise me."
```

### `explore_archive` Prompt

Keep the prompt short. Voice rules live in `.claude/skills/liner-notes-voice/SKILL.md` —
the skill is the source of truth. The prompt is just the framing.

```
You are the Morperhaus Concert Archive — 40 years of live music, 1984 to the present,
speaking in your own voice. Speak as the archive itself, in first person. See the
project's liner-notes-voice skill for full voice rules.

Be honest about gaps. When you have enrichment (genres, top tracks, setlists), use it.
When you don't, say so and move on.
```

-----

## Error Handling — Five Failure Modes

All five handled explicitly. No generic catch-all.

### 1. Data file HTTP error (500, 404, network failure)

```typescript
try {
  data = await fetchWithCache(url, ctx)
} catch (e) {
  console.error(`Data fetch failed: ${url}`, e)
  return { error: "temporary", message: "Archive data temporarily unavailable. Try again in a moment." }
}
```

### 2. Malformed JSON in data file

```typescript
let parsed
try {
  parsed = await response.json()
} catch (e) {
  console.error(`Malformed JSON: ${url}`, e)
  return { error: "data", message: "Archive data is currently malformed. Reporting." }
}
```

### 3. Join miss — concert found, setlist/metadata not available

This is **not** an error. Tools gracefully omit enrichment:

```typescript
const setlist = setlistsCache[concert.id]  // may be undefined — that's fine
if (setlist) {
  narration += ` The setlist that night included ${setlist.songs[0]} and ${setlist.songs[1]}.`
}
// else: say nothing — don't say "no setlist available"
```

### 4. Artist partial-match ambiguity

Example: `"Peter Hook"` could match `"Peter Hook"` and `"Peter Hook and the Light"`.

Behavior: prefer exact match. If only partial matches, prefer the shortest. If multiple
shortest candidates, return all with a disambiguation line:

```
I have multiple artists matching "Peter Hook":
- Peter Hook
- Peter Hook and the Light

Which one did you mean?
```

### 5. Workers runtime exception mid-tool

The outermost handler wraps every tool call in a try/catch. Logs via `wrangler tail`,
returns a narrated apology rather than a 500:

```typescript
try {
  return await executeToolCall(name, args)
} catch (e) {
  console.error(`Tool ${name} threw:`, e)
  return { content: "Something went wrong answering that — try again or ask something else." }
}
```

-----

## The 6 Tools

Concert IDs are included in list responses so follow-up queries can thread.
Format: `[concert-N]` inline after the show detail.

Tool descriptions are written in the archive’s voice — they read as if the archive is
offering them. The AI client reads these before any tool runs; they set the tone.

-----

### 1. `get_archive_info`

**Description:** *“The front door. A sense of the collection’s shape — four decades, the
artists and venues that keep coming back, the rhythm of a concert life.”*

**Parameters:** None

**Data:** Use `facts.json` (pre-computed). Fall back to computing from `concerts.json`
if facts.json fails to load.

**Returns:**

```
I've been to [N] concerts across [X] years, from [earliest] to [most recent] —
[V] venues in [C] cities.

Most-seen artists: [top 5 with counts]
Most-visited venues: [top 5 with counts]
Most active decade: the [decade]s, with [N] shows.

The longest stretch without a show: [N] days, between [show A] and [show B].
```

-----

### 2. `search_concerts`

**Description:** *“Search memory by name, by place, by year.”*

**Parameters:**

- `artist` (string, optional) — headliner or opener, case-insensitive partial match
- `year` (number, optional) — exact year
- `decade` (string, optional) — “1980s” | “1990s” | “2000s” | “2010s” | “2020s”
- `city` (string, optional) — partial match
- `genre` (string, optional) — partial match
- `limit` (number, optional, default 10, max 25)

**Multi-result behaviour:** Flat chronological list, one line per concert, hard cap at
`limit`. If results hit the cap: append “That’s [limit] of [N] matches — try narrowing
the search.” No arc summaries, no pagination.

> **Note (per Addendum 2026-05-17):** In v1, drop the `[If a pattern is obvious: one closing sentence.]` line below — `search_concerts` is fully deterministic; pattern-spotting moves to the `query` escape hatch.

**Returns:**

```
[N] concerts matching "[query summary]":

[Artist] — [Venue], [City] ([Mon YYYY]) [concert-N]
[With [opener] opening.] — if applicable
...

[If a pattern is obvious: one closing sentence.]
["That's [limit] of [N] — try narrowing the search." — if capped]

[If zero results:]
"[Term] isn't in the archive. [If notable absence: one plain sentence about it.]"
```

-----

### 3. `get_artist_history`

**Description:** *“Everything I remember about an artist — every show, every venue,
every year.”*

**Parameters:**

- `artist` (string, required) — case-insensitive partial match

**Enrichment:**

- Genres + formed year from `artists-metadata.json` if present (5/279 have data)
- Top tracks from `artists-top-tracks.json` if present (257/279 coverage)
- Opener context from `concerts.json`
- Opening context line + closing arc from `public/data/narrations/artists.json` (per Addendum 2026-05-17 — hybrid layer). The templated arc shown in the Returns block below is the **fallback** when narration is missing.

**Returns:**

```
I've seen [Artist] [N] time(s)[, across [X] years ([first]–[last])].
[If genres/formed available: "Formed [year], [genre]."]

[n]. [Full date] — [Venue], [City] [concert-N]
     [With [openers] opening.] — if applicable

[If top tracks available: "Known for [track 1], [track 2]."]

[Closing arc — scaled to count:]
[1]:   "A single show. [Artist] appears in the archive once."
[2–4]: "Seen [N] times, [year] to [year]."
[5+]:  "[Artist] is one of the artists I've seen most — [N] times over [X] years."

[If not found:]
"[Artist] isn't in the archive. [If notable: one plain sentence.]"

[If ambiguous — see Error Handling §4 for behavior.]
```

-----

### 4. `get_venue_history`

**Description:** *“The rooms I’ve kept returning to — every show at a single venue, in order.”*

**Parameters:**

- `venue` (string, required) — case-insensitive partial match

**Data:** Loads `venues-metadata.json` lazily on first call to this tool.

**Enrichment from venues-metadata.json:** city, capacity, address, any description fields
present (schema confirmed in Window 1).

> **Note (per Addendum 2026-05-17):** Opening context line + closing arc read from `public/data/narrations/venues.json` (hybrid layer). The templated closing note in the Returns block is the **fallback** when narration is missing. Caveat: `capacity`, `neighborhood`, and `description` are NOT in the venues-metadata schema today — narration prompt must not depend on them.

**Returns:**

```
[Venue][, [City]] — [N] show(s) in the archive.
[If venue metadata available: one sentence of context.]

[n]. [Full date] — [Artist] [concert-N]
     [With [openers] opening.] — if applicable

[Closing note — scaled to count:]
[1]:   "A single visit — [date], [artist]."
[2–4]: "Visited [N] times, [year] to [year]."
[5+]:  "One of the venues I've returned to most — [N] times across [X] years."

[If not found:]
"[Venue] isn't in the archive."
```

-----

### 5. `on_this_day`

**Description:** *“Concerts that share a date — across all the years, whatever’s happened
on this day.”*

**Parameters:**

- `month` (number, optional) — 1–12, defaults to today
- `day` (number, optional) — 1–31, defaults to today

**Returns:**

```
[If matches:]
On [Month] [Day], across the years:

[YYYY]: [Artist] at [Venue], [City] [concert-N]
...

[If 1 match: "One show on this date — [artist], [year]."]

[If none:]
"Nothing in the archive on [Month] [Day]. A quiet date."
```

-----

### 6. `surprise_me`

**Description:** *“I’ll pick one. A random concert, and why it’s worth remembering.”*

**Parameters:** None

**Logic:** Select a random concert. Compute which angle is most compelling:

1. Only appearance of this artist in the archive
1. First or last time I saw this artist
1. Only show ever at this venue
1. From the most or least active year in the archive
1. Setlist available — join via `concert.id` → `setlists-cache[concertId]`

Lead with the best angle. **State the angle explicitly in the response** — transparency
about the archive’s own logic is part of the charm.

**Setlist join:** `setlists-cache.json` is keyed by `concertId` (matches `concert.id`).
Load lazily on first call. Extract `sets.set[].song[].name` for song names.

**Returns:**

```
[One-sentence "why this one" up top, naming the angle:]
"I'm surfacing this one because it's the only time [artist] appears in the archive."
"I'm picking this because it's the first of [N] times I'd see [artist]."
"This one stood out — [year] was the quietest year in the archive."
"I picked this because I have the setlist."

[Concert detail:]
[Artist] at [Venue], [City]
[Full date] [concert-N]
[Genre if known from artists-metadata] • [Formed year if known]
[With [openers] opening.] — if applicable

[If setlist available:]
"The setlist that night included [song 1] and [song 2]."

[If top tracks available:]
"Known for [track 1], [track 2]."
```

-----

## Observability

```bash
npx wrangler tail morperhaus-mcp
```

Log all data fetch errors, join failures, and tool calls at minimum. No PII in logs.

### Public Server Abuse

This server is public and unauthenticated — it can be hammered. Cloudflare Workers free
tier allows 100K requests/day before billing kicks in. If the server sees sustained
traffic beyond casual use, turn on Cloudflare’s rate limiting (documented in Phase 2).
Acceptable risk for Phase 1 — monitor via Cloudflare analytics.

-----

## Testing

### Vitest — Narration Unit Tests

Pure narration functions in `tools.ts` are unit-testable without a running Worker.
Set up Vitest snapshot tests for:

- `get_archive_info` — given mock facts.json, assert narration shape
- `search_concerts` — zero results, single result, capped results
- `get_artist_history` — 1 show, 5+ shows, artist not found, ambiguous match
- `get_venue_history` — single visit, repeat venue
- `on_this_day` — match, no match
- `surprise_me` — each interesting-angle branch

```bash
cd workers/mcp-server
npx vitest run
```

Snapshot tests catch voice regressions fast. Update snapshots intentionally when voice
evolves, not accidentally.

### `surprise_me` Angle Variation Test

Pure randomness isn’t the interesting behavior — angle variation is. Test: call 10 times
against a fixed seed, assert at least 3 distinct angle types surface across results.

### Manual E2E Checklist

- [ ] `wrangler dev` starts without errors
- [ ] `curl https://concerts.morperhaus.org/` still hits meta-injector (route isolation)
- [ ] `curl -X POST https://concerts.morperhaus.org/mcp` hits MCP Worker
- [ ] `get_archive_info` totals match `concerts.json` metadata
- [ ] `search_concerts` known artist returns correct results
- [ ] `search_concerts` unknown artist returns graceful non-empty response
- [ ] `get_artist_history` most-seen artist returns all shows in order
- [ ] `get_artist_history` ambiguous match (e.g. “Peter Hook”) prompts for disambiguation
- [ ] `get_venue_history` loads lazily (check wrangler tail — no venues fetch at cold start)
- [ ] `get_venue_history` second call in same isolate is instant (cache warmed by prefetch)
- [ ] `on_this_day` date with known shows returns correct results
- [ ] `on_this_day` date with no shows returns graceful response
- [ ] `surprise_me` returns different concerts across 5+ calls
- [ ] `surprise_me` surfaces at least 3 distinct angle types across 10 calls
- [ ] `surprise_me` setlist join works for a concert known to have setlist data
- [ ] Malformed data fetch returns graceful error (test by pointing at 404 URL)
- [ ] No named era labels in any response
- [ ] `Mcp-Session-Id` present in response headers
- [ ] `explore_archive` prompt available to connecting clients
- [ ] Connects from Claude Desktop

### Test Data Anchors

Before implementing, record from the repo:

- Total concert count (verify against `metadata.totalConcerts` in concerts.json)
- Most-seen artist and count (from facts.json)
- Most-visited venue and count (from facts.json)
- A `concertId` known to exist in `setlists-cache.json` (for surprise_me setlist test)
- A month/day with at least one show (for on_this_day)
- A month/day with no shows (for zero-result test)
- An ambiguous artist partial match (for error handling §4 test)

-----

## Implementation Plan

### Window 0: Transport POC (≤2 hours, hard cap)

**Goal:** Confirm `agents/mcp` (`McpAgent`) works with Streamable HTTP in the Workers
runtime before committing to the architecture.

**Tasks:**

1. Create a throwaway `/workers/mcp-poc/` directory
1. Install `agents` package from Cloudflare
1. Implement a single tool (`ping`) that returns `"pong"`
1. Deploy with `wrangler dev` and verify an MCP client can connect and call `ping`
1. Delete `/workers/mcp-poc/` when done

**Exit criteria:**

- **Success:** Working MCP response confirmed. Proceed to Window 1.
- **Failure within 2 hours:** STOP. Spec back to planning. Do not push through.
  `workers-mcp` may be an alternative but needs its own POC, not ad-hoc evaluation.

**Gate:** Do not proceed past Window 0 without a working MCP response in ≤2 hours.

-----

### Window 1: Directory Restructure + Test Anchors

Schemas and data sizes were confirmed in the design session. This window is small —
just the structural prep the implementation needs.

**Tasks:**

1. Move existing meta-injector files into `/workers/meta-injector/`
1. Update any deployment scripts or CI references that point to old paths
1. Redeploy meta-injector from new path: `cd workers/meta-injector && wrangler deploy`
1. **Live-fire verification** — `curl https://concerts.morperhaus.org/` returns the same
   response as before the move. If not, revert and escalate.
1. Record test data anchors (see Testing section):
- Most-seen artist + count from facts.json
- Most-visited venue + count from facts.json
- A `concertId` present in setlists-cache.json
- A month/day known to have at least one show
- A month/day known to have no shows
- An ambiguous partial-match artist name (e.g., “Peter Hook”)
1. Confirm `venues-metadata.json` narration-usable fields (description? capacity? neighborhood?)

**Acceptance Criteria:**

- [ ] Meta-injector deployed from new path and verified live
- [ ] Site response unchanged after migration
- [ ] Test data anchors recorded in a scratch file for Window 3
- [ ] `venues-metadata.json` field inventory confirmed

**Gate:** Meta-injector live and stable at the new path before Window 2 starts.

-----

### Window 2: Scaffold + Data Layer

**Files to Create:**

- `/workers/mcp-server/package.json` — `agents` (Cloudflare) + `vitest`
- `/workers/mcp-server/wrangler.toml` — per configuration section above
- `/workers/mcp-server/src/types.ts` — mirror `src/types/concert.ts` + local enrichment types
- `/workers/mcp-server/src/data.ts` — Cloudflare Cache API fetch for LOAD files; lazy fetch
  helpers for LAZY files; background prefetch on first request via `ctx.waitUntil`
- `/workers/mcp-server/src/index.ts` — `McpAgent` entry point with error handling wrapper,
  no tools yet

**Tasks:**

1. Scaffold project using `agents/mcp` pattern confirmed in Window 0
1. Implement `data.ts` with cache-first fetching (5-min TTL via Cache API)
1. Implement lazy fetch helpers for `venues-metadata`, `setlists-cache`, `artists-top-tracks`
1. Implement background prefetch: on first request, `ctx.waitUntil(prefetchLazyFiles())`
1. Wire up `McpAgent` with `explore_archive` prompt and CORS headers
1. Wrap tool execution in the runtime exception handler (Error Handling §5)
1. Verify `wrangler dev` starts and responds to a basic connection

**Acceptance Criteria:**

- [ ] `wrangler dev` starts cleanly
- [ ] LOAD files fetch and cache on first request
- [ ] LAZY files do NOT fetch synchronously at cold start (verify via `wrangler tail`)
- [ ] Background prefetch warms LAZY caches after first request
- [ ] `Mcp-Session-Id` present in response headers
- [ ] Data fetch failures return graceful error (not 500)
- [ ] Runtime exceptions caught at wrapper, logged, narrated apology returned

-----

### Window 3: All 6 Tools + Tests

**Files to Create:**

- `/workers/mcp-server/src/tools.ts` — all 6 tools, narration inline
- `/workers/mcp-server/src/tools.test.ts` — Vitest snapshots

**Files to Modify:**

- `/workers/mcp-server/src/index.ts` — register all tools

**Tasks:**

1. Implement tools in order: `get_archive_info`, `search_concerts`, `get_artist_history`,
   `get_venue_history`, `on_this_day`, `surprise_me`
1. Use tool descriptions as written (archive voice, not functional)
1. Follow voice rules from `.claude/skills/liner-notes-voice/SKILL.md` throughout
1. Include `[concert-N]` IDs in all list responses
1. Wire lazy data fetches into `get_venue_history` and `surprise_me`
1. Implement setlist join in `surprise_me` via `concertId`
1. Implement artist partial-match disambiguation (Error Handling §4)
1. Every `surprise_me` response starts with a “why this one” sentence naming the angle
1. Write Vitest snapshots for each tool’s key branches, plus the angle-variation test
1. Test all tools locally

**Enrichment integration:**

- `get_archive_info` — `facts.json` values preferred; fallback to computed
- `get_artist_history` — genres + formed year if present in `artists-metadata`; top tracks
  from `artists-top-tracks` if present
- `get_venue_history` — venue detail from `venues-metadata` (lazy load)
- `surprise_me` — setlist join via `concertId`; top tracks as fallback enrichment

**Acceptance Criteria:**

- [ ] All 6 tools return narrated first-person text — not raw JSON
- [ ] Tool descriptions read as archive voice, not functional documentation
- [ ] No named era labels in any response
- [ ] Voice matches liner-notes-voice register
- [ ] Concert IDs appear in list responses
- [ ] `surprise_me` names its angle explicitly in every response
- [ ] Ambiguous artist partial matches return disambiguation, not guesswork
- [ ] Vitest passes including angle-variation test
- [ ] Zero-result responses are non-empty

-----

### Window 4: Polish + Deployment

**Files to Create:**

- `/workers/mcp-server/README.md`

**Files to Modify:**

- `/workers/mcp-server/src/index.ts` — final CORS headers audit
- `/workers/mcp-server/wrangler.toml` — route finalisation

**Tasks:**

1. Audit CORS headers — confirm `Mcp-Session-Id` in both `Allow` and `Expose`
1. Write README (see content below)
1. `npx wrangler deploy`
1. Run full manual E2E checklist against live URL
1. Confirm meta-injector still works (`curl https://concerts.morperhaus.org/`)
1. Connect from Claude Desktop

**Acceptance Criteria:**

- [ ] Deployed without errors
- [ ] `concerts.morperhaus.org/mcp` live and responding
- [ ] Meta-injector unaffected
- [ ] Claude Desktop connected
- [ ] README example queries produce good responses

-----

## README Content

### Connecting

```
https://concerts.morperhaus.org/mcp
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "morperhaus": {
      "type": "http",
      "url": "https://concerts.morperhaus.org/mcp"
    }
  }
}
```

**Things to ask:**

- “Give me an overview of the archive”
- “Tell me about my history with Depeche Mode”
- “What shows happened on this date across all the years?”
- “Show me every concert at the 9:30 Club”
- “Search for concerts in the 1990s”
- “Surprise me”

### Deployment

```bash
cd workers/mcp-server
npm install
npx wrangler login   # first time only
npx wrangler deploy
```

Data updates automatically — no redeployment needed when data files change.

-----

## Future Enhancements (Phase 2)

- **`compare`** — “Compare my 1990s and 2010s” / “Compare Depeche Mode and New Order in the
  archive.” Uniquely possible with the biographical voice. Likely the next wow feature.
- **Deep links in responses** — surface `concerts.morperhaus.org/?scene=artists&artist=...`
  URLs alongside concert IDs. Normalized fields already exist in concerts.json.
- **`get_stats`** — gaps, decade breakdowns, longest streaks
- **`get_concert`** — single concert by ID for follow-up threading
- **`get_timeline`** — year-by-year narrative of the full arc
- **Rate limiting** — Cloudflare Worker rate limiting if traffic warrants it
- **Analytics** — which tools get used most, via Workers Analytics Engine

-----

## Success Metrics

- Live at `concerts.morperhaus.org/mcp`
- All 6 tools return responses that feel like memoir pages, not database output
- Zero-result responses are graceful and say something real
- A stranger connecting cold can learn something surprising without being told what to ask
- Meta-injector unaffected
- Vitest passing