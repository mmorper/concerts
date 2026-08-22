/**
 * Syndication ledger — idempotency, seeding and the retraction index (#330).
 *
 * A committed JSON file keyed `slug × platform`. Committed rather than KV
 * because it is diffable, reviewable and greppable, which is how this project
 * already treats every other piece of state.
 *
 * Three jobs, and the third is why it exists at all:
 *
 * 1. **Never post if the pair exists.** Re-running the pipeline does not
 *    double-post.
 * 2. **Partial fan-out resumes only what failed.** State is per-pair, so
 *    Bluesky succeeding and Mastodon 500ing leaves exactly one row to retry.
 *    Retrying the batch would double-post to Bluesky.
 * 3. **It is the retraction index.** Because the returned post IDs are
 *    recorded, `--retract <slug>` can delete across every channel it posted
 *    to. That buys back everything a human approval gate would have, with no
 *    weekly clicking — and it is impossible to retrofit, because the IDs would
 *    never have been written down.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

import {
  ledgerKey,
  type Channel,
  type LedgerEntry,
  type MediaSource,
  type MediaTier,
  type SyndicationLedger,
} from "./types.ts";
import { ROOT } from "./payload.ts";

/**
 * `data/`, not `public/data/`.
 *
 * The ledger is operational state, not site content: nothing in the app reads
 * it, and shipping it in the client bundle would publish every post ID we hold
 * for no benefit. It sits alongside `data/artist-aliases.json`, the other
 * committed file the pipeline reads and writes.
 */
export const LEDGER_PATH = join(ROOT, "data", "syndication-log.json");

export function emptyLedger(): SyndicationLedger {
  return { version: 1, updatedAt: new Date(0).toISOString(), entries: [] };
}

/**
 * A missing ledger is a supported first-run state and returns empty — but that
 * is exactly the state in which an unseeded run fires the entire back
 * catalogue, so `seed()` runs before any post does. An *unparseable* ledger is
 * different and throws: silently starting fresh from a corrupt file would
 * re-post everything already live.
 */
export function loadLedger(path: string = LEDGER_PATH): SyndicationLedger {
  if (!existsSync(path)) return emptyLedger();
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as SyndicationLedger;
  if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error(`Unrecognised syndication ledger at ${path}`);
  }
  return parsed;
}

export function saveLedger(ledger: SyndicationLedger, path: string = LEDGER_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = {
    ...ledger,
    updatedAt: new Date().toISOString(),
    // Sorted on write so a run that touches two channels produces a two-line
    // diff rather than a reshuffle. The file is reviewed by a human in a PR.
    entries: [...ledger.entries].sort((a, b) =>
      ledgerKey(a.slug, a.platform).localeCompare(ledgerKey(b.slug, b.platform))
    ),
  };
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
}

export function findEntry(
  ledger: SyndicationLedger,
  slug: string,
  platform: Channel
): LedgerEntry | undefined {
  return ledger.entries.find((e) => e.slug === slug && e.platform === platform);
}

/**
 * Any row at all blocks a post, whatever its status.
 *
 * `seeded` means deliberately suppressed. `posted` means already live.
 * `retracted` means it was live and was pulled — and a retracted post must
 * never come back on the next weekly run, which is the one case a naive
 * "skip if posted" check would get catastrophically wrong.
 */
export function alreadyHandled(
  ledger: SyndicationLedger,
  slug: string,
  platform: Channel
): boolean {
  return findEntry(ledger, slug, platform) !== undefined;
}

function upsert(ledger: SyndicationLedger, entry: LedgerEntry): void {
  const idx = ledger.entries.findIndex(
    (e) => e.slug === entry.slug && e.platform === entry.platform
  );
  if (idx === -1) ledger.entries.push(entry);
  else ledger.entries[idx] = { ...ledger.entries[idx], ...entry };
}

export function recordPost(
  ledger: SyndicationLedger,
  args: {
    slug: string;
    platform: Channel;
    uri: string;
    rkey?: string;
    tier?: MediaTier;
    source?: MediaSource;
  }
): void {
  upsert(ledger, {
    slug: args.slug,
    platform: args.platform,
    status: "posted",
    uri: args.uri,
    ...(args.rkey ? { rkey: args.rkey } : {}),
    postedAt: new Date().toISOString(),
    // Which tier actually shipped. This is the greppable blast radius a
    // content-ID strike needs: "every post carrying a TheAudioDB press shot"
    // has to be one filter, and here it is one.
    ...(args.tier ? { tier: args.tier } : {}),
    ...(args.source ? { source: args.source } : {}),
  });
}

export function recordRetraction(
  ledger: SyndicationLedger,
  slug: string,
  platform: Channel
): void {
  const existing = findEntry(ledger, slug, platform);
  upsert(ledger, {
    ...(existing ?? { slug, platform }),
    slug,
    platform,
    status: "retracted",
    retractedAt: new Date().toISOString(),
  });
}

/**
 * Suppress the back catalogue.
 *
 * 57 liner notes are already published. An empty ledger means the first run
 * fires all 57 at once, on a brand-new account, in one burst — which is both
 * the worst possible introduction and the exact behaviour that gets a young
 * account flagged.
 *
 * Seeding writes a `seeded` row for every slug on every channel. It never
 * overwrites an existing row: a post already live stays `posted`, so seeding
 * is safe to re-run and cannot erase a retraction.
 *
 * Returns the number of rows added, so `--seed-ledger` can say what it did.
 */
export function seed(
  ledger: SyndicationLedger,
  slugs: string[],
  channels: readonly Channel[]
): number {
  const seededAt = new Date().toISOString();
  let added = 0;
  for (const slug of slugs) {
    for (const platform of channels) {
      if (alreadyHandled(ledger, slug, platform)) continue;
      ledger.entries.push({ slug, platform, status: "seeded", seededAt });
      added++;
    }
  }
  return added;
}

/**
 * The back catalogue, oldest first, for the opt-in drip.
 *
 * Rather than merely suppressing what was seeded, one archived note ships
 * alongside the new one each week: it doubles content volume for a year at
 * zero marginal cost and means a new account is not empty on day three.
 *
 * Oldest first is deliberate — dripping newest-first would make the account
 * read as an archive being emptied backwards, and the oldest notes are the
 * ones nobody has seen.
 *
 * The drip un-seeds a row rather than posting past it, so the ledger never
 * carries a `seeded` row for something that later went out. Callers must
 * persist the ledger for the un-seeding to hold.
 */
export function takeFromBacklog(
  ledger: SyndicationLedger,
  orderedSlugs: string[],
  count: number
): string[] {
  const taken: string[] = [];
  for (const slug of orderedSlugs) {
    if (taken.length >= count) break;
    const rows = ledger.entries.filter((e) => e.slug === slug);
    // Only a wholly-seeded post is eligible: one that is partly posted is
    // mid-retry, not backlog, and must not be re-picked by the drip.
    if (!rows.length || rows.some((r) => r.status !== "seeded")) continue;
    ledger.entries = ledger.entries.filter((e) => e.slug !== slug);
    taken.push(slug);
  }
  return taken;
}

/** Every channel a slug is currently live on, for retraction. */
export function livePlatforms(ledger: SyndicationLedger, slug: string): LedgerEntry[] {
  return ledger.entries.filter((e) => e.slug === slug && e.status === "posted" && e.uri);
}
