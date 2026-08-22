/**
 * Ledger, seeding, idempotency and retraction (#330).
 *
 * These are the acceptance criteria of the issue, one test each. The
 * double-post cases matter more than they look: the failure mode is not a
 * duplicate tweet, it is 57 of them on a brand-new account in one burst.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  emptyLedger,
  loadLedger,
  saveLedger,
  alreadyHandled,
  recordPost,
  recordRetraction,
  seed,
  takeFromBacklog,
  livePlatforms,
} from "../../scripts/syndication/ledger.ts";
import { run, DEFAULT_OPTIONS, type RunOptions } from "../../scripts/syndication/run.ts";
import type { Adapter, PostResult } from "../../scripts/syndication/adapters/types.ts";
import type { Channel, SyndicationPayload } from "../../scripts/syndication/types.ts";

let dir: string;
let ledgerPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "syndication-"));
  ledgerPath = join(dir, "syndication-log.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ── A fake channel that records what it was asked to do ─────────────────────

class FakeAdapter implements Adapter {
  posted: string[] = [];
  retracted: string[] = [];
  constructor(
    readonly channel: Channel,
    private readonly behaviour: "ok" | "fail" = "ok"
  ) {}
  configured(): boolean {
    return true;
  }
  async post(payload: SyndicationPayload): Promise<PostResult> {
    if (this.behaviour === "fail") throw new Error("500 from the instance");
    this.posted.push(payload.slug);
    return { uri: `uri://${this.channel}/${payload.slug}`, rkey: payload.slug };
  }
  async retract(entry: { slug: string }): Promise<void> {
    this.retracted.push(entry.slug);
  }
}

/**
 * Three eligible posts, in publish order. Real enough to build a payload from:
 * the builder resolves the credit stack off `concerts`, so a post with no
 * matching concert would be filtered as ineligible and test nothing.
 */
function archive() {
  const concerts = ["one", "two", "three"].map((_slug, i) => ({
    id: `concert-${i}`,
    date: `200${i}-06-04`,
    headliner: "The Band",
    headlinerNormalized: "the-band",
    openers: [],
    venue: "The Venue",
    venueNormalized: "the-venue",
    city: "Los Angeles",
    state: "California",
    year: 2000 + i,
  }));

  const posts = ["one", "two", "three"].map((slug, i) => ({
    id: `note-${slug}`,
    slug: `note-${slug}`,
    category: "cultural",
    temporality: "evergreen",
    headline: `Headline ${slug}`,
    prose: "Prose.",
    image: { url: "https://r2.theaudiodb.com/images/media/artist/thumb/x.jpg", alt: "The Band", source: "artist" },
    artists: ["the-band"],
    venues: ["the-venue"],
    years: [2000 + i],
    tags: ["#detector-tag"],
    deepLinks: [],
    relatedSlugs: [],
    score: 40,
    detector: "artist-longevity",
    publishedAt: `200${i}-06-05T00:00:00.000Z`,
    social: { hook: "A hook.", caption: "I was there and I remember it.", authoredAt: "" },
  }));

  return { posts, concerts };
}

function options(overrides: Partial<RunOptions> = {}): RunOptions {
  const { posts, concerts } = archive();
  return {
    ...DEFAULT_OPTIONS,
    jitterMinutes: 0,
    ledgerPath,
    // A missing file means "active". Pointed at the temp dir so these stay
    // hermetic: the switch is repo-wide by design, so without this a genuinely
    // paused repository makes every "it posts" test fail.
    pausePath: join(dir, "syndication-pause.json"),
    sleep: async () => {},
    archive: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      posts: posts as any,
      sources: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        concerts: concerts as any,
        artistsMetadata: { "the-band": { name: "The Band" } },
        venuesMetadata: { "the-venue": { name: "The Venue", city: "Los Angeles" } },
        // The OG card is rendered by the pipeline, not by these tests.
        cardExists: () => true,
      },
    },
    ...overrides,
  };
}

// ── Unit level ──────────────────────────────────────────────────────────────

describe("ledger", () => {
  it("treats a missing file as a first run, not an error", () => {
    expect(loadLedger(ledgerPath).entries).toEqual([]);
  });

  it("refuses to start fresh from a file it does not recognise", () => {
    // Silently starting empty here would re-post everything already live.
    writeFileSync(ledgerPath, JSON.stringify({ version: 99, entries: [] }));
    expect(() => loadLedger(ledgerPath)).toThrow(/Unrecognised/);
  });

  it("round-trips and sorts entries so a run produces a readable diff", () => {
    const ledger = emptyLedger();
    recordPost(ledger, { slug: "zulu", platform: "mastodon", uri: "1" });
    recordPost(ledger, { slug: "alpha", platform: "bluesky", uri: "2" });
    saveLedger(ledger, ledgerPath);

    const reloaded = loadLedger(ledgerPath);
    expect(reloaded.entries.map((e) => e.slug)).toEqual(["alpha", "zulu"]);
  });

  it("blocks a slug on every status, including retracted", () => {
    const ledger = emptyLedger();
    recordPost(ledger, { slug: "a", platform: "bluesky", uri: "x" });
    recordRetraction(ledger, "a", "bluesky");
    // A retracted post coming back on the next weekly run is the one case a
    // naive "skip if posted" check gets catastrophically wrong.
    expect(alreadyHandled(ledger, "a", "bluesky")).toBe(true);
  });

  it("records which tier and source actually shipped", () => {
    const ledger = emptyLedger();
    recordPost(ledger, {
      slug: "a",
      platform: "bluesky",
      uri: "x",
      tier: 2,
      source: "artist-audiodb",
    });
    expect(ledger.entries[0]).toMatchObject({ tier: 2, source: "artist-audiodb" });
  });
});

