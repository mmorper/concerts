/**
 * Agentic Liner Notes — RSS Feed Generator
 *
 * Generates public/liner-notes.xml (RSS 2.0) from published LinerNotesPost[].
 * Called by pipeline.ts after liner-notes.json is written.
 *
 * Feed URL: https://concerts.morperhaus.org/liner-notes.xml
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUTPUT_PATH = join(ROOT, "public", "liner-notes.xml");

const SITE_URL = "https://concerts.morperhaus.org";
const FEED_TITLE = "Morperhaus Concert Archives — Liner Notes";
const FEED_DESCRIPTION =
  "Weekly stories from 42 years of live music. First-person editorial posts about patterns, discoveries, and moments from a personal concert history spanning 1984 to present.";
const MAX_FEED_ITEMS = 20;

export function generateRss(posts: LinerNotesPost[]): void {
  const recent = [...posts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_FEED_ITEMS);

  const items = recent.map(buildItem).join("\n");
  const lastBuildDate = recent[0]
    ? rfc822(new Date(recent[0].publishedAt))
    : rfc822(new Date());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/liner-notes</link>
    <description>${escXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/liner-notes.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/og-image.png</url>
      <title>${escXml(FEED_TITLE)}</title>
      <link>${SITE_URL}/liner-notes</link>
    </image>
${items}
  </channel>
</rss>`;

  writeFileSync(OUTPUT_PATH, xml, "utf8");
}

function buildItem(post: LinerNotesPost): string {
  const url = `${SITE_URL}/liner-notes/${post.slug}`;
  const pubDate = rfc822(new Date(post.publishedAt));
  const categories = post.tags.map((t) => `    <category>${escXml(t)}</category>`).join("\n");
  const imageEl = post.image?.url
    ? `    <media:content url="${escXml(post.image.url)}" medium="image" />`
    : "";

  return `  <item>
    <title>${escXml(post.headline)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${escXml(post.prose)}</description>
${categories}
${imageEl}
  </item>`;
}

function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format a Date as RFC 822 for RSS pubDate. */
function rfc822(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}
