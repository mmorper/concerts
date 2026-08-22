#!/usr/bin/env tsx
/**
 * Backfill authored social copy onto already-published liner notes — CLI.
 *
 * The logic lives in scripts/liner-notes/backfill-social.ts; this is the thin
 * wrapper, matching refresh-liner-note-images.ts.
 *
 * Deliberately a separate command rather than a pipeline flag: the pipeline's
 * job is to publish this week's note, and a 57-call batch that half-finishes
 * must not be able to leave a weekly run in a strange state.
 *
 * Usage:
 *   npm run backfill:social -- --dry-run        # list what would be authored
 *   npm run backfill:social -- --limit 5        # author five, then stop
 *   npm run backfill:social                     # author every remaining note
 *   npm run backfill:social -- --slug <slug>    # one specific note
 *   npm run backfill:social -- --force          # re-author notes that already have copy
 *
 * Resumable: re-running skips whatever already has copy, so a batch can be
 * done in chunks or picked up after a failure.
 *
 * Requires: ANTHROPIC_API_KEY.
 *
 * See: https://github.com/mmorper/concerts/issues/323
 */

import { config } from "dotenv";
config({ override: true });

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { selectForBackfill, applyAuthored, type BackfillSources } from "./liner-notes/backfill-social.ts";
import { generateSocial } from "./liner-notes/social.ts";
import { checkSocial, formatSocialIssues } from "./liner-notes/voice-check.ts";
import type { Concert } from "../src/types/concert.ts";
import type { LinerNotesData } from "../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const LINER_NOTES_PATH = join(DATA_DIR, "liner-notes.json");

const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

/** A flag with no value is an error, never a silent fall-through to the next flag. */
function value(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  if (next === undefined || next.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return next;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const dryRun = flag("dry-run");
  const force = flag("force");
  const slug = value("slug");
  const limitRaw = value("limit");
  const limit = limitRaw === undefined ? undefined : Number(limitRaw);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error(`--limit must be a positive integer, got "${limitRaw}"`);
  }

  console.log("📣 Backfilling social copy\n");
  if (dryRun) console.log("   Mode: dry-run (no API calls, no files written)");
  if (force) console.log("   Mode: force (re-authoring notes that already have copy)");
  if (slug) console.log(`   Slug: ${slug}`);
  if (limit) console.log(`   Limit: ${limit}`);
  console.log();

  const data = readJson<LinerNotesData>("liner-notes.json");
  const sources: BackfillSources = {
    concerts: readJson<{ concerts: Concert[] }>("concerts.json").concerts,
    artistsMetadata: readJson("artists-metadata.json"),
    venuesMetadata: readJson("venues-metadata.json"),
  };

  const { candidates, skipped } = selectForBackfill(data.posts, sources, { force, limit, slug });

  const have = data.posts.filter((p) => p.social).length;
  console.log(`📚 ${data.posts.length} published notes — ${have} already carry social copy`);
  for (const s of skipped) console.log(`   ⏭  ${s.slug}: ${s.reason}`);

  if (slug && !candidates.length && !skipped.length) {
    throw new Error(
      `No note matches --slug ${slug}${force ? "" : " (it may already have copy — use --force to re-author)"}`
    );
  }
  if (!candidates.length) {
    console.log("\n✨ Nothing to author.");
    return;
  }

  console.log(`\n✍️  Authoring ${candidates.length} note${candidates.length !== 1 ? "s" : ""}:`);
  for (const c of candidates) console.log(`   • ${c.post.slug}`);

  if (dryRun) {
    console.log("\n✅ --dry-run: stopping before any API call. No files written.\n");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required to author social copy.");
  }

  const authored = await generateSocial(candidates);
  const result = applyAuthored(data.posts, authored, checkSocial, (s, issues) =>
    console.log(formatSocialIssues(s, issues as Parameters<typeof formatSocialIssues>[1]))
  );

  console.log(
    `\n   ✓ ${result.attached}/${candidates.length} authored and passed voice checks` +
      (result.failed.length ? ` (${result.failed.length} failed)` : "")
  );
  for (const f of result.failed) console.log(`     ✗ ${f.slug}: ${f.reason}`);

  if (result.attached === 0) {
    console.log("\n⚠️  Nothing passed. Not writing.");
    return;
  }

  // Written once at the end rather than per note. A crash mid-batch loses this
  // run's API calls, which is cheap; a half-written liner-notes.json is not.
  // Re-running is safe and resumes exactly where this stopped, because the
  // selection skips any note that already has copy.
  writeFileSync(LINER_NOTES_PATH, JSON.stringify(data, null, 2));
  const remaining = data.posts.filter((p) => !p.social).length;
  console.log("   ✓ Written: public/data/liner-notes.json");
  console.log(`\n✨ ${data.posts.length - remaining}/${data.posts.length} notes now carry social copy.`);
  if (remaining) console.log(`   ${remaining} still to go — re-run to continue.`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:", (err as Error).message ?? err);
  process.exit(1);
});
