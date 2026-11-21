import { describe, expect, it } from "vitest";
import { actKeysFor, cleanArtist, fnv1a, nearKey, nearKeys, rulesFingerprint, stripFeat, tidyTitle, titleKeys } from "./match.js";

describe("titleKeys", () => {
  it("uses the archive's own folding: version markers go, title-bearing brackets stay", () => {
    expect(titleKeys("Everything Counts (Remastered 2006)")).toEqual(["everything counts"]);
    expect(titleKeys("(Don't Fear) The Reaper")).toEqual(["dont fear the reaper"]);
    expect(titleKeys("Dancing With Myself")).toEqual(["dancing with myself"]);
  });

  it("splits a medley only on a spaced slash", () => {
    expect(titleKeys("Head Over Heels / Broken")).toEqual(["head over heels broken", "head over heels", "broken"]);
    expect(titleKeys("Smart Patrol/Mr. DNA")).toEqual(["smart patrol mr dna"]);
  });
});

describe("nearKeys", () => {
  it("lets 'Mr. DNA' come close to 'Smart Patrol/Mr. DNA'", () => {
    expect(nearKeys("Smart Patrol/Mr. DNA")).toContain(nearKey("Mr. DNA"));
  });

  it("ignores parts under four letters, so 'Let' isn't close to 'Let/s Get Lost'", () => {
    expect(nearKeys("Let/s Get Lost")).not.toContain(nearKey("Let"));
  });
});

describe("acts", () => {
  it("tries the full name before dropping a paired act", () => {
    expect(actKeysFor("Echo & the Bunnymen")[0]).toBe("echobunnymen");
    expect(actKeysFor("Depeche Mode feat. X")).toEqual(["depechemodefeatx", "depechemode"]);
    expect(cleanArtist("Queen & David Bowie")).toBe("Queen");
  });

  it("keeps '&' in a displayed name, dropping only a featured act", () => {
    expect(stripFeat("Kool & the Gang")).toBe("Kool & the Gang");
    expect(stripFeat("Depeche Mode feat. X")).toBe("Depeche Mode");
  });
});

describe("tidyTitle", () => {
  it("drops Shazam's noise, never real words", () => {
    expect(tidyTitle("Let's Dance - 2018 Remaster")).toBe("Let's Dance");
    expect(tidyTitle("Blind Vision - Single Version")).toBe("Blind Vision");
    expect(tidyTitle("(Don't Fear) The Reaper")).toBe("(Don't Fear) The Reaper");
  });
});

describe("rulesFingerprint", () => {
  it("is stable for the same rules", () => {
    expect(rulesFingerprint()).toBe(rulesFingerprint());
    expect(rulesFingerprint()).toMatch(/^[0-9a-f]{8}$/);
  });

  it("hashes the same in every runtime", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
  });
});
