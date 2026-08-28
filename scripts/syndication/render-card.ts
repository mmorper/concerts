/**
 * The 4:5 Instagram card, rendered from the archive's own photography (#342 · L0).
 *
 * 🔴 WHY THIS EXISTS AS ONE NARROW SCRIPT.
 *
 * Every piece of the imagery chain was decided by 2026-08-27 — the crop box, the
 * derivation rule, full bleed over the media band — and every one of them was validated in
 * throwaway scripts under `.preview/`. No card had ever been produced from
 * `media-index.json` by code living in this repo. This renders ONE, end to end, so the
 * chain is proven before #342's per-channel infrastructure is built on top of it.
 *
 * It deliberately does ONE format. Per-channel targets, the Bluesky quality ladder and the
 * CI rendition stage are #342 proper and are not here.
 *
 * Output goes to `.renditions/`, which is gitignored: a rendition is a pure function of
 * (master, channel), so committing one puts a stale copy in the repo the moment that
 * function changes.
 */

import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser } from "puppeteer";
import { deriveRect, derivationFor, retainedFraction } from "../media/derive.ts";
import { getShowAsset, postNightOf, showByline, type ImageSources } from "../liner-notes/image-refs.ts";
import { buildCredit, resolveAnchorConcert, type PayloadSources } from "./payload.ts";
import { classifyImageUrl } from "./provenance.ts";
import type { CropBox, LinerNotesPost } from "../../src/types/liner-notes.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Instagram feed, and the format every other 4:5 channel scales from. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;

export const OUTPUT_DIR = join(ROOT, ".renditions");

/**
 * The gradient scrim, and therefore the type zone.
 *
 * 740px is the height `LadderFullBleed.dc.html` drew, and it is the only number in this
 * layout that says how much of the card belongs to type rather than to the photograph.
 * DECISIONS.md §1 says "type over its lower third", which the mock itself does not literally
 * honour — so the scrim is the honest constraint: type outside it has no ground under it and
 * sits on the bare frame.
 *
 * ⚠️ This is a DESIGN CEILING pulled from the mock, not a measured one. It is the number to
 * argue with if cards start ramping down further than they should.
 */
export const SCRIM_HEIGHT = 740;

/**
 * The hook sizes to try, largest first.
 *
 * 🔴 RAMPED OFF A MEASUREMENT, NEVER OFF CHARACTER COUNT. `StressMaxHook.dc.html` measured
 * a 120-character hook running 180px off the 4:5 card at 72px, silently — and its character
 * table is one string at one width, which Playfair's varying character widths would make
 * wrong on some other hook. So this measures the real box and steps down.
 *
 * WHAT IT MEASURES DIFFERS FROM THAT BOARD, because the layout does. There, a fixed-height
 * flex column below an 820px band overflowed the BOTTOM edge and deleted the credit stack.
 * Here the type block is bottom-anchored and grows upward, so nothing can leave the bottom
 * — the collision is with the byline. See the loop for the measurement that proves it.
 *
 * Full bleed also has far more room: 117 characters hold at the top of this ramp, where the
 * band needed 48px. The cost is that they hold by covering the photograph, which is the
 * tradeoff DECISIONS.md §1 named when it chose this layout.
 */
const HOOK_SIZES = [90, 80, 72, 68, 60, 56, 52, 48, 42];

export interface RenderResult {
  slug: string;
  path: string;
  /** The published still this came from. */
  asset: string;
  crop: CropBox;
  /** Source pixels taken, after derivation. */
  rect: { left: number; top: number; width: number; height: number };
  /** How much of the authored box survived. 1 at 4:5. */
  retained: number;
  byline: string;
  /** The size the hook actually rendered at, after fitting. */
  hookSize: number;
  /** Where the type block starts. Below CARD_HEIGHT - SCRIM_HEIGHT it has no ground. */
  typeTop: number;
  bytes: number;
}

/**
 * Both source bags at once.
 *
 * An intersection rather than an `extends`: `PayloadSources` and `ImageSources` both carry
 * `artistsMetadata` and describe it differently — the payload needs `name`, image
 * resolution needs `image`. A real run supplies the same object to both, so the intersection
 * is the honest type. Reconciling the two declarations is a tidy-up for #340's schema work,
 * not something to do from here.
 */
