/**
 * Social-copy backfill — selection and application (#323).
 *
 * 57 notes were published before the syndication stage existed, so none of
 * them carries `post.social`. Without it they are permanently ineligible to
 * syndicate, which is why the `--backlog` drip currently has nothing to draw
 * on.
 *
 * The obvious shortcut is the one thing that must not happen: deriving the
 * hook from the headline or the first sentence of the prose. DECISIONS.md §11
 * measured what that costs — 28 of these 57 headlines follow one of five
 * detector templates, and "Caught Once, Never Again" alone accounts for nine.
 * A backfill that copied headlines would produce a profile grid of visibly
 * duplicated copy: the exact failure "authored, never derived" exists to
 * prevent, applied retroactively to the whole archive.
 *
 * So a backfilled note goes through the SAME authoring path a new one does —
 * `generateSocial()` then `checkSocial()`. Nothing downstream should be able
 * to tell which is which.
 *
 * The CLI wrapper is scripts/backfill-social.ts.
 */

import { resolveAnchorConcert } from "../syndication/payload.ts";
import { VENUE_NAMED_DETECTORS } from "./image-refs.ts";
import type { SocialContext } from "./social.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost, PostSocial } from "../../src/types/liner-notes.ts";

export interface BackfillSources {
  concerts: Concert[];
  artistsMetadata: Record<string, { name?: string }>;
  venuesMetadata: Record<string, { name?: string; city?: string }>;
  /**
   * Optional: release dates the copy is allowed to cite. The voice skill makes
   * an album's release date Tier 1 when this file carries it, so a caption
   * saying "Rebel Yell had been out since November 1983" is sourced — but only
   * if the year gate can see the same file the rule refers to.
   */
  albumEras?: {
    artists?: Record<string, { studioAlbums?: Array<{ releaseDate?: string }> }>;
  };
}

export interface BackfillOptions {
  /** Re-author notes that already carry copy. */
  force?: boolean;
  /** Author at most this many. */
  limit?: number;
  /** Restrict to one note. */
  slug?: string;
}

export interface BackfillSelection {
  candidates: Array<{ post: LinerNotesPost; context: SocialContext }>;
  skipped: Array<{ slug: string; reason: string }>;
}

/**
 * The credit stack the card will render, so the hook is authored against
 * exactly the furniture it must NOT repeat.
 *
 * Resolved through `resolveAnchorConcert` — the same function the payload
 * builder uses — rather than reimplemented. Two different answers to "which
 * night is this post about" is how a hook ends up written against a venue the
 * card does not show.
 */
export function contextFor(
  post: LinerNotesPost,
  sources: BackfillSources
): SocialContext | undefined {
  const concert = resolveAnchorConcert(post, sources.concerts);
  if (!concert) return undefined;

  const venueSlug = post.venues.includes(concert.venueNormalized)
    ? concert.venueNormalized
    : post.venues[0] ?? concert.venueNormalized;
  const venue = sources.venuesMetadata[venueSlug];

  return {
    artists: post.artists.map((slug) => sources.artistsMetadata[slug]?.name ?? slug),
    venue: venue?.name ?? concert.venue,
    city: venue?.city ?? concert.city,
    date: concert.date,
    song: post.audio?.role === "subject" ? post.audio.trackName : undefined,
    knownYears: knownYears(post, sources),
    knownDates: knownDates(post, sources),
    // Narrower than VENUE_SUBJECT_DETECTORS on purpose — see the comment there.
    // The second half of the test is the load-bearing one: a post naming sixteen
    // venues has no single room to be about, whatever its detector says.
    subject:
      VENUE_NAMED_DETECTORS.has(post.detector) && post.venues.length === 1
        ? "venue"
        : "artist",
  };
}

/**
 * The years this post may state, over and above the ones in its own prose.
 *
 * `post.years` is the detector's own answer to "which years is this about", so a
 * drought-comeback post carries both ends of the gap even though only one of
 * them is the anchor concert. Album release years come from `album-eras.json`,
 * which the voice skill already treats as Tier 1 evidence.
 */