describe("seeding", () => {
  it("suppresses the whole back catalogue across every channel", () => {
    const ledger = emptyLedger();
    const added = seed(ledger, ["a", "b", "c"], ["bluesky", "mastodon"]);
    expect(added).toBe(6);
    expect(alreadyHandled(ledger, "b", "mastodon")).toBe(true);
  });

  it("never overwrites a live row, so it is safe to re-run", () => {
    const ledger = emptyLedger();
    recordPost(ledger, { slug: "a", platform: "bluesky", uri: "live" });
    seed(ledger, ["a"], ["bluesky"]);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].status).toBe("posted");
  });
});

describe("backlog drip", () => {
  it("takes the oldest wholly-seeded posts only", () => {
    const ledger = emptyLedger();
    seed(ledger, ["oldest", "middle", "newest"], ["bluesky", "mastodon"]);
    // "middle" is mid-retry, not backlog.
    recordPost(ledger, { slug: "middle", platform: "bluesky", uri: "x" });

    expect(takeFromBacklog(ledger, ["oldest", "middle", "newest"], 2)).toEqual([
      "oldest",
      "newest",
    ]);
  });

  it("un-seeds what it takes, so no seeded row survives for something that went out", () => {
    const ledger = emptyLedger();
    seed(ledger, ["a"], ["bluesky"]);
    takeFromBacklog(ledger, ["a"], 1);
    expect(ledger.entries).toHaveLength(0);
  });
});

// ── Run loop ────────────────────────────────────────────────────────────────

describe("run loop", () => {
  it("does not double-post when the pipeline is re-run", async () => {
    const bluesky = new FakeAdapter("bluesky");
    const first = await run(options({ adapters: [bluesky], channels: ["bluesky"], limit: 1 }));
    expect(first.posted.map((p) => p.slug)).toEqual(["note-one"]);

    const second = await run(options({ adapters: [bluesky], channels: ["bluesky"], limit: 1 }));

    // The second run moves on to the next note; it never resends the first.
    expect(second.posted.map((p) => p.slug)).toEqual(["note-two"]);
    expect(bluesky.posted).toEqual(["note-one", "note-two"]);
  });

  it("resumes only the failed channel after a partial fan-out", async () => {
    const bluesky = new FakeAdapter("bluesky");
    const broken = new FakeAdapter("mastodon", "fail");

    const first = await run(
      options({ adapters: [bluesky, broken], channels: ["bluesky", "mastodon"], limit: 1 })
    );
    expect(first.failed.every((f) => f.channel === "mastodon")).toBe(true);
    const blueskyCount = bluesky.posted.length;

    // The instance recovers.
    const fixed = new FakeAdapter("mastodon");
    await run(options({ adapters: [bluesky, fixed], channels: ["bluesky", "mastodon"], limit: 1 }));

    // Retrying the batch would double-post to Bluesky. It must not.
    expect(bluesky.posted).toHaveLength(blueskyCount);
    expect(fixed.posted).toEqual(first.posted.map((p) => p.slug));
  });

  it("seeds every published note so the back catalogue does not fire", async () => {
    const bluesky = new FakeAdapter("bluesky");
    const seeded = await run(options({ seedLedger: true, adapters: [bluesky], channels: ["bluesky"] }));
    expect(seeded.seeded).toBe(3);

    await run(options({ adapters: [bluesky], channels: ["bluesky"], limit: 100 }));
    expect(bluesky.posted).toHaveLength(0);
  });

  it("retracts from every channel a slug posted to", async () => {
    const ledger = emptyLedger();
    recordPost(ledger, { slug: "gone", platform: "bluesky", uri: "uri://bluesky/gone", rkey: "gone" });
    recordPost(ledger, { slug: "gone", platform: "mastodon", uri: "12345" });
    saveLedger(ledger, ledgerPath);

    const bluesky = new FakeAdapter("bluesky");
    const mastodon = new FakeAdapter("mastodon");
    const summary = await run(
      options({ retract: "gone", adapters: [bluesky, mastodon], channels: ["bluesky", "mastodon"] })
    );

    expect(bluesky.retracted).toEqual(["gone"]);
    expect(mastodon.retracted).toEqual(["gone"]);
    expect(summary.retracted).toHaveLength(2);

    const after = loadLedger(ledgerPath);
    expect(livePlatforms(after, "gone")).toHaveLength(0);
    expect(after.entries.every((e) => e.status === "retracted")).toBe(true);
  });

  it("leaves a retracted post retracted on the next run", async () => {
    const ledger = emptyLedger();
    recordPost(ledger, { slug: "gone", platform: "bluesky", uri: "u", rkey: "gone" });
    recordRetraction(ledger, "gone", "bluesky");
    saveLedger(ledger, ledgerPath);

    const bluesky = new FakeAdapter("bluesky");
    await run(options({ adapters: [bluesky], channels: ["bluesky"], limit: 100 }));
    expect(bluesky.posted).not.toContain("gone");
    expect(bluesky.posted).toEqual(["note-one", "note-two", "note-three"]);
  });

  it("persists the ledger after each post, not once at the end", async () => {
    const bluesky = new FakeAdapter("bluesky");
    const mastodon = new FakeAdapter("mastodon", "fail");
    await run(options({ adapters: [bluesky, mastodon], channels: ["bluesky", "mastodon"], limit: 1 }));

    // The Mastodon failure must not have taken the Bluesky row down with it.
    const written = JSON.parse(readFileSync(ledgerPath, "utf8"));
    expect(written.entries.some((e: { platform: string }) => e.platform === "bluesky")).toBe(true);
  });
});
