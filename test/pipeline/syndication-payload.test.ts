/**
 * Canonical payload, provenance and tags (#329, #327).
 *
 * The tag tests carry the most weight here. "Detector tags never publish" is a
 * rule the spec states three times, and `#full-circle` on a public timeline is
 * both meaningless to a reader and an instant tell that a machine wrote the
 * post — so it is asserted rather than assumed.
 */

import { describe, it, expect } from "vitest";
import { buildPayload, resolveAnchorConcert, cardAlt, SITE_URL } from "../../scripts/syndication/payload.ts";
import { classifyImageUrl } from "../../scripts/syndication/provenance.ts";
import { entityTags, tagsForChannel, toHashtag } from "../../scripts/syndication/tags.ts";
import { isPublishableTier } from "../../scripts/syndication/types.ts";
import { withUtm } from "../../scripts/syndication/utm.ts";
import { CAPTION_MAX, HOOK_MAX } from "../../scripts/syndication/budgets.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

const CONCERT = {
  id: "concert-1",
  date: "1986-07-31",
  headliner: "The Art of Noise",
  headlinerNormalized: "the-art-of-noise",
  openers: [],
  venue: "Pacific Amphitheatre",
  venueNormalized: "pacific-amphitheatre",
  city: "Costa Mesa",
  state: "California",
  year: 1986,
} as unknown as Concert;

function post(overrides: Partial<LinerNotesPost> = {}): LinerNotesPost {
  return {
    id: "note",
    slug: "forty-years-since-the-art-of-noise",
    category: "cultural",
    temporality: "evergreen",
    headline: "July 31: 40 Years Since The Art of Noise",
    prose: "Prose.",
    image: {
      url: "https://r2.theaudiodb.com/images/media/artist/thumb/x.jpg",
      alt: "The Art of Noise",
      source: "artist",
    },
    artists: ["the-art-of-noise"],
    venues: ["pacific-amphitheatre"],
    years: [1986],
    // Detector taxonomy. It must never reach a payload.
    tags: ["#calendar-anniversary", "#full-circle"],
    deepLinks: [],
    relatedSlugs: [],
    score: 40,
    detector: "calendar-anniversary",
    publishedAt: "2026-07-31T00:00:00.000Z",
    social: {
      hook: "Forty years to the day, in the same amphitheatre.",
      caption: "I was seventeen and I have been coming back to this room ever since.",
      authoredAt: "2026-07-31T00:00:00.000Z",
    },
    ...overrides,
  } as LinerNotesPost;
}

const sources = {
  concerts: [CONCERT],
  artistsMetadata: { "the-art-of-noise": { name: "The Art of Noise" } },
  // `state` carries the region the card prints after the city — "Costa Mesa, CA".
  venuesMetadata: {
    "pacific-amphitheatre": { name: "Pacific Amphitheatre", city: "Costa Mesa", state: "California" },
  },
  cardExists: () => true,
};

describe("provenance", () => {
  it.each([
    ["https://coverartarchive.org/release-group/x/front-500.jpg", 2, "cover-art"],
    ["https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg", 2, "album-itunes"],
    ["https://r2.theaudiodb.com/images/media/artist/thumb/x.jpg", 2, "artist-audiodb"],
    ["https://e-cdns-images.dzcdn.net/images/artist/x.jpg", 2, "artist-deezer"],
    ["https://places.googleapis.com/v1/photo/x", 2, "venue-places"],
    ["https://upload.wikimedia.org/wikipedia/commons/x.jpg", 2, "wikimedia"],
    // The path #340's media-index schema names. Classified before that work
    // lands, so real photography is never mistaken for the generic fallback.
    ["/images/shows/2026-07-31-nile-rodgers-01.jpg", 1, "personal"],
    ["/images/personal/nile-rodgers-2026.jpg", 1, "personal"],
    ["/images/generative/constellation.png", 3, "generative"],
    ["/images/material/ticket-stub.png", 3, "material"],
    ["/images/venues/fallback-active.jpg", 3, "site-fallback"],
  ])("classifies %s as tier %i / %s", (url, tier, source) => {
    expect(classifyImageUrl(url)).toEqual({ tier, source });
  });

  it("returns undefined for an unknown host rather than guessing a label", () => {
    // An unclassified image must be visible in the run log, not promoted.
    expect(classifyImageUrl("https://some-new-cdn.example/x.jpg")).toBeUndefined();
  });

  it("leaves an unrecognised LOCAL path unclassified rather than suppressing it", () => {
    // Classifying it as site-fallback would never publish it and would say
    // nothing about why. Suppression is fine; silent suppression is not.
    expect(classifyImageUrl("/images/somewhere-new/x.jpg")).toBeUndefined();
  });

  it("puts the generic site fallback below the tier-3 floor", () => {
    const asset = { source: "site-fallback" } as Parameters<typeof isPublishableTier>[0];
    expect(isPublishableTier(asset)).toBe(false);
  });
});

