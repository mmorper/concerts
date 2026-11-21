/**
 * Brand Assets — profile avatars for the syndication accounts
 *
 * Renders the venue-network mark at every size the four social channels need.
 * Output: public/images/brand/
 *
 * SOURCE IS ios-icon-v2-network.svg, NOT public/favicon.svg.
 *
 * The favicon is a 32px-native drawing and does not survive enlargement: its
 * connection lines run hero-centre to node-CENTRE at partial opacity beneath
 * semi-transparent nodes, so above ~200px every node shows a bright square
 * butt-cap artifact through it. Its hero is also 37% of the frame filled by a
 * single gradient that fades across its whole radius, which at size reads as a
 * blur rather than a light source.
 *
 * The 180px icon already fixed both — its line ends are tucked just inside each
 * node edge, its composition is centred with real margin, and its hero has a
 * defined edge. That is the drawing an avatar wants. Same mark, authored for
 * being looked at rather than glanced at in a tab.
 *
 * One source, not five hand-made PNGs: edit the SVG and regenerate.
 * Platform specs churn, so every size is re-derivable rather than exported by
 * hand (see #355).
 *
 * Also generates the profile HEADER (#356) from concerts.json — one composition
 * at two resolutions, since Bluesky, Mastodon and X all take 3:1 and Instagram
 * has no header at all.
 *
 * Nothing in the header is a hardcoded figure. The year ticks and the last year
 * are derived, so adding a 2027 show redraws the axis rather than leaving a
 * banner that quietly stops at 2026 — the perishability the voice rules exist
 * to prevent, moved into the artwork.
 *
 * Also emits the review renders that decide whether the mark actually works:
 *   - avatar-32.png            the legibility gate — an avatar sits at ~32px
 *                              beside every post, viewed constantly
 *   - preview-circle-*.png     circular mask, as Bluesky / X / Instagram crop
 *   - preview-rounded-*.png    rounded square, as Mastodon crops
 *
 * The masked previews are for review only; platforms apply their own crop to
 * the square file, so the uploads stay unmasked.
 *
 * Also writes the tvOS app icon for Morperhaus Now Spinning (#698): see generateTvosIcon().
 *
 * Usage: npm run generate:brand            (everything)
 *        npm run generate:brand -- --tvos  (the tvOS icon only)
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "docs", "design", "icons", "ios-icon-v2-network.svg");
const OUT = join(ROOT, "public", "images", "brand");

/**
 * Per-channel avatar sizes. Confirm against current platform docs before an
 * upload — these change, and DECISIONS.md §7 already flags platform guidance
 * as unstable.
 */
interface AvatarSpec {
  channel: string;
  size: number;
  crop: "circle" | "rounded";
}

const AVATARS: AvatarSpec[] = [
  { channel: "bluesky", size: 1000, crop: "circle" },
  { channel: "mastodon", size: 400, crop: "rounded" },
  { channel: "x", size: 400, crop: "circle" },
  { channel: "instagram", size: 320, crop: "circle" },
];

/** Sizes rendered purely to judge the mark, not to upload. */
const REVIEW_SIZES = [32, 48, 64, 128];

/**
 * The mark's geometry, in the source's 180-unit viewBox. Used to prove no
 * peripheral node is clipped by a circular crop rather than assuming it.
 * Keep in step with ios-icon-v2-network.svg.
 */
const VIEWBOX = 180;
const NODES = [
  { name: "top", cx: 90, cy: 30, r: 10 },
  { name: "right", cx: 150, cy: 90, r: 10 },
  { name: "lower-right", cx: 135, cy: 135, r: 7 },
  { name: "lower-left", cx: 45, cy: 135, r: 7 },
  { name: "upper-left", cx: 45, cy: 45, r: 8 },
  { name: "upper-right", cx: 135, cy: 45, r: 8 },
  { name: "hero", cx: 90, cy: 90, r: 32 },
];

/** Rounded-square corner radius as a share of the side, per Apple/Mastodon norms. */
const ROUNDED_RATIO = 0.22;

function circleMask(size: number): Buffer {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
}

function roundedMask(size: number): Buffer {
  const radius = Math.round(size * ROUNDED_RATIO);
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
}

/**
 * Render the SVG at `size`, optionally masked.
 *
 * `density` is scaled so sharp rasterises the 180-unit viewBox at the target
 * resolution rather than upscaling a 32px bitmap — without it every avatar is
 * a blurry enlargement of a small bitmap.
 */
