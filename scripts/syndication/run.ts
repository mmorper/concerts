/**
 * Syndication run loop — fan-out, idempotency, jitter and retraction.
 *
 * The site is canonical and every social post is a deliberately lossy pointer
 * back to it. This module is the part that actually points.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

import { BlueskyAdapter } from "./adapters/bluesky.ts";
import { MastodonAdapter } from "./adapters/mastodon.ts";
import type { Adapter } from "./adapters/types.ts";
import {
  alreadyHandled,
  livePlatforms,
  loadLedger,
  recordPost,
  recordRetraction,
  saveLedger,
  seed,
  takeFromBacklog,
  LEDGER_PATH,
} from "./ledger.ts";
import { buildOnThisDayPayload, buildPayload, ROOT, type PayloadSources } from "./payload.ts";
import { readPause } from "./pause.ts";
import { IMPLEMENTED_CHANNELS, type Channel, type SyndicationLedger, type SyndicationPayload } from "./types.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesData, LinerNotesPost } from "../../src/types/liner-notes.ts";
import type { OnThisDayData, OnThisDayPost } from "../on-this-day/types.ts";

const DATA_DIR = join(ROOT, "public", "data");

export interface RunOptions {
  /** Build payloads and print what would go out. No network, no ledger write. */
  dryRun: boolean;
  /** Mark the whole back catalogue as suppressed, then stop. */
  seedLedger: boolean;
  /** Delete this slug from every channel it posted to, then stop. */
  retract?: string;
  /** Restrict the fan-out. Defaults to every implemented channel. */
  channels: Channel[];
  /** Most posts to syndicate this run. */
  limit: number;
  /**
   * Opt-in backlog drip: also ship this many archived notes. Never a default —
   * "must be an explicit mode, never an accident" (#330).
   */
  backlog: number;
  /** Minutes of jitter between channels. 0 disables it (tests, dry runs). */
  jitterMinutes: number;
  /** Injected in tests. */
  ledgerPath?: string;
  /**
   * Injected in tests. Defaults to the committed switch.
   *
   * Worth injecting rather than letting tests read the real file: the switch is
   * repo-wide by design, so a genuinely paused repository would otherwise make
   * every "it posts" test fail — which is exactly what happened the first time
   * this was engaged for real.
   */
  pausePath?: string;
  adapters?: Adapter[];
  sleep?: (ms: number) => Promise<void>;
  /**
   * Injected in tests. Defaults to reading the committed archive.
   *
   * Worth injecting rather than mocking the filesystem: the run loop's job is
   * ledger arithmetic, and a test that has to publish a real liner note first
   * to exercise "do not double-post" tests the wrong thing.
   */
  archive?: { posts: LinerNotesPost[]; sources: PayloadSources; onThisDay?: OnThisDayPost[] };
}

export const DEFAULT_OPTIONS: RunOptions = {
  dryRun: false,
  seedLedger: false,
  channels: [...IMPLEMENTED_CHANNELS],
  limit: 3,
  backlog: 0,
  jitterMinutes: 4,
};

