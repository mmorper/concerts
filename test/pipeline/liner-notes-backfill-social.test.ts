/**
 * Social-copy backfill (#323).
 *
 * The load-bearing property is that a backfilled note is indistinguishable
 * from a freshly authored one: same authoring path, same voice checks, no
 * shortcut from the headline. DECISIONS.md §11 measured why — 28 of the 57
 * headlines follow one of five detector templates, so a backfill that derived
 * copy from them would fill the profile grid with visible duplicates.
 */

import { describe, it, expect, vi } from "vitest";
import {
  selectForBackfill,
  applyAuthored,
  contextFor,
  type BackfillSources,
} from "../../scripts/liner-notes/backfill-social.ts";
import { checkSocial } from "../../scripts/liner-notes/voice-check.ts";
import type { SocialContext } from "../../scripts/liner-notes/social.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost, PostSocial } from "../../src/types/liner-notes.ts";

const CONCERTS = [
  {
    id: "c1",
    date: "1986-07-31",
    headliner: "The Art of Noise",
    headlinerNormalized: "the-art-of-noise",
    openers: [],
    venue: "Pacific Amphitheatre",
    venueNormalized: "pacific-amphitheatre",
    city: "Costa Mesa",
    year: 1986,
  },
  {
    id: "c2",
    date: "1991-06-21",
    headliner: "Jimmy Buffett",
    headlinerNormalized: "jimmy-buffett",
    openers: [],
    venue: "Irvine Meadows",
    venueNormalized: "irvine-meadows",
    city: "Irvine",
    year: 1991,
  },
] as unknown as Concert[];

const SOURCES: BackfillSources = {
  concerts: CONCERTS,
  artistsMetadata: {
    "the-art-of-noise": { name: "The Art of Noise" },
    "jimmy-buffett": { name: "Jimmy Buffett" },
  },
  venuesMetadata: {
    "pacific-amphitheatre": { name: "Pacific Amphitheatre", city: "Costa Mesa" },
    "irvine-meadows": { name: "Irvine Meadows", city: "Irvine" },
  },
};

function post(overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    id: "n",
    slug: "forty-years-since-the-art-of-noise",
    category: "cultural",
    // A calendar anniversary IS the count, and it publishes on the day it is
    // true — so this fixture's "Forty years to the day" is not the perishable
    // kind. `perishable-claim` reads temporality, so it has to be honest here.
    temporality: "timely",
    headline: "July 31: 40 Years Since The Art of Noise",
    prose: "Prose.",
    image: { url: "https://r2.theaudiodb.com/x.jpg", alt: "x", source: "artist" },
    artists: ["the-art-of-noise"],
    venues: ["pacific-amphitheatre"],
    years: [1986],
    tags: ["#calendar-anniversary"],
    deepLinks: [],
    relatedSlugs: [],
    score: 40,
    detector: "calendar-anniversary",
    publishedAt: "2026-07-31T00:00:00.000Z",
    ...overrides,
  } as LinerNotesPost;
}

const SOCIAL: PostSocial = {
  hook: "Forty years to the day, in the same amphitheatre.",
  caption: "I was seventeen the first time. I keep coming back to this room.",
  authoredAt: "2026-08-22T00:00:00.000Z",
};

describe("contextFor", () => {
  it("resolves the credit stack the hook must not repeat", () => {
    expect(contextFor(post(), SOURCES)).toEqual({
      artists: ["The Art of Noise"],
      venue: "Pacific Amphitheatre",
      city: "Costa Mesa",
      date: "1986-07-31",
      song: undefined,
      subject: "artist",
      knownYears: [1986],
      knownDates: ["1986-07-31"],
    });
  });

  it("marks a single-venue loyalty post as venue-subject", () => {
    const loyalty = contextFor(
      post({ detector: "venue-loyalty", venues: ["pacific-amphitheatre"] }),
      SOURCES
    );
    expect(loyalty?.subject).toBe("venue");
  });

  it("does NOT mark a post spanning several venues as venue-subject", () => {
    // `my-west-coast-chapter` covers sixteen rooms. Requiring it to name
    // venues[0] would force one arbitrary venue into a hook about a region.
    const chapter = contextFor(
      post({
        detector: "geographic-chapter",
        venues: ["pacific-amphitheatre", "irvine-meadows"],
      }),
      SOURCES
    );
    expect(chapter?.subject).toBe("artist");
  });

  it("carries the subject song when the post has one, and only then", () => {
    const withSong = contextFor(
      post({
        audio: {
          trackName: "Notorious",
          artistName: "x",
          albumName: "y",
          previewUrl: "",
          albumArt: "",
          streamingUrl: "",
          source: "itunes",
          role: "subject",
        },
      }),
      SOURCES
    );
    expect(withSong?.song).toBe("Notorious");

    const bestKnown = contextFor(
      post({
        audio: {
          trackName: "Get Lucky",
          artistName: "x",
          albumName: "y",
          previewUrl: "",
          albumArt: "",
          streamingUrl: "",
          source: "itunes",
          role: "best-known",
        },
      }),
      SOURCES
    );
    // A stand-in track is not what the post is about, so it is not credit.
    expect(bestKnown?.song).toBeUndefined();
  });

  it("returns undefined when no concert resolves", () => {
    expect(contextFor(post({ artists: ["nobody"], venues: [] }), SOURCES)).toBeUndefined();
  });
});

