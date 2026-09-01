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
import { socialCheckExtras, type SocialContext } from "./social.ts";

/** What `socialCheckExtras` supplies — named so the injected gate stays explicit. */
type SocialCheckExtras = ReturnType<typeof socialCheckExtras>;
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost, PostSocial } from "../../src/types/liner-notes.ts";

export interface BackfillSources {
  concerts: Concert[];
  artistsMetadata: Record<string, { name?: string }>;
  venuesMetadata: Record<string, { name?: string; city?: string }>;
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
    // Same two fields the live pipeline supplies. A backfilled note is
    // indistinguishable from a fresh one downstream, and that has to include
    // what the voice check sees — otherwise the back catalogue is authored
    // against a weaker guard than the notes written next week.
    openers: concert.openers ?? [],
    years: post.years ?? [],
  };
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
    candidates.push({ post, context });
  }

  return { candidates, skipped };
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
  check: (input: Partial<SocialCheckExtras> & { hook: string; caption: string; beats?: string[] }) =>
    Array<{ severity: "error" | "warning"; rule: string; detail: string }>,
  onIssues?: (slug: string, issues: Array<{ severity: string; rule: string; detail: string }>) => void,
  /**
   * The credit stacks from `contextFor`, by slug.
   *
   * Optional only so the existing callers keep compiling. Pass it: without a
   * context there are no display names or openers to mask, and `derived-copy`
   * then reads a beat that lists the bill as lifted phrasing.
   */
  contexts?: Map<string, SocialContext>
): ApplyResult {
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const result: ApplyResult = { attached: 0, failed: [] };

  for (const [slug, social] of authored) {
    const post = bySlug.get(slug);
    if (!post) {
      result.failed.push({ slug, reason: "no such post" });
      continue;
    }

    const context = contexts?.get(slug);
    const issues = check({
      ...social,
      ...(context
        ? socialCheckExtras(post, context)
        : { headline: post.headline, prose: post.prose, temporality: post.temporality, years: post.years }),
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
