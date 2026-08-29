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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser } from "puppeteer";
import { deriveRect, derivationFor, retainedFraction } from "../media/derive.ts";
import type { SyndicationPayload } from "./types.ts";
import type { CropBox, LinerNotesPost } from "../../src/types/liner-notes.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Instagram feed, and the format every other 4:5 channel scales from. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;

/** Bluesky, Mastodon and X — `DECISIONS.md` §1, and #342 as amended 2026-08-28. */
export const WIDE_WIDTH = 1200;
export const WIDE_HEIGHT = 630;
/**
 * 🔴 THE IMAGE SLOT IS SQUARE, AND THAT IS THE WHOLE POINT OF THIS LAYOUT.
 *
 * The obvious objection to a 1.91:1 card is that it slices a 4:5 box down to 42%. It would,
 * if the photograph were the background. It is not: `WideSplit` puts it in a **630×630
 * square** beside a 570px type column, so derivation runs at 1.0 and keeps **80%** of the
 * authored box.
 *
 * Square is also the one place a tier-2 source is a natural fit rather than a compromise.
 * Every tier-2 image is 700×700, so this DOWNSCALES to 630 instead of upscaling 1.54× —
 * the only real quality cost in the system, avoided.
 *
 * 42% is what the Open Graph card pays, because that one genuinely is a full-bleed 1.91:1
 * background. Different thing, same canvas size; `og-image.ts` owns it.
 */
export const WIDE_SLOT = 630;

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


