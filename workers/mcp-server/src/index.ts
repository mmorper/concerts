import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Env } from "./types.js";
import { prefetchLazyFiles, prefetchLoadFiles } from "./data.js";
import { registerTools } from "./tools.js";

const SERVER_NAME = "Morperhaus Concert Archive";
const SERVER_VERSION = "0.1.0";

// Spec §"Server Identity" — shown to connecting clients as the server description.
const SERVER_INSTRUCTIONS =
  "40 years of live music — 1984 to the present. Ask about artists, venues, " +
  'decades, or just say "surprise me." ' +
  "Tool results end with an \"Open on the site\" line of markdown links to the artists " +
  "and venues mentioned — always include that line, exactly as given, at the end of your " +
  "reply so people can click through to the site.";

// Spec §"`explore_archive` Prompt" — kept short; voice rules live in the
// liner-notes-voice skill, which is the source of truth.
const EXPLORE_ARCHIVE_PROMPT =
  "You are the Morperhaus Concert Archive — 40 years of live music, 1984 to the " +
  "present, speaking in your own voice. Speak as the archive itself, in first person. " +
  "See the project's liner-notes-voice skill for full voice rules.\n\n" +
  "Be honest about gaps. When you have enrichment (genres, top tracks, setlists), use " +
  "it. When you don't, say so and move on.\n\n" +
  "Tool results end with an \"Open on the site\" line of markdown links to the artists " +
  "and venues mentioned — always include that line, exactly as given, at the end of your " +
  "reply so people can click through to the site.";

// Spec §"CORS Headers" — `Mcp-Session-Id` MUST appear in both Allow-Headers and
// Expose-Headers or Claude Desktop's session handshake fails silently. The agents/mcp
// transport applies these (incl. the OPTIONS preflight) when passed to serve().
const CORS_OPTIONS = {
  origin: "*",
  methods: "POST, GET, OPTIONS",
  headers: "Content-Type, Authorization, Mcp-Session-Id",
  exposeHeaders: "Mcp-Session-Id",
} as const;

const CORS_RESPONSE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": CORS_OPTIONS.origin,
  "Access-Control-Allow-Methods": CORS_OPTIONS.methods,
  "Access-Control-Allow-Headers": CORS_OPTIONS.headers,
  "Access-Control-Expose-Headers": CORS_OPTIONS.exposeHeaders,
};

// The canonical connector page is the static /about-mcp (Cloudflare Pages) — the single source.
// Browser hits on /mcp redirect here instead of the Worker rendering its own HTML copy.
const ABOUT_MCP_URL = "https://concerts.morperhaus.org/about-mcp";

// Per-isolate cold-start latch. Warm caches once on the first request that reaches
// this isolate; subsequent requests skip straight through.
let cachesWarmed = false;

function warmCachesOnce(env: Env, ctx: ExecutionContext): void {
  if (cachesWarmed) return;
  cachesWarmed = true;
  // Both run in the background — the LAZY files are never fetched synchronously on the
  // cold-start path, and the second caller finds every cache warm. Spec §"Background
  // Prefetch on First Hot Path".
  ctx.waitUntil(prefetchLoadFiles(env, ctx));
  ctx.waitUntil(prefetchLazyFiles(env, ctx));
}

export class MorperhausMcp extends McpAgent<Env> {
  server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: SERVER_NAME,
      websiteUrl: "https://concerts.morperhaus.org",
      // Connector icon (MCP Implementation.icons). PNG first: clients commonly refuse
      // remote SVG (XSS risk) and don't decode .ico, so the prior SVG/ICO-only array
      // rendered as the default cube. These PNGs live under /icons/ — note root-level
      // paths like /icon-512.png resolve to the SPA's HTML fallback, not a real image.
      icons: [
        {
          src: "https://concerts.morperhaus.org/icons/apple-touch-icon-180.png",
          mimeType: "image/png",
          sizes: ["180x180"],
        },
        {
          src: "https://concerts.morperhaus.org/icons/favicon-32.png",
          mimeType: "image/png",
          sizes: ["32x32"],
        },
        {
          src: "https://concerts.morperhaus.org/favicon.svg",
          mimeType: "image/svg+xml",
          sizes: ["any"],
        },
      ],
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  async init(): Promise<void> {
    this.server.registerPrompt(
      "explore_archive",
      {
        title: "Explore the archive",
        description:
          "Step into the Morperhaus Concert Archive and speak with it in its own voice.",
      },
      () => ({
        messages: [
          {
            role: "user",
            content: { type: "text", text: EXPLORE_ARCHIVE_PROMPT },
          },
        ],
      }),
    );

    registerTools(this.server, this.env);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      // A human visiting the endpoint in a browser is 302-redirected to the canonical connector
      // page at /about-mcp (static Pages — the single source). MCP clients fall through to the
      // protocol handler: the only legitimate GET a client makes is the SSE stream, which always
      // sends `Accept: text/event-stream` (and a session id) — that's the one case we defer.
      // Everything else that's a browser GET (incl. speculative prefetches, address-bar
      // preconnects, and `Accept: */*`) — and HEAD, which link unfurlers / preview bots send
      // first — gets the redirect. A 302 has no body, so it can't hit the transport's 406 (the
      // old "load it twice" bug) or the Content-Length hang that made us render HTML here.
      // The outer branch already scoped to /mcp and /mcp/* — so ANY browser GET/HEAD that reaches
      // here (incl. a trailing-slash /mcp/ or any speculative /mcp/<subpath>) redirects; only real
      // MCP requests fall through (POST, or the SSE GET carved out by the two checks below).
      const accept = request.headers.get("accept") ?? "";
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        !accept.includes("text/event-stream") &&
        !request.headers.get("mcp-session-id")
      ) {
        return Response.redirect(ABOUT_MCP_URL, 302);
      }

      warmCachesOnce(env, ctx);
      // Outermost guard (spec Error Handling §5): a runtime exception in the transport
      // is logged and returned as a JSON-RPC error rather than a bare 500.
      try {
        return await MorperhausMcp.serve("/mcp", {
          corsOptions: CORS_OPTIONS,
        }).fetch(request, env, ctx);
      } catch (e) {
        console.error("MCP request handler threw:", e);
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message:
                "Something went wrong — try again in a moment, or ask something else.",
            },
            id: null,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...CORS_RESPONSE_HEADERS,
            },
          },
        );
      }
    }

    return new Response("Not found", {
      status: 404,
      headers: CORS_RESPONSE_HEADERS,
    });
  },
};
