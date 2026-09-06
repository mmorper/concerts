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

// sharp 0.35 stopped exporting a `sharp` namespace; `Sharp` is a named type now.
import sharp, { type Sharp } from "sharp";
import { deriveRect, derivationFor } from "../media/derive.ts";
import { classifyImageUrl } from "../syndication/provenance.ts";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { CropBox, LinerNotesPost } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OG_DIR = join(ROOT, "public", "og", "liner-notes");

export const WIDTH = 1200;
export const HEIGHT = 630;

/** Cap on fetching a post's background image. See the call site for why. */
const FETCH_TIMEOUT_MS = 15_000;

export const CATEGORY_COLORS: Record<string, string> = {
  cultural: "#7c3aed",
  personal: "#0ea5e9",
  "deep-cut": "#059669",
};

export interface OgImageOptions {
  /**
   * Slugs to rebuild even though a PNG already exists.
   *
   * Cards are normally generated once and skipped forever, which is right for
   * new posts. But a card composited from an image URL that was later revoked
   * is stale in exactly the way the post was, and the existing-file skip means
   * it would never be rebuilt. Stage 5c passes the posts whose image changed
   * (#252) — without this, that hand-off was silently a no-op.
   */
  force?: Iterable<string>;
}

export interface OgImageResult {
  /**
   * Slugs whose card was composited on a solid ground because the image could
   * not be fetched. Those cards are bare type and must not syndicate — the
   * caller records it on the post so `buildPayload` can refuse them.
   */
  fellBack: string[];
  /** Slugs rendered with their real imagery, so a stale flag can be cleared. */
  rendered: string[];
}

export async function generateOgImages(
  posts: LinerNotesPost[],
  options: OgImageOptions = {}
): Promise<OgImageResult> {
  mkdirSync(OG_DIR, { recursive: true });
  const force = new Set(options.force ?? []);
  const result: OgImageResult = { fellBack: [], rendered: [] };

  for (const post of posts) {
    const outPath = join(OG_DIR, `${post.slug}.png`);
    if (existsSync(outPath) && !force.has(post.slug)) continue;

    try {
      const usedFallback = await generateOgImage(post, outPath);
      if (usedFallback) result.fellBack.push(post.slug);
      else result.rendered.push(post.slug);
    } catch (err) {
      console.warn(`   ⚠️  OG image failed for ${post.slug}: ${(err as Error).message}`);
    }
  }

  return result;
}

/** Returns true when the card is type on a solid ground rather than over imagery. */
async function generateOgImage(post: LinerNotesPost, outPath: string): Promise<boolean> {
  const accentColor = CATEGORY_COLORS[post.category] ?? "#6366f1";
  const categoryLabel = post.category.toUpperCase().replace("-", " ");

  const { background, usedFallback } = await loadBackground(post.image?.url, post.image?.crop);

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
  return usedFallback;
}

export interface LoadedBackground {
  background: Sharp;
  /**
   * True when the image could not be fetched and a solid ground was used.
   *
   * **This is not cosmetic.** A card composited on a solid ground is bare
   * type, which the imagery rubric forbids outright — and a caller that does
   * not know it happened will happily publish it while the payload still
   * claims `tier: 2`. The fallback is the right behaviour for the site's own
   * OG tags, where a plain card beats a broken image; it is the wrong thing
   * to syndicate. Callers that publish must check this.
   */
  usedFallback: boolean;
}

/**
 * The post's image as a cover-cropped background, or a solid fallback.
 *
 * Shared by both render targets. The timeout is the load-bearing part: this
 * runs unattended in a weekly workflow against third-party CDNs, and an
 * unbounded fetch stalls the whole job until GitHub's 6-hour default. A
 * try/catch cannot help with that — a hang is not an exception.
 */
export async function loadBackground(
  imageUrl: string | undefined,
  crop?: CropBox
): Promise<LoadedBackground> {
  if (!imageUrl) return { background: solidBackground(), usedFallback: true };

  /* A LEADING SLASH IS A FILE IN THIS REPO, NOT A URL TO FETCH.
     Until #340 every post image was a third-party URL, so this function only ever spoke
     http. The archive's own photography is site-relative — `/images/shows/…` — and without
     this branch it took the not-a-URL path and returned a SOLID GROUND: a blank card, and
     `usedFallback: true`, which per the contract above means syndication must refuse the
     post outright. Wiring show photos in would have made exactly the posts that gained a
     real photograph publish worse, or not at all.

     Read from disk. The file is committed, so there is nothing to fetch and no timeout to
     worry about. */
  if (imageUrl.startsWith("/")) {
    const local = join(ROOT, "public", imageUrl.slice(1));
    if (!existsSync(local)) return { background: solidBackground(), usedFallback: true };

    /* 🔴 HONOUR THE OWNER'S CROP BOX. This card is 1.91:1 — the most aggressive target in
       the system, showing 42% of an authored 4:5 box (#342). A plain `position: "center"`
       takes that 42% from the MIDDLE, discarding the top fifth of the crop, and on this
       archive the top fifth is where the head is: these frames are shot upward from a
       crowd, so the subject sits high. Centre-derivation decapitated all four acts it was
       tested against. Top-derivation fixed all four.

       Nothing about the failure is loud. The card renders, it is the right size, and the
       subject's head is gone. */
    if (crop) {
      const meta = await sharp(local).metadata();
      if (meta.width && meta.height) {
        const rect = deriveRect(
          crop,
          { width: meta.width, height: meta.height },
          WIDTH / HEIGHT,
          derivationFor(classifyImageUrl(imageUrl)?.tier ?? 1)
        );
        return {
          background: sharp(local).extract(rect).resize(WIDTH, HEIGHT, { fit: "fill" }),
          usedFallback: false,
        };
      }
    }

    /* No box drawn yet. Centre-cropping is wrong for the reason above, but a card is still
       owed — this one serves the site's own og:image, where a plain card beats none. The
       imagery is ours either way; the crop is simply unreviewed. `npm run media:crop` is
       what closes the gap. */
    return {
      background: sharp(local).resize(WIDTH, HEIGHT, { fit: "cover", position: "center" }),
      usedFallback: false,
    };
  }

  if (!/^https?:\/\//.test(imageUrl)) {
    return { background: solidBackground(), usedFallback: true };
  }
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return { background: solidBackground(), usedFallback: true };
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      background: sharp(buffer).resize(WIDTH, HEIGHT, { fit: "cover", position: "center" }),
      usedFallback: false,
    };
  } catch {
    return { background: solidBackground(), usedFallback: true };
  }
}

export function solidBackground(): Sharp {
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
export function wrapText(text: string, maxChars: number): string[] {
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

export function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
