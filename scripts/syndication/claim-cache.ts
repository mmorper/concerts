/**
 * Claim-check verdict cache (#529).
 *
 * A post's copy and fact sheet do not change between runs unless the copy was
 * rewritten or the data moved a date under it, so re-verifying an unchanged
 * post on unchanged data would spend an API call to reconfirm the same answer
 * every single day it sits in the queue. Keyed on a hash of the copy PLUS its
 * fact sheet — not the slug alone — so a data refresh that touches any of the
 * post's shows changes the hash and forces a re-check automatically, exactly
 * the way a hand-written cache key never would.
 *
 * Shape and API mirror `ledger.ts` on purpose: committed JSON, a `version`
 * that throws on mismatch rather than silently resetting (a corrupt file
 * re-checking everything costs money; it never costs correctness), sorted on
 * write for a clean diff.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

import type { ClaimIssue, CopyFields } from "../liner-notes/verify-claims.ts";
import { ROOT } from "./payload.ts";

export const CLAIM_CACHE_PATH = join(ROOT, "data", "claim-checks.json");

export interface ClaimCacheEntry {
  slug: string;
  /** Hash of (fact sheet + copy) at the time this verdict was recorded. */
  hash: string;
  checkedAt: string;
  issues: ClaimIssue[];
}

export interface ClaimCache {
  version: 1;
  updatedAt: string;
  entries: ClaimCacheEntry[];
}

export function emptyClaimCache(): ClaimCache {
  return { version: 1, updatedAt: new Date(0).toISOString(), entries: [] };
}

/**
 * A missing cache is a normal first-run state — every post simply gets
 * checked. A cache that exists but does not parse is different: silently
 * starting fresh would re-spend API calls for every post in the queue, which
 * is only money, so it throws rather than resetting — the same asymmetry the
 * syndication ledger uses for the same reason.
 */
export function loadClaimCache(path: string = CLAIM_CACHE_PATH): ClaimCache {
  if (!existsSync(path)) return emptyClaimCache();
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ClaimCache;
  if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error(`Unrecognised claim-check cache at ${path}`);
  }
  return parsed;
}

export function saveClaimCache(cache: ClaimCache, path: string = CLAIM_CACHE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = {
    ...cache,
    updatedAt: new Date().toISOString(),
    entries: [...cache.entries].sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
}

/**
 * The cache key input. Not the slug alone — the fact sheet's own text is
 * hashed alongside the copy, so a show moving under a post (the staleness
 * gate's exact scenario) changes the hash and forces a fresh check, with no
 * separate invalidation logic to keep in sync.
 */
export function hashClaimInput(factSheet: string, copy: CopyFields): string {
  return createHash("sha256")
    .update(JSON.stringify({ factSheet, copy }))
    .digest("hex")
    .slice(0, 16);
}

export function findCached(cache: ClaimCache, slug: string, hash: string): ClaimCacheEntry | undefined {
  return cache.entries.find((e) => e.slug === slug && e.hash === hash);
}

export function recordCheck(cache: ClaimCache, slug: string, hash: string, issues: ClaimIssue[]): void {
  const idx = cache.entries.findIndex((e) => e.slug === slug);
  const entry: ClaimCacheEntry = { slug, hash, checkedAt: new Date().toISOString(), issues };
  if (idx === -1) cache.entries.push(entry);
  else cache.entries[idx] = entry;
}
