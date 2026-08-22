/**
 * On This Day as a second `kind` on the canonical payload (#333).
 *
 * The claim Phase 1 made was that a new content stream is a payload variant,
 * not a pipeline — no adapter changes, no channel formatting branches. These
 * assert that literally: an On This Day payload goes through the SAME adapter
 * composition functions as a liner note and comes out correctly formatted.
 */

import { describe, it, expect } from "vitest";
import { buildOnThisDayPayload, onThisDayAlt } from "../../scripts/syndication/payload.ts";
import { composeBlueskyText } from "../../scripts/syndication/adapters/bluesky.ts";
import { composeMastodonStatus } from "../../scripts/syndication/adapters/mastodon.ts";
import { CAPTION_MAX, HOOK_MAX } from "../../scripts/syndication/budgets.ts";
import type { OnThisDayPost } from "../../scripts/on-this-day/types.ts";

function post(overrides: Partial<OnThisDayPost> = {}): OnThisDayPost {
  return {
    slug: "otd-2027-06-30",
    day: "06-30",
    showDate: "1987-06-30",
    age: 40,
    artist: "Oingo Boingo",
    artistNormalized: "oingo-boingo",
    venue: "Caliente Racetrack",
    venueNormalized: "caliente-racetrack",
    city: "Tijuana",
    score: 72,
    // Points at a card that exists in the repo, so the "card not rendered"
    // gate does not fire. Any committed PNG serves.
    cardPath: "public/icons/favicon-32.png",
    imageUrl: "https://r2.theaudiodb.com/ob.jpg",
    tier: 2,
    source: "artist-audiodb",
    url: "https://concerts.morperhaus.org/?scene=artists&artist=oingo-boingo",
    social: {
      hook: "Forty years to the day, at a racetrack across the border.",
      caption: "I was there and I have never seen a crowd like it since.",
      authoredAt: "2027-06-30T00:00:00.000Z",
    },
    publishedAt: "2027-06-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildOnThisDayPayload", () => {
  it("produces an eligible payload marked as the second kind", () => {
    const payload = buildOnThisDayPayload(post());
    expect(payload.eligible).toBe(true);
    expect(payload.ineligibleReasons).toEqual([]);
    expect(payload.kind).toBe("on-this-day");
    expect(payload.credit).toEqual({
      artists: ["Oingo Boingo"],
      venue: "Caliente Racetrack",
      city: "Tijuana",
      date: "1987-06-30",
    });
  });

  it("tags the decade of the SHOW, not of the anniversary", () => {
    // A 1987 show posted in 2027 belongs in #1980s. Tagging it #2020s would
    // file the archive's own history under the year someone read it.
    expect(buildOnThisDayPayload(post()).tags).toContain("1980s");
    expect(buildOnThisDayPayload(post()).tags).not.toContain("2020s");
  });

  it("carries the cross-linked liner note when there is one", () => {
    const payload = buildOnThisDayPayload(
      post({
        url: "https://concerts.morperhaus.org/liner-notes/oingo-boingo-5-more-1987-festival-bill",
        linerNoteSlug: "oingo-boingo-5-more-1987-festival-bill",
      })
    );
    expect(payload.url).toContain("/liner-notes/");
  });

  it("blocks a post with no authored copy", () => {
    const payload = buildOnThisDayPayload(post({ social: undefined }));
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/no authored social text/);
  });

  it("blocks over-budget copy on the same budgets liner notes use", () => {
    expect(
      buildOnThisDayPayload(
        post({ social: { hook: "x".repeat(HOOK_MAX + 1), caption: "y", authoredAt: "" } })
      ).ineligibleReasons.join()
    ).toMatch(new RegExp(`hook ${HOOK_MAX + 1} chars`));

    expect(
      buildOnThisDayPayload(
        post({ social: { hook: "h", caption: "y".repeat(CAPTION_MAX + 1), authoredAt: "" } })
      ).ineligibleReasons.join()
    ).toMatch(/caption 201 chars/);
  });

  it("blocks a post whose card was never rendered — never bare type", () => {
    const payload = buildOnThisDayPayload(post({ cardPath: "public/og/on-this-day/nope.png" }));
    expect(payload.eligible).toBe(false);
    expect(payload.ineligibleReasons.join()).toMatch(/card not rendered/);
  });

  it("writes alt text that leads with the date, as the card does", () => {
    expect(onThisDayAlt(post())).toBe(
      "40 years ago today: Oingo Boingo at Caliente Racetrack, Tijuana, 30 June 1987."
    );
  });
});

describe("the adapters do not know there are two streams", () => {
  it("composes a Bluesky post from an On This Day payload unchanged", () => {
    const composed = composeBlueskyText(buildOnThisDayPayload(post()));

    // Same facet machinery, same tag budget, same link handling.
    const kinds = composed.facets.map((f) => f.features[0].$type);
    expect(kinds).toContain("app.bsky.richtext.facet#link");
    expect(kinds).toContain("app.bsky.richtext.facet#tag");

    const link = composed.facets.find(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link"
    )!.features[0] as { uri: string };
    // The campaign is the ONE place `kind` reaches, and it is analytics only.
    expect(link.uri).toContain("utm_campaign=on-this-day");
    expect(link.uri).toContain("utm_source=bluesky");
  });

  it("composes a Mastodon status from an On This Day payload unchanged", () => {
    const status = composeMastodonStatus(buildOnThisDayPayload(post()));
    expect(status).toContain("utm_campaign=on-this-day");
    expect(status).toContain("#OingoBoingo");
    expect(status).toContain("#1980s");
  });
});
