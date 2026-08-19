# Morperhaus Concert Archive — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing 40 years of
personal concert history (1984–present) as a set of tools an AI client can call. It speaks
in the archive's own first-person voice — ask it about an artist, a venue, a date, or just
say "surprise me."

Runs as a Cloudflare Worker at `concerts.morperhaus.org/mcp`, reading the same
`public/data/*.json` files that power [concerts.morperhaus.org](https://concerts.morperhaus.org).
No database, no runtime data APIs — the Worker is a static-file reader with a thin LLM
escape hatch (`query`).

## Connecting

```
https://concerts.morperhaus.org/mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

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

(Config lives at `~/Library/Application Support/Claude/claude_desktop_config.json` on
macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Restart Claude Desktop
after editing.)

Any MCP client that speaks Streamable HTTP works the same way — point it at the `/mcp` URL.

### Things to ask

- "Give me an overview of the archive"
- "Tell me about my history with Depeche Mode"
- "What shows happened on this date across all the years?"
- "Show me every concert at the 9:30 Club"
- "Search for concerts in the 1990s"
- "Surprise me"
- "Where were Depeche Mode in their career the night I saw them?"
- "Do I catch bands early or late?"
- "Which artists have I seen exactly twice?" — _(freeform; routes to `query`)_

## Tools

| Tool | What it does |
|------|--------------|
| `get_archive_info` | Overview — counts, top artists/venues, busiest decade, longest gap. |
| `search_concerts` | Filter by `artist` / `year` / `decade` / `city` / `genre` / `cycleBucket` (limit 10, max 25). |
| `get_artist_history` | Every show for one artist, with enrichment + a count-scaled closing arc. |
| `get_venue_history` | Every show at one venue, in order, with closure context. |
| `on_this_day` | Concerts sharing a `month`/`day` across the years (defaults to today). |
| `surprise_me` | A random concert and an explicit reason it's worth remembering. |
| `get_concert_setlist` | The songs from one night, with album annotations where they're known. |
| `get_career_position` | Where one artist stood in their arc that night — and what hadn't happened yet. |
| `get_career_shape` | The same question across the whole archive: early adopter or catalogue listener? |
| `get_archive_top_songs` | Most-played songs across the setlists on record. |
| `query` | Freeform questions the others can't answer. Runtime LLM — see below. |

Everything but `query` is deterministic (or hybrid: deterministic data + build-time narration).
`get_artist_history` and `get_venue_history` read optional prose from
`public/data/narrations/{artists,venues}.json` and fall back to templates when it's absent.

### The `query` escape hatch

`query` is the only tool that calls an LLM at request time (Claude Haiku, with
`concerts.json` as context). It's budget-capped via Cloudflare KV — **250K tokens/day or
8 calls/day**, whichever trips first — and refuses politely when the day's budget is spent.
It hedges its answers ("I think…", "my count says…") because it's counting at runtime and
can miscount. Use the deterministic tools when one fits; reach for `query` only when none do.

## Local development

```bash
cd workers/mcp-server
npm install
npx wrangler dev          # serves http://localhost:8787/mcp
```

To exercise the `query` tool locally, create `workers/mcp-server/.dev.vars` (gitignored):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Smoke-test the handshake:

```bash
curl -s -D - -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
```

Look for the `Mcp-Session-Id` response header, then reuse it on follow-up
`tools/list` / `tools/call` requests.

## Tests

```bash
npm test          # Vitest — pure narration functions, snapshots
npm run typecheck # tsc --noEmit
```

## Deployment

```bash
cd workers/mcp-server
npm install
npx wrangler login                 # first time only
npx wrangler secret put ANTHROPIC_API_KEY   # for the query tool
npx wrangler deploy
```

Notes:

- **KV namespace** `MCP_QUERY_USAGE` is already declared in `wrangler.toml`. If it doesn't
  exist yet, create it with `npx wrangler kv namespace create MCP_QUERY_USAGE` and paste the
  returned `id` into the config.
- **Route** `concerts.morperhaus.org/mcp*` (zone `morperhaus.org`) is more specific than the
  meta-injector's `/*`, so Cloudflare routes `/mcp` to this Worker and everything else to the
  site. After deploying, confirm both:
  - `curl https://concerts.morperhaus.org/` still serves the site (meta-injector).
  - `curl -X POST https://concerts.morperhaus.org/mcp` reaches this Worker.
- **Data updates need no redeploy** — the Worker fetches `public/data/*.json` live (cached
  5 minutes via the Cache API). New concerts appear as soon as the site redeploys.

### Narration prose (optional)

The hybrid tools read build-time narration from `public/data/narrations/{artists,venues}.json`.
Generate it from the repo root:

```bash
npm run generate:narrations -- --dry-run   # report what would regenerate, no spend
npm run generate:narrations                # generate (Claude Haiku; ~$13 for a full cold run)
```

It's hash-based — only entities whose facts changed regenerate, so steady state is a no-op.
Until these files exist and deploy, the hybrid tools template gracefully.

## Observability

```bash
npx wrangler tail morperhaus-mcp
```

Logs data-fetch failures, tool exceptions, and query usage. No PII is logged. Phase 1 has
no rate limiting beyond the `query` budget cap — watch Cloudflare analytics for abuse and
add WAF rules in Phase 2 if traffic warrants.

## Architecture

Full design and rationale: [`docs/specs/future/global-mcp-server.md`](../../docs/specs/future/global-mcp-server.md).