export interface RunSummary {
  /** Set when the kill switch stopped this run before it posted anything. */
  paused?: string;
  posted: Array<{ slug: string; channel: Channel; permalink?: string }>;
  failed: Array<{ slug: string; channel: Channel; error: string }>;
  skipped: Array<{ slug: string; reason: string }>;
  seeded: number;
  retracted: Array<{ slug: string; channel: Channel }>;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function run(options: RunOptions): Promise<RunSummary> {
  const ledgerPath = options.ledgerPath ?? LEDGER_PATH;
  const ledger = loadLedger(ledgerPath);
  const summary: RunSummary = { posted: [], failed: [], skipped: [], seeded: 0, retracted: [] };

  const { posts, sources, onThisDay = [] } = options.archive ?? loadArchive();
  const adapters = (options.adapters ?? [new BlueskyAdapter(), new MastodonAdapter()]).filter((a) =>
    options.channels.includes(a.channel)
  );

  // The kill switch. Checked before anything reaches an adapter, and reported
  // loudly — a paused run must never be mistakable for a quiet one. "Nothing
  // to syndicate" and "posting is switched off" look identical in a log
  // otherwise, and that is exactly when someone assumes the wrong one.
  //
  // Deliberately not applied to --seed-ledger or --retract below: seeding
  // writes no posts, and retraction is the safety valve. A switch that also
  // disabled the undo would be the wrong shape.
  const pauseState = readPause(options.pausePath);

  // ── Seed ───────────────────────────────────────────────────────────────
  if (options.seedLedger) {
    const added = seed(
      ledger,
      [...posts.map((p) => p.slug), ...onThisDay.map((p) => p.slug)],
      options.channels
    );
    summary.seeded = added;
    console.log(`🌱 Seeded ${added} ledger row${added === 1 ? "" : "s"} across ${options.channels.length} channel(s).`);
    console.log(`   ${posts.length} published note${posts.length === 1 ? "" : "s"} will not fire.`);
    if (!options.dryRun) saveLedger(ledger, ledgerPath);
    return summary;
  }

  // ── Retract ────────────────────────────────────────────────────────────
  if (options.retract) {
    return retract(options.retract, ledger, adapters, options, ledgerPath, summary);
  }

  // ── Paused? ────────────────────────────────────────────────────────────
  if (pauseState.paused) {
    summary.paused = pauseState.detail;
    console.log("⛔ SYNDICATION IS PAUSED — nothing will be posted.");
    console.log(`   ${pauseState.detail}`);
    console.log("   Resume with: npm run syndicate -- --resume\n");

    // Still say what WOULD have gone out. During a development pause that is
    // the useful half of the run, and it costs nothing.
    const wouldPost = selectCandidates(posts, onThisDay, ledger, options, summary, sources);
    for (const p of wouldPost) console.log(`   [held] ${p.slug}`);
    if (!wouldPost.length) console.log("   (nothing was queued anyway)");
    console.log();
    return summary;
  }

  // ── Select ─────────────────────────────────────────────────────────────
  const candidates = selectCandidates(posts, onThisDay, ledger, options, summary, sources);
  if (!candidates.length) {
    console.log("📭 Nothing to syndicate this run.");
    return summary;
  }

  console.log(`📤 Syndicating ${candidates.length} post(s) to ${adapters.map((a) => a.channel).join(", ")}:`);
  for (const payload of candidates) console.log(`   • ${payload.slug}`);

  // ── Fan out ────────────────────────────────────────────────────────────
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let firstChannel = true;

  for (const adapter of adapters) {
    if (!adapter.configured()) {
      console.log(`   ⏭  ${adapter.channel}: no credentials configured — skipping`);
      continue;
    }

    // Minutes of jitter between channels. Simultaneous posting across several
    // platforms reads as botlike, and a couple of platforms notice. Applied
    // between channels rather than between posts because the tell is the
    // synchronised fan-out, not the cadence within one account.
    if (!firstChannel && options.jitterMinutes > 0 && !options.dryRun) {
      const ms = jitter(options.jitterMinutes);
      console.log(`   ⏲  waiting ${Math.round(ms / 1000)}s before ${adapter.channel}`);
      await sleep(ms);
    }
    firstChannel = false;

    for (const payload of candidates) {
      // Re-checked per pair, not per post: this is what makes a partial
      // fan-out resume only what failed. Bluesky succeeded and Mastodon 500ed
      // means exactly one row is missing, and only that one is retried.
      if (alreadyHandled(ledger, payload.slug, adapter.channel)) continue;

      if (options.dryRun) {
        console.log(`   [dry-run] ${adapter.channel} ← ${payload.slug}`);
        continue;
      }

      try {
        const result = await adapter.post(payload);
        const card = payload.media.find((m) => m.role === "card");
        recordPost(ledger, {
          slug: payload.slug,
          platform: adapter.channel,
          uri: result.uri,
          rkey: result.rkey,
          tier: card?.tier,
          source: card?.source,
        });
        // Persisted after every single post, not once at the end. A crash
        // between two channels must not lose the row for the one that
        // succeeded — that is precisely the double-post this file exists to
        // prevent.
        saveLedger(ledger, ledgerPath);
        summary.posted.push({ slug: payload.slug, channel: adapter.channel, permalink: result.permalink });
        console.log(`   ✓ ${adapter.channel} ← ${payload.slug}${result.permalink ? ` (${result.permalink})` : ""}`);
      } catch (err) {
        const message = (err as Error).message;
        summary.failed.push({ slug: payload.slug, channel: adapter.channel, error: message });
        console.error(`   ✗ ${adapter.channel} ← ${payload.slug}: ${message}`);
      }
    }
  }

  return summary;
}

// ── Selection ─────────────────────────────────────────────────────────────────

function selectCandidates(
  posts: LinerNotesPost[],
  onThisDay: OnThisDayPost[],
  ledger: SyndicationLedger,
  options: RunOptions,
  summary: RunSummary,
  sources: PayloadSources
): SyndicationPayload[] {
  const payloads: SyndicationPayload[] = [];

  // Newest first — the weekly note is the point, and the drip below is what
  // reaches back into the archive.
  const fresh = posts.filter((p) =>
    options.channels.some((c) => !alreadyHandled(ledger, p.slug, c))
  );

  for (const post of fresh) {
    if (payloads.length >= options.limit) break;
    const payload = buildPayload(post, sources);
    if (!payload.eligible) {
      summary.skipped.push({ slug: post.slug, reason: payload.ineligibleReasons.join("; ") });
      continue;
    }
    payloads.push(payload);
  }

  // On This Day, newest first. It shares the run and the limit with the liner
  // notes rather than getting a budget of its own: the point of one canonical
  // payload is that the fan-out does not care which stream a post came from.
  const freshOtd = [...onThisDay]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((p) => options.channels.some((c) => !alreadyHandled(ledger, p.slug, c)));

  for (const post of freshOtd) {
    if (payloads.length >= options.limit) break;
    const payload = buildOnThisDayPayload(post);
    if (!payload.eligible) {
      summary.skipped.push({ slug: post.slug, reason: payload.ineligibleReasons.join("; ") });
      continue;
    }
    payloads.push(payload);
  }

  // Opt-in, rate-limited backfill. Doubles content volume for a year at zero
  // marginal cost and means a new account is not empty on day three — but only
  // ever when asked for, and only ever `backlog` at a time.
  if (options.backlog > 0) {
    const oldestFirst = [...posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    const taken = takeFromBacklog(ledger, oldestFirst.map((p) => p.slug), options.backlog);
    for (const slug of taken) {
      const post = posts.find((p) => p.slug === slug);
      if (!post) continue;
      const payload = buildPayload(post, sources);
      if (!payload.eligible) {
        summary.skipped.push({ slug, reason: `backlog: ${payload.ineligibleReasons.join("; ")}` });
        continue;
      }
      console.log(`   ↩ backlog drip: ${slug}`);
      payloads.push(payload);
    }
  }

  for (const entry of summary.skipped) {
    console.log(`   ⏭  ${entry.slug}: ${entry.reason}`);
  }

  return payloads;
}

// ── Retraction ────────────────────────────────────────────────────────────────

/**
 * Fully automatic and no-way-to-undo are different decisions, and only the
 * first was chosen. This is the second one.
 */
async function retract(
  slug: string,
  ledger: SyndicationLedger,
  adapters: Adapter[],
  options: RunOptions,
  ledgerPath: string,
  summary: RunSummary
): Promise<RunSummary> {
  const live = livePlatforms(ledger, slug);
  if (!live.length) {
    console.log(`🔍 ${slug} is not live on any channel — nothing to retract.`);
    return summary;
  }

  console.log(`🗑  Retracting ${slug} from ${live.map((e) => e.platform).join(", ")}`);

  for (const entry of live) {
    const adapter = adapters.find((a) => a.channel === entry.platform);
    if (!adapter) {
      console.warn(`   ⚠️  no adapter for ${entry.platform} — ${slug} stays live there`);
      continue;
    }
    if (options.dryRun) {
      console.log(`   [dry-run] would delete ${entry.uri} from ${entry.platform}`);
      continue;
    }
    try {
      await adapter.retract(entry);
      recordRetraction(ledger, slug, entry.platform);
      // Written per channel, same reasoning as the post loop: a failure on the
      // second channel must not lose the record that the first was deleted.
      saveLedger(ledger, ledgerPath);
      summary.retracted.push({ slug, channel: entry.platform });
      console.log(`   ✓ deleted from ${entry.platform}`);
    } catch (err) {
      const message = (err as Error).message;
      summary.failed.push({ slug, channel: entry.platform, error: message });
      console.error(`   ✗ ${entry.platform}: ${message}`);
    }
  }

  return summary;
}

// ── Data loading ──────────────────────────────────────────────────────────────

export function loadArchive(): {
  posts: LinerNotesPost[];
  sources: PayloadSources;
  onThisDay: OnThisDayPost[];
} {
  const linerNotesPath = join(DATA_DIR, "liner-notes.json");
  if (!existsSync(linerNotesPath)) {
    throw new Error("public/data/liner-notes.json missing — run the liner notes pipeline first");
  }
  const data = JSON.parse(readFileSync(linerNotesPath, "utf8")) as LinerNotesData;
  const concerts = (JSON.parse(readFileSync(join(DATA_DIR, "concerts.json"), "utf8")) as { concerts: Concert[] }).concerts;

  // Absent until the first On This Day run, which is a normal first-run state
  // and not an error — the stream simply has nothing to syndicate yet.
  const otdPath = join(DATA_DIR, "on-this-day.json");
  const onThisDay = existsSync(otdPath)
    ? (JSON.parse(readFileSync(otdPath, "utf8")) as OnThisDayData).posts
    : [];

  return {
    posts: data.posts,
    onThisDay,
    sources: {
      concerts,
      artistsMetadata: JSON.parse(readFileSync(join(DATA_DIR, "artists-metadata.json"), "utf8")),
      venuesMetadata: JSON.parse(readFileSync(join(DATA_DIR, "venues-metadata.json"), "utf8")),
    },
  };
}

/**
 * Uniform jitter across the whole window rather than a fixed delay, because a
 * fixed delay is itself a signature — "always 240 seconds apart" is as
 * recognisable a pattern as posting simultaneously.
 */
function jitter(minutes: number): number {
  return Math.round(Math.random() * minutes * 60_000);
}
