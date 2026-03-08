/**
 * Agentic Liner Notes — OG Image Generator
 *
 * Generates 1200×630 PNG social cards for each liner notes post.
 * Output: public/og/liner-notes/{slug}.png
 *
 * Approach:
 *   1. Download (or skip) the post's image URL
 *   2. Resize/crop to 1200×630 with sharp, apply dark overlay
 *   3. Composite an SVG text layer (headline, category, site name)
 *   4. Save as PNG
 *
 * Falls back to a solid-color background if the image can't be fetched.
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OG_DIR = join(ROOT, "public", "og", "liner-notes");

const WIDTH = 1200;
const HEIGHT = 630;

const CATEGORY_COLORS: Record<string, string> = {
  cultural: "#7c3aed",
  personal: "#0ea5e9",
  "deep-cut": "#059669",
};

export async function generateOgImages(posts: LinerNotesPost[]): Promise<void> {
  mkdirSync(OG_DIR, { recursive: true });

  for (const post of posts) {
    const outPath = join(OG_DIR, `${post.slug}.png`);
    if (existsSync(outPath)) continue; // Skip if already generated

    try {
      await generateOgImage(post, outPath);
    } catch (err) {
      console.warn(`   ⚠️  OG image failed for ${post.slug}: ${(err as Error).message}`);
    }
  }
}

async function generateOgImage(post: LinerNotesPost, outPath: string): Promise<void> {
  const accentColor = CATEGORY_COLORS[post.category] ?? "#6366f1";
  const categoryLabel = post.category.toUpperCase().replace("-", " ");

  // Try to fetch background image
  let background: sharp.Sharp;
  const imageUrl = post.image?.url;

  if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
    try {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        background = sharp(buffer)
          .resize(WIDTH, HEIGHT, { fit: "cover", position: "center" });
      } else {
        background = solidBackground();
      }
    } catch {
      background = solidBackground();
    }
  } else {
    background = solidBackground();
  }

  // Apply dark overlay
  const darkOverlay = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="rgba(0,0,0,0.60)" />
    </svg>`
  );

  const textSvg = buildTextSvg(post.headline, categoryLabel, post.years, accentColor);
  const textBuf = Buffer.from(textSvg);

  const composed = await background
    .composite([
      { input: darkOverlay, blend: "over" },
      { input: textBuf, blend: "over" },
    ])
    .png()
    .toBuffer();

  writeFileSync(outPath, composed);
}

function solidBackground(): sharp.Sharp {
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 17, g: 24, b: 39 }, // dark gray
    },
  });
}

function buildTextSvg(
  headline: string,
  categoryLabel: string,
  years: number[],
  accentColor: string
): string {
  const lines = wrapText(headline, 36);
  const lineHeight = 60;
  const headlineY = 340 - (lines.length - 1) * (lineHeight / 2);

  const headlineLines = lines
    .map((line, i) => `<text x="60" y="${headlineY + i * lineHeight}" fill="white" font-size="52" font-weight="bold" font-family="system-ui, -apple-system, sans-serif">${escXml(line)}</text>`)
    .join("\n    ");

  const yearRange =
    years.length >= 2
      ? `${Math.min(...years)}–${Math.max(...years)}`
      : years[0]
      ? String(years[0])
      : "";

  const pillW = categoryLabel.length * 10 + 32;

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Category pill -->
  <rect x="60" y="52" width="${pillW}" height="36" rx="18" fill="${accentColor}" />
  <text x="${60 + pillW / 2}" y="75" text-anchor="middle" fill="white" font-size="13" font-weight="600" font-family="system-ui, -apple-system, sans-serif" letter-spacing="1">${escXml(categoryLabel)}</text>

  <!-- Headline -->
  ${headlineLines}

  <!-- Year range -->
  ${yearRange ? `<text x="60" y="${headlineY + lines.length * lineHeight + 24}" fill="rgba(255,255,255,0.65)" font-size="24" font-family="system-ui, -apple-system, sans-serif">${escXml(yearRange)}</text>` : ""}

  <!-- Site name -->
  <text x="60" y="${HEIGHT - 44}" fill="rgba(255,255,255,0.50)" font-size="18" font-family="system-ui, -apple-system, sans-serif">concerts.morperhaus.org</text>
</svg>`;
}

/** Naive word-wrap: split headline into lines of ~maxChars each. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