describe("selectForBackfill", () => {
  const older = post({ slug: "older", publishedAt: "2026-01-01T00:00:00.000Z" });
  const newer = post({ slug: "newer", publishedAt: "2026-07-01T00:00:00.000Z" });

  it("takes oldest first, matching the direction the drip reaches back", () => {
    const { candidates } = selectForBackfill([newer, older], SOURCES);
    expect(candidates.map((c) => c.post.slug)).toEqual(["older", "newer"]);
  });

  it("skips notes that already carry copy, so a re-run resumes", () => {
    const done = post({ slug: "done", social: SOCIAL, publishedAt: "2026-01-01T00:00:00.000Z" });
    const { candidates } = selectForBackfill([done, newer], SOURCES);
    expect(candidates.map((c) => c.post.slug)).toEqual(["newer"]);
  });

  it("re-authors under --force", () => {
    const done = post({ slug: "done", social: SOCIAL });
    const { candidates } = selectForBackfill([done], SOURCES, { force: true });
    expect(candidates).toHaveLength(1);
  });

  it("honours a limit so the batch can be run in chunks", () => {
    const { candidates } = selectForBackfill([older, newer], SOURCES, { limit: 1 });
    expect(candidates.map((c) => c.post.slug)).toEqual(["older"]);
  });

  it("restricts to one slug", () => {
    const { candidates } = selectForBackfill([older, newer], SOURCES, { slug: "newer" });
    expect(candidates.map((c) => c.post.slug)).toEqual(["newer"]);
  });

  it("skips a note with no anchor concert rather than paying for copy it cannot use", () => {
    // The payload builder would mark it ineligible for want of a credit stack,
    // so authoring would spend an API call on something that can never publish.
    const orphan = post({ slug: "orphan", artists: ["nobody"], venues: [] });
    const { candidates, skipped } = selectForBackfill([orphan], SOURCES);
    expect(candidates).toHaveLength(0);
    expect(skipped).toEqual([
      { slug: "orphan", reason: "no concert resolves for the credit stack" },
    ]);
  });
});

/** These posts are artist-subject, so no venue name is required of them. */
const NO_VENUE_RULE = new Map<string, SocialContext>();

describe("applyAuthored", () => {
  it("attaches copy that passes the voice checks", () => {
    const posts = [post()];
    const result = applyAuthored(
      posts,
      new Map([[posts[0].slug, SOCIAL]]),
      NO_VENUE_RULE,
      checkSocial
    );
    expect(result).toEqual({ attached: 1, failed: [] });
    expect(posts[0].social).toEqual(SOCIAL);
  });

  it("holds a backfilled note to the same standard as a new one", () => {
    // A hook that restates the headline is the exact failure mode the
    // backfill could otherwise reintroduce across the whole archive.
    const posts = [post()];
    const derived: PostSocial = {
      ...SOCIAL,
      hook: "July 31 — 40 years since The Art of Noise!",
    };
    const result = applyAuthored(posts, new Map([[posts[0].slug, derived]]), NO_VENUE_RULE, checkSocial);

    expect(result.attached).toBe(0);
    expect(result.failed[0].reason).toContain("derived-copy");
    // Left exactly as it was — never half-written.
    expect(posts[0].social).toBeUndefined();
  });

  it("reports an unknown slug instead of silently dropping it", () => {
    const posts = [post()];
    const result = applyAuthored(posts, new Map([["ghost", SOCIAL]]), NO_VENUE_RULE, checkSocial);
    expect(result.failed).toEqual([{ slug: "ghost", reason: "no such post" }]);
  });

  it("surfaces warnings without blocking", () => {
    const posts = [post()];
    const onIssues = vi.fn();
    const thirdPerson: PostSocial = {
      ...SOCIAL,
      caption: "The band played for two hours in the rain.",
    };
    const result = applyAuthored(posts, new Map([[posts[0].slug, thirdPerson]]), NO_VENUE_RULE, checkSocial, onIssues);

    expect(result.attached).toBe(1);
    expect(onIssues).toHaveBeenCalledWith(
      posts[0].slug,
      expect.arrayContaining([expect.objectContaining({ severity: "warning", rule: "person" })])
    );
  });
});
