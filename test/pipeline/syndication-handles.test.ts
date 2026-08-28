/**
 * Handle lookup and the mention swap (#323).
 *
 * Everything here is a test that the pipeline **declines**. That is the point:
 * automated resolution of "which account is really theirs" was measured and it
 * does not work — Bluesky's strongest signal returns INTERPOL for the band
 * Interpol — so the lookup is built out of refusals and every refusal lands on
 * the hashtag that was already shipping.
 *
 * A test suite for a feature like this earns its keep on the negative cases,
 * not the happy path. A bug that mentions nobody costs a hashtag. A bug that
 * mentions the wrong person is a stranger being tagged, weekly, by a cron job.
 */

import { describe, it, expect } from "vitest";

import {
  mentionFor,
  mentionForPost,
  isStale,
  loadHandles,
  VERIFIED_MAX_AGE_MONTHS,
  type HandlesFile,
} from "../../scripts/syndication/handles.ts";
import { composeBlueskyText } from "../../scripts/syndication/adapters/bluesky.ts";
import { graphemeLength } from "../../scripts/syndication/facets.ts";
import { CAPTION_MAX, CHANNEL_LIMITS, LINK_DISPLAY_MAX } from "../../scripts/syndication/budgets.ts";
import type { SyndicationPayload } from "../../scripts/syndication/types.ts";

const NOW = new Date("2026-08-28T00:00:00Z");

function file(overrides: Partial<HandlesFile> = {}): HandlesFile {
  return {
    version: 1,
    updatedAt: "2026-08-28T00:00:00.000Z",
    artists: {
      "depeche-mode": {
        bluesky: {
          handle: "depechemode.com",
          did: "did:plc:ueppiwulfqikh4zl2qre3evh",
          evidence: "site-domain",
          verifiedAt: "2026-08-01",
        },
      },
    },
    venues: {
      "9-30-club": {
        bluesky: {
          handle: "930.com",
          did: "did:plc:venue930",
          evidence: "site-domain",
          verifiedAt: "2026-08-01",
        },
      },
    },
    ...overrides,
  };
}

describe("mentionFor — every gate returns nothing, and nothing means hashtag", () => {
  it("returns the account when the row is sound", () => {
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: file() })).toEqual({
      handle: "depechemode.com",
      did: "did:plc:ueppiwulfqikh4zl2qre3evh",
      evidence: "site-domain",
      kind: "artist",
    });
  });

  it("declines an artist it has never heard of", () => {
    expect(mentionFor("artist", "the-human-league", "bluesky", { now: NOW, file: file() })).toBeUndefined();
  });

  it("does not read an artist row for a venue lookup, or the reverse", () => {
    expect(mentionFor("venue", "depeche-mode", "bluesky", { now: NOW, file: file() })).toBeUndefined();
    expect(mentionFor("artist", "9-30-club", "bluesky", { now: NOW, file: file() })).toBeUndefined();
  });

  it("honours an opt-out, and honours it before any other rule", () => {
    const f = file();
    f.artists["depeche-mode"].bluesky!.blocked = true;
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
  });

  it("refuses evidence outside the union, however plausible the file looks", () => {
    const f = file();
    // What a hand-edit, or a harvester that grew a search rule, would write.
    (f.artists["depeche-mode"].bluesky as { evidence: string }).evidence = "verified-and-name-matched";
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
  });

  it("refuses a Bluesky row with no DID — the facet cannot be addressed by handle", () => {
    const f = file();
    delete f.artists["depeche-mode"].bluesky!.did;
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
  });

  it("stops publishing a row nobody has confirmed inside the window", () => {
    const f = file();
    f.artists["depeche-mode"].bluesky!.verifiedAt = "2024-01-01";
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
  });

  it("treats an unparseable date as stale rather than as fresh", () => {
    const f = file();
    f.artists["depeche-mode"].bluesky!.verifiedAt = "sometime last year";
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
    expect(isStale("sometime last year", NOW)).toBe(true);
  });

  it("expires to the day, not to the month", () => {
    // Counting whole months and flooring would keep a row alive for eighteen
    // months and twenty-nine days, which makes the stated window a lie.
    const f = file();
    const at = new Date(NOW);
    at.setUTCMonth(at.getUTCMonth() - VERIFIED_MAX_AGE_MONTHS);
    f.artists["depeche-mode"].bluesky!.verifiedAt = at.toISOString().slice(0, 10);
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeDefined();

    at.setUTCDate(at.getUTCDate() - 1);
    f.artists["depeche-mode"].bluesky!.verifiedAt = at.toISOString().slice(0, 10);
    expect(mentionFor("artist", "depeche-mode", "bluesky", { now: NOW, file: f })).toBeUndefined();
  });

  it("clamps a month-end shift instead of overflowing it", () => {
    // 31 August minus 18 months is 28 February. Rolling forward to 3 March
    // would hand three free days to exactly the dates most likely to be
    // month-ends.
    expect(isStale("2025-02-28", new Date("2026-08-31T00:00:00Z"))).toBe(false);
    expect(isStale("2025-02-27", new Date("2026-08-31T00:00:00Z"))).toBe(true);
  });

  it("declines a channel the entity has no row for", () => {
    expect(mentionFor("artist", "depeche-mode", "mastodon", { now: NOW, file: file() })).toBeUndefined();
  });
});

