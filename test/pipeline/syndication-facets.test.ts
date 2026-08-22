/**
 * Byte-offset facets (#332).
 *
 * The acceptance criterion is "byte-offset facets verified against a post
 * containing a link, a tag, and a non-ASCII artist name" — because that is
 * exactly the combination where a UTF-16 index silently produces a mangled
 * link, and where an ASCII-only test would pass while production broke.
 */

import { describe, it, expect } from "vitest";
import { FacetedText, utf8Length, graphemeLength, displayUrl } from "../../scripts/syndication/facets.ts";
import { composeBlueskyText, describe as describeCredit } from "../../scripts/syndication/adapters/bluesky.ts";
import type { SyndicationPayload } from "../../scripts/syndication/types.ts";

function payload(overrides: Partial<SyndicationPayload> = {}): SyndicationPayload {
  return {
    slug: "bjork-at-the-greek",
    kind: "liner-note",
    hook: "The hook",
    caption: "I saw Björk at the Greek and I have not stopped thinking about it.",
    credit: {
      artists: ["Björk"],
      venue: "Greek Theatre",
      city: "Los Angeles",
      date: "1997-08-09",
    },
    url: "https://concerts.morperhaus.org/liner-notes/bjork-at-the-greek",
    media: [
      {
        role: "card",
        aspect: "1.91:1",
        path: "public/og/liner-notes/bjork-at-the-greek.png",
        alt: "Björk at the Greek Theatre.",
        tier: 2,
        source: "artist-audiodb",
      },
    ],
    tags: ["Bjork", "GreekTheatre", "LosAngeles", "1990s"],
    eligible: true,
    ineligibleReasons: [],
    ...overrides,
  };
}

/** Decode the facet's byte span back out of the UTF-8 encoding of the text. */
function sliceByFacet(text: string, byteStart: number, byteEnd: number): string {
  return new TextDecoder().decode(new TextEncoder().encode(text).slice(byteStart, byteEnd));
}

describe("FacetedText", () => {
  it("computes offsets in UTF-8 bytes, not UTF-16 code units", () => {
    const t = new FacetedText();
    t.append("Björk — ");
    t.appendLink("concerts.morperhaus.org", "https://concerts.morperhaus.org/x?utm_source=bluesky");

    const [facet] = t.facets;
    // "Björk — " is 8 code units but 11 bytes: ö is 2, the em dash is 3.
    expect("Björk — ".length).toBe(8);
    expect(utf8Length("Björk — ")).toBe(11);
    expect(facet.index.byteStart).toBe(11);
    expect(sliceByFacet(t.text, facet.index.byteStart, facet.index.byteEnd)).toBe(
      "concerts.morperhaus.org"
    );
  });

  it("puts the # inside the facet span and the bare word in the tag", () => {
    const t = new FacetedText();
    t.append("Motörhead ");
    t.appendTag("#Motorhead");

    const [facet] = t.facets;
    expect(sliceByFacet(t.text, facet.index.byteStart, facet.index.byteEnd)).toBe("#Motorhead");
    expect(facet.features[0]).toEqual({
      $type: "app.bsky.richtext.facet#tag",
      tag: "Motorhead",
    });
  });

  it("keeps every facet correct when several follow a multi-byte name", () => {
    const composed = composeBlueskyText(payload());

    for (const facet of composed.facets) {
      const slice = sliceByFacet(composed.text, facet.index.byteStart, facet.index.byteEnd);
      const feature = facet.features[0];
      if (feature.$type === "app.bsky.richtext.facet#tag") {
        expect(slice).toBe(`#${feature.tag}`);
      } else {
        // The display text is a truncation of the URL, never the URL itself.
        expect(composed.text).toContain(slice);
        expect(feature.uri).toContain("utm_source=bluesky");
      }
    }
  });

  it("carries a link facet and at least one tag facet, per the acceptance criterion", () => {
    const composed = composeBlueskyText(payload());
    const kinds = composed.facets.map((f) => f.features[0].$type);
    expect(kinds).toContain("app.bsky.richtext.facet#link");
    expect(kinds).toContain("app.bsky.richtext.facet#tag");
  });

  it("stacks no more than the two tags Bluesky tolerates", () => {
    const composed = composeBlueskyText(payload());
    const tagFacets = composed.facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag"
    );
    expect(tagFacets).toHaveLength(2);
  });
});

describe("graphemeLength", () => {
  it("counts what Bluesky counts, not code units", () => {
    // A combining acute is two code units and one grapheme.
    expect("é".normalize("NFD").length).toBe(2);
    expect(graphemeLength("é".normalize("NFD"))).toBe(1);
  });

  it("keeps a real post inside the 300 budget", () => {
    expect(graphemeLength(composeBlueskyText(payload()).text)).toBeLessThanOrEqual(300);
  });
});

describe("displayUrl", () => {
  it("strips the scheme and the query, and truncates", () => {
    const long =
      "https://concerts.morperhaus.org/liner-notes/the-brian-setzer-orchestra-a-jazz-blues-outlier-in-a-rock-electronic-reggae-arch?utm_source=bluesky";
    const display = displayUrl(long, 40);
    expect(display).toHaveLength(40);
    expect(display).not.toContain("utm_source");
    expect(display.startsWith("concerts.morperhaus.org/liner-notes/")).toBe(true);
  });

  it("leaves a short URL alone", () => {
    expect(displayUrl("https://concerts.morperhaus.org/x", 40)).toBe("concerts.morperhaus.org/x");
  });
});

describe("embed description", () => {
  it("is the credit stack, not the hook", () => {
    const text = describeCredit(payload());
    expect(text).toBe("Björk · Greek Theatre · Los Angeles · 1997-08-09");
    expect(text).not.toContain("The hook");
  });
});