describe("tags", () => {
  it("CamelCases so a screen reader finds the word boundaries", () => {
    expect(toHashtag("Nile Rodgers")).toBe("NileRodgers");
    expect(toHashtag("Los Angeles")).toBe("LosAngeles");
  });

  it("folds diacritics, because a hashtag is an index key", () => {
    expect(toHashtag("Björk")).toBe("Bjork");
    expect(toHashtag("Sigur Rós")).toBe("SigurRos");
  });

  it("leaves an acronym and an existing mixed case alone", () => {
    expect(toHashtag("REM")).toBe("REM");
    expect(toHashtag("McCartney")).toBe("McCartney");
  });

  it("orders artists first, so a tight budget keeps the tag a fan follows", () => {
    const tags = entityTags({
      artists: ["Nile Rodgers", "Duran Duran"],
      venues: ["Pacific Amphitheatre"],
      city: "Costa Mesa",
      date: "2026-07-31",
    });
    expect(tags).toEqual([
      "NileRodgers",
      "DuranDuran",
      "PacificAmphitheatre",
      "CostaMesa",
      "2020s",
    ]);
  });

  it("applies each channel's own answer", () => {
    const tags = ["A", "B", "C", "D", "E", "F"];
    expect(tagsForChannel(tags, "bluesky")).toEqual(["#A", "#B"]);
    expect(tagsForChannel(tags, "mastodon")).toEqual(["#A", "#B", "#C", "#D", "#E"]);
    expect(tagsForChannel(tags, "instagram")).toEqual(["#A", "#B", "#C", "#D", "#E"]);
    expect(tagsForChannel(tags, "x")).toEqual([]);
  });

  it("under-supplies rather than inventing a tag to hit a minimum", () => {
    expect(tagsForChannel(["A", "B"], "mastodon")).toEqual(["#A", "#B"]);
  });
});

