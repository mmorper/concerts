/**
 * The syndication kill switch.
 *
 * The defaults are deliberately asymmetric — ambiguity means stop — and that
 * asymmetry is the whole safety property, so it is what these assert hardest.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { readPause, pause, resume, writePause } from "../../scripts/syndication/pause.ts";
import { run, DEFAULT_OPTIONS, type RunOptions } from "../../scripts/syndication/run.ts";
import type { Adapter, PostResult } from "../../scripts/syndication/adapters/types.ts";
import type { Channel, SyndicationPayload } from "../../scripts/syndication/types.ts";

let dir: string;
let path: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pause-"));
  path = join(dir, "syndication-pause.json");
  env = { ...process.env };
  delete process.env.SYNDICATION_PAUSED;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = env;
});

describe("readPause", () => {
  it("treats a missing file as active — the normal state needs no ceremony", () => {
    expect(readPause(path)).toEqual({ paused: false, detail: "" });
  });

  it("pauses when the file says so, and explains why in one line", () => {
    pause("mid-development", path);
    const verdict = readPause(path);
    expect(verdict.paused).toBe(true);
    expect(verdict.detail).toContain("mid-development");
  });

  it("PAUSES on a malformed file rather than assuming go", () => {
    // The safety inversion. The ledger throws on corruption because starting
    // fresh there would re-post everything; here, "I cannot tell" must read as
    // "do not post".
    writeFileSync(path, "{ not json");
    const verdict = readPause(path);
    expect(verdict.paused).toBe(true);
    expect(verdict.detail).toMatch(/unreadable/);
  });

  it("PAUSES when `paused` is not a boolean", () => {
    writeFileSync(path, JSON.stringify({ paused: "yes" }));
    expect(readPause(path).paused).toBe(true);
  });

  it("lets the environment force a pause, whatever the file says", () => {
    writePause({ paused: false }, path);
    process.env.SYNDICATION_PAUSED = "1";
    expect(readPause(path).paused).toBe(true);
  });

  it("gives the environment NO way to force a resume", () => {
    // An emergency stop should work from anywhere. An emergency start should
    // require editing the file that records why it was stopped.
    pause("do not post", path);
    process.env.SYNDICATION_PAUSED = "0";
    expect(readPause(path).paused).toBe(true);
  });
});

describe("resume", () => {
  it("keeps the record rather than deleting it", () => {
    pause("a reason", path);
    const state = resume(path);
    expect(state.paused).toBe(false);
    // "This was paused and is now not" — a missing file would say only
    // "nothing to see", which is indistinguishable from never having paused.
    expect(state.reason).toBe("a reason");
    expect(state.pausedAt).toBeDefined();
    expect(state.resumedAt).toBeDefined();
    expect(readPause(path).paused).toBe(false);
  });
});

// ── The run loop honours it ──────────────────────────────────────────────────

class SpyAdapter implements Adapter {
  posted: string[] = [];
  retracted: string[] = [];
  constructor(readonly channel: Channel) {}
  configured(): boolean {
    return true;
  }
  async post(payload: SyndicationPayload): Promise<PostResult> {
    this.posted.push(payload.slug);
    return { uri: `uri://${payload.slug}`, rkey: payload.slug };
  }
  async retract(entry: { slug: string }): Promise<void> {
    this.retracted.push(entry.slug);
  }
}

function archive() {
  const concerts = [
    {
      id: "c1",
      date: "2001-06-04",
      headliner: "The Band",
      headlinerNormalized: "the-band",
      openers: [],
      venue: "The Venue",
      venueNormalized: "the-venue",
      city: "Los Angeles",
      state: "California",
      year: 2001,
    },
  ];
  const posts = [
    {
      id: "n1",
      slug: "note-one",
      category: "cultural",
      temporality: "evergreen",
      headline: "Headline",
      prose: "Prose.",
      image: { url: "https://r2.theaudiodb.com/x.jpg", alt: "x", source: "artist" },
      artists: ["the-band"],
      venues: ["the-venue"],
      years: [2001],
      tags: [],
      deepLinks: [],
      relatedSlugs: [],
      score: 40,
      detector: "artist-longevity",
      publishedAt: "2001-06-05T00:00:00.000Z",
      social: { hook: "A hook.", caption: "I was there.", authoredAt: "" },
    },
  ];
  return { concerts, posts };
}

function options(overrides: Partial<RunOptions> = {}): RunOptions {
  const { concerts, posts } = archive();
  return {
    ...DEFAULT_OPTIONS,
    /* Draw nothing. These tests assert the LOOP — selection, the ledger, the pause switch —
       and the cards are drawn at post time now, which would mean a headless browser and a
       network fetch per test. The drawing itself is covered by the renderer's own tests and
       by `npm run render:card`; what matters here is that the loop calls it and honours the
       result, which the drop-path test below pins. */
    renderCardFor: async () => {},
    jitterMinutes: 0,
    ledgerPath: join(dir, "ledger.json"),
    pausePath: path,
    sleep: async () => {},
    archive: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      posts: posts as any,
      sources: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        concerts: concerts as any,
        artistsMetadata: { "the-band": { name: "The Band" } },
        venuesMetadata: { "the-venue": { name: "The Venue", city: "Los Angeles" } },
        cardExists: () => true,
      },
    },
    ...overrides,
  };
}

