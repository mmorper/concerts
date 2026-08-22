/**
 * On This Day — the date-forward card (#333).
 *
 * DECISIONS.md §10 settled the architecture: **date-forward**. A masthead
 * carries the date with a rule under it, where a liner-note card leads with a
 * sentence. That masthead is the whole point — it is what separates the two
 * streams at a glance in a feed, where the two will often sit adjacent.
 *
 * This is a parameterization of `og-image.ts`, not a second renderer: same
 * sharp pipeline, same 1200×630, same bounded background fetch, same dark
 * overlay. Only the text layer differs. The spec's own framing — "a second
 * render target is a parameterization of working code, not new infra".
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  CATEGORY_COLORS,
  HEIGHT,
  WIDTH,
  escXml,
  loadBackground,
  wrapText,
} from "../liner-notes/og-image.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
export const CARD_DIR = join(ROOT, "public", "og", "on-this-day");

/**
 * The masthead accent. On This Day is one stream, so it takes one colour
 * rather than borrowing the liner-note category palette — the coloured rule
 * on a liner-note card encodes its category, and reusing those hues here
 * would imply a category this stream does not have.
 */
const ACCENT = CATEGORY_COLORS.personal;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface CardInput {
  /** ISO date of the show. */
  date: string;
  /** Years elapsed, as the card states it. */
  age: number;
  artist: string;
  venue: string;
  city: string;
  /** Background image URL; a solid ground is used when it cannot be fetched. */
  imageUrl?: string;
}

/** `4 June` — day-first, matching how the archive writes dates elsewhere. */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

export function cardPath(slug: string): string {
  return `public/og/on-this-day/${slug}.png`;
}

/**
 * The text layer. Split out so the layout is testable without sharp, a
 * network, or a written file — the same reason `composeBlueskyText` is
 * separate from the Bluesky adapter.
 */
export function buildCardSvg(input: CardInput): string {
  const masthead = formatDay(input.date).toUpperCase();
  const yearsLine = `${input.age} year${input.age === 1 ? "" : "s"} ago`;

  // The artist is the largest thing after the masthead: at feed scale it is
  // the only text a scrolling reader reliably takes in (DECISIONS.md §11
  // measured this at 124px on the profile grid).
  const artistLines = wrapText(input.artist, 22);
  const artistSize = artistLines.length > 1 ? 64 : 76;
  const artistY = 300;

  const artistSvg = artistLines
    .map(
      (line, i) =>
        `<text x="72" y="${artistY + i * (artistSize + 6)}" fill="white" font-size="${artistSize}" font-weight="bold" font-family="system-ui, -apple-system, sans-serif">${escXml(line)}</text>`
    )
    .join("\n  ");

  const belowArtist = artistY + artistLines.length * (artistSize + 6) + 12;

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Masthead: the date, and the rule under it. This is what tells the two
       streams apart in a feed. -->
  <text x="72" y="118" fill="white" font-size="54" font-weight="600" letter-spacing="6" font-family="system-ui, -apple-system, sans-serif">${escXml(masthead)}</text>
  <rect x="72" y="146" width="180" height="5" fill="${ACCENT}" />

  <!-- How long ago -->
  <text x="72" y="212" fill="rgba(255,255,255,0.72)" font-size="30" letter-spacing="1" font-family="system-ui, -apple-system, sans-serif">${escXml(yearsLine)}</text>

  <!-- Subject -->
  ${artistSvg}

  <!-- Where -->
  <text x="72" y="${belowArtist + 22}" fill="rgba(255,255,255,0.80)" font-size="27" font-family="system-ui, -apple-system, sans-serif">${escXml(`${input.venue} · ${input.city}`)}</text>

  <text x="72" y="${HEIGHT - 44}" fill="rgba(255,255,255,0.50)" font-size="18" font-family="system-ui, -apple-system, sans-serif">concerts.morperhaus.org</text>
</svg>`;
}

export interface RenderOptions {
  /** Rebuild even when the PNG already exists. */
  force?: boolean;
}

export interface RenderedCard {
  /** Repo-relative path, ready to drop into a `MediaAsset`. */
  path: string;
  /**
   * True when the background image could not be fetched, so the card is type
   * on a solid ground — which is bare type, and must not syndicate. The
   * caller marks the post ineligible rather than shipping it.
   */
  usedFallback: boolean;
}

/**
 * Render one card to `public/og/on-this-day/{slug}.png`.
 *
 * Reports whether the background fell back to a solid ground, because that
 * card is bare type and the caller must not publish it. Skipping an existing
 * file reports `usedFallback: false` — a card already on disk was written by
 * a run that accepted it, and re-fetching to re-check would defeat the skip.
 */
export async function renderCard(
  slug: string,
  input: CardInput,
  options: RenderOptions = {}
): Promise<RenderedCard> {
  mkdirSync(CARD_DIR, { recursive: true });
  const rel = cardPath(slug);
  const out = join(ROOT, rel);
  if (existsSync(out) && !options.force) return { path: rel, usedFallback: false };

  const { background, usedFallback } = await loadBackground(input.imageUrl);

  const overlay = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="rgba(0,0,0,0.62)" /></svg>`
  );

  const composed = await background
    .composite([
      { input: overlay, blend: "over" },
      { input: Buffer.from(buildCardSvg(input)), blend: "over" },
    ])
    .png()
    .toBuffer();

  writeFileSync(out, composed);
  return { path: rel, usedFallback };
}