export function knownYears(post: LinerNotesPost, sources: BackfillSources): number[] {
  const out = new Set<number>(post.years ?? []);
  for (const slug of post.artists) {
    for (const album of sources.albumEras?.artists?.[slug]?.studioAlbums ?? []) {
      const year = Number(album.releaseDate?.slice(0, 4));
      if (Number.isFinite(year)) out.add(year);
    }
  }
  return [...out];
}

/**
 * Exact dates this post may state: the nights themselves, and the release dates
 * of albums by the acts involved.
 *
 * Narrower than `knownYears` on purpose. A full calendar date in the copy is
 * always a quotation, never a calculation, so it either appears here or it was
 * remembered from somewhere that is not this archive.
 */
export function knownDates(post: LinerNotesPost, sources: BackfillSources): string[] {
  const out = new Set<string>();
  for (const concert of sources.concerts) {
    if (post.artists.includes(concert.headlinerNormalized) || post.years?.includes(concert.year)) {
      out.add(concert.date);
    }
  }

  // 🔴 EVERY ARTIST'S RELEASES, NOT JUST THIS POST'S. An album-context note is
  // frequently ABOUT a record by someone else — the Siouxsie post turns on U2's
  // Achtung Baby — so scoping this to `post.artists` rejected the one date in it
  // that was right. The question this gate asks is "did you invent this", not
  // "is this the correct album", and a release date anywhere in album-eras is a
  // date the archive holds.
  for (const artist of Object.values(sources.albumEras?.artists ?? {})) {
    for (const album of artist.studioAlbums ?? []) {
      // Partial values like "1995-01" and "2003" appear in the file; a date that
      // is not a full date cannot be matched against one and would only ever
      // create false rejections.
      if (album.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(album.releaseDate)) {
        out.add(album.releaseDate);
      }
    }
  }
  // 🔴 A "DAYS BEFORE/AFTER" POST MAKES ONE MORE DATE COMPUTABLE, and the gate's
  // premise — that a full date is always a quotation, never a calculation — is
  // false for exactly this shape. The Brian Setzer note says The Bends dropped
  // "13 days" before a show on 1995-03-26, so 1995-03-13 is derived from the
  // post's own prose. It is not in album-eras because Radiohead has never been
  // seen live, so no amount of widening that file would have reached it, and the
  // gate rejected the post's entire premise as a fabrication.
  for (const match of String(post.prose ?? "").matchAll(/\b(\d{1,4})\s+days?\b/gi)) {
    const days = Number(match[1]);
    if (!Number.isFinite(days) || days > 3650) continue;
    for (const anchor of post.years?.length ? [...out] : []) {
      const t = Date.parse(`${anchor}T00:00:00Z`);
      if (Number.isNaN(t)) continue;
      for (const sign of [-1, 1]) {
        out.add(new Date(t + sign * days * 86400000).toISOString().slice(0, 10));
      }
    }
  }

  return [...out];
}

/**
 * Which notes to author, oldest first.
 *
 * Oldest-first matches the drip, which also reaches back oldest-first — so a
 * partial run has already covered whatever ships next, rather than leaving a
 * gap exactly where the backlog is about to draw from.
 *
 * A note with no resolvable concert is skipped rather than authored: the
 * payload builder would mark it ineligible anyway for want of a credit stack,
 * so authoring copy for it would spend an API call on something that can never
 * publish.
 */