describe("the run loop honours the switch", () => {
  it("posts nothing while paused, and says so rather than looking quiet", async () => {
    process.env.SYNDICATION_PAUSED = "1";
    const bluesky = new SpyAdapter("bluesky");
    const summary = await run(options({ adapters: [bluesky], channels: ["bluesky"] }));

    expect(bluesky.posted).toEqual([]);
    // A paused run must be distinguishable from a quiet one in the summary,
    // not only in the log.
    expect(summary.paused).toBeTruthy();
    expect(summary.posted).toEqual([]);
  });

  it("posts normally when not paused", async () => {
    const bluesky = new SpyAdapter("bluesky");
    const summary = await run(options({ adapters: [bluesky], channels: ["bluesky"] }));
    expect(bluesky.posted).toEqual(["note-one"]);
    expect(summary.paused).toBeUndefined();
  });

  it("still retracts while paused — the switch must not disable the undo", async () => {
    // Retraction is the safety valve. A kill switch that also killed the
    // ability to pull a live post would be the wrong shape entirely.
    const bluesky = new SpyAdapter("bluesky");
    const ledgerPath = join(dir, "ledger.json");
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          { slug: "gone", platform: "bluesky", status: "posted", uri: "u", rkey: "gone" },
        ],
      })
    );

    process.env.SYNDICATION_PAUSED = "1";
    const summary = await run(
      options({ retract: "gone", adapters: [bluesky], channels: ["bluesky"], ledgerPath })
    );

    expect(bluesky.retracted).toEqual(["gone"]);
    expect(summary.retracted).toHaveLength(1);
  });

  it("still seeds while paused — seeding writes no posts", async () => {
    process.env.SYNDICATION_PAUSED = "1";
    const bluesky = new SpyAdapter("bluesky");
    const summary = await run(
      options({ seedLedger: true, adapters: [bluesky], channels: ["bluesky"] })
    );
    expect(summary.seeded).toBeGreaterThan(0);
    expect(bluesky.posted).toEqual([]);
  });
});

describe('cards are drawn at post time', () => {
  // A rendition is a pure function of (master, channel), so a committed one is stale the
  // moment that function changes (#342). Liner Notes and Syndicate are separate scheduled
  // jobs on separate machines, each from a fresh checkout — so anything Monday renders and
  // does not commit is gone by Tuesday. Drawing in the run that posts removes the staleness
  // by construction, and moves the "never bare type" guard along with it.
  it('drops a post whose card cannot be drawn, and says why', async () => {
    const bluesky = new SpyAdapter('bluesky')
    const summary = await run(options({
      adapters: [bluesky],
      channels: ['bluesky'],
      limit: 1,
      renderCardFor: async () => { throw new Error('font server unreachable') },
    }))

    expect(bluesky.posted).toEqual([])
    expect(summary.posted).toEqual([])
    expect(summary.skipped.map((s) => s.reason).join(' ')).toContain('font server unreachable')
  })

  it('a failed card does not take the RUN down — it returns and reports', async () => {
    // A daily job going red over one unreachable asset is how a schedule stops being
    // trusted. The failure is recorded per-post and the run exits normally; this fixture
    // holds a single note, so what it can pin is that the throw is contained and named
    // rather than propagated.
    const bluesky = new SpyAdapter('bluesky')
    const summary = await run(options({
      adapters: [bluesky],
      channels: ['bluesky'],
      limit: 5,
      renderCardFor: async () => { throw new Error('one bad asset') },
    }))

    expect(summary.failed).toEqual([])
    expect(summary.skipped.some((s) => s.reason.includes('one bad asset'))).toBe(true)
  })
})
