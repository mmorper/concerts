/**
 * Entity tags, and the four different answers each channel wants (#329).
 *
 * Two rules, both from DECISIONS.md §7:
 *
 * 1. **Tags come from entities the record already knows** — artist, venue,
 *    city, decade. They are *generated*, never authored, which is why they do
 *    not live in `SocialText`.
 *
 * 2. **The detector tags must never ship.** `liner-notes.json` carries
 *    `#full-circle`, `#road-tested`, `#before-the-record`. That is internal
 *    taxonomy: meaningless to a reader and an instant tell that a machine
 *    wrote the post. This module never reads `post.tags` at all — the
 *    strongest available form of "never", since there is no code path from the
 *    detector tags to a published one.
 *
 * A single house rule would be wrong on three channels of four, so the limit
 * is per-channel and the payload carries the unformatted entity list.
 */

import type { Channel } from "./types.ts";

/** DECISIONS.md §7. `0` means the channel takes none. */
const TAG_LIMITS: Record<Channel, { min: number; max: number }> = {
  // Needs them most: no recommendation algorithm, full-text search is opt-in.
  mastodon: { min: 4, max: 5 },
  // Real (clickable facets, followable feeds), but stacking reads as spam.
  bluesky: { min: 1, max: 2 },
  // The 30-tag block is obsolete; keyword search carries much of discovery.
  instagram: { min: 3, max: 5 },
  // Discouraged by the platform, and they eat the tightest budget.
  x: { min: 0, max: 0 },
};

/**
 * CamelCase on every channel, not just Mastodon.
 *
 * DECISIONS.md calls it a firm accessibility norm there — screen readers parse
 * the word boundaries in `#NileRodgers` and read `#nilerodgers` as one
 * unpronounceable token. That reasoning is not Mastodon-specific, and nothing
 * on the other channels prefers the lowercase form, so it applies everywhere.
 *
 * Diacritics are folded because a hashtag is an index key: `#Björk` and
 * `#Bjork` are two different tags on every platform here, and the ASCII one is
 * what a reader types.
 */
export function toHashtag(entity: string): string {
  const folded = entity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "");

  const words = folded.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return "";

  return words
    .map((word) =>
      // An all-caps acronym stays as it is: #REM, not #Rem. A word that is
      // already mixed case keeps its own shape — #McCartney, not #Mccartney.
      /^[A-Z0-9]+$/.test(word) || /[a-z][A-Z]/.test(word)
        ? word
        : word[0].toUpperCase() + word.slice(1)
    )
    .join("");
}

export interface EntitySources {
  /** Display names in billing order. */
  artists: string[];
  /**
   * EVERY venue the post covers, not just the one the credit stack names.
   *
   * 🔴 THIS WAS SINGULAR, AND IT SILENTLY LOST TWO THIRDS OF SOME POSTS.
   * It took `credit.venue` — the anchor show — which is right for the card, where the
   * credit stack is furniture identifying ONE night. It is wrong for tags, which are
   * discovery: `3-concerts-in-12-days` covers The Belasco, Peacock Theater and Pacific
   * Amphitheatre, and someone following Pacific Amphitheatre could never find it.
   *
   * The anchor stays FIRST, so the venue on the card is the venue most likely to survive a
   * channel's limit.
   */
  venues: string[];
  city: string;
  /** ISO date of the night the post is anchored to. */
  date: string;
}

/**
 * Entity tags in priority order: artists first, then venues, city, decade.
 *
 * Order is the whole selection mechanism — Bluesky takes the first 1–2 and X
 * takes none, so "which tags survive a tight budget" is decided here once
 * rather than in four adapters. Artists lead because an artist tag is the only
 * one a fan is plausibly following.
 */
export function entityTags(sources: EntitySources): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined) => {
    if (!value) return;
    const tag = toHashtag(value);
    if (!tag) return;
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  };

  /* Artists first — the owner's rule, 2026-08-29: "artists should trump venues". Someone
     follows a band; a venue is the second thing they would look for. On a channel taking
     only one or two tags this is the whole of the decision. */
  for (const artist of sources.artists) push(artist);
  for (const venue of sources.venues) push(venue);
  push(sources.city);

  const year = Number(sources.date.slice(0, 4));
  if (Number.isFinite(year)) push(`${Math.floor(year / 10) * 10}s`);

  return out;
}

/**
 * The tags one channel actually prints, already `#`-prefixed.
 *
 * Under-supply is allowed: a channel wanting 4–5 gets whatever the record has
 * if the record has three. Inventing a fourth to hit a minimum would mean
 * authoring a tag, which is exactly what rule 1 forbids.
 */
export function tagsForChannel(tags: string[], channel: Channel): string[] {
  const { max } = TAG_LIMITS[channel];
  if (max === 0) return [];
  return tags.slice(0, max).map((t) => `#${t}`);
}

export { TAG_LIMITS };
