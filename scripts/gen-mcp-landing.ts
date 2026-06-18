/**
 * Renders the MCP "Ask the Archive" connector landing page to a STATIC file
 * (public/about-mcp.html), served by Cloudflare Pages. The Worker also serves it at /mcp and
 * /mcp/about, but some browsers hang on the Worker's chunked (no Content-Length) responses while
 * Pages' static files (with Content-Length) load fine — so /about-mcp is the reliable URL.
 *
 * NOTE: /ask now belongs to the in-app chat (Container A, #141). This connector-marketing page
 * moved to /about-mcp; the in-app chat links back to it to keep the "add it to Claude" funnel.
 *
 * Single source of truth: imports the same renderLandingPage() the Worker uses, so the
 * page never drifts. Runs as part of `npm run build` (before vite copies public/ → dist/).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLandingPage } from "../workers/mcp-server/src/landing.ts";

const PAGE_URL = "https://concerts.morperhaus.org/about-mcp";
// Headline stats — bump at releases (the page is informational, not live-data-driven).
const STATS = { shows: 183, venues: 79, cities: 36, firstYear: 1984 };

const html = renderLandingPage(STATS, PAGE_URL);
const out = join(process.cwd(), "public", "about-mcp.html");
writeFileSync(out, html, "utf-8");
console.log(`Wrote ${out} (${html.length} bytes)`);
