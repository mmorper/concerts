/**
 * The spec's fixture table, run against a small frozen index cut from the real archive
 * (test/fixtures/index/, see test-loader.ts). Exact expectations, so they live here and not
 * against live data, which moves.
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Testing Strategy
 */
import { describe, expect, it } from "vitest";
import { lookup } from "./identify.js";
import { rulesFingerprint } from "./match.js";
import { alteredLoader, fixtureLoader } from "./test-loader.js";

const look = (artist: string, title: string, album?: string) => lookup({ artist, title, album }, fixtureLoader);

describe("the frozen fixture", () => {
  it("was built with the current matching rules (if not, regenerate it: see test-loader.ts)", async () => {
    const manifest = (await fixtureLoader("manifest.json")) as { rules: string };
    expect(manifest.rules).toBe(rulesFingerprint());
  });
});

describe("heard", () => {
  it("strips Shazam's version marker and counts every night", async () => {
    const r = await look("Depeche Mode", "Everything Counts (Remastered 2006)");
    expect(r).toMatchObject({ screen: "heard", title: "Everything Counts", count: { n: 5, times: true } });
    expect(r.headline).toBe("You've heard this one live 5 times.");
    expect(r.lines[0]).toBe("First in 1985 · most recent Mar 28, 2023");
    expect(r.album?.title).toBe("Construction Time Again");
    expect(r.nights).toHaveLength(4);
    expect(r.moreNights).toBe(1);
  });

  it("finds a song an opening act played", async () => {
    const r = await look("Blancmange", "Blind Vision - Single Version");
    expect(r).toMatchObject({ screen: "heard", title: "Blind Vision", count: { n: 1, times: true } });
    expect(r.headline).toBe("You heard this one live, once.");
    expect(r.nights[0].text).toMatch(/· opening$/);
  });

  it.each([
    ["Echo & the Bunnymen", "The Killing Moon"],
    ["Echo and the Bunnymen", "Lips Like Sugar"],
    ["Joan Jett & The Blackhearts", "I Love Rock 'N Roll"],
    ["Depeche Mode feat. X", "Enjoy the Silence"],
  ])("resolves %s to the act", async (artist, title) => {
    expect((await look(artist, title)).screen).toBe("heard");
  });

  it("merges every billing of one act (Brian Setzer has four)", async () => {
    const r = await look("Brian Setzer", "Rock This Town");
    expect(r).toMatchObject({ screen: "heard", count: { n: 3 } });
  });

  it("matches a medley only as a whole when the slash isn't spaced", async () => {
    for (const t of ["Smart Patrol / Mr. DNA", "Smart Patrol/Mr. DNA"]) {
      expect(await look("Devo", t)).toMatchObject({ screen: "heard", count: { n: 2 } });
    }
  });

  it("flags a night heard only inside a medley", async () => {
    const r = await look("Tears for Fears", "Head Over Heels");
    expect(r).toMatchObject({ screen: "heard", count: { n: 1 } });
    expect(r.nights[0].text).toContain("in a medley");
  });

  it("strips '(Live)'", async () => {
    expect(await look("Depeche Mode", "Enjoy the Silence (Live)")).toMatchObject({ screen: "heard", count: { n: 3 } });
  });

  it("keeps two 'with' songs apart (#689)", async () => {
    expect(await look("Billy Idol", "Dancing With Myself")).toMatchObject({ screen: "heard", count: { n: 1 } });
    expect((await look("Billy Idol", "Dancing With Tears in My Eyes")).screen).not.toBe("heard");
  });

  it("matches a title the setlist writes all in brackets", async () => {
    expect((await look("The Twilight Sad", "10 Good Reasons for Modern Drugs")).screen).toBe("heard");
    expect((await look("Foals", "Summer Sky")).screen).toBe("heard");
  });

  it("doesn't let '(Intro)' match a bracketed title", async () => {
    expect((await look("Foals", "(Intro)")).screen).not.toBe("heard");
  });
});

describe("seen-cover", () => {
  it("Wham!: heard from George Michael", async () => {
    const r = await look("Wham!", "I'm Your Man");
    expect(r).toMatchObject({ screen: "seen-cover", count: { n: 1, times: true } });
    expect(r.headline).toBe("You've seen Wham! once, and you heard George Michael play this one.");
    expect(r.lines[0]).toBe("Wham! didn't play it the night you saw them.");
  });

  it("Oingo Boingo: heard from Danny Elfman, twice; mentions the missing setlist", async () => {
    const r = await look("Oingo Boingo", "Only a Lad");
    expect(r).toMatchObject({ screen: "seen-cover", count: { n: 2 } });
    expect(r.headline).toContain("Danny Elfman play this one 2 times");
    expect(r.lines[0]).toMatch(/no setlist/);
  });

  it("Run-D.M.C.: the act's unusual hyphen still resolves", async () => {
    expect((await look("Run-D.M.C.", "Jam-Master Jay")).screen).toBe("seen-cover");
  });
});

