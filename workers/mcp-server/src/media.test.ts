import { describe, it, expect } from "vitest";
import DEEP_LINKS from "../../../test/fixtures/deep-link-urls.json";
import {
  artistMediaNote,
  nightMediaNote,
  nightsMediaNote,
  photoDeepLink,
  selectMedia,
  withMediaNote,
  type MediaAsset,
  type MediaIndexFile,
} from "./media.js";

const still = (date: string, artist: string | null, slug: string | null): MediaAsset => ({
  kind: "image",
  url: `/images/shows/${date}.jpg`,
  date,
  artist,
  artistNormalized: slug,
});

const clip = (date: string, artist: string, slug: string, song?: string, url: string | null = "https://media/x.mp4"): MediaAsset => ({
  kind: "video",
  url,
  date,
  artist,
  artistNormalized: slug,
  ...(song ? { song } : {}),
});

const NIGHT = "2026-09-16";
const media: MediaIndexFile = {
  assets: [
    still(NIGHT, "Thompson Twins", "thompson-twins"),
    still(NIGHT, "Thompson Twins", "thompson-twins"),
    clip(NIGHT, "Thompson Twins", "thompson-twins", "Lies"),
    clip(NIGHT, "Thompson Twins", "thompson-twins", "In the Name of Love"),
    still(NIGHT, "Blancmange", "blancmange"),
    still(NIGHT, null, null),
    still("2019-01-01", "Thompson Twins", "thompson-twins"),
  ],
};

describe("artistMediaNote", () => {
  it("counts the act across nights and names the clips' songs", () => {
    expect(artistMediaNote(media, "Thompson Twins", ["thompson-twins"])).toBe(
      "**Media on the site:** Thompson Twins: 1 photo from 1 January 2019; 2 photos and 2 clips from 16 September 2026 (“Lies”, “In the Name of Love”). None from any other night.",
    );
  });

  it("collapses every billing of one act", () => {
    const billed = { assets: [still("2020-01-01", "A", "a"), still("2021-01-01", "A Band", "a-band")] };
    expect(artistMediaNote(billed, "A", ["a", "a-band"])).toBe(
      "**Media on the site:** A: 1 photo from 1 January 2020; 1 photo from 1 January 2021. None from any other night.",
    );
  });

  it("says nothing about an act with no media", () => {
    expect(artistMediaNote(media, "New Order", ["new-order"])).toBe("");
  });

  it("does not credit a room frame to an act", () => {
    expect(artistMediaNote(media, "Blancmange", ["blancmange"])).toBe(
      "**Media on the site:** Blancmange: 1 photo from 16 September 2026. None from any other night.",
    );
  });
});

describe("an unpublished clip", () => {
  const hidden = { assets: [clip(NIGHT, "Blancmange", "blancmange", "Secret Song", null)] };

  it("never reaches a count or a song", () => {
    expect(artistMediaNote(hidden, "Blancmange", ["blancmange"])).toBe("");
    expect(nightMediaNote(hidden, NIGHT)).toBe("");
    expect(nightsMediaNote(hidden, [NIGHT])).toBe("");
  });

  it("is left out when it sits beside a published one", () => {
    const mixed = { assets: [...hidden.assets, clip(NIGHT, "Blancmange", "blancmange", "Blind Vision")] };
    const note = artistMediaNote(mixed, "Blancmange", ["blancmange"]);
    expect(note).toContain("1 clip");
    expect(note).not.toContain("Secret Song");
  });
});

describe("nightMediaNote", () => {
  it("credits each act and the room apart", () => {
    expect(nightMediaNote(media, NIGHT)).toBe(
      "**Media on the site from this night:** 2 photos and 2 clips of Thompson Twins (“Lies”, “In the Name of Love”); 1 photo of Blancmange; 1 photo of the room.",
    );
  });

  it("says nothing about a night with no media", () => {
    expect(nightMediaNote(media, "1987-06-30")).toBe("");
  });
});

