import { describe, it, expect } from "vitest";
import {
  OWNER_FIRST_NAME,
  OWNER_IDENTITY_NOTE,
  OWNER_IDENTITY_RULE,
  OWNER_NAME,
  isOwnerReference,
  ownerNotAnArtist,
} from "./owner.js";

describe("isOwnerReference", () => {
  it("recognizes the owner by first name, full name, and role", () => {
    for (const q of [
      "Mike",
      "mike",
      "Mike Morper",
      "MIKE MORPER",
      "Michael Morper",
      "Morper",
      "Morps",
      "morps",
      "Morperhaus",
      "the owner",
      "the archivist",
    ]) {
      expect(isOwnerReference(q), q).toBe(true);
    }
  });

  it("recognizes second- and first-person stand-ins, since the archive answers as 'I'", () => {
    for (const q of ["you", "You", "yourself", "me", "myself"]) {
      expect(isOwnerReference(q), q).toBe(true);
    }
  });

  it("tolerates the punctuation and lead-ins a model tacks on", () => {
    for (const q of [" Mike ", "Mike?", '"Mike"', "about Mike", "for mike morper"]) {
      expect(isOwnerReference(q), q).toBe(true);
    }
  });

  // "Mike's" has to fold to "mike" — dropping the apostrophe alone leaves "mikes",
  // which matches no alias and falls through to the guessing path this exists to stop.
  it("folds possessives, straight and curly", () => {
    for (const q of ["Mike's", "Mike’s", "mike morper's", "Morps's", "the owner's"]) {
      expect(isOwnerReference(q), q).toBe(true);
    }
  });

  // The whole reason this function is whole-string and not a substring test: the
  // archive holds a real headliner whose name starts with "Mike".
  it("never claims a performer whose name merely contains the owner's", () => {
    for (const q of [
      "Mike Ness",
      "Mike Watt",
      "Michael Stipe",
      "George Michael",
      "Mike and the Mechanics",
      "Mike Doughty",
    ]) {
      expect(isOwnerReference(q), q).toBe(false);
    }
  });

  it("does not fire on an empty or unrelated query", () => {
    for (const q of ["", "   ", "Depeche Mode", "the Roxy"]) {
      expect(isOwnerReference(q), q).toBe(false);
    }
  });
});

describe("ownerNotAnArtist", () => {
  it("names the owner and redirects to a question the tools can answer", () => {
    const text = ownerNotAnArtist(184);
    expect(text).toContain(OWNER_NAME);
    expect(text).toContain("184 shows");
    expect(text).toMatch(/name the artist or the venue/i);
  });

  it("never says the owner isn't in the archive — he's in all of it", () => {
    expect(ownerNotAnArtist(184)).not.toMatch(/isn't in the archive/i);
  });

  it("degrades to a countless phrasing when no total is available", () => {
    expect(ownerNotAnArtist()).toContain("every show in it is a night I was there");
    expect(ownerNotAnArtist(0)).toContain("every show in it is a night I was there");
  });
});

describe("prompt text", () => {
  // Both surfaces inject one of these; if the owner's name ever changes, it changes
  // in owner.ts alone and every prompt follows.
  it("states the identity and forbids looking the owner up as a performer", () => {
    for (const text of [OWNER_IDENTITY_RULE, OWNER_IDENTITY_NOTE]) {
      expect(text).toContain(OWNER_NAME);
      expect(text).toContain(OWNER_FIRST_NAME);
      expect(text).toMatch(/never look/i);
    }
  });

  it("points the connector note at the tool that actually answers the question", () => {
    expect(OWNER_IDENTITY_NOTE).toContain("get_artist_history");
  });
});
