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
  domainMatchesEntity,
  mentionFor,
  needsHarvest,
  mentionsForPost,
  MENTIONS_MAX,
  isStale,
  loadHandles,
  VERIFIED_MAX_AGE_MONTHS,
  type HandlesFile,
} from "../../scripts/syndication/handles.ts";
import { composeBlueskyText } from "../../scripts/syndication/adapters/bluesky.ts";
import { graphemeLength } from "../../scripts/syndication/facets.ts";
import { CAPTION_MAX, CHANNEL_LIMITS } from "../../scripts/syndication/budgets.ts";
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

describe("domainMatchesEntity — the DNS proof identifies a domain, not a band", () => {
  it("drops a label's domain listed as the artist's official homepage", () => {
    // The case that found this rule. MusicBrainz lists lojinx.com as Fountains
    // of Wayne's official homepage, lojinx.com really does resolve as a
    // Bluesky handle, and Lojinx is their record label. The proof held
    // perfectly and identified the wrong party.
    expect(domainMatchesEntity("lojinx.com", "Fountains of Wayne")).toBe(false);
  });

  it("keeps the domains that are the entity's own", () => {
    expect(domainMatchesEntity("depechemode.com", "Depeche Mode")).toBe(true);
    expect(domainMatchesEntity("thecure.com", "The Cure")).toBe(true);
    expect(domainMatchesEntity("bunnymen.com", "Echo & The Bunnymen")).toBe(true);
    expect(domainMatchesEntity("satriani.com", "Joe Satriani")).toBe(true);
    expect(domainMatchesEntity("squeezeofficial.com", "Squeeze")).toBe(true);
    expect(domainMatchesEntity("ucla.edu", "UCLA")).toBe(true);
    expect(domainMatchesEntity("www.brucespringsteen.net", "Bruce Springsteen")).toBe(true);
  });

  it("keeps a three-letter name inside a longer domain — the 0.3 floor exists for EMF", () => {
    expect(domainMatchesEntity("emf-theband.com", "EMF")).toBe(true);
  });

  it("rejects an unrelated domain, and a coincidental short overlap", () => {
    expect(domainMatchesEntity("livenation.com", "Depeche Mode")).toBe(false);
    expect(domainMatchesEntity("me.com", "Depeche Mode")).toBe(false);
  });

  it("folds diacritics and punctuation rather than failing on them", () => {
    expect(domainMatchesEntity("bjork.com", "Björk")).toBe(true);
    expect(domainMatchesEntity("umphreys.com", "Umphrey’s McGee")).toBe(true);
  });
});