describe("nightsMediaNote", () => {
  it("totals a set of nights and says how many had media", () => {
    expect(nightsMediaNote(media, [NIGHT, "2019-01-01", "1987-06-30"])).toBe(
      "**Media on the site:** 5 photos and 2 clips from 2 of these 3 nights: 1 January 2019, 16 September 2026. The clips show “Lies” (Thompson Twins), “In the Name of Love” (Thompson Twins).",
    );
  });

  it("reads naturally for a single night", () => {
    expect(nightsMediaNote(media, ["2019-01-01"])).toBe("**Media on the site:** 1 photo from this night.");
  });

  it("says nothing when none of the nights has media", () => {
    expect(nightsMediaNote(media, ["1987-06-30"])).toBe("");
  });
});

describe("a failed load", () => {
  it("never reads as no media", () => {
    for (const note of [artistMediaNote(null, "A", ["a"]), nightMediaNote(null, NIGHT), nightsMediaNote(null, [NIGHT])]) {
      expect(note).toContain("I can't check right now");
    }
  });
});

describe("withMediaNote", () => {
  const footer = "\n\n---\n**Open on the site:** [A](https://x/a)";

  it("keeps the footer last", () => {
    expect(withMediaNote(`Body.${footer}`, "NOTE")).toBe(`Body.\n\nNOTE${footer}`);
  });

  it("appends when there is no footer", () => {
    expect(withMediaNote("Body.", "NOTE")).toBe("Body.\n\nNOTE");
  });

  it("leaves the text alone for an empty note", () => {
    expect(withMediaNote(`Body.${footer}`, "")).toBe(`Body.${footer}`);
  });
});

describe("selectMedia", () => {
  it("builds the link every surface agrees on", () => {
    const { slug, date, photo } = DEEP_LINKS.photo.input;
    expect(photoDeepLink(slug, date, photo)).toBe(DEEP_LINKS.photo.url);
  });

  const gatefold = (a: MediaAsset) => a.artistNormalized ?? "the-headliner";
  const tt = (n: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({
    ...still(NIGHT, "Thompson Twins", "thompson-twins"),
    url: `/images/shows/${NIGHT}-thompson-twins-${n}.jpg`,
    ...extra,
  });

  it("links to the exact frame, not just the gatefold", () => {
    const [item] = selectMedia({ assets: [tt("10")] }, {}, gatefold);
    expect(item.deepLink).toBe(`/?scene=artists&artist=thompson-twins&show=${NIGHT}&photo=thompson-twins-10`);
    expect(item.id).toBe("thompson-twins-10");
  });

  it("names a clip's link so it opens the clip", () => {
    const [item] = selectMedia({ assets: [clip(NIGHT, "Thompson Twins", "thompson-twins", "Lies", `https://m/${NIGHT}-thompson-twins-01.mp4?v=1`)] }, {}, gatefold);
    expect(item.id).toBe("thompson-twins-01-video");
    expect(item.deepLink).toContain("&photo=thompson-twins-01-video");
  });

  it("opens a room frame in the gatefold it names, with no act credited", () => {
    const [item] = selectMedia({ assets: [{ ...still(NIGHT, null, null), url: `/images/shows/${NIGHT}-venue-01.jpg` }] }, {}, gatefold);
    expect(item.act).toBeNull();
    expect(item.deepLink).toContain("artist=the-headliner");
  });

  it("leads with the owner's marks, then the newest night", () => {
    const assets = [tt("01"), tt("02", { hero: true }), { ...tt("03"), date: "2027-01-01" }, tt("04", { signature: true })];
    expect(selectMedia({ assets }, {}, gatefold).map((m) => m.id.slice(-2))).toEqual(["04", "02", "03", "01"]);
  });

  it("never returns an unpublished clip", () => {
    const hidden = clip(NIGHT, "Blancmange", "blancmange", "Secret Song", null);
    expect(selectMedia({ assets: [hidden] }, {}, gatefold)).toEqual([]);
  });

  it("filters by act, night, year, kind and song", () => {
    const filter = (f: Parameters<typeof selectMedia>[1]) => selectMedia(media, f, gatefold).length;
    expect(filter({ slugs: ["blancmange"] })).toBe(1);
    expect(filter({ dates: new Set(["2019-01-01"]) })).toBe(1);
    expect(filter({ year: 2026 })).toBe(6);
    expect(filter({ kind: "video" })).toBe(2);
    expect(filter({ song: "lies" })).toBe(1);
  });
});