export type RenderSources = PayloadSources & ImageSources;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * The full-bleed layout, from `LadderFullBleed.dc.html`.
 *
 * A copy rather than an import of the artboard: the mock is the DESIGN RECORD and carries
 * the counter-case annotations that explain why it beat the band. Rendering production
 * cards out of it would mean editing the record every time the card changes, and the
 * artboard's value is that it stays as-drawn.
 *
 * The photograph is already cropped to exactly 1080x1350 before it gets here, so
 * `object-fit: cover` has nothing left to do. That is the point of full bleed: at 4:5 the
 * authored box IS the card and the renderer discards nothing.
 */
function template(v: {
  imageDataUri: string;
  alt: string;
  byline: string;
  acts: string;
  hook: string;
  hookSize: number;
  meta: string;
}): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap">
<style>html,body{margin:0;padding:0;background:#0a0810}</style></head><body>
<div id="card" style="width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;background:#0d1a24;position:relative;overflow:hidden;font-family:'Source Sans 3',system-ui,sans-serif;">
  <img src="${v.imageDataUri}" alt="${escapeHtml(v.alt)}" style="position:absolute;inset:0;width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;object-fit:cover;display:block;">
  <span id="byline" style="position:absolute;left:30px;top:30px;font-size:21px;font-weight:600;letter-spacing:0.03em;color:rgba(255,255,255,0.82);background:rgba(8,10,16,0.58);padding:9px 15px;border-radius:4px;">${escapeHtml(v.byline)}</span>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${SCRIM_HEIGHT}px;background:linear-gradient(to bottom,rgba(9,11,18,0) 0%,rgba(9,11,18,0.78) 40%,rgba(9,11,18,0.95) 74%,#090b12 100%);"></div>
  <div id="type" style="position:absolute;left:0;right:0;bottom:0;padding:0 72px 72px 72px;box-sizing:border-box;display:flex;flex-direction:column;gap:28px;">
    <div style="display:flex;align-items:center;gap:18px;">
      <span style="width:56px;height:5px;background:#7c3aed;flex-shrink:0;"></span>
      <span style="font-size:34px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,0.6);">${escapeHtml(v.acts)}</span>
    </div>
    <div id="hook" style="font-family:'Playfair Display',Georgia,serif;font-size:${v.hookSize}px;line-height:1.05;letter-spacing:-0.028em;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,0.55);text-wrap:pretty;">${escapeHtml(v.hook)}</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:32px;">
      <span style="font-size:29px;font-weight:500;line-height:1.42;color:#9b90bd;">${v.meta}</span>
      <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;">
        <span style="font-size:26px;font-weight:600;line-height:1.1;color:#6d6390;">concerts.</span>
        <span style="font-size:26px;font-weight:700;line-height:1.1;color:#9b90bd;">morperhaus</span>
        <span style="font-size:26px;font-weight:600;line-height:1.1;color:#6d6390;">.org</span>
      </div>
    </div>
  </div>
</div></body></html>`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/**
 * Render one post's 4:5 card.
 *
 * Throws with a named reason rather than producing a card that is quietly wrong — a
 * half-right card is worse than none, because it publishes.
 */
export async function renderCard(
  post: LinerNotesPost,
  sources: RenderSources,
  browser: Browser
): Promise<RenderResult> {
  const lead = post.artists[0];
  if (!lead) throw new Error(`${post.slug}: no lead artist`);

  /* Re-resolve the asset rather than trusting the post's stored image.
     `image.ref` is the durable half and `image.url` is derived on every run — the whole
     reason image-refs.ts exists. Re-resolving also means this works against posts written
     before the crop box existed, which today is all 58 of them. */
  const asset = getShowAsset(lead, sources);
  if (!asset?.url) throw new Error(`${post.slug}: no published photograph of ${lead}`);

  const provenance = classifyImageUrl(asset.url);
  if (!provenance) throw new Error(`${post.slug}: unclassified image path ${asset.url}`);

  /* 🔴 REFUSE AN UNCROPPED ASSET. Falling back to a centre crop here would be the exact
     failure #342 documents, and it would be invisible: the card renders, it just cuts the
     subject's head off. An asset the owner has not judged is not ready to publish. */
  if (!asset.crop) {
    throw new Error(`${post.slug}: ${asset.url} has no crop box — run \`npm run media:crop\``);
  }

  const file = join(ROOT, "public", asset.url.replace(/^\//, ""));
  if (!existsSync(file)) throw new Error(`${post.slug}: ${asset.url} is not on disk`);

  const meta = await sharp(file).metadata();
  if (!meta.width || !meta.height) throw new Error(`${post.slug}: cannot read ${asset.url}`);

  const derivation = derivationFor(provenance.tier);
  const rect = deriveRect(asset.crop, { width: meta.width, height: meta.height }, CARD_ASPECT, derivation);
  const retained = retainedFraction(asset.crop, { width: meta.width, height: meta.height }, CARD_ASPECT);

  const cropped = await sharp(file)
    .extract(rect)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "fill" })
    // Renditions are stripped: phone GPS in a published file is an unretractable privacy
    // leak the moment it is live. sharp drops metadata unless asked to keep it.
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const imageDataUri = `data:image/jpeg;base64,${cropped.toString("base64")}`;

  /* 🔴 IS THIS POST ABOUT ONE NIGHT, OR ABOUT A SPAN? The card says different things.

     `resolveAnchorConcert` ALWAYS returns a concert — for a span post it falls through to
     "earliest by the lead artist", which is furniture identifying *a* show, explicitly not
     a claim that the post is about that night. Feeding that date to the different-night
     rule turns a deliberate fallback into an assertion, and the byline then disclaims
     against a night the post never claimed: `howard-jones-39-years-of-shows` is about six
     shows across 39 years, and rendered "not the 1985 night" over a photograph that is
     legitimately one of the six.

     The only durable signal that a post is about ONE night is the `?show=` deep link — the
     pipeline emits it only when a setlist backs that night, and `resolveAnchorConcert`
     treats it as rule 1 for the same reason. Absent it, the post is about a span. */
  const postNight = postNightOf(post);

  /* The furniture follows the SUBJECT when there is one, and the PHOTOGRAPH otherwise.

     A post about one night: that night is the subject, the credit stack names it, and the
     byline discloses if the photograph came from elsewhere.

     A post about a span has no subject night, so naming an arbitrary one under a photograph
     taken somewhere else puts the picture and its caption in disagreement — this card read
     "Irvine Meadows · June 1985" beneath a frame shot at YouTube Theatre in 2024. On a
     tier-1 card the photograph is the most concrete claim present; the furniture supports
     it rather than contradicting it. */
  const shotThatNight = sources.concerts.find((c) => c.date === asset.date);
  const anchor = postNight
    ? resolveAnchorConcert(post, sources.concerts)
    : shotThatNight ?? resolveAnchorConcert(post, sources.concerts);
  if (!anchor) throw new Error(`${post.slug}: no concert resolves for the credit stack`);
  const concert = anchor;
  const credit = buildCredit(post, concert, sources);

  const hook = post.social?.hook;
  if (!hook) throw new Error(`${post.slug}: no authored hook — never chop one out of prose`);

  const byline = showByline(asset.date, postNight);
  const metaLines = [
    credit.song ? `&ldquo;${escapeHtml(credit.song)}&rdquo;` : undefined,
    `${escapeHtml(credit.venue)} &middot; ${escapeHtml(credit.city)}`,
    monthYear(concert.date),
  ].filter(Boolean).join("<br>");

  const page = await browser.newPage();
  await page.setViewport({ width: CARD_WIDTH, height: CARD_HEIGHT, deviceScaleFactor: 1 });

  let hookSize = HOOK_SIZES[0];
  let typeTop = 0;
  try {
    /* Set the content ONCE and re-measure by restyling.
       Calling setContent per ramp step is both slow and unreliable: with `networkidle0` the
       second call hangs, because the Google Fonts request is served from cache and there is
       never a network-idle transition to wait for. The fit loop can call this up to nine
       times, so that is a hang on a normal card, not an edge case. Fonts are awaited
       directly, which is the dependency that actually matters for a text measurement. */
    await page.setContent(
      template({ imageDataUri, alt: post.image.alt, byline, acts: credit.artists.join(" · "), hook, hookSize: HOOK_SIZES[0], meta: metaLines }),
      { waitUntil: "load" }
    );
    try { await page.evaluate(() => document.fonts.ready); } catch { /* fonts are a nicety */ }

    for (const size of HOOK_SIZES) {
      await page.evaluate((px: number) => {
        (document.getElementById("hook") as HTMLElement).style.fontSize = `${px}px`;
      }, size);

      /* 🔴 MEASURE THE TOP EDGE, NOT THE BOTTOM.
         `StressMaxHook.dc.html` measured overflow leaving the BOTTOM of the card, and that
         is true of the layout it was drawn against: a flex column of fixed height below an
         820px band. This layout is different. The type block is `position: absolute;
         bottom: 0`, so its bottom edge is pinned at 1350 by construction and grows UPWARD.
         Checking `bottom - 1350` here is not a loose test, it is a constant zero — the loop
         never steps down and the ramp is dead code. Measured, not reasoned: at 90px a
         117-character hook reports bottom = 1350, exactly as an empty card does.
         The real collision is with the byline in the top-left corner. */
      const measured = await page.evaluate((scrim: number) => {
        const type = document.getElementById("type")!.getBoundingClientRect();
        const byline = document.getElementById("byline")!.getBoundingClientRect();
        // Two conditions, and the SCRIM is the load-bearing one. Collision with the byline
        // is a floor so low that a hook three times over budget cleared it while covering
        // the entire photograph — which is the one thing this layout exists to avoid.
        return {
          top: Math.round(type.top),
          fits: type.top >= scrim && type.top >= byline.bottom + 24,
        };
      }, CARD_HEIGHT - SCRIM_HEIGHT);

      hookSize = size;
      typeTop = measured.top;
      if (measured.fits) break;
    }

    const path = join(OUTPUT_DIR, `${post.slug}-4x5.png`);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.screenshot({ path: path as `${string}.png` });

    return {
      slug: post.slug,
      path,
      asset: asset.url,
      crop: asset.crop,
      rect,
      retained,
      byline,
      hookSize,
      typeTop,
      bytes: readFileSync(path).length,
    };
  } finally {
    await page.close();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: npm run render:card -- <slug>");
    process.exit(1);
  }

  const notes = load<{ posts: LinerNotesPost[] }>("public/data/liner-notes.json");
  const post = notes.posts.find((p) => p.slug === slug);
  if (!post) {
    console.error(`no post with slug "${slug}"`);
    process.exit(1);
  }

  const sources = {
    concerts: load<{ concerts: unknown[] }>("public/data/concerts.json").concerts,
    artistsMetadata: load("public/data/artists-metadata.json"),
    venuesMetadata: load("public/data/venues-metadata.json"),
    artistsTopTracks: load("public/data/artists-top-tracks.json"),
    mediaIndex: load("public/data/media-index.json"),
  } as unknown as RenderSources;

  const browser = await puppeteer.launch({ headless: true });
  try {
    const r = await renderCard(post, sources, browser);
    console.log(`\n  ${r.slug}`);
    console.log(`  ${"─".repeat(60)}`);
    console.log(`  photograph  ${r.asset}`);
    console.log(`  crop        x=${r.crop.x} y=${r.crop.y} w=${r.crop.w} h=${r.crop.h}`);
    console.log(`  source px   ${r.rect.width}x${r.rect.height} at (${r.rect.left}, ${r.rect.top})`);
    console.log(`  retained    ${(r.retained * 100).toFixed(1)}% of the authored box`);
    console.log(`  byline      ${r.byline}`);
    console.log(`  hook        ${r.hookSize}px after fitting`);
    console.log(`  type block  starts at y=${r.typeTop} of ${CARD_HEIGHT}  (scrim top is y=${CARD_HEIGHT - SCRIM_HEIGHT})`);
    console.log(`  written     ${r.path}  (${(r.bytes / 1024).toFixed(0)} KB)\n`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`\n  ✗ ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