async function render(size: number, mask?: Buffer): Promise<Buffer> {
  const svg = readFileSync(SRC);
  const base = sharp(svg, { density: Math.max(72, Math.round((size / VIEWBOX) * 72)) })
    .resize(size, size, { fit: "fill" })
    .png();

  if (!mask) return base.toBuffer();

  return base
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Distance from each node's outer edge to the centre, against the inscribed
 * circle a platform's round crop applies. Anything at or over 1.0 is clipped.
 */
function clipReport(): { name: string; ratio: number; clipped: boolean }[] {
  const c = VIEWBOX / 2;
  return NODES.map((n) => {
    const dist = Math.hypot(n.cx - c, n.cy - c) + n.r;
    return { name: n.name, ratio: dist / c, clipped: dist >= c };
  }).sort((a, b) => b.ratio - a.ratio);
}


/* ------------------------------------------------------------------------ *
 * Profile header (#356) — the chronological ridge
 * ------------------------------------------------------------------------ */

/** Bluesky, Mastodon and X are all 3:1. Instagram has no header. */
const HEADERS = [
  { channel: "bluesky", w: 3000, h: 1000 },
  { channel: "mastodon", w: 1500, h: 500 },
  { channel: "x", w: 1500, h: 500 },
];

/** Design resolution. Everything else is a downscale of this. */
const HEADER_W = 3000;
const HEADER_H = 1000;

/**
 * All three channels punch the avatar through the header's lower left, so the
 * ridge starts well clear of it. The data helps here: the early years are the
 * archive's quietest, so the zone that cannot be used is the zone that has
 * least to say.
 */
const RIDGE_X0 = 600;
const RIDGE_X1 = 2880;
const RIDGE_BASE = 805;
const RIDGE_TOP = 250;

/** Years at or above this are lit rather than recessive. */
const PEAK_THRESHOLD = 11;

interface Concert {
  year: number;
}

function perYearCounts(): { counts: number[]; firstYear: number; lastYear: number } {
  const raw = JSON.parse(
    readFileSync(join(ROOT, "public", "data", "concerts.json"), "utf8"),
  );
  const concerts: Concert[] = Array.isArray(raw) ? raw : raw.concerts;

  const byYear = new Map<number, number>();
  for (const c of concerts) byYear.set(c.year, (byYear.get(c.year) ?? 0) + 1);

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  const counts: number[] = [];
  for (let y = firstYear; y <= lastYear; y++) counts.push(byYear.get(y) ?? 0);

  return { counts, firstYear, lastYear };
}

function headerSvg(): string {
  const { counts, firstYear, lastYear } = perYearCounts();
  const max = Math.max(...counts);
  const step = (RIDGE_X1 - RIDGE_X0) / counts.length;
  const bw = step * 0.6;

  const bars = counts
    .map((n, i) => {
      const h = (n / max) * (RIDGE_BASE - RIDGE_TOP);
      const x = RIDGE_X0 + i * step;
      const lit = n >= PEAK_THRESHOLD;
      return `  <rect x="${x.toFixed(1)}" y="${(RIDGE_BASE - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 5).toFixed(1)}" rx="4" fill="${lit ? "#c4b5fd" : "#5b3fa0"}" opacity="${lit ? 0.95 : 0.6}"/>`;
    })
    .join("\n");

  /** Decade ticks between the real first and last year — never hardcoded. */
  const tickYears: [number, string][] = [[firstYear, String(firstYear)]];
  for (let y = Math.ceil((firstYear + 1) / 10) * 10; y < lastYear; y += 10) {
    tickYears.push([y, `\u2019${String(y).slice(2)}`]);
  }
  tickYears.push([lastYear, String(lastYear)]);

  const ticks = tickYears
    .map(([y, label]) => {
      const x = RIDGE_X0 + (y - firstYear) * step + bw / 2;
      return `  <text class="ss" x="${x.toFixed(1)}" y="${RIDGE_BASE + 52}" text-anchor="middle" font-size="30" font-weight="600" fill="#6b5f94">${label}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HEADER_W}" height="${HEADER_H}" viewBox="0 0 ${HEADER_W} ${HEADER_H}">
  <style>@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&amp;display=swap');.ss{font-family:'Source Sans 3',system-ui,sans-serif}</style>
  <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14111f"/><stop offset="1" stop-color="#1d1633"/></linearGradient></defs>
  <rect width="${HEADER_W}" height="${HEADER_H}" fill="url(#hg)"/>
${bars}
  <line x1="${RIDGE_X0}" y1="${RIDGE_BASE + 8}" x2="${RIDGE_X1}" y2="${RIDGE_BASE + 8}" stroke="#2e2749" stroke-width="3"/>
${ticks}
  <text class="ss" x="${RIDGE_X1}" y="190" text-anchor="end" font-size="38" font-weight="600" letter-spacing="8" fill="#7d7099">EVERY SHOW SINCE ${firstYear}</text>
</svg>
`;
}

async function generateHeaders(): Promise<void> {
  const svg = Buffer.from(headerSvg());
  writeFileSync(join(OUT, "header.svg"), svg);

  for (const h of HEADERS) {
    const file = join(OUT, `header-${h.channel}-${h.w}x${h.h}.png`);
    const buf = await sharp(svg, { density: Math.round((h.w / HEADER_W) * 96) })
      .resize(h.w, h.h)
      .png()
      .toBuffer();
    writeFileSync(file, buf);
    console.log(`  ${h.channel.padEnd(10)} ${h.w}×${h.h}`);
  }

  /** True phone width. The type is illegible here by design — it is texture. */
  const mobile = await sharp(svg, { density: 24 }).resize(390, 130).png().toBuffer();
  writeFileSync(join(OUT, "header-review-mobile-390.png"), mobile);
  console.log("  review     390×130  (true mobile scale)");
}

// --- tvOS app icon: Morperhaus Now Spinning (#698) ---------------------------------------------
//
// The same mark, from the layers Icon Composer keeps (MorperhausConcerts.icon), not redrawn.
// tvOS icons are wide (5:3) and layered: the layers shift against each other when the icon is
// focused. Back to front: the base gradient across the whole canvas, then the connecting lines,
// then the outer nodes, then the hero node, so the lines sit under every node as they do in the
// original drawing. The mark is centred with a clear margin, because a focused icon is enlarged
// and its edges are cropped. The whole asset catalog entry, Contents.json files included, is
// written here, so it can always be regenerated.

const ICON_LAYERS_SRC = join(ROOT, "docs", "design", "icons", "MorperhausConcerts.icon", "Assets");
const TVOS_BRAND = join(
  ROOT, "now-spinning", "tvos", "NowSpinning", "Resources", "Assets.xcassets",
  "App Icon & Top Shelf Image.brandassets",
);
/** icon.json's base fill, #1e1b4b → #581c87, run corner to corner as in the approved preview. */
const TVOS_GRADIENT = ["#1e1b4b", "#581c87"] as const;
/** The mark's square, as a share of the icon's height (matches tvos-icon-preview.png). */
const TVOS_MARK = 0.83;
/** The Top Shelf banners are much wider and shorter; the mark sits smaller in them. */
const TOP_SHELF_MARK = 0.5;

type TvLayer = "gradient" | "connections" | "nodes" | "hero";
/** Back to front. */
const TV_LAYERS: TvLayer[] = ["gradient", "connections", "nodes", "hero"];
const LAYER_NAME: Record<TvLayer, string> = {
  gradient: "Back", connections: "Lines", nodes: "Nodes", hero: "Front",
};
const XCODE_INFO = { info: { author: "xcode", version: 1 } };

function gradientSvg(w: number, h: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${TVOS_GRADIENT[0]}"/><stop offset="1" stop-color="${TVOS_GRADIENT[1]}"/>` +
      `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
  );
}

/** One layer at one size: the gradient, or a piece of the mark centred on a transparent canvas. */
async function tvLayer(layer: TvLayer, w: number, h: number, markRatio: number): Promise<Buffer> {
  if (layer === "gradient") return sharp(gradientSvg(w, h)).png().toBuffer();
  const side = Math.round(h * markRatio);
  const file = join(ICON_LAYERS_SRC, layer === "hero" ? "hero.png" : `${layer}.svg`);
  const input = layer === "hero"
    ? sharp(file)
    : sharp(file, { density: Math.max(72, Math.ceil((72 * side) / 1024)) });
  const piece = await input.resize(side, side).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.round((w - side) / 2), top: Math.round((h - side) / 2) }])
    .png()
    .toBuffer();
}

/** All layers flattened, for the Top Shelf images, which aren't layered. */
async function tvFlat(w: number, h: number, markRatio: number): Promise<Buffer> {
  const [base, ...rest] = await Promise.all(TV_LAYERS.map((l) => tvLayer(l, w, h, markRatio)));
  return sharp(base).composite(rest.map((input) => ({ input }))).png().toBuffer();
}

function writeJson(dir: string, body: object): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "Contents.json"), JSON.stringify(body, null, 2) + "\n");
}

/** An image stack: one layer per folder, listed front to back as Xcode does. */
async function tvStack(name: string, w: number, h: number, scales: number[]): Promise<void> {
  const stack = join(TVOS_BRAND, `${name}.imagestack`);
  writeJson(stack, {
    ...XCODE_INFO,
    layers: [...TV_LAYERS].reverse().map((l) => ({ filename: `${LAYER_NAME[l]}.imagestacklayer` })),
  });
  for (const layer of TV_LAYERS) {
    const layerDir = join(stack, `${LAYER_NAME[layer]}.imagestacklayer`);
    writeJson(layerDir, XCODE_INFO);
    const imageset = join(layerDir, "Content.imageset");
    mkdirSync(imageset, { recursive: true });
    const images = [];
    for (const scale of scales) {
      const filename = `${LAYER_NAME[layer].toLowerCase()}-${w}x${h}${scale > 1 ? `@${scale}x` : ""}.png`;
      writeFileSync(join(imageset, filename), await tvLayer(layer, w * scale, h * scale, TVOS_MARK));
      images.push({ filename, idiom: "tv", scale: `${scale}x` });
    }
    writeJson(imageset, { images, ...XCODE_INFO });
  }
}

async function tvTopShelf(name: string, w: number, h: number): Promise<void> {
  const imageset = join(TVOS_BRAND, `${name}.imageset`);
  mkdirSync(imageset, { recursive: true });
  const images = [];
  for (const scale of [1, 2]) {
    const filename = `top-shelf-${w}x${h}${scale > 1 ? "@2x" : ""}.png`;
    writeFileSync(join(imageset, filename), await tvFlat(w * scale, h * scale, TOP_SHELF_MARK));
    images.push({ filename, idiom: "tv", scale: `${scale}x` });
  }
  writeJson(imageset, { images, ...XCODE_INFO });
}

async function generateTvosIcon(): Promise<void> {
  writeJson(join(TVOS_BRAND, ".."), XCODE_INFO);
  writeJson(TVOS_BRAND, {
    assets: [
      { filename: "App Icon - App Store.imagestack", idiom: "tv", role: "primary-app-icon", size: "1280x768" },
      { filename: "App Icon.imagestack", idiom: "tv", role: "primary-app-icon", size: "400x240" },
      { filename: "Top Shelf Image Wide.imageset", idiom: "tv", role: "top-shelf-image-wide", size: "2320x720" },
      { filename: "Top Shelf Image.imageset", idiom: "tv", role: "top-shelf-image", size: "1920x720" },
    ],
    ...XCODE_INFO,
  });
  await tvStack("App Icon", 400, 240, [1, 2]);
  await tvStack("App Icon - App Store", 1280, 768, [1]);
  await tvTopShelf("Top Shelf Image", 1920, 720);
  await tvTopShelf("Top Shelf Image Wide", 2320, 720);
}

async function main() {
  if (process.argv.includes("--tvos")) {
    await generateTvosIcon();
    console.log("✅ tvOS app icon written to now-spinning/tvos/NowSpinning/Resources/Assets.xcassets/");
    return;
  }
  mkdirSync(OUT, { recursive: true });

  console.log("🎨 Brand assets — venue-network mark\n");

  // --- the crop check, before anything is written ---
  console.log("Circular-crop safety (1.0 = touching the crop edge):");
  const report = clipReport();
  for (const n of report) {
    const flag = n.clipped ? "❌ CLIPPED" : n.ratio > 0.95 ? "⚠️  tight" : "✅";
    console.log(`  ${flag}  ${n.name.padEnd(12)} ${(n.ratio * 100).toFixed(1)}% of radius`);
  }
  const clipped = report.filter((n) => n.clipped);
  console.log("");

  // --- per-channel uploads (unmasked; platforms apply their own crop) ---
  for (const a of AVATARS) {
    const file = join(OUT, `avatar-${a.channel}-${a.size}.png`);
    writeFileSync(file, await render(a.size));
    console.log(`  ${a.channel.padEnd(10)} ${a.size}×${a.size}  ${a.crop}`);
  }

  // --- review renders ---
  console.log("\nReview renders:");
  for (const size of REVIEW_SIZES) {
    writeFileSync(join(OUT, `review-${size}.png`), await render(size));
    writeFileSync(
      join(OUT, `review-circle-${size}.png`),
      await render(size, circleMask(size)),
    );
    writeFileSync(
      join(OUT, `review-rounded-${size}.png`),
      await render(size, roundedMask(size)),
    );
    console.log(`  ${size}px  plain · circle · rounded`);
  }

  // --- profile headers (#356) ---
  console.log("\nHeaders — chronological ridge, generated from concerts.json:");
  await generateHeaders();
  console.log("  instagram  — no header on this channel");

  console.log(`\n✅ Written to public/images/brand/`);

  // --- the tvOS app icon (#698); `--tvos` runs this part alone ---
  await generateTvosIcon();
  console.log("✅ tvOS app icon written to now-spinning/tvos/NowSpinning/Resources/Assets.xcassets/");

  if (clipped.length) {
    console.error(
      `\n❌ ${clipped.length} node(s) clipped by a circular crop: ${clipped
        .map((n) => n.name)
        .join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    "\n⚠️  The 32px render is the acceptance gate (#355). Look at it before uploading.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