export interface RenderResult {
  slug: string;
  path: string;
  /** The published still this came from. */
  asset: string;
  /** Absent on tier 2 — nobody drew a box for a press shot. */
  crop?: CropBox;
  /** 1 personal, 2 sourced, 3 derived. Which branch drew the image. */
  tier: 1 | 2 | 3;
  /** Source pixels taken, after derivation. */
  rect: { left: number; top: number; width: number; height: number };
  /** How much of the authored box survived. 1 at 4:5. */
  retained: number;
  byline: string;
  /** The size the hook actually rendered at, after fitting. */
  hookSize: number;
  /** Where the type block starts. Below CARD_HEIGHT - SCRIM_HEIGHT it has no ground. */
  typeTop: number;
  /** The JPEG quality the ladder settled on. 82 unless the ceiling forced it lower. */
  quality: number;
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
/** @deprecated The renderer takes a `SyndicationPayload` now and needs no sources at all. */
export type RenderSources = never;

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
interface TemplateVals {
  imageDataUri: string;
  alt: string;
  byline: string;
  acts: string;
  hook: string;
  hookSize: number;
  meta: string;
  pill: string;
}

const HEAD = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap">
<style>html,body{margin:0;padding:0;background:#0a0810}</style></head><body>`;

function fullBleed(v: TemplateVals): string {
  return `${HEAD}
<div id="card" style="width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;background:#0d1a24;position:relative;overflow:hidden;font-family:'Source Sans 3',system-ui,sans-serif;">
  <img src="${v.imageDataUri}" alt="${escapeHtml(v.alt)}" style="position:absolute;inset:0;width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;object-fit:cover;display:block;">
  <!-- MATCH THE SHAPE, NOT THE WEIGHT. Both chips are pills so they read as one family of
       metadata. The FILL is where the hierarchy lives: the act pill is solid and carries the
       category, this one stays screened-back and neutral.
       It must never take the category colour. Colour on this card means identity; the byline
       is a factual credit about provenance, and folding it into the identity system is the
       confusion PROVENANCE.md avoids by giving tier 2 no byline at all. A second solid chip
       would also compete with the act name and flatten a hierarchy that is deliberate — the
       byline is what makes personal imagery outrank a press shot, but it is a credit, not a
       headline. -->
  <span id="byline" style="position:absolute;left:30px;top:30px;font-size:21px;font-weight:600;letter-spacing:0.03em;color:rgba(255,255,255,0.82);background:rgba(8,10,16,0.58);padding:9px 19px;border-radius:999px;">${escapeHtml(v.byline)}</span>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${SCRIM_HEIGHT}px;background:linear-gradient(to bottom,rgba(9,11,18,0) 0%,rgba(9,11,18,0.78) 40%,rgba(9,11,18,0.95) 74%,#090b12 100%);"></div>
  <div id="type" style="position:absolute;left:0;right:0;bottom:0;padding:0 72px 72px 72px;box-sizing:border-box;display:flex;flex-direction:column;gap:28px;">
    <div style="display:flex;align-items:center;">
      <!-- 🔴 A PILL, NOT A LOZENGE, AND IT CARRIES THE CATEGORY.
           The screened-back rectangle read as a patch stuck over the photograph rather than
           as part of the card. A pill is a chip of metadata, which is what this is, and it
           lets the fill do two jobs at once: a ground the act name is legible on, and the
           category signal that the 56x5px rule was carrying alone and illegibly.

           THE RULE IS GONE. With a coloured pill immediately after it, the dash is a second
           adjacent block of the same colour — redundant, and it reads as a tail on the pill.
           The pill absorbs its job and states it in a form that can actually be read. -->
      <span id="acts" style="font-size:34px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#fff;background:${v.pill};padding:10px 22px;border-radius:999px;white-space:nowrap;">${escapeHtml(v.acts)}</span>
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

/**
 * The act line: who this card is about, in a form that fits.
 *
 * 🔴 `credit.artists` IS EVERY ACT ON THE POST, and a festival-bill post has nine. Rendered
 * straight it gave `THE HUMAN LEAGUE · THE ALARM · DRAMARAMA · THE MOTELS · NAKED EYES ·
 * THE UNTOUCHABLES · GENE LOVES JEZABEL · WHEN IN ROME · THE POLECATS` — five lines of
 * uppercase display type on the wide card, crushing the hook to three. That is #361's
 * worst-case criterion failing on a real published post, not a hypothetical.
 *
 * THE PHOTOGRAPHED ACT LEADS. It is the one the byline is about and the one in the frame,
 * so a card that names it fourth is describing a different thing from the picture above it.
 *
 * Identification is not withheld — `DECISIONS.md` §3 is explicit that names are furniture
 * and only the interpretation gets held back. "+6 more" keeps the count honest and the
 * caption carries the full bill.
 */
export function actLine(artists: string[], photographed: string | undefined, show: number): string {
  const ordered = photographed
    ? [...artists].sort((a, b) => Number(b === photographed) - Number(a === photographed))
    : artists;
  const n = Math.max(1, Math.min(show, ordered.length));
  if (n >= ordered.length) return ordered.join(" · ");
  // A non-breaking space, so "+6 more" can never be the thing that splits.
  return `${ordered.slice(0, n).join(" · ")} +${ordered.length - n}\u00a0more`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/**
 * The wide split, from `WideSplit.dc.html` — 630x630 photograph, 570px type column.
 *
 * WHY A SPLIT AND NOT A SCALED 4:5. `WideStacked.dc.html` is kept in the spec as evidence:
 * scaling the 4:5 band proportionally gives a 1200x340 letterbox, a 3.5:1 slice that
 * decapitates the subject, and every tier-2 source is square so a 700x700 press shot in it
 * is a 2:1 strip across someone's eyes. Two layouts, not one scaled.
 *
 * The byline sits INSIDE the photograph here, bottom-left, rather than over the type column.
 * It is a claim about the picture and it has to travel with the picture — a card gets
 * screenshotted and re-shared without its caption, and cropped to the image often enough
 * that a byline outside the frame is a byline that can be separated from what it describes.
 */
function wideSplit(v: TemplateVals): string {
  return `${HEAD}
<div id="card" style="width:${WIDE_WIDTH}px;height:${WIDE_HEIGHT}px;background:#14111f;position:relative;overflow:hidden;font-family:'Source Sans 3',system-ui,sans-serif;">
  <div style="position:absolute;inset:0;display:flex;flex-direction:row;">
    <div style="width:${WIDE_SLOT}px;height:${WIDE_SLOT}px;position:relative;overflow:hidden;flex-shrink:0;">
      <img src="${v.imageDataUri}" alt="${escapeHtml(v.alt)}" style="width:${WIDE_SLOT}px;height:${WIDE_SLOT}px;object-fit:cover;display:block;">
      <span id="byline" style="position:absolute;left:22px;bottom:20px;font-size:16px;font-weight:600;letter-spacing:0.03em;color:rgba(255,255,255,0.82);background:rgba(8,10,16,0.58);padding:7px 15px;border-radius:999px;">${escapeHtml(v.byline)}</span>
    </div>
    <!-- FIXED WIDTH, NOT flex-grow. A white-space:nowrap pill wider than the column made
         the column itself grow, pushing the type off the right edge of the card AND taking
         the hook with it — and because the fit check measured the pill against its parent,
         the parent had already stretched to fit and every length "fitted". Pinning the
         column is what makes the measurement mean anything. -->
    <div id="type" style="width:${WIDE_WIDTH - WIDE_SLOT}px;flex-shrink:0;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:20px;padding:48px 48px 44px 44px;box-sizing:border-box;">
      <div style="display:flex;align-items:flex-start;">
        <span id="acts" style="font-size:24px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#fff;background:${v.pill};padding:8px 18px;border-radius:999px;white-space:nowrap;">${escapeHtml(v.acts)}</span>
      </div>
      <div id="hook" style="font-family:'Playfair Display',Georgia,serif;font-size:${v.hookSize}px;line-height:1.06;letter-spacing:-0.025em;color:#fff;text-wrap:pretty;">${escapeHtml(v.hook)}</div>
      <span style="font-size:21px;font-weight:500;line-height:1.44;color:#8a80ab;">${v.meta}</span>
      <div style="display:flex;justify-content:flex-end;">
        <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;">
          <span style="font-size:18px;font-weight:600;line-height:1.1;color:#5d5480;">concerts.</span>
          <span style="font-size:18px;font-weight:700;line-height:1.1;color:#8a80ab;">morperhaus</span>
          <span style="font-size:18px;font-weight:600;line-height:1.1;color:#5d5480;">.org</span>
        </div>
      </div>
    </div>
  </div>
</div></body></html>`;
}

/**
 * The act pill's fill, per category.
 *
 * 🔴 THE RULE WAS CARRYING THE CATEGORY, AND THIS RENDERER HARDCODED IT PURPLE. #361:
 * "Category rule keeps its colour; the label is gone in favour of the artist name" — so
 * that 56x5px dash is the ONLY surviving category signal on the card, and every card was
 * printing `cultural` regardless of what it was. The pill absorbs the job and does it
 * legibly, which a dash never did: nobody decodes a coloured line.
 *
 * 🔴 DARKENED, BECAUSE WHITE ON THE RAW COLOUR FAILS. Measured against the source values in
 * `og-image.ts`:
 *
 *     cultural   #7c3aed   5.70:1   passes
 *     personal   #0ea5e9   2.77:1   FAILS even large-text AA
 *     deep-cut   #059669   3.77:1   large text only
 *
 * `personal` is 27 of 58 posts, so a solid pill at the raw value would be worst exactly
 * where it is most common — the opposite of a contrast fix. At 0.7 all three clear 5:1 and
 * the hue family survives. Black text on the bright values was the alternative and needs a
 * different text colour per category, which is a worse rule to maintain.
 */
export const ACT_PILL: Record<string, string> = {
  cultural: "#5628a5",
  personal: "#0973a3",
  "deep-cut": "#036949",
};
export const ACT_PILL_FALLBACK = "#463c7a";

export interface Format {
  id: "4x5" | "wide";
  width: number;
  height: number;
  /** The image slot's aspect, which is what derivation runs against — NOT the card's. */
  slotAspect: number;
  /** Pixels the photograph is resized to before the layout sees it. */
  slot: { width: number; height: number };
  template: (v: TemplateVals) => string;
  /**
   * The byte ceiling this format must fit under.
   *
   * Bluesky's is a HARD platform limit — 1,000,000 bytes — and a breach fails at the API in
   * an unattended 10am job. Both formats carry it rather than only the wide card: Instagram
   * has no such limit today, but a ceiling that exists on one path only is a ceiling nobody
   * remembers when a third format arrives.
   */
  maxBytes: number;
  /**
   * Hook sizes to try, largest first.
   *
   * 🔴 RAMPED OFF A MEASUREMENT, NEVER OFF CHARACTER COUNT. `StressMaxHook.dc.html` measured
   * a 120-character hook running 180px off the 4:5 card at 72px, silently — and its
   * character table is one string at one width, which Playfair's varying character widths
   * would make wrong on some other hook. So the renderer measures the real box and steps
   * down.
   *
   * WHAT IT MEASURES DIFFERS BY LAYOUT, because the layouts fail differently. Full bleed is
   * bottom-anchored and grows upward over the photograph, so the limit is the scrim. The
   * wide card has its own column and cannot reach the photograph at all, so the limit is
   * simply the top of the card.
   */
  hookSizes: number[];
  /**
   * How far down the card the type block may start, in px from the top.
   *
   * Full bleed: the scrim, because type above it has no ground under it. The wide card has
   * its own column and cannot collide with the photograph at all, so the only real limit is
   * the top of that column.
   */
  typeCeiling: number;
}

export const FORMATS: Record<Format["id"], Format> = {
  "4x5": {
    id: "4x5",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    slotAspect: CARD_ASPECT,
    slot: { width: CARD_WIDTH, height: CARD_HEIGHT },
    template: fullBleed,
    maxBytes: 1_000_000,
    hookSizes: [90, 80, 72, 68, 60, 56, 52, 48, 42],
    typeCeiling: CARD_HEIGHT - SCRIM_HEIGHT,
  },
  wide: {
    id: "wide",
    width: WIDE_WIDTH,
    height: WIDE_HEIGHT,
    // 1.0 — square, and the reason this format keeps 80% of the box rather than 42%.
    slotAspect: 1,
    slot: { width: WIDE_SLOT, height: WIDE_SLOT },
    template: wideSplit,
    maxBytes: 1_000_000,
    // Smaller column, so the ramp starts lower. 50px is what the artboard was drawn at.
    hookSizes: [50, 46, 42, 38, 34, 30, 27],
    typeCeiling: 0,
  },
};

/**
 * The quality ladder (#342) — encode down until the file fits, and say where it landed.
 *
 * 🔴 THE FORMAT WAS THE REAL PROBLEM. Cards were written as PNG screenshots at ~875KB
 * against Bluesky's 1MB ceiling, which looked like a ladder problem and was a format one:
 * the same card as JPEG q82 is 124KB. #342 specifies "JPEG (mozjpeg, q82) as the universal
 * primary" and nothing was doing it.
 *
 *     png       875 KB
 *     q92       189 KB
 *     q82       124 KB   ← the spec's value, and where every card in the corpus lands
 *     q74       101 KB
 *     q66        84 KB
 *
 * So the ladder is a GUARD, not a routine mechanism. Measured across all 58 published posts
 * at q82, the largest card is a fraction of the ceiling and nothing steps down. It stays
 * because the ceiling is a hard platform limit — a post that breaches it fails at the API,
 * at 10am, unattended — and because 9:16 and a busier photograph are both still ahead.
 *
 * Descending rather than a fixed setting is #342's own argument: one quality is either
 * wasteful or over the limit, and which of the two depends on the photograph.
 *
 * The floor is real. If even q50 will not fit, the caller gets the q50 buffer and the size
 * to complain about rather than an exception — a card slightly over a limit is a decision
 * for the adapter, and throwing here would turn a large photograph into a dropped post.
 */
const QUALITY_LADDER = [82, 74, 66, 58, 50];

export async function encodeUnder(
  png: Buffer,
  maxBytes: number
): Promise<{ buffer: Buffer; quality: number }> {
  let last = { buffer: png, quality: 0 };
  for (const quality of QUALITY_LADDER) {
    const buffer = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    last = { buffer, quality };
    if (buffer.length <= maxBytes) return last;
  }
  return last;
}

/** Cap on fetching a third-party image. Same reason as og-image.ts: a hang is not an
 *  exception, and this runs unattended in a daily workflow against CDNs we do not own. */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * The image bytes, whether ours or someone else's.
 *
 * A leading slash is a file in this repo — the archive's own photography, and the local
 * venue fallback. Everything else is a third-party URL and is fetched, bounded.
 */
async function loadImage(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    const file = join(ROOT, "public", url.replace(/^\//, ""));
    if (!existsSync(file)) throw new Error(`${url} is not on disk`);
    return readFileSync(file);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Render one post's 4:5 card.
 *
 * Throws with a named reason rather than producing a card that is quietly wrong — a
 * half-right card is worse than none, because it publishes.
 */
export async function renderCard(
  payload: SyndicationPayload,
  browser: Browser,
  format: Format = FORMATS["4x5"]
): Promise<RenderResult> {
  /* 🔴 THE PAYLOAD IS THE ONLY INPUT, AND THAT IS THE POINT.
     This used to take `(post, sources)` and re-derive its own tier, its own night, its own
     image and its own credit — while `buildPayload` derived the same things for the
     adapters. Five bugs on 2026-08-28 came from exactly that: two places answering one
     question, disagreeing, and each fix catching one symptom.

       · tier 2 refused outright, which would have dropped 53 of 58 posts
       · the renderer re-resolved tier and bypassed both venue gates
       · the card said "The Wiltern · May 2023", its alt said "Olympic Velodrome, 1993"

     Handing it the payload does not catch the sixth — it makes the sixth impossible. There
     is nothing left here to decide. `buildPayload` decides; this draws. */
  const card = payload.media.find((m) => m.role === "card");
  if (!card) throw new Error(`${payload.slug}: no card asset — never bare type`);

  const image = await loadImage(card.sourceUrl);
  const meta = await sharp(image).metadata();
  if (!meta.width || !meta.height) throw new Error(`${payload.slug}: cannot read ${card.sourceUrl}`);

  let pipeline = sharp(image);
  let retained = 1;
  let rect = { left: 0, top: 0, width: meta.width, height: meta.height };

  if (card.crop) {
    const derivation = derivationFor(card.tier);
    /* DERIVE AGAINST THE SLOT, NOT THE CARD. The wide card is 1.91:1 and its photograph is
       square; deriving at 1.905 would take a letterbox out of the box and throw away 58% of
       it for a slot that wanted none of that. */
    rect = deriveRect(card.crop, { width: meta.width, height: meta.height }, format.slotAspect, derivation);
    retained = retainedFraction(card.crop, { width: meta.width, height: meta.height }, format.slotAspect);
    pipeline = pipeline.extract(rect).resize(format.slot.width, format.slot.height, { fit: "fill" });
  } else if (card.tier === 1) {
    /* 🔴 REFUSE AN UNCROPPED TIER-1 ASSET. Falling back to a centre crop is the exact
       failure #342 documents, and it is invisible: the card renders, it just cuts the
       subject's head off. An asset the owner has not judged is not ready to publish.
       Tier 2 has no box because nobody drew one, which is a different thing entirely. */
    throw new Error(`${payload.slug}: ${card.sourceUrl} has no crop box — run \`npm run media:crop\``);
  } else {
    /* No box, and none is owed. A press shot is composed centred with deliberate headroom —
       the same reason #342 centre-derives tier 2 rather than top-aligning it. `cover` suits
       a 700x700 source going into a 630x630 slot: a downscale, nothing upscaled, and nothing
       cropped when the source is already square. */
    pipeline = pipeline.resize(format.slot.width, format.slot.height, { fit: "cover", position: "centre" });
  }

