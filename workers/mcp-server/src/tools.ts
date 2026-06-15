// Tool implementations land in W3 (#106). This file holds the wiring shape
// so src/index.ts can register tools by name without each implementation
// existing yet. Each tool gets its own file under src/tools/ in W3.
//
// Reference: docs/specs/future/global-mcp-server.md §"The 6 Tools" + addendum
// §"Three layers" for which tools are deterministic / hybrid / runtime-LLM.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "./types.js";

export function registerTools(_server: McpServer, _env: Env): void {
  // W3 will register:
  //   get_archive_info   — deterministic (facts.json)
  //   search_concerts    — deterministic
  //   on_this_day        — deterministic
  //   surprise_me        — deterministic
  //   get_artist_history — hybrid (deterministic list + getNarration("artists", slug))
  //   get_venue_history  — hybrid (deterministic list + getNarration("venues", slug))
  //   query              — runtime LLM (Haiku, KV-capped — see data.ts readQueryUsage)
}
