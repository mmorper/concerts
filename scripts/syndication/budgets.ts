/**
 * Text budgets (#329), measured in Phase 0 rather than estimated.
 *
 * DECISIONS.md §2 records what the corpus post actually rendered at:
 *
 *   | field         | budget | actual |
 *   | hook          | ≤ 120  | 53     |
 *   | beats[] each  | ≤ 120  | 53 / 58 / 109 / 96 / 62 |
 *   | caption core  | —      | 166    |
 *   | + Bluesky     | fits   | 217    |
 *   | + Mastodon    | fits   | 267    |
 *   | + X           | fits   | 166    |
 *   | + Instagram   | fits   | 415    |
 *
 * The headline finding is that **the tightest channel does not force a shorter
 * hook** — which is only true while the caption stays inside the arithmetic
 * below. That arithmetic is the reason CAPTION_MAX is a number and not a
 * preference.
 */

/**
 * DECISIONS.md §2. Confirmed by the carousel board; the longest beat measured 109.
 *
 * ⚠️  120 is only renderable if the card FITS THE HOOK TO ITS BOX. Every Phase 0
 * board was drawn against a 53-68 char hook at a fixed type size, and at
 * `Main.dc.html`'s 72px a 120-char hook runs 180px off the bottom of the 4:5
 * card — taking the credit stack and the wordmark with it, silently, because
 * the type column is `justify-content: flex-end` and flex falls back to
 * start-alignment when it overflows. 120 chars needs 48px; 57 chars needs 68px.
 * Measured in `StressMaxHook.dc.html`, which carries the full ramp table.
 *
 * This is a constraint on the L0 renderer (#361), not a reason to lower the
 * number: pinning the hook at 72px would cap it near 55 and invalidate the
 * beats budget too, since beats share HOOK_MAX and one measured 109.
 */
export const HOOK_MAX = 120;

/** DECISIONS.md §3 — the five-beat arc holds. Carousel adapters only (Phase 3). */
export const BEATS_MIN = 3;
export const BEATS_MAX = 5;

/**
 * Derived from the tightest channel, not chosen.
 *
 * Bluesky allows 300 graphemes and is the binding constraint. Since the move to image
 * posts (2026-09-26) the adapter appends a link line and one line of mentions and tags:
 *
 *   300 total
 *   − 1  line break
 *   −28  link text, the longer `LINK_TEXT` in payload.ts ("Setlist and the full night →")
 *   − 2  line breaks
 *   ───
 *   269  for the caption plus mentions and tags
 *
 * A 200 caption leaves 69, which one mention and one tag always fit. Two mentions and two
 * tags can reach ~95 and do not always fit — that is what the adapter's trim order is for
 * (second tag, second mention, last tag). The caption and the link are never trimmed, and
 * the measured median caption is 175, so most posts keep everything.
 *
 * Every other channel clears it comfortably: X is 280 and counts any URL as
 * 23, Mastodon 500, Instagram 2200.
 */
export const CAPTION_MAX = 200;

/** Per-channel hard limits, asserted by each adapter before it posts. */
export const CHANNEL_LIMITS = {
  /** Graphemes, not code units, and not bytes. */
  bluesky: 300,
  /** Instance-configurable; 500 is the default and what we build against. */
  mastodon: 500,
  x: 280,
  instagram: 2200,
} as const;