  const cropped = await pipeline
    // Renditions are stripped: phone GPS in a published file is an unretractable privacy
    // leak the moment it is live. sharp drops metadata unless asked to keep it.
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const imageDataUri = `data:image/jpeg;base64,${cropped.toString("base64")}`;

  const credit = payload.credit;
  const hook = payload.hook;
  if (!hook) throw new Error(`${payload.slug}: no authored hook — never chop one out of prose`);

  /* Tier 1 ONLY, and the payload already decided. The absence on tier 2 is what makes the
     archive's own photography visibly outrank a press shot (PROVENANCE.md). */
  const byline = card.byline ?? "";
  const metaLines = [
    credit.song ? `&ldquo;${escapeHtml(credit.song)}&rdquo;` : undefined,
    `${escapeHtml(credit.venue)} &middot; ${escapeHtml(credit.region ? `${credit.city}, ${credit.region}` : credit.city)}`,
    monthYear(credit.date),
  ].filter(Boolean).join("<br>");

  /* The act in the frame leads the act line. `credit.artists` is billing order, and the
     payload's first entry is the post's lead — the one the byline is about. */
  let acts = actLine(credit.artists, credit.artists[0], credit.artists.length);
  const pill = ACT_PILL[payload.category ?? ""] ?? ACT_PILL_FALLBACK;
  let hookSize = format.hookSizes[0];
  let typeTop = 0;