describe("loadHandles", () => {
  it("reads a missing file as 'no handles', not as an error", () => {
    // Emphatically unlike the ledger, where corruption throws: the worst a
    // missing file can do here is emit the hashtags we already emit.
    const loaded = loadHandles("/nonexistent/social-handles.json");
    expect(loaded.artists).toEqual({});
    expect(loaded.venues).toEqual({});
  });
});

describe("mentionForPost — one mention, following the tag priority", () => {
  it("takes the lead artist", () => {
    const m = mentionForPost({ artists: ["depeche-mode"], venue: "9-30-club" }, "bluesky", { now: NOW, file: file() });
    expect(m?.handle).toBe("depechemode.com");
    expect(m?.kind).toBe("artist");
  });

  it("falls back to the venue only when the lead artist has no account", () => {
    const m = mentionForPost({ artists: ["the-human-league"], venue: "9-30-club" }, "bluesky", { now: NOW, file: file() });
    expect(m?.handle).toBe("930.com");
    expect(m?.kind).toBe("venue");
  });

  it("never reaches past the lead artist to a supporting act", () => {
    // The billing name is the subject. A post billed to the openers' headliner
    // does not get retargeted at whoever happens to have a livelier account.
    const m = mentionForPost({ artists: ["the-human-league", "depeche-mode"] }, "bluesky", { now: NOW, file: file() });
    expect(m).toBeUndefined();
  });

  it("returns nothing for a post whose entities are all unknown", () => {
    expect(mentionForPost({ artists: ["new-order"], venue: "irvine-meadows" }, "bluesky", { now: NOW, file: file() })).toBeUndefined();
  });
});

// ── The swap ─────────────────────────────────────────────────────────────────

function payload(overrides: Partial<SyndicationPayload> = {}): SyndicationPayload {
  return {
    slug: "depeche-mode-at-the-forum",
    kind: "liner-note",
    hook: "The hook",
    caption: "I saw Depeche Mode at the Fórum and I have not stopped thinking about it.",
    credit: { artists: ["Depeche Mode"], venue: "Kia Forum", city: "Inglewood", date: "2023-12-12" },
    refs: { artists: ["depeche-mode"], venue: "kia-forum" },
    url: "https://concerts.morperhaus.org/liner-notes/depeche-mode-at-the-forum",
    media: [
      {
        role: "card",
        aspect: "1.91:1",
        path: "public/og/liner-notes/depeche-mode-at-the-forum.png",
        alt: "Depeche Mode at the Kia Forum.",
        tier: 2,
        source: "artist-audiodb",
      },
    ],
    tags: ["DepecheMode", "KiaForum", "Inglewood", "2020s"],
    eligible: true,
    ineligibleReasons: [],
    ...overrides,
  };
}