describe("needsHarvest — new entities get crawled, everything else is left alone", () => {
  const NEVER: Record<string, string> = {};

  it("crawls an entity nobody has looked at", () => {
    expect(needsHarvest("artist", "the-human-league", file(), NEVER)).toBe(true);
    expect(needsHarvest("venue", "birchmere", file(), NEVER)).toBe(true);
  });

  it("leaves an entity that is already curated", () => {
    expect(needsHarvest("artist", "depeche-mode", file(), NEVER)).toBe(false);
  });

  it("leaves a BLOCKED entity alone", () => {
    // The whole reason opt-out is a state and not a deletion. Re-proposing a
    // row somebody asked to remove is the failure this prevents.
    const f = file();
    f.artists["depeche-mode"].bluesky!.blocked = true;
    expect(needsHarvest("artist", "depeche-mode", f, NEVER)).toBe(false);
  });

  it("does not re-crawl an entity we asked about and found nothing for", () => {
    // 129 of 336 entities have no account anywhere. Without this the
    // incremental run is a full run.
    const attempted = { "artist:the-human-league": "2026-08-28" };
    expect(needsHarvest("artist", "the-human-league", file(), attempted)).toBe(false);
  });

  it("re-asks past --recheck, and not before", () => {
    const attempted = { "artist:the-human-league": "2026-01-01" };
    const now = new Date("2026-08-28T00:00:00Z");
    expect(needsHarvest("artist", "the-human-league", file(), attempted, { now, recheckDays: 180 })).toBe(true);
    expect(needsHarvest("artist", "the-human-league", file(), attempted, { now, recheckDays: 365 })).toBe(false);
  });

  it("treats an unreadable attempt date as never having asked", () => {
    const attempted = { "artist:the-human-league": "recently" };
    expect(needsHarvest("artist", "the-human-league", file(), attempted, { recheckDays: 180 })).toBe(true);
  });

  it("keys artists and venues separately", () => {
    const attempted = { "artist:the-anthem": "2026-08-28" };
    expect(needsHarvest("venue", "the-anthem", file(), attempted)).toBe(true);
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

const opener = (handle: string, did: string) => ({
  bluesky: { handle, did, evidence: "site-domain" as const, verifiedAt: "2026-08-01" },
});

describe("mentionsForPost — at most two, in a fixed order", () => {
  const withOpeners = () =>
    file({
      artists: {
        ...file().artists,
        "living-colour": opener("livingcolour.com", "did:plc:lc"),
        "public-enemy": opener("publicenemyno1.bsky.social", "did:plc:pe"),
        "fishbone": opener("fishbone.bsky.social", "did:plc:fb"),
      },
    });
  const opts = (text = "") => ({ now: NOW, file: withOpeners(), text });

  it("takes the lead artist, then the venue", () => {
    const m = mentionsForPost({ artists: ["depeche-mode"], venue: "9-30-club" }, "bluesky", opts());
    expect(m.map((x) => x.handle)).toEqual(["depechemode.com", "930.com"]);
    expect(m.map((x) => x.kind)).toEqual(["artist", "venue"]);
  });

  it("reaches an opener only when the post's text names them", () => {
    // The Roots at the museum: neither has an account, both openers do.
    const refs = { artists: ["the-roots", "living-colour", "public-enemy"], venue: "nmaahc" };
    const named = "The Roots played, with Living Colour and Public Enemy opening.";
    expect(mentionsForPost(refs, "bluesky", opts(named)).map((x) => x.handle)).toEqual([
      "livingcolour.com",
      "publicenemyno1.bsky.social",
    ]);
    expect(mentionsForPost(refs, "bluesky", opts("The Roots played a museum."))).toEqual([]);
  });

  it("marks an opener's mention with its slug, so the adapter drops that act's tag", () => {
    const [m] = mentionsForPost({ artists: ["the-roots", "living-colour"] }, "bluesky", opts("Living Colour opened."));
    expect(m.slug).toBe("living-colour");
  });

  it("never tags more than two accounts, however many acts the post names", () => {
    // One venue-loyalty note names twenty-two acts. It must never tag twenty-two accounts.
    const refs = { artists: ["depeche-mode", "living-colour", "public-enemy", "fishbone"], venue: "9-30-club" };
    const m = mentionsForPost(refs, "bluesky", opts("Living Colour, Public Enemy and Fishbone all played."));
    expect(m).toHaveLength(MENTIONS_MAX);
    expect(m.map((x) => x.handle)).toEqual(["depechemode.com", "930.com"]);
  });

  it("matches whole names only", () => {
    // "Enemy" in the text is not Public Enemy.
    const refs = { artists: ["the-roots", "public-enemy"] };
    expect(mentionsForPost(refs, "bluesky", opts("They played Enemy of the State."))).toEqual([]);
  });

  it("returns nothing for a post whose entities are all unknown", () => {
    expect(mentionsForPost({ artists: ["new-order"], venue: "irvine-meadows" }, "bluesky", opts())).toEqual([]);
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
        sourceUrl: 'https://r2.theaudiodb.com/x.jpg',
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

  it("keeps two tags beside a mention when they fit", () => {
    const composed = composeBlueskyText(payload(), file());
    const tags = composed.facets.filter((f) =>
      f.features.some((x) => x.$type === "app.bsky.richtext.facet#tag")
    );
    // The artist tag went to the mention; the next two survive.
    expect(tags).toHaveLength(2);
    expect(composed.text).toContain("#KiaForum");
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

  it("trims the second tag, then the second mention, never the caption or the link", () => {
    const composed = composeBlueskyText(
      payload({
        caption: "x".repeat(CAPTION_MAX),
        refs: { artists: ["depeche-mode"], venue: "9-30-club" },
        credit: { ...payload().credit, venue: "9:30 Club" },
        tags: ["DepecheMode", "Synthpop", "AVeryLongArtistNameIndeedYes", "AnotherQuiteLongTagHere"],
      }),
      file()
    );
    expect(graphemeLength(composed.text)).toBeLessThanOrEqual(CHANNEL_LIMITS.bluesky);
    expect(composed.text.startsWith("x".repeat(CAPTION_MAX))).toBe(true);
    expect(composed.facets.some((f) => f.features[0].$type === "app.bsky.richtext.facet#link")).toBe(true);
    // Both mentions fit once the tags are trimmed: 200 + link + two handles.
    expect(composed.text).toContain("@depechemode.com");
    expect(composed.text).toContain("@930.com");
  });

  it("puts the link on its own line, in words rather than a URL", () => {
    const composed = composeBlueskyText(payload({ linkText: "Read the note →" }), file());
    expect(composed.text).toContain("\nRead the note →");
    expect(composed.text).not.toContain("concerts.morperhaus.org");
  });
});