  const page = await browser.newPage();
  await page.setViewport({ width: format.width, height: format.height, deviceScaleFactor: 1 });

  try {
    /* Set the content ONCE and re-measure by restyling.
       Calling setContent per ramp step is both slow and unreliable: with `networkidle0` the
       second call hangs, because the Google Fonts request is served from cache and there is
       never a network-idle transition to wait for. The fit loop can call this up to nine
       times, so that is a hang on a normal card, not an edge case. Fonts are awaited
       directly, which is the dependency that actually matters for a text measurement. */
    await page.setContent(
      format.template({ imageDataUri, alt: card.alt, byline, acts, hook, hookSize: format.hookSizes[0], meta: metaLines, pill }),
      { waitUntil: "load" }
    );
    try { await page.evaluate(() => document.fonts.ready); } catch { /* fonts are a nicety */ }

    /* 🔴 THE ACT LINE IS ONE LINE, ALWAYS — drop a name before you wrap.
       Two lines of uppercase display type pushes the hook down and reads as a paragraph
       rather than a label, and on a nine-act bill it was five. Measured, not counted: the
       pill is `white-space: nowrap`, so a too-long line overflows its container rather than
       wrapping, and the test is whether it still fits the column.

       Names are dropped from the END, so the photographed act — the one in the frame and
       the one the byline is about — is the last thing to go. A single name that still
       overflows is left alone: that is identification and there is nothing left to drop. */
    for (let show = credit.artists.length; show >= 1; show--) {
      const line = actLine(credit.artists, credit.artists[0], show);
      const fits = await page.evaluate((text: string) => {
        const el = document.getElementById("acts")!;
        el.textContent = text;
        /* 🔴 MEASURE AGAINST THE CARD, WHICH IS PINNED BY DEFINITION.
           Against the parent this silently always passed: an over-wide nowrap pill stretched
           its own container, so the thing being measured and the thing it was measured
           against grew together. That is the third time in this renderer that a measurement
           has been taken against a box the content could move — the bottom edge in #415, the
           flex-grow column here, and this. The card cannot move. */
        const card = document.getElementById("card")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return box.right <= card.right && box.left >= card.left;
      }, line);
      acts = line;
      if (fits || show === 1) break;
    }

    for (const size of format.hookSizes) {
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
      const measured = await page.evaluate((ceiling: number) => {
        const block = document.getElementById("type")!;
        /* 🔴 MEASURE THE CONTENT, NOT THE COLUMN.
           `#type` on the wide card is `flex-grow: 1`, so its box is the full 630 height
           whatever it contains — measuring it reports y=0 for an empty card and y=0 for one
           three times over budget, and the ramp never engages. The full-bleed block is
           bottom-anchored and shrink-wraps, so there the two agree; taking the first child
           is correct for both and pinned by construction in neither. */
        const first = block.firstElementChild ?? block;
        const type = first.getBoundingClientRect();
        const byline = document.getElementById("byline")!.getBoundingClientRect();
        const card = document.getElementById("card")!.getBoundingClientRect();
        // Two conditions, and the SCRIM is the load-bearing one. Collision with the byline
        // is a floor so low that a hook three times over budget cleared it while covering
        // the entire photograph — which is the one thing this layout exists to avoid.
        /* The byline clause only applies when the byline shares the type block's box. On
           the wide card it lives inside the photograph, in the other column, so it can never
           collide however long the hook runs — testing against it there would ramp the type
           down for a reason that does not exist. */
        const shares = byline.right > type.left;
        return {
          top: Math.round(type.top),
          fits: type.top >= ceiling && type.top >= card.top && (!shares || type.top >= byline.bottom + 24),
        };
      }, format.typeCeiling);

      hookSize = size;
      typeTop = measured.top;
      if (measured.fits) break;
    }

    /* CAPTURE LOSSLESS, ENCODE ONCE. The screenshot is PNG so the ladder below re-encodes
       from a clean original rather than compounding JPEG artefacts on every step. */
    const shot = await page.screenshot({ type: "png" });

    const path = join(OUTPUT_DIR, `${payload.slug}-${format.id}.jpg`);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const { buffer, quality } = await encodeUnder(Buffer.from(shot), format.maxBytes);
    writeFileSync(path, buffer);

    return {
      slug: payload.slug,
      path,
      asset: card.sourceUrl,
      tier: card.tier,
      crop: card.crop,
      rect,
      retained,
      byline,
      hookSize,
      typeTop,
      bytes: buffer.length,
      quality,
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
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("-"));
  const wanted = args.includes("--wide") ? ["wide"]
    : args.includes("--4x5") ? ["4x5"]
    : (["4x5", "wide"] as const);
  if (!slug) {
    console.error("usage: npm run render:card -- <slug> [--4x5 | --wide]");
    console.error("       both formats render by default");
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

  /* Build the payload, then draw it — the same two steps the run takes, in the same order.
     A CLI that assembled the card its own way would be previewing itself. */
  const { buildPayload } = await import("./payload.ts");
  const payload = buildPayload(post, Object.assign({}, sources, { cardExists: () => true }) as never);
  if (!payload.eligible) {
    console.error(`\n  ${post.slug} would not post:`);
    for (const r of payload.ineligibleReasons) console.error(`    · ${r}`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  try {
    console.log(`\n  ${post.slug}`);
    for (const id of wanted) {
      const format = FORMATS[id as Format["id"]];
      const r = await renderCard(payload, browser, format);
      console.log(`  ${"─".repeat(62)}`);
      console.log(`  ${format.id.padEnd(5)} ${format.width}x${format.height}` +
        `   image slot ${format.slot.width}x${format.slot.height}`);
      console.log(`  photograph  ${r.asset}`);
      console.log(`  tier        ${r.tier}${r.tier === 1 ? " · the archive's own" : " · sourced"}`);
      console.log(`  crop        ${r.crop ? `x=${r.crop.x} y=${r.crop.y} w=${r.crop.w} h=${r.crop.h}` : "none — tier 2, centred"}`);
      console.log(`  source px   ${r.rect.width}x${r.rect.height} at (${r.rect.left}, ${r.rect.top})`);
      console.log(`  retained    ${(r.retained * 100).toFixed(1)}% of the authored box`);
      console.log(`  byline      ${r.byline}`);
      console.log(`  hook        ${r.hookSize}px after fitting, type starts at y=${r.typeTop}`);
      console.log(`  written     ${r.path}  (${(r.bytes / 1024).toFixed(0)} KB at q${r.quality}, ceiling ${(format.maxBytes / 1024).toFixed(0)} KB)`);
    }
    console.log('');
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
