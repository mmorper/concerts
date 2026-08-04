import { describe, it, expect } from "vitest";
import { pickPrimaryExhibit, artistDeepLink, venueDeepLink, showDeepLink, type Exhibit } from "./exhibits.js";
import DEEP_LINKS from "../../../test/fixtures/deep-link-urls.json";

const artist: Exhibit = { kind: "artist", entity: "artist", slug: "depeche-mode", name: "Depeche Mode", deepLink: artistDeepLink("depeche-mode") };
const venue: Exhibit = { kind: "venue", entity: "venue", slug: "9-30-club", name: "9:30 Club", deepLink: venueDeepLink("9-30-club") };
const serendipity: Exhibit = { kind: "serendipity", concertId: "c1", artist: { entity: "artist", slug: "adam-ant", name: "Adam Ant", deepLink: artistDeepLink("adam-ant") } };
const disambig: Exhibit = { kind: "disambiguation", entity: "artist", candidates: [] };

describe("pickPrimaryExhibit", () => {
  it("returns a plain exhibit when no descriptors were produced", () => {
    expect(pickPrimaryExhibit([])).toEqual({ kind: "plain" });
  });

  it("picks the only entity exhibit", () => {
    expect(pickPrimaryExhibit([artist])).toBe(artist);
  });

  it("lets disambiguation outrank a concrete entity card", () => {
    expect(pickPrimaryExhibit([artist, disambig])).toBe(disambig);
  });

  it("prefers an entity card over serendipity and list", () => {
    const list: Exhibit = { kind: "list", title: "3 concerts", rows: [] };
    expect(pickPrimaryExhibit([list, serendipity, venue])).toBe(venue);
  });

  it("picks a list over a plain fallback", () => {
    const list: Exhibit = { kind: "list", title: "12 concerts · 1998", rows: [] };
    expect(pickPrimaryExhibit([{ kind: "plain" }, list])).toBe(list);
  });

  it("breaks ties to the FIRST tool call (the sentence's subject is resolved first)", () => {
    // "did Depeche Mode play at the 9:30 Club?" resolves the subject (Depeche Mode) first, so its
    // card — not the later venue/second-entity lookup — is the one the prose is about.
    const a2: Exhibit = { kind: "artist", entity: "artist", slug: "the-cure", name: "The Cure", deepLink: artistDeepLink("the-cure") };
    expect(pickPrimaryExhibit([artist, a2])).toBe(artist);
    expect(pickPrimaryExhibit([artist, venue])).toBe(artist);
  });
});

describe("deep-link builders", () => {
  it("build scene-scoped URLs matching DEEP_LINKING.md", () => {
    expect(artistDeepLink("depeche-mode")).toBe("/?scene=artists&artist=depeche-mode");
    expect(venueDeepLink("9-30-club")).toBe("/?scene=venues&venue=9-30-club");
  });
});

// #197 — asserted against the shared fixture (test/fixtures/deep-link-urls.json)
// rather than a hand-written string, so this worker cannot drift from the SPA,
// the MCP server or the sitemap independently.
describe("showDeepLink (#197)", () => {
  it("matches the shared contract fixture", () => {
    expect(
      showDeepLink(DEEP_LINKS.setlist.input.slug, DEEP_LINKS.setlist.input.date),
    ).toBe(DEEP_LINKS.setlist.url);
  });

  it("is additive — the artist link is a strict prefix", () => {
    const artist = artistDeepLink(DEEP_LINKS.setlist.input.slug);
    expect(showDeepLink(DEEP_LINKS.setlist.input.slug, DEEP_LINKS.setlist.input.date)).toContain(artist);
  });

  it("never emits an id-keyed show param", () => {
    expect(showDeepLink("adam-ant", "1984-04-27")).not.toMatch(/show=concert-/);
  });
});