describe("seen", () => {
  it("says 'never heard' only when every night has a setlist", async () => {
    const r = await look("Depeche Mode", "Barrel of a Gun");
    expect(r).toMatchObject({ screen: "seen", count: { n: 5, times: true } });
    expect(r.headline).toBe("You've seen Depeche Mode 5 times, but never heard this one live.");
  });

  it("says 'maybe' when some nights have no setlist", async () => {
    const r = await look("Tears for Fears", "A Song Nobody Has Written");
    expect(r.screen).toBe("seen");
    expect(r.headline).not.toContain("never heard");
    expect(r.lines[0]).toMatch(/no setlist/);
  });

  it("says something close is on a setlist, never 'never heard'", async () => {
    const r = await look("Devo", "Mr. DNA");
    expect(r.screen).toBe("seen");
    expect(r.headline).not.toContain("never heard");
    expect(r.lines[0]).toBe("Something close to it is on 2 of those setlists: “Smart Patrol/Mr. DNA”.");
  });

  it("doesn't count a part under four letters as close", async () => {
    expect((await look("The Twilight Sad", "Let")).headline).toContain("never heard");
  });

  it("passes Shazam's album through when the archive has none", async () => {
    const r = await look("Depeche Mode", "Barrel of a Gun", "Ultra");
    expect(r.album).toEqual({ title: "Ultra" });
  });
});

describe("never seen the act", () => {
  it("cover-of-this: Bowie, via Heaven 17 and Nile Rodgers", async () => {
    const r = await look("David Bowie", "Let's Dance - 2018 Remaster");
    expect(r).toMatchObject({ screen: "cover-of-this", title: "Let's Dance", count: { n: 2 } });
    expect(r.headline).toBe("You've never seen David Bowie. But you've heard this one live, played by Heaven 17 and Nile Rodgers.");
  });

  it("cover-of-this: shows 'Queen & David Bowie' whole", async () => {
    expect(await look("Queen & David Bowie", "Under Pressure")).toMatchObject({ screen: "cover-of-this", artist: "Queen & David Bowie" });
  });

  it("covers: shows 'Kool & the Gang' whole", async () => {
    const r = await look("Kool & the Gang", "Celebration");
    expect(r).toMatchObject({ screen: "covers", artist: "Kool & the Gang", count: { n: 1, times: false } });
  });

  it("covers: the Rolling Stones", async () => {
    expect((await look("The Rolling Stones", "Paint It Black")).screen).toBe("covers");
  });

  it("none: Fleetwood Mac, with Shazam's album", async () => {
    const r = await look("Fleetwood Mac", "Dreams", "Rumours");
    expect(r).toMatchObject({ screen: "none", headline: "Not in the archive. Yet.", album: { title: "Rumours" } });
    expect(r.count).toBeUndefined();
  });

  it("keeps a real parenthetical in the displayed title", async () => {
    expect((await look("Blue Öyster Cult", "(Don't Fear) The Reaper")).title).toBe("(Don't Fear) The Reaper");
  });
});

describe("never a false 'none'", () => {
  const input = { artist: "Depeche Mode", title: "Enjoy the Silence" };

  it.each([
    ["the manifest is missing", alteredLoader({ "manifest.json": () => null })],
    ["the manifest isn't the index (the site's HTML)", alteredLoader({ "manifest.json": () => "<!DOCTYPE html>" })],
    ["the version is unknown", alteredLoader({ "manifest.json": (m) => ({ ...m, v: 2 }) })],
    ["the rules fingerprint differs", alteredLoader({ "manifest.json": (m) => ({ ...m, rules: "00000000" }) })],
    ["a listed act file won't load", alteredLoader({ "acts/depeche-mode.json": () => null })],
    ["a listed covers file won't load", alteredLoader({ "covers/depechemode.json": () => null })],
    ["the act's key is ambiguous", alteredLoader({ "manifest.json": (m) => ({ ...m, ambiguous: ["depechemode"] }) })],
  ])("answers unknown when %s", async (_why, loader) => {
    const r = await lookup(input, loader);
    expect(r.screen).toBe("unknown");
    expect(r.headline).toBe("The archive isn't answering right now.");
    expect(r.nights).toEqual([]);
  });
});

describe("photos", () => {
  it("are absolute, newest night first, and every caption names its night", async () => {
    const r = await look("Brian Setzer", "Rock This Town");
    expect(r.photos.length).toBeGreaterThan(0);
    for (const p of r.photos) {
      expect(p.url).toMatch(/^https:\/\/concerts\.morperhaus\.org\//);
      expect(p.caption).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4} · /);
    }
    expect(r.photos.length).toBeLessThanOrEqual(5);
  });
});
