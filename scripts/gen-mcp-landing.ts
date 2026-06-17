/**
 * Renders the MCP "Ask the Archive" landing page to a STATIC file (public/ask.html),
 * served by Cloudflare Pages. The Worker also serves it at /mcp and /mcp/about, but some
 * browsers hang on the Worker's chunked (no Content-Length) responses while Pages' static
 * files (with Content-Length) load fine — so /ask.html is the reliable, shareable URL.
 *
 * Single source of truth: imports the same renderLandingPage() the Worker uses, so the
 * page never drifts. Runs as part of `npm run build` (before vite copies public/ → dist/).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLandingPage } from "../workers/mcp-server/src/landing.ts";

const PAGE_URL = "https://concerts.morperhaus.org/ask.html";
// Headline stats — bump at releases (the page is informational, not live-data-driven).
const STATS = { shows: 183, venues: 79, cities: 36, firstYear: 1984 };

const html = renderLandingPage(STATS, PAGE_URL);
const out = join(process.cwd(), "public", "ask.html");
writeFileSync(out, html, "utf-8");
console.log(`Wrote ${out} (${html.length} bytes)`);