export function selectForBackfill(
  posts: LinerNotesPost[],
  sources: BackfillSources,
  options: BackfillOptions = {}
): BackfillSelection {
  const limit = options.limit ?? Infinity;
  const ordered = [...posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const candidates: BackfillSelection["candidates"] = [];
  const skipped: BackfillSelection["skipped"] = [];

  for (const post of ordered) {
    if (options.slug && post.slug !== options.slug) continue;
    if (post.social && !options.force) continue;
    if (candidates.length >= limit) break;

    const context = contextFor(post, sources);
    if (!context) {
      skipped.push({ slug: post.slug, reason: "no concert resolves for the credit stack" });
      continue;
    }
    candidates.push({ post, context: { ...context, avoid: siblingHooks(post, posts) } });
  }

  return { candidates, skipped };
}

/**
 * What the other posts of this detector already say.
 *
 * Same detector only — that is where the material rhymes and therefore where the
 * copy converges. Widening it to the whole corpus would spend tokens listing
 * fifty-eight hooks that share nothing with this one, and dilute the handful
 * that actually threaten to repeat.
 *
 * Capped, and taken from the END of publication order: the most recent siblings
 * are the ones a reader scrolling the profile will still have in view.
 */
const AVOID_LIMIT = 8;

export function siblingHooks(post: LinerNotesPost, all: LinerNotesPost[]): string[] {
  return all
    .filter((p) => p.slug !== post.slug && p.detector === post.detector && p.social?.hook)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-AVOID_LIMIT)
    // 🔴 HOOK AND CAPTION BOTH. Showing hooks alone suppressed the repeated
    // opening and let the same idea reappear one line lower: "I never planned
    // it" moved out of four hooks and straight into four captions.
    .flatMap((p) => [p.social!.hook, p.social!.caption].filter(Boolean));
}

export interface ApplyResult {
  attached: number;
  failed: Array<{ slug: string; reason: string }>;
}

/**
 * Attach authored copy to the posts, gated on the voice checks.
 *
 * `posts` is the live array from `liner-notes.json` and is mutated in place —
 * `check` is injected so the gate is explicit rather than an import the caller
 * has to know about. A backfilled note is held to exactly the standard a new
 * one is; a failure drops the copy and leaves the note as it was, never
 * half-written.
 */
export function applyAuthored(
  posts: LinerNotesPost[],
  authored: Map<string, PostSocial>,
  /**
   * Looked up per post so the venue rule can be applied, and `undefined` for an
   * artist-subject post — where requiring the venue name would break the rule
   * that keeps those hooks clean.
   */
  contexts: Map<string, SocialContext>,
  check: (input: {
    hook: string;
    caption: string;
    beats?: string[];
    headline?: string;
    venue?: { name: string; city?: string };
    bill?: { headliner: string; support: string[] };
    derivedFrom?: { prose: string; names: string[] };
    span?: { years: number[]; timely: boolean; today: number };
    sourceText?: string;
  }) => Array<{ severity: "error" | "warning"; rule: string; detail: string }>,
  onIssues?: (slug: string, issues: Array<{ severity: string; rule: string; detail: string }>) => void
): ApplyResult {
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const result: ApplyResult = { attached: 0, failed: [] };

  for (const [slug, social] of authored) {
    const post = bySlug.get(slug);
    if (!post) {
      result.failed.push({ slug, reason: "no such post" });
      continue;
    }

    const context = contexts.get(slug);
    const issues = check({
      ...social,
      headline: post.headline,
      // Everything the copy is allowed to have taken a number from.
      sourceText: [
        post.prose ?? "",
        post.headline,
        context?.date ?? "",
        ...(context?.artists ?? []),
        context?.venue ?? "",
        ...(context?.knownYears ?? []).map(String),
      ].join(" "),
      ...(context?.subject === "venue"
        ? { venue: { name: context.venue, city: context.city } }
        : {}),
      // Only on a real multi-act bill: on a single-act post the artist is
      // furniture the hook is told not to repeat.
      ...(context && context.artists.length > 1
        ? { bill: { headliner: context.artists[0], support: context.artists.slice(1) } }
        : {}),
      // Names stripped from both sides, so the caption is not punished for doing
      // its job — see longestSharedRun.
      ...(post.prose && context
        ? { derivedFrom: { prose: post.prose, names: [...context.artists, context.venue, context.city] } }
        : {}),
      span: {
        years: [...new Set(post.years ?? [])],
        timely: post.temporality === "timely",
        today: new Date().getUTCFullYear(),
      },
    });
    if (issues.length) onIssues?.(slug, issues);

    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length) {
      result.failed.push({ slug, reason: errors.map((e) => e.rule).join(", ") });
      continue;
    }

    post.social = social;
    result.attached++;
  }

  return result;
}