describe("buildPayload", () => {
  it("builds an eligible payload from a published note", () => {
    const payload = buildPayload(post(), sources);
    expect(payload.eligible).toBe(true);
    expect(payload.ineligibleReasons).toEqual([]);
    expect(payload.url).toBe(`${SITE_URL}/liner-notes/forty-years-since-the-art-of-noise`);
    // `credit` stays SINGULAR — it is furniture naming one show on the card. Only the tag
    // list went plural, because tags are discovery and a post can span venues.
    expect(payload.credit).toEqual({
      artists: ["The Art of Noise"],
      song: undefined,
      venue: "Pacific Amphitheatre",
      region: "CA",
      city: "Costa Mesa",
      date: "1986-07-31",
    });
  });

  it("never carries a detector tag", () => {
    const payload = buildPayload(post(), sources);
    expect(payload.tags).toEqual([
      "TheArtOfNoise",
      "PacificAmphitheatre",
      "CostaMesa",
      "1980s",
    ]);
    for (const tag of payload.tags) {
      expect(tag).not.toMatch(/full|circle|calendar|anniversary/i);
    }
  });

  it("blocks a note that has no authored social text", () => {
    const payload = buildPayload(post({ social: undefined }), sources);
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/no authored social text/);
  });

  it("blocks copy that overruns a measured budget", () => {
    const payload = buildPayload(
      post({
        social: { hook: "x".repeat(HOOK_MAX + 1), caption: "y", authoredAt: "" },
      }),
      sources
    );
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(new RegExp(`hook ${HOOK_MAX + 1} chars`));
  });

  it("blocks a caption over the budget the tightest channel implies", () => {
    const payload = buildPayload(
      post({ social: { hook: "h", caption: "y".repeat(CAPTION_MAX + 1), authoredAt: "" } }),
      sources
    );
    expect(payload.ineligibleReasons.join()).toMatch(/caption 201 chars/);
  });

  it("blocks a note whose only image is the generic site fallback", () => {
    const payload = buildPayload(
      post({ image: { url: "/images/venues/fallback-active.jpg", alt: "A venue", source: "placeholder" } }),
      sources
    );
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/below the tier-3 floor/);
  });

  it("blocks a note whose card fell back to a solid ground", () => {
    // The subtle case: the card exists, and the image URL still classifies as
    // a perfectly good tier-2 source. Only the flag records that the fetch
    // failed at render time and the card is actually type on a solid ground.
    const payload = buildPayload(
      post({
        image: {
          url: "https://r2.theaudiodb.com/images/media/artist/thumb/x.jpg",
          alt: "The Art of Noise",
          source: "artist",
          cardFallback: true,
        },
      }),
      sources
    );
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/fell back to a solid ground/);
  });

  it("blocks a note whose card has not been rendered — never bare type", () => {
    const payload = buildPayload(post(), { ...sources, cardExists: () => false });
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/card not rendered/);
  });

  it("names an unclassified host in the reason rather than shipping it", () => {
    const payload = buildPayload(
      post({ image: { url: "https://new-cdn.example/x.jpg", alt: "x", source: "artist" } }),
      sources
    );
    expect(payload.ineligibleReasons.join()).toMatch(/unclassified image host: new-cdn.example/);
  });

  it("publishes personal photography at the path #340 will write to", () => {
    const payload = buildPayload(
      post({
        image: {
          url: "/images/shows/1986-07-31-art-of-noise-01.jpg",
          alt: "The stage",
          source: "artist",
          credit: "Mike Morper \u00b7 31 July 1986",
        },
      }),
      sources
    );
    expect(payload.eligible).toBe(true);
    expect(payload.media[0]).toMatchObject({ tier: 1, source: "personal" });
  });

  it("carries a byline on tier 1 only", () => {
    const tierTwo = buildPayload(post(), sources);
    expect(tierTwo.media[0].byline).toBeUndefined();

    const tierOne = buildPayload(
      post({
        image: {
          url: "/images/personal/aon-1986.jpg",
          alt: "The stage",
          source: "artist",
          credit: "Mike Morper · July 2026, not the 1986 night",
        },
      }),
      sources
    );
    expect(tierOne.media[0].tier).toBe(1);
    expect(tierOne.media[0].byline).toBe("Mike Morper · July 2026, not the 1986 night");
  });

  it("writes alt text describing the card, not the source photograph", () => {
    const alt = cardAlt(post(), {
      artists: ["The Art of Noise"],
      venue: "Pacific Amphitheatre",
      city: "Costa Mesa",
      date: "1986-07-31",
    });
    expect(alt).toBe(
      "The Art of Noise at Pacific Amphitheatre, Costa Mesa, 31 July 1986. " +
        "Card reads: July 31: 40 Years Since The Art of Noise."
    );
  });
});

describe("resolveAnchorConcert", () => {
  it("prefers the ?show= deep link, which is the night itself", () => {
    const other = { ...CONCERT, id: "concert-2", date: "1990-01-01", year: 1990 } as Concert;
    const resolved = resolveAnchorConcert(
      post({
        years: [1986, 1990],
        deepLinks: [
          { label: "x", type: "setlist", url: "/?scene=artists&artist=the-art-of-noise&show=1990-01-01" },
        ],
      }),
      [CONCERT, other]
    );
    expect(resolved?.date).toBe("1990-01-01");
  });

  it("anchors a span to its earliest night", () => {
    const later = { ...CONCERT, id: "concert-2", date: "2006-07-31", year: 2006 } as Concert;
    const resolved = resolveAnchorConcert(post({ years: [1986, 2006] }), [later, CONCERT]);
    expect(resolved?.date).toBe("1986-07-31");
  });

  it("returns undefined rather than guessing when nothing matches", () => {
    expect(resolveAnchorConcert(post({ artists: ["nobody"] }), [CONCERT])).toBeUndefined();
  });
});

describe("utm", () => {
  it("distinguishes the channel and the content stream", () => {
    expect(withUtm("https://x.org/a", "bluesky", "liner-note")).toBe(
      "https://x.org/a?utm_source=bluesky&utm_medium=social&utm_campaign=liner-note"
    );
    expect(withUtm("https://x.org/a", "mastodon", "on-this-day")).toContain(
      "utm_campaign=on-this-day"
    );
  });
});
