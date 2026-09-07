/**
 * Health is the answer to "is it still posting", and the ledger cannot give it.
 *
 * The ledger records `posted`, `seeded` and `retracted` and deliberately records
 * nothing for a failure, so that a failed pair stays retryable. Correct for
 * idempotency, useless for detection: it can say when a channel last succeeded
 * and can never say it has been failing since. That gap is why failures are
 * carried forward in the health file rather than re-derived.
 */

import { describe, it, expect } from "vitest";
import { deriveHealth, alertsFor, type SyndicationHealth } from "../../scripts/syndication/health.ts";
import type { SyndicationLedger } from "../../scripts/syndication/types.ts";

const CHANNELS = ["bluesky", "mastodon"] as const;

function ledger(entries: SyndicationLedger["entries"]): SyndicationLedger {
  return { version: 1, updatedAt: "2026-09-07T00:00:00.000Z", entries };
}

const POSTED = ledger([
  { slug: "a", platform: "bluesky", status: "posted", postedAt: "2026-09-05T19:29:00.000Z" },
  { slug: "b", platform: "bluesky", status: "posted", postedAt: "2026-09-06T13:22:00.000Z" },
  { slug: "a", platform: "mastodon", status: "posted", postedAt: "2026-09-05T19:33:00.000Z" },
  { slug: "z", platform: "bluesky", status: "seeded", seededAt: "2026-08-22T04:22:00.000Z" },
]);

const NOW = "2026-09-07T10:00:00.000Z";

describe("deriveHealth", () => {
  it("reports the last success per channel, newest wins", () => {
    const h = deriveHealth(POSTED, { channels: CHANNELS, now: NOW });
    const bsky = h.channels.find((c) => c.channel === "bluesky")!;
    expect(bsky.lastSuccessAt).toBe("2026-09-06T13:22:00.000Z");
    expect(bsky.postedCount).toBe(2);
    expect(h.channels.find((c) => c.channel === "mastodon")!.postedCount).toBe(1);
  });

  it("counts the ledger by status", () => {
    const h = deriveHealth(POSTED, { channels: CHANNELS, now: NOW });
    expect(h.ledger).toEqual({ total: 4, posted: 3, seeded: 1, retracted: 0 });
  });

  /** The gap the ledger cannot fill: a failure leaves no row anywhere. */
  it("records a failure that the ledger will never show", () => {
    const h = deriveHealth(POSTED, {
      channels: CHANNELS,
      now: NOW,
      run: { posted: [], failed: [{ slug: "c", channel: "mastodon", error: "401 Unauthorized" }] },
    });
    const masto = h.channels.find((c) => c.channel === "mastodon")!;
    expect(masto.consecutiveFailures).toBe(1);
    expect(masto.lastError).toBe("401 Unauthorized");
    // The last SUCCESS is untouched — that is what makes the gap visible.
    expect(masto.lastSuccessAt).toBe("2026-09-05T19:33:00.000Z");
  });

  it("accumulates consecutive failures across runs", () => {
    const first = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW,
      run: { posted: [], failed: [{ slug: "c", channel: "mastodon", error: "401" }] },
    });
    const second = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW, previous: first,
      run: { posted: [], failed: [{ slug: "d", channel: "mastodon", error: "401" }] },
    });
    expect(second.channels.find((c) => c.channel === "mastodon")!.consecutiveFailures).toBe(2);
  });

  /** An error that outlives its fault sends you hunting for a problem already fixed. */
  it("a success clears the failure record outright", () => {
    const failing = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW,
      run: { posted: [], failed: [{ slug: "c", channel: "mastodon", error: "401" }] },
    });
    const recovered = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW, previous: failing,
      run: { posted: [{ slug: "d", channel: "mastodon" }], failed: [] },
    });
    const masto = recovered.channels.find((c) => c.channel === "mastodon")!;
    expect(masto.consecutiveFailures).toBe(0);
    expect(masto.lastError).toBeUndefined();
  });

  /** Most runs post nothing — that is normal, and must not erase the record. */
  it("a quiet run carries the previous record forward", () => {
    const failing = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW,
      run: { posted: [], failed: [{ slug: "c", channel: "mastodon", error: "401" }] },
    });
    const quiet = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW, previous: failing, run: { posted: [], failed: [] },
    });
    expect(quiet.channels.find((c) => c.channel === "mastodon")!.lastError).toBe("401");
  });

  it("carries the kill switch through", () => {
    const h = deriveHealth(POSTED, {
      channels: CHANNELS, now: NOW, paused: { paused: true, reason: "instance down" },
    });
    expect(h.paused).toBe(true);
    expect(h.pausedReason).toBe("instance down");
  });
});

describe("alertsFor", () => {
  const base = (over: Partial<SyndicationHealth> = {}): SyndicationHealth => ({
    version: 1, generatedAt: NOW, paused: false,
    ledger: { total: 0, posted: 0, seeded: 0, retracted: 0 },
    channels: [], ...over,
  });

  it("alerts on a failing channel", () => {
    const a = alertsFor(base({
      channels: [{ channel: "mastodon", postedCount: 1, consecutiveFailures: 2, lastError: "401" }],
    }), { now: NOW });
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("401");
  });

  /** The five-night silence: no errors at all, just nothing happening. */
  it("alerts on a channel that has simply gone quiet", () => {
    const a = alertsFor(base({
      channels: [{ channel: "bluesky", postedCount: 5, consecutiveFailures: 0,
                   lastSuccessAt: "2026-08-20T00:00:00.000Z" }],
    }), { now: NOW });
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("nothing posted for");
  });

  it("stays silent on a healthy channel", () => {
    expect(alertsFor(base({
      channels: [{ channel: "bluesky", postedCount: 5, consecutiveFailures: 0,
                   lastSuccessAt: "2026-09-06T13:22:00.000Z" }],
    }), { now: NOW })).toEqual([]);
  });

  /** A channel with no history is not yet live — absence is not a fault. */
  it("does not alert on a channel that has never posted", () => {
    expect(alertsFor(base({
      channels: [{ channel: "instagram", postedCount: 0, consecutiveFailures: 0 }],
    }), { now: NOW })).toEqual([]);
  });
});
