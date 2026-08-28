/**
 * Crop-box derivation — the authored 4:5 rectangle to a target aspect (#342).
 *
 * The owner draws ONE box per asset, at 4:5, in the review page. Every other target derives
 * from it. This module is that derivation, and it exists as committed code because until
 * now it lived only in throwaway scripts under `.preview/` — which is how the rule came to
 * be stated three different ways in three documents while no shipping renderer used any of
 * them.
 *
 * 🔴 THE VERTICAL RULE IS THE WHOLE POINT.
 *
 * A non-4:5 target is wider than the box, so something has to go. Taking it from the
 * CENTRE discards the top fifth of the crop — and on this archive that is where the head
 * is. These frames are shot upward from a crowd, so the subject sits high with nothing
 * above worth keeping. Centre-derivation decapitated all four acts it was tested against.
 *
 * Top-derivation fixes them, and it is NOT the top-align heuristic rejected on 2026-08-25:
 * that one guessed at a raw photograph with no information. This aligns to the top of a
 * rectangle the owner drew. The box is the decision; derivation only declines to throw away
 * the half they cared about.
 *
 * It inverts for a press shot. A studio portrait is composed centred with deliberate
 * headroom, so top-aligning one discards the composition the photographer chose and fills
 * the frame with backdrop — visibly worse, rendered side by side. Hence: top for the
 * archive's own photography, centre for everything else.
 *
 * Horizontally there is no such rule, and no evidence for one, so a taller-than-4:5 target
 * (9:16) takes its width from the centre. Stated here so the asymmetry reads as a decision
 * rather than an oversight.
 */

import type { CropBox } from "../../src/types/liner-notes.ts";

/** Which end of the box a wider target keeps. */
export type Derivation = "top" | "centre";

/** A rectangle in SOURCE pixels, ready for `sharp().extract()`. */
export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Crops are authored at 4:5. Anything else is a derivation. */
export const AUTHORED_ASPECT = 4 / 5;

/**
 * Top for the archive's own photography, centre for everything else.
 *
 * Keyed on tier rather than on `subject`, because the reason is provenance, not content: a
 * tier-2 press shot is composed by someone else and its headroom is deliberate. Tier 3 is
 * generated at the frame and has no box to derive from at all, but centre is the safe
 * answer if one ever arrives.
 */
export function derivationFor(tier: 1 | 2 | 3): Derivation {
  return tier === 1 ? "top" : "centre";
}

/**
 * The source-pixel rectangle a target aspect takes from an authored crop box.
 *
 * `targetAspect` is width/height — 0.8 for 4:5, 1.905 for the 1.91:1 open-graph card.
 *
 * At 4:5 this is the identity: the box IS the output, nothing is discarded, and that is
 * why the Instagram card is full bleed rather than a landscape band. The band asked a
 * portrait rectangle to fill a 1.32:1 hole, which cannot be done without cutting.
 */
export function deriveRect(
  crop: CropBox,
  source: { width: number; height: number },
  targetAspect: number,
  derivation: Derivation
): PixelRect {
  const bx = crop.x * source.width;
  const by = crop.y * source.height;
  const bw = crop.w * source.width;
  const bh = crop.h * source.height;

  let left: number, top: number, width: number, height: number;

  if (targetAspect > bw / bh) {
    // Wider than the box: keep the full width, give up height.
    width = bw;
    height = bw / targetAspect;
    left = bx;
    top = derivation === "top" ? by : by + (bh - height) / 2;
  } else {
    // Taller than the box: keep the full height, give up width, centred.
    height = bh;
    width = bh * targetAspect;
    top = by;
    left = bx + (bw - width) / 2;
  }

  // Round INWARD and clamp. sharp throws on a rectangle that leaves the image by even one
  // pixel, and a weekly unattended run must not die on a rounding error at the edge of a
  // box the owner drew flush to the frame — which is most of them: 30 of 34 have x = 0.
  const l = Math.max(0, Math.round(left));
  const t = Math.max(0, Math.round(top));
  return {
    left: l,
    top: t,
    width: Math.max(1, Math.min(Math.round(width), source.width - l)),
    height: Math.max(1, Math.min(Math.round(height), source.height - t)),
  };
}

/**
 * How much of the authored box a target actually shows, 0-1.
 *
 * Reported by the renderer so the cost of a derivation is visible in the run log rather
 * than discovered in a published card. The 1.91:1 card keeps 42% and that is inherent to
 * putting a 4:5 box in a 1.91:1 frame — a known cost, not a defect, but not one to
 * discover twice.
 */
export function retainedFraction(crop: CropBox, source: { width: number; height: number }, targetAspect: number): number {
  const bw = crop.w * source.width;
  const bh = crop.h * source.height;
  const boxAspect = bw / bh;
  return targetAspect > boxAspect ? boxAspect / targetAspect : targetAspect / boxAspect;
}
