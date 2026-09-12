/**
 * Post-time claim check (#529) — `verifyPayloads` in `run.ts`.
 *
 * Before drawing or posting, every candidate payload is verified against
 * today's data. A must-fix issue makes it ineligible; a verifier failure holds
 * the post rather than publishing it unchecked ("ambiguity means stop").
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { verifyPayloads, type RunSummary } from "../../scripts/syndication/run.ts";
import type { PayloadSources } from "../../scripts/syndication/payload.ts";
import type { SyndicationPayload } from "../../scripts/syndication/types.ts";
import type { ClaimIssue, CopyFields } from "../../scripts/liner-notes/verify-claims.ts";

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "claim-check-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function payload(over: Partial<SyndicationPayload> = {}): SyndicationPayload {
  return {
    slug: "some-slug",
    kind: "liner-note",
    hook: "A true hook.",
    caption: "A true caption.",
    credit: { artists: ["Test Band"], venue: "The Venue", city: "Los Angeles", date: "1990-06-01" },
    refs: { artists: ["test-band"], venue: "the-venue" },
    url: "https://example.test/x",
    media: [],
    tags: [],
    eligible: true,
    ineligibleReasons: [],
    ...over,
  };
}

const sources: PayloadSources = { concerts: [], artistsMetadata: {}, venuesMetadata: {} };

function summary(): RunSummary {
  return { posted: [], failed: [], skipped: [], seeded: 0, retracted: [] };
}

describe("verifyPayloads", () => {
  it("keeps a payload with no issues", async () => {
    const s = summary();
    const kept = await verifyPayloads([payload()], sources, s, {
      verifyClaims: async () => [],
      claimCachePath: join(tempDir(), "cache.json"),
    });
    expect(kept).toHaveLength(1);
    expect(s.skipped).toEqual([]);
  });

  it("keeps a payload whose only issues are review-severity", async () => {
    const s = summary();
    const reviewIssue: ClaimIssue = { field: "hook", sentence: "x", kind: "external", severity: "review", evidence: "y" };
    const kept = await verifyPayloads([payload()], sources, s, {
      verifyClaims: async () => [reviewIssue],
      claimCachePath: join(tempDir(), "cache.json"),
    });
    expect(kept).toHaveLength(1);
    expect(s.skipped).toEqual([]);
  });

  it("drops a payload with a must-fix issue, naming the sentence and evidence", async () => {
    const s = summary();
    const mustFix: ClaimIssue = {
      field: "hook",
      sentence: "I never left California once.",
      kind: "contradicted",
      severity: "must-fix",
      evidence: "62 shows on record outside California.",
    };
    const kept = await verifyPayloads([payload()], sources, s, {
      verifyClaims: async () => [mustFix],
      claimCachePath: join(tempDir(), "cache.json"),
    });
    expect(kept).toEqual([]);
    expect(s.skipped).toHaveLength(1);
    expect(s.skipped[0].slug).toBe("some-slug");
    expect(s.skipped[0].reason).toContain("I never left California once.");
    expect(s.skipped[0].reason).toContain("62 shows on record outside California.");
  });

  it("holds the post — never publishes it unchecked — when the verifier itself fails", async () => {
    const s = summary();
    const kept = await verifyPayloads([payload()], sources, s, {
      verifyClaims: async () => {
        throw new Error("bad API response");
      },
      claimCachePath: join(tempDir(), "cache.json"),
    });
    expect(kept).toEqual([]);
    expect(s.skipped).toHaveLength(1);
    expect(s.skipped[0].reason).toContain("claim check failed");
    expect(s.skipped[0].reason).toContain("bad API response");
  });

  it("caches a verdict so an unchanged post on unchanged data costs no second call", async () => {
    const cachePath = join(tempDir(), "cache.json");
    let calls = 0;
    const verifyClaims = async (): Promise<ClaimIssue[]> => {
      calls++;
      return [];
    };

    await verifyPayloads([payload()], sources, summary(), { verifyClaims, claimCachePath: cachePath });
    expect(calls).toBe(1);

    // A second run, same payload, same sources, fresh cache load from disk.
    await verifyPayloads([payload()], sources, summary(), { verifyClaims, claimCachePath: cachePath });
    expect(calls).toBe(1);
  });

  it("re-checks when the copy changes, even with the same slug", async () => {
    const cachePath = join(tempDir(), "cache.json");
    const seen: CopyFields[] = [];
    const verifyClaims = async (_factSheet: string, copy: CopyFields): Promise<ClaimIssue[]> => {
      seen.push(copy);
      return [];
    };

    await verifyPayloads([payload({ hook: "First hook." })], sources, summary(), { verifyClaims, claimCachePath: cachePath });
    await verifyPayloads([payload({ hook: "A different hook." })], sources, summary(), { verifyClaims, claimCachePath: cachePath });
    expect(seen).toHaveLength(2);
  });

  it("defaults to a real Anthropic call when no verifier is injected — held without a key", async () => {
    // No verifyClaims injected: falls through to the default, which requires
    // ANTHROPIC_API_KEY. In a test environment that fails, and the payload is
    // held rather than posted unchecked — proving the "ambiguity means stop"
    // posture holds even for the production default, not only the injected path.
    delete process.env.ANTHROPIC_API_KEY;
    const s = summary();
    const kept = await verifyPayloads([payload()], sources, s, { claimCachePath: join(tempDir(), "cache.json") });
    expect(kept).toEqual([]);
    expect(s.skipped).toHaveLength(1);
    expect(s.skipped[0].reason).toContain("claim check failed");
  });
});