describe("composeBlueskyText — the mention displaces its own tag, never joins it", () => {
  it("emits the artist tag when there is no account on file", () => {
    const composed = composeBlueskyText(payload(), file({ artists: {}, venues: {} }));
    expect(composed.text).toContain("#DepecheMode");
    expect(composed.text).not.toContain("@");
  });

  it("swaps the artist tag for the artist mention", () => {
    const composed = composeBlueskyText(payload(), file());
    expect(composed.text).toContain("@depechemode.com");
    expect(composed.text).not.toContain("#DepecheMode");
  });

  it("drops the VENUE tag on a venue mention, and keeps the artist tag", () => {
    // The bug this pins: displacing tags[0] by position would throw away
    // #DepecheMode — the more valuable tag — and still print
    // "@930.com #KiaForum", which is the redundancy the swap exists to avoid.
    const composed = composeBlueskyText(
      payload({
        refs: { artists: ["__unknown__"], venue: "9-30-club" },
        credit: { ...payload().credit, venue: "9:30 Club" },
        // As `entityTags` would have generated them: artist, venue, city, decade.
        tags: ["DepecheMode", "930Club", "Inglewood", "2020s"],
      }),
      file()
    );
    expect(composed.text).toContain("@930.com");
    expect(composed.text).toContain("#DepecheMode");
    expect(composed.text).not.toContain("#930Club");
  });

  it("prints one tag beside a mention, not two — the mention occupies a slot", () => {
    const composed = composeBlueskyText(payload(), file());
    const tags = composed.facets.filter((f) =>
      f.features.some((x) => x.$type === "app.bsky.richtext.facet#tag")
    );
    expect(tags).toHaveLength(1);
  });

  it("addresses the mention facet by DID, never by handle", () => {
    const composed = composeBlueskyText(payload(), file());
    const mention = composed.facets
      .flatMap((f) => f.features)
      .find((x) => x.$type === "app.bsky.richtext.facet#mention");
    expect(mention).toBeDefined();
    expect(mention && "did" in mention && mention.did).toBe("did:plc:ueppiwulfqikh4zl2qre3evh");
  });

  it("puts the mention's byte span on exactly its own text, past a non-ASCII caption", () => {
    // "Fórum" in the caption is the whole reason this is a byte assertion and
    // not a string search: a UTF-16 index lands one byte short of the mention.
    const composed = composeBlueskyText(payload(), file());
    const bytes = Buffer.from(composed.text, "utf8");
    for (const facet of composed.facets) {
      for (const feature of facet.features) {
        if (feature.$type !== "app.bsky.richtext.facet#mention") continue;
        const slice = bytes.subarray(facet.index.byteStart, facet.index.byteEnd).toString("utf8");
        expect(slice).toBe("@depechemode.com");
      }
    }
  });

  it("stays inside Bluesky's limit on a maximal post", () => {
    const composed = composeBlueskyText(
      payload({ caption: "x".repeat(CAPTION_MAX), tags: ["AVeryLongArtistNameIndeed", "AVeryLongVenueNameToo"] }),
      file()
    );
    expect(graphemeLength(composed.text)).toBeLessThanOrEqual(CHANNEL_LIMITS.bluesky);
  });

  it("documents why the swap is a swap: appending would overflow", () => {
    // The arithmetic from budgets.ts, with the longest handle on file (29).
    // Kept as an assertion rather than a comment so that raising CAPTION_MAX
    // or the tag limit fails here instead of in production.
    const SEPARATORS = 4;
    const WORST_TAGS = 35;
    const LONGEST_MENTION = 29;
    const appended = CAPTION_MAX + LINK_DISPLAY_MAX + WORST_TAGS + SEPARATORS + LONGEST_MENTION;
    const swapped = CAPTION_MAX + LINK_DISPLAY_MAX + Math.ceil(WORST_TAGS / 2) + SEPARATORS + LONGEST_MENTION;
    expect(appended).toBeGreaterThan(CHANNEL_LIMITS.bluesky);
    expect(swapped).toBeLessThanOrEqual(CHANNEL_LIMITS.bluesky);
  });
});
