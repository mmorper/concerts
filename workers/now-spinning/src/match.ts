/**
 * Now Spinning's matching rules — a thin layer over the archive's own.
 *
 * Titles are compared with `foldSongTitle` / `songIndexKeys` and acts with `actKey`, the same
 * fail-closed rules the rest of the archive uses. Nothing here re-decides what makes two titles
 * the same song. This file adds only what Shazam's input needs:
 *
 *   - `actKeysFor`: try the act name as given, then with a featured act dropped
 *   - `tidyTitle` / `stripFeat`: tidy what goes on screen
 *   - `nearKeys`: looser keys that may only ever SOFTEN a "never heard" claim
 *   - `rulesFingerprint`: lets the Worker tell when the index was built with different rules
 *
 * The index builder (scripts/build-now-spinning-index.ts) and the Worker both import this file,
 * so the two sides of every comparison are folded by the same code.
 *
 * Spec: docs/specs/implemented/global-now-spinning/global-now-spinning-spec.md §Data
 */

import { foldSongTitle, songIndexKeys } from "../../../scripts/utils/song-title.js";
import { actKey } from "../../../scripts/utils/act-name.js";

export { actKey, foldSongTitle };

/**
 * Every strict key a title answers to: the fold of the whole title first, then each part of a
 * medley written with a spaced slash ("Head Over Heels / Broken" answers to "Head Over Heels").
 * Strict keys decide every positive statement on the screen.
 */
export function titleKeys(title: string): string[] {
  const whole = foldSongTitle(title);
  const keys = new Set<string>(whole ? [whole] : []);
  for (const k of songIndexKeys(title)) if (k) keys.add(k);
  return [...keys];
}

/** Bracketed text, removed outright — only for near-miss keys, never for strict ones. */
const ANY_BRACKETS = /\s*[([][^)\]]*[)\]]\s*/g;

/**
 * Looser keys, used for ONE purpose: to stop the screen saying "never heard this one live" when
 * something close is on a setlist ("Mr. DNA" against "Smart Patrol/Mr. DNA"). They never make
 * the screen say "heard". All bracketed text goes, any slash splits, and a part must have four
 * letters or more, so "Let/s Get Lost" doesn't answer to "Let".
 */
export function nearKeys(title: string): string[] {
  const keys = new Set<string>();
  const add = (s: string) => {
    const k = foldSongTitle(s.replace(ANY_BRACKETS, " ")).replace(/ /g, "");
    if (k.length >= 4) keys.add(k);
  };
  add(title);
  for (const part of title.split("/")) add(part);
  for (const k of titleKeys(title)) if (k.replace(/ /g, "").length >= 4) keys.add(k.replace(/ /g, ""));
  return [...keys];
}

/** The near-miss key for Shazam's title, compared against `nearKeys` of setlist titles. */
export function nearKey(title: string): string {
  return foldSongTitle(title.replace(ANY_BRACKETS, " ")).replace(/ /g, "");
}

/**
 * The act as Shazam names it, reduced to `actKey`s, full name first. The second key drops a
 * featured or paired act ("Depeche Mode feat. X" → Depeche Mode, "Queen & David Bowie" → Queen).
 * It is only a fallback: "Echo & the Bunnymen" must be tried whole before it becomes "Echo".
 */
export function actKeysFor(artist: string): string[] {
  const keys = [actKey(artist), actKey(cleanArtist(artist))].filter(Boolean);
  return [...new Set(keys)];
}

/** Drop a featured or paired act. Matching fallback only; never used for display. */
export function cleanArtist(artist: string): string {
  return artist.replace(/\s+(feat\.?|featuring|ft\.?|with|&|and)\s+.*$/i, "").trim();
}

/** For display: drop only "feat. X". "&" and "and" are part of real names (Kool & the Gang). */
export function stripFeat(artist: string): string {
  return artist.replace(/\s+[([]?(feat\.?|featuring|ft\.)\s+.*$/i, "").trim();
}

const NOISE = /\b(remaster(ed)?|live|version|mix|edit|mono|stereo|single|demo|bonus|deluxe|anniversary|explicit)\b/i;

/**
 * For display, when the archive has no spelling of its own: drop only Shazam's noise
 * ("(Remastered 2006)", "- Single Version"), never real words like "(Don't Fear) The Reaper".
 */
export function tidyTitle(title: string): string {
  const out = title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (m, inner: string) => (NOISE.test(inner) ? "" : m))
    .replace(/\s+[-–—]\s+[^-–—]*$/, (m) => (NOISE.test(m) ? "" : m))
    .trim();
  return out || title.trim();
}

/**
 * A short hash of the rules applied to fixed samples. The site and the Worker deploy separately
 * and both contain these rules; if one deploys a change first, their keys stop agreeing and real
 * matches are missed without any error. The builder writes this into the manifest, the Worker
 * computes it from its own copy, and a mismatch reads as "index unavailable".
 */
export function rulesFingerprint(): string {
  const samples = [
    "Everything Counts (Remastered 2006)", "Smart Patrol/Mr. DNA", "Head Over Heels / Broken",
    "(Don't Fear) The Reaper", "[10 Good Reasons for Modern Drugs]", "Dancing With Myself",
    "Song (feat. Someone) - Live", "With or Without You", "Just Can’t Get Enough", "Salt & Pepper",
  ];
  const acts = ["Echo & the Bunnymen", "Run‐D.M.C.", "The Beach Boys", "Depeche Mode feat. X", "Tone-Lōc"];
  const parts = [
    ...samples.map((s) => `${titleKeys(s).join(",")}|${nearKeys(s).join(",")}`),
    ...acts.map((a) => actKeysFor(a).join(",")),
  ];
  return fnv1a(parts.join("\n"));
}

/** FNV-1a, 32-bit. Small, pure, and identical in Node and a Worker. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
