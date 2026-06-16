// Tool implementations land in W3 (#106). This file holds the wiring shape
// so src/index.ts can register tools by name without each implementation
// existing yet. Each tool gets its own file under src/tools/ in W3.
//
// Reference: docs/specs/future/global-mcp-server.md §"The 6 Tools" + addendum
// §"Three layers" for which tools are deterministic / hybrid / runtime-LLM.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Env } from "./types.js";

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

// Spec Error Handling §5 — every tool handler runs inside this wrapper. A thrown
// runtime exception is logged (surfaces in `wrangler tail`) and turned into a narrated
// apology rather than bubbling up as a 500. W3 registers tools as `wrapTool(name, fn)`.
export function wrapTool<Args>(
  name: string,
  handler: (args: Args) => Promise<CallToolResult>,
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    try {
      return await handler(args);
    } catch (e) {
      console.error(`Tool ${name} threw:`, e);
      return textResult(
        "Something went wrong answering that — try again or ask something else.",
        true,
      );
    }
  };
}

// Spec Error Handling §1 (HTTP failure) + §2 (malformed JSON). cachedJsonFetch collapses
// both to a logged null; tools turn that null into this narrated result instead of a 500.
export function dataUnavailableResult(): CallToolResult {
  return textResult(
    "My archive data is temporarily unavailable. Try again in a moment.",
    true,
  );
}

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
