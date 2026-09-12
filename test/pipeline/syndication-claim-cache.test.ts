/**
 * Claim-check verdict cache (#529).
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  emptyClaimCache,
  loadClaimCache,
  saveClaimCache,
  hashClaimInput,
  findCached,
  recordCheck,
} from "../../scripts/syndication/claim-cache.ts";
import type { ClaimIssue } from "../../scripts/liner-notes/verify-claims.ts";

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "claim-cache-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("hashClaimInput", () => {
  it("is stable for identical input", () => {
    const a = hashClaimInput("FACT SHEET", { hook: "h" });
    const b = hashClaimInput("FACT SHEET", { hook: "h" });
    expect(a).toBe(b);
  });

  it("changes when the fact sheet changes — a moved show forces a re-check", () => {
    const a = hashClaimInput("FACT SHEET v1", { hook: "h" });
    const b = hashClaimInput("FACT SHEET v2", { hook: "h" });
    expect(a).not.toBe(b);
  });

  it("changes when the copy changes", () => {
    const a = hashClaimInput("FACT SHEET", { hook: "h1" });
    const b = hashClaimInput("FACT SHEET", { hook: "h2" });
    expect(a).not.toBe(b);
  });
});

describe("load / save / find", () => {
  it("returns an empty cache when the file is missing", () => {
    const path = join(tempDir(), "claim-checks.json");
    expect(loadClaimCache(path)).toEqual(emptyClaimCache());
  });

  it("round-trips a recorded verdict", () => {
    const path = join(tempDir(), "claim-checks.json");
    const cache = emptyClaimCache();
    const issues: ClaimIssue[] = [
      { field: "hook", sentence: "x", kind: "contradicted", severity: "must-fix", evidence: "y" },
    ];
    const hash = hashClaimInput("FACT SHEET", { hook: "x" });
    recordCheck(cache, "some-slug", hash, issues);
    saveClaimCache(cache, path);

    const reloaded = loadClaimCache(path);
    const found = findCached(reloaded, "some-slug", hash);
    expect(found?.issues).toEqual(issues);
  });

  it("misses on a different hash for the same slug", () => {
    const cache = emptyClaimCache();
    recordCheck(cache, "some-slug", "hash-a", []);
    expect(findCached(cache, "some-slug", "hash-b")).toBeUndefined();
  });

  it("throws on a corrupt file — never silently re-checks everything for free", () => {
    const path = join(tempDir(), "claim-checks.json");
    writeFileSync(path, JSON.stringify({ version: 2, entries: [] }));
    expect(() => loadClaimCache(path)).toThrow();
  });

  it("overwrites the previous verdict for the same slug on a new hash", () => {
    const cache = emptyClaimCache();
    recordCheck(cache, "some-slug", "hash-a", [
      { field: "hook", sentence: "old", kind: "internal", severity: "review", evidence: "e" },
    ]);
    recordCheck(cache, "some-slug", "hash-b", []);
    expect(cache.entries).toHaveLength(1);
    expect(cache.entries[0].hash).toBe("hash-b");
    expect(cache.entries[0].issues).toEqual([]);
  });
});
