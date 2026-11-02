/**
 * On This Day — post assembly and cross-linking (#333).
 *
 * The cross-link tests carry the weight. Matching loosely does not fail
 * loudly; it produces a confident link to the wrong post, which is worse than
 * the generic deep link it replaces.
 */

import { describe, it, expect } from "vitest";
import { buildPost, findCoveringNote, resolveUrl, type BuildSources } from "../../scripts/on-this-day/build.ts";
import { candidateForDay } from "../../scripts/on-this-day/detect.ts";
import { SITE_URL } from "../../scripts/syndication/payload.ts";
import type { MediaIndexAsset } from "../../scripts/liner-notes/image-refs.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

const SHOW = {
  id: "c1",
  date: "1987-06-30",
  headliner: "Oingo Boingo",
  headlinerNormalized: "oingo-boingo",
  openers: [],
  venue: "Caliente Racetrack",
  venueNormalized: "caliente-racetrack",
  city: "Tijuana",
  state: "Baja California",
  year: 1987,
} as unknown as Concert;

const NOW = new Date(Date.UTC(2027, 5, 30));

function note(overrides: Partial<LinerNotesPost>): LinerNotesPost {
  return {
    id: "n",
    slug: "a-note",
    category: "cultural",
    temporality: "evergreen",
    headline: "A Note",
    prose: "Prose.",
    image: { url: "https://r2.theaudiodb.com/x.jpg", alt: "x", source: "artist" },
    artists: [],
    venues: [],
    years: [],
    tags: [],
    deepLinks: [],
    relatedSlugs: [],
    score: 40,
    detector: "artist-longevity",
    publishedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as LinerNotesPost;
}

function sources(overrides: Partial<BuildSources> = {}): BuildSources {
  return {
    artistsMetadata: { "oingo-boingo": { name: "Oingo Boingo", image: "https://r2.theaudiodb.com/ob.jpg" } },
    venuesMetadata: { "caliente-racetrack": { name: "Caliente Racetrack", city: "Tijuana" } },
    linerNotes: [],
    datesWithSetlists: new Set<string>(),
    ...overrides,
  };
}

const candidate = () => candidateForDay([SHOW], NOW)!;

describe("findCoveringNote", () => {
  it("matches on an explicit ?show= link, even across several artists", () => {
    // The festival note lists six acts, so no artist-count rule would accept
    // it — but its setlist link names this exact night, which is conclusive.
    const festival = note({
      slug: "festival",
      artists: ["oingo-boingo", "bangles", "squeeze", "chris-isaak", "the-fixx", "hoodoo-gurus"],
      venues: ["caliente-racetrack"],
      years: [1987],
      deepLinks: [
        { label: "x", type: "setlist", url: "/?scene=artists&artist=oingo-boingo&show=1987-06-30" },
      ],
    });
    expect(findCoveringNote(candidate(), [festival])?.slug).toBe("festival");
  });

  it("does NOT match a venue-spanning note that merely contains the artist and year", () => {
    // The regression this rule exists for: a venue-ghost note covering 13
    // artists across 16 years at Irvine Meadows matched a Caliente Racetrack
    // show, and would have sent readers to a post about a different venue.
    const venueGhost = note({
      slug: "irvine-meadows-16-shows",
      artists: ["oingo-boingo", "depeche-mode", "sting"],
      venues: ["irvine-meadows"],
      years: [1987, 1990, 1995],
      detector: "venue-ghost",
    });
    expect(findCoveringNote(candidate(), [venueGhost])).toBeUndefined();
  });

  it("matches a single-artist note on artist, venue AND year together", () => {
    const single = note({
      slug: "oingo-1987",
      artists: ["oingo-boingo"],
      venues: ["caliente-racetrack"],
      years: [1987],
    });
    expect(findCoveringNote(candidate(), [single])?.slug).toBe("oingo-1987");
  });

  it("rejects the right artist and year at the wrong venue", () => {
    const elsewhere = note({
      slug: "elsewhere",
      artists: ["oingo-boingo"],
      venues: ["irvine-meadows"],
      years: [1987],
    });
    expect(findCoveringNote(candidate(), [elsewhere])).toBeUndefined();
  });

  it("rejects the right artist and venue in the wrong year", () => {
    const otherYear = note({
      slug: "other-year",
      artists: ["oingo-boingo"],
      venues: ["caliente-racetrack"],
      years: [1991],
    });
    expect(findCoveringNote(candidate(), [otherYear])).toBeUndefined();
  });

  it("never links an aggregate post", () => {
    const aggregate = note({
      slug: "whole-archive",
      aggregate: true,
      artists: ["oingo-boingo"],
      venues: ["caliente-racetrack"],
      years: [1987],
    });
    expect(findCoveringNote(candidate(), [aggregate])).toBeUndefined();
  });
});

describe("resolveUrl", () => {
  it("prefers a covering liner note over the deep link", () => {
    const covering = note({ slug: "covering", artists: ["oingo-boingo"], venues: ["caliente-racetrack"], years: [1987] });
    expect(resolveUrl(candidate(), sources({ linerNotes: [covering] }))).toEqual({
      url: `${SITE_URL}/liner-notes/covering`,
      linerNoteSlug: "covering",
    });
  });

  it("emits a ?show= deep link only when a setlist backs that night", () => {
    const withSetlist = resolveUrl(candidate(), sources({ datesWithSetlists: new Set(["1987-06-30"]) }));
    expect(withSetlist.url).toBe(`${SITE_URL}/?scene=artists&artist=oingo-boingo&show=1987-06-30`);

    // No setlist means no ?show= — it would open an empty panel.
    const without = resolveUrl(candidate(), sources());
    expect(without.url).toBe(`${SITE_URL}/?scene=artists&artist=oingo-boingo`);
    expect(without.linerNoteSlug).toBeUndefined();
  });
});

describe("buildPost", () => {
  it("assembles a publishable post from the record", () => {
    const { post, ineligible } = buildPost(candidate(), sources());
    expect(ineligible).toBeUndefined();
    expect(post).toMatchObject({
      slug: "otd-2027-06-30",
      day: "06-30",
      showDate: "1987-06-30",
      age: 40,
      artist: "Oingo Boingo",
      venue: "Caliente Racetrack",
      city: "Tijuana",
      tier: 2,
      source: "artist-audiodb",
    });
  });

  it("refuses to publish when the artist has no image — never bare type", () => {
    const { ineligible } = buildPost(candidate(), sources({ artistsMetadata: { "oingo-boingo": { name: "Oingo Boingo" } } }));
    expect(ineligible).toMatch(/bare type/);
  });

  it("refuses an unclassified image host rather than guessing provenance", () => {
    const { ineligible } = buildPost(
      candidate(),
      sources({ artistsMetadata: { "oingo-boingo": { name: "Oingo Boingo", image: "https://new-cdn.example/x.jpg" } } })
    );
    expect(ineligible).toMatch(/unclassified image host/);
  });
});

describe("the owner's photograph", () => {
  const CROP = { x: 0, y: 0, w: 0.8, h: 1 };
  const asset = (name: string, overrides: Partial<MediaIndexAsset> = {}): MediaIndexAsset => ({
    kind: "image",
    url: `/images/shows/1987-06-30-${name}.jpg`,
    date: "1987-06-30",
    artist: "Oingo Boingo",
    artistNormalized: "oingo-boingo",
    order: 1,
    crop: CROP,
    ...overrides,
  });
  const withMedia = (assets: MediaIndexAsset[], overrides: Partial<BuildSources> = {}) =>
    sources({ mediaIndex: { assets }, ...overrides });
  const opener = (assets: MediaIndexAsset[]) =>
    buildPost(
      candidateForDay([{ ...SHOW, openers: ["Fishbone"] } as Concert], NOW)!,
      withMedia(assets)
    ).post;

  it("beats the press shot, and links to that frame in the gatefold", () => {
    const { post, ineligible } = buildPost(candidate(), withMedia([asset("oingo-boingo-01")]));
    expect(ineligible).toBeUndefined();
    expect(post).toMatchObject({
      imageUrl: "/images/shows/1987-06-30-oingo-boingo-01.jpg",
      crop: CROP,
      tier: 1,
      source: "personal",
      url: `${SITE_URL}/?scene=artists&artist=oingo-boingo&show=1987-06-30&photo=oingo-boingo-01`,
    });
  });

  it("takes the hero of the night, not the first ordinal", () => {
    const { post } = buildPost(
      candidate(),
      withMedia([asset("oingo-boingo-01"), asset("oingo-boingo-02", { order: 2, hero: true })])
    );
    expect(post.imageUrl).toContain("oingo-boingo-02");
  });

  it("links to the frame even when a liner note covers the night", () => {
    const { post } = buildPost(
      candidate(),
      withMedia([asset("oingo-boingo-01")], {
        linerNotes: [
          note({ deepLinks: [{ type: "setlist", label: "x", url: "/?show=1987-06-30" }] }),
        ],
      })
    );
    expect(post.url).toContain("&photo=oingo-boingo-01");
    expect(post.linerNoteSlug).toBeUndefined();
  });

  it("never reaches for a frame from a different night", () => {
    const { post } = buildPost(
      candidate(),
      withMedia([asset("oingo-boingo-01", { date: "1988-01-01", signature: true })])
    );
    expect(post.tier).toBe(2);
    expect(post.imageUrl).toBe("https://r2.theaudiodb.com/ob.jpg");
  });

  it("skips a frame with no crop box, which the renderer would refuse", () => {
    const { post } = buildPost(candidate(), withMedia([asset("oingo-boingo-01", { crop: null })]));
    expect(post.tier).toBe(2);
  });

  it("skips a clip, which is not a picture", () => {
    const { post } = buildPost(
      candidate(),
      withMedia([asset("oingo-boingo-01", { kind: "video", url: "https://media.example/x.mp4" })])
    );
    expect(post.tier).toBe(2);
  });

  it("publishes a night whose artist has no image at all", () => {
    const { ineligible } = buildPost(
      candidate(),
      withMedia([asset("oingo-boingo-01")], {
        artistsMetadata: { "oingo-boingo": { name: "Oingo Boingo" } },
      })
    );
    expect(ineligible).toBeUndefined();
  });

  it("opens an opener's frame in the opener's gatefold, and names them", () => {
    const post = opener([
      asset("fishbone-01", { artist: "Fishbone", artistNormalized: "fishbone" }),
    ]);
    expect(post.url).toContain("artist=fishbone&show=1987-06-30&photo=fishbone-01");
    expect(post.photographedOpener).toEqual({ name: "Fishbone", slug: "fishbone" });
  });

  it("prefers the headliner over an opener", () => {
    const post = opener([
      asset("fishbone-01", { artist: "Fishbone", artistNormalized: "fishbone", hero: true }),
      asset("oingo-boingo-01"),
    ]);
    expect(post.imageUrl).toContain("oingo-boingo-01");
    expect(post.photographedOpener).toBeUndefined();
  });

  it("falls to the room, in the headliner's gatefold, with no act credited", () => {
    const post = opener([asset("marquee-01", { artist: null, artistNormalized: null })]);
    expect(post.url).toContain("artist=oingo-boingo&show=1987-06-30&photo=marquee-01");
    expect(post.photographedOpener).toBeUndefined();
    expect(post.tier).toBe(1);
  });
});
