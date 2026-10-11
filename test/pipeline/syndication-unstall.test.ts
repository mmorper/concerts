/**
 * The October 2026 stall: nothing posted for days while every run finished green.
 *
 * - A blocked note at the front of the backlog stopped the drip outright.
 * - On This Day posts whose day had passed sat in the queue, re-blocked daily.
 * - Health read clean, because nothing reached a platform to fail.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { run, selectCandidates, DEFAULT_OPTIONS, type RunOptions, type RunSummary } from "../../scripts/syndication/run.ts";
import { deriveHealth, alertsFor, type SyndicationHealth } from "../../scripts/syndication/health.ts";
import type { Adapter, PostResult } from "../../scripts/syndication/adapters/types.ts";
import type { Channel, SyndicationLedger, SyndicationPayload } from "../../scripts/syndication/types.ts";
import type { ClaimIssue, CopyFields } from "../../scripts/liner-notes/verify-claims.ts";

let dir: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "unstall-"));
  env = { ...process.env };
  delete process.env.SYNDICATION_PAUSED;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = env;
});

class SpyAdapter implements Adapter {
  posted: string[] = [];
  constructor(readonly channel: Channel) {}
  configured(): boolean {
    return true;
  }
  async post(payload: SyndicationPayload): Promise<PostResult> {
    this.posted.push(payload.slug);
    return { uri: `uri://${payload.slug}`, rkey: payload.slug };
  }
  async retract(): Promise<void> {}
}

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

const note = (slug: string, publishedAt: string, hook: string) => ({
  id: slug,
  slug,
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
  publishedAt,
  social: { hook, caption: "I was there.", authoredAt: "" },
});

const posts = [
  note("oldest-blocked", "2001-01-01T00:00:00.000Z", "A false hook."),
  note("second", "2001-02-01T00:00:00.000Z", "A true hook."),
  note("third", "2001-03-01T00:00:00.000Z", "Another true hook."),
];

// Blocks only the note whose hook is false — the claim check doing its job.
const verifyClaims = async (_sheet: string, copy: CopyFields): Promise<ClaimIssue[]> =>
  copy.hook === "A false hook."
    ? [{ field: "hook", sentence: "A false hook.", kind: "contradicted", severity: "must-fix", evidence: "no" }]
    : [];

function options(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    ...DEFAULT_OPTIONS,
    renderCardFor: async () => {},
    jitterMinutes: 0,
    ledgerPath: join(dir, "ledger.json"),
    pausePath: join(dir, "pause.json"),
    sleep: async () => {},
    verifyClaims,
    claimCachePath: join(dir, "claim-checks.json"),
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

const ledgerRows = (slug: string) =>
  (JSON.parse(readFileSync(join(dir, "ledger.json"), "utf8")) as SyndicationLedger).entries.filter(
    (e) => e.slug === slug
  );

describe("backlog drip", () => {
  it("moves past a note that fails its claim check instead of posting nothing", async () => {
    const bluesky = new SpyAdapter("bluesky");
    await run(options({ seedLedger: true, adapters: [bluesky], channels: ["bluesky"] }));

    await run(options({ backlog: 1, adapters: [bluesky], channels: ["bluesky"] }));

    expect(bluesky.posted).toEqual(["second"]);
  });

  it("keeps the blocked note, and the unused spare, in the backlog", async () => {
    const bluesky = new SpyAdapter("bluesky");
    await run(options({ seedLedger: true, adapters: [bluesky], channels: ["bluesky"] }));
    await run(options({ backlog: 1, adapters: [bluesky], channels: ["bluesky"] }));

    // Saved after the post. Before this fix a taken-but-unposted note lost its
    // seeded row here and fell out of the drip for good.
    expect(ledgerRows("oldest-blocked").map((e) => e.status)).toEqual(["seeded"]);
    expect(ledgerRows("third").map((e) => e.status)).toEqual(["seeded"]);
    expect(ledgerRows("second").map((e) => e.status)).toEqual(["posted"]);
  });

  it("still drips only `backlog` notes when several pass", async () => {
    const bluesky = new SpyAdapter("bluesky");
    await run(options({ seedLedger: true, adapters: [bluesky], channels: ["bluesky"] }));
    await run(options({ backlog: 1, verifyClaims: async () => [], adapters: [bluesky], channels: ["bluesky"] }));
    expect(bluesky.posted).toEqual(["oldest-blocked"]);
  });
});

describe("On This Day expiry", () => {
  const otd = (slug: string) => ({
    slug,
    day: slug.slice(9),
    showDate: "2001-06-04",
    age: 25,
    artist: "The Band",
    artistNormalized: "the-band",
    venue: "The Venue",
    venueNormalized: "the-venue",
    city: "Los Angeles",
    score: 50,
    cardPath: "public/og/on-this-day/x.png",
    tier: "artist",
    source: "artist",
    publishedAt: `${slug.slice(4)}T07:00:00.000Z`,
    social: { hook: "A hook.", caption: "Twenty-five years ago today.", authoredAt: "" },
  });
  const summary = (): RunSummary => ({ posted: [], failed: [], skipped: [], seeded: 0, retracted: [] });
  const emptyLedger: SyndicationLedger = { version: 1, updatedAt: "", entries: [] } as SyndicationLedger;

  it("expires a post whose day has passed — it says 'today'", () => {
    const s = summary();
    const o = options({ today: "2026-10-10", channels: ["bluesky"] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectCandidates([], [otd("otd-2026-10-04")] as any, emptyLedger, o, s, o.archive!.sources);
    expect(s.skipped).toEqual([{ slug: "otd-2026-10-04", reason: "expired — its day was 2026-10-04" }]);
  });

  it("does not expire a post on its own day", () => {
    const s = summary();
    const o = options({ today: "2026-10-10", channels: ["bluesky"] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectCandidates([], [otd("otd-2026-10-10")] as any, emptyLedger, o, s, o.archive!.sources);
    expect(s.skipped.some((e) => e.reason.startsWith("expired"))).toBe(false);
  });
});

describe("health: every candidate blocked", () => {
  const ledger = { version: 1, updatedAt: "", entries: [] } as unknown as SyndicationLedger;
  const derive = (previous: SyndicationHealth | undefined, run: { posted?: number; blocked?: number }) =>
    deriveHealth(ledger, {
      channels: ["bluesky"],
      previous,
      run: {
        posted: Array.from({ length: run.posted ?? 0 }, () => ({ slug: "x", channel: "bluesky" as Channel })),
        failed: [],
        blocked: run.blocked ?? 0,
      },
      now: "2026-10-10T12:00:00.000Z",
    });

  it("counts blocked runs, and alerts from the second in a row", () => {
    const first = derive(undefined, { blocked: 4 });
    expect(first.consecutiveBlockedRuns).toBe(1);
    expect(alertsFor(first, { now: first.generatedAt })).toEqual([]);

    const second = derive(first, { blocked: 4 });
    expect(second.consecutiveBlockedRuns).toBe(2);
    expect(alertsFor(second, { now: second.generatedAt })[0]).toContain("blocked by the claim check for 2 runs");
  });

  it("carries the count through a run with nothing due, and clears it on a post", () => {
    const blocked = derive(derive(undefined, { blocked: 1 }), { blocked: 1 });
    expect(derive(blocked, {}).consecutiveBlockedRuns).toBe(2);
    expect(derive(blocked, { posted: 1, blocked: 1 }).consecutiveBlockedRuns).toBe(0);
  });
});

describe("a channel without credentials", () => {
  class Unconfigured extends SpyAdapter {
    configured(): boolean {
      return false;
    }
  }

  it("does not make already-posted notes look fresh again", async () => {
    const bluesky = new SpyAdapter("bluesky");
    // Post everything on Bluesky first.
    await run(options({ limit: 10, verifyClaims: async () => [], adapters: [bluesky], channels: ["bluesky"] }));
    expect(bluesky.posted).toHaveLength(3);

    // Instagram is listed but has no credentials: nothing should be re-selected.
    // Counted by cards drawn: a selected post is always drawn, and the claim-check verdicts
    // from the first run are cached, so counting checks would see nothing either way.
    let drawn = 0;
    const summary = await run(
      options({
        limit: 10,
        adapters: [bluesky, new Unconfigured("instagram")],
        channels: ["bluesky", "instagram"],
        verifyClaims: async () => [],
        renderCardFor: async () => {
          drawn++;
        },
      })
    );
    expect(bluesky.posted).toHaveLength(3);
    expect(summary.posted).toEqual([]);
    expect(drawn).toBe(0);
  });
});
