#!/usr/bin/env tsx
/**
 * Social Syndication — CLI entry point.
 *
 * Usage:
 *   npm run syndicate                        # post the new notes
 *   npm run syndicate -- --dry-run           # build payloads, print, post nothing
 *   npm run syndicate -- --seed-ledger       # suppress the back catalogue (run this FIRST)
 *   npm run syndicate -- --retract <slug>    # delete from every channel it posted to
 *   npm run syndicate -- --channels bluesky  # restrict the fan-out
 *   npm run syndicate -- --backlog 1         # opt-in drip of one archived note
 *   npm run syndicate -- --limit 2 --no-jitter
 *
 * Seeding is not optional on a fresh ledger: 57 notes are already published,
 * and an unseeded first run fires all of them at once.
 */

import { config } from "dotenv";
config({ override: true });

import { run, DEFAULT_OPTIONS, type RunOptions } from "./run.ts";
import { CHANNELS, type Channel } from "./types.ts";

const args = process.argv.slice(2);

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

/**
 * A flag present with no value returns undefined, not the next flag: `--retract
 * --dry-run` must be an error, never a run that quietly falls through to
 * posting because `retract` looked absent.
 */
function value(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  if (next === undefined || next.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return next;
}

function parseChannels(raw: string | undefined): Channel[] {
  if (!raw) return [...DEFAULT_OPTIONS.channels];
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = requested.filter((c) => !CHANNELS.includes(c as Channel));
  if (unknown.length) {
    throw new Error(`Unknown channel(s): ${unknown.join(", ")}. Known: ${CHANNELS.join(", ")}`);
  }
  return requested as Channel[];
}

function parsePositive(name: string, fallback: number): number {
  const raw = value(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer, got "${raw}"`);
  }
  return parsed;
}

function parseArgs(): RunOptions {
  return {
    ...DEFAULT_OPTIONS,
    dryRun: flag("dry-run"),
    seedLedger: flag("seed-ledger"),
    retract: value("retract"),
    channels: parseChannels(value("channels")),
    limit: parsePositive("limit", DEFAULT_OPTIONS.limit),
    backlog: parsePositive("backlog", 0),
    jitterMinutes: flag("no-jitter") ? 0 : parsePositive("jitter", DEFAULT_OPTIONS.jitterMinutes),
  };
}

// A bad flag is an operator mistake, not a bug: say what is wrong on one line
// rather than printing a stack trace over it.
let options: RunOptions;
try {
  options = parseArgs();
} catch (err) {
  fail((err as Error).message);
}

console.log("📡 Social Syndication\n");
if (options.dryRun) console.log("   Mode: dry-run (nothing posted, ledger untouched)");
if (options.seedLedger) console.log("   Mode: seed-ledger");
if (options.retract) console.log(`   Mode: retract ${options.retract}`);
console.log(`   Channels: ${options.channels.join(", ")}`);
console.log();

run(options)
  .then((summary) => {
    console.log();
    if (summary.posted.length) console.log(`✅ Posted ${summary.posted.length}`);
    if (summary.retracted.length) console.log(`🗑  Retracted ${summary.retracted.length}`);
    if (summary.skipped.length) console.log(`⏭  Skipped ${summary.skipped.length} ineligible`);
    if (summary.failed.length) {
      // Loud, not silent (#337). A silent partial failure is how a channel
      // quietly stops posting for a month without anyone noticing.
      console.error(`\n❌ ${summary.failed.length} failure(s):`);
      for (const f of summary.failed) console.error(`   ${f.channel} ← ${f.slug}: ${f.error}`);
      process.exit(1);
    }
    console.log();
  })
  .catch((err) => {
    console.error("\n❌ Syndication failed:", err.message ?? err);
    process.exit(1);
  });
