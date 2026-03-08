#!/usr/bin/env tsx
/**
 * Agentic Liner Notes — CLI Entry Point
 *
 * Usage:
 *   npm run generate:liner-notes                  # Full run (2-3 posts)
 *   npm run generate:liner-notes -- --analyze-only # Analyze & score only (no API calls)
 *   npm run generate:liner-notes -- --dry-run      # Select candidates but don't generate
 *   npm run generate:liner-notes -- --seed         # First-run seeding (~10 posts)
 *   npm run generate:liner-notes -- --force        # Ignore deduplication
 *   npm run generate:liner-notes -- --date 2026-06-04  # Override today's date
 */

import { run } from "./pipeline.ts";
import type { PipelineOptions } from "./types.ts";

const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

function argValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const options: PipelineOptions = {
  analyzeOnly: flag("analyze-only"),
  dryRun: flag("dry-run"),
  seed: flag("seed"),
  force: flag("force"),
  date: argValue("date"),
};

console.log("🎵 Agentic Liner Notes Pipeline\n");
if (options.analyzeOnly) console.log("   Mode: analyze-only (no API calls)");
else if (options.dryRun)  console.log("   Mode: dry-run (no files written)");
else if (options.seed)    console.log("   Mode: seed (generating ~10 posts)");
else if (options.force)   console.log("   Mode: force (ignoring deduplication)");
if (options.date)         console.log(`   Date override: ${options.date}`);
console.log();

run(options).catch((err) => {
  console.error("\n❌ Pipeline failed:", err.message ?? err);
  process.exit(1);
});
