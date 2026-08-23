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
 * Resumable: liner-notes.json is checkpointed after every authored note, and
 * re-running skips whatever already has copy — so a batch can be done in chunks
 * or picked up after a failure without re-spending the calls it already made.
 *
 * Requires: ANTHROPIC_API_KEY.
 *
 * See: https://github.com/mmorper/concerts/issues/323
 */

import { config } from "dotenv";
config({ override: true });

import { readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { selectForBackfill, applyAuthored, type BackfillSources } from "./liner-notes/backfill-social.ts";
import { generateSocial } from "./liner-notes/social.ts";
import { checkSocial, formatSocialIssues } from "./liner-notes/voice-check.ts";
import { graphemeLength } from "./syndication/text.ts";
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

/**
 * Write through a temp file and rename.
 *
 * The batch checkpoints after every note, so this runs 57 times rather than
 * once, and a crash lands in the middle of one of those writes rather than
 * between them. `rename` is atomic within a filesystem: readers see the old
 * file or the new one, never a truncated one. That is what makes checkpointing
 * safe enough to do at all — the alternative was writing once at the end and
 * losing the whole run's API calls to a crash at note 40.
 */
function writeAtomic(path: string, contents: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
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

  // One note per API call, checkpointed after each.
  //
  // The batch is 57 sequential Sonnet calls — long enough that a crash partway
  // through is a real possibility rather than a theoretical one, and every note
  // already authored is money already spent. Checkpointing makes a failure at
  // note 40 cost note 40 rather than notes 1 through 40: the next run's
  // selection skips whatever already carries copy and picks up exactly there.
  //
  // Per note rather than every N notes because the write is atomic and cheap
  // beside the API call that precedes it, so batching it buys nothing.
  let attached = 0;
  const failed: Array<{ slug: string; reason: string }> = [];
  const width = String(candidates.length).length;

  for (const [index, candidate] of candidates.entries()) {
    const position = `[${String(index + 1).padStart(width)}/${candidates.length}]`;
    const authored = await generateSocial([candidate]);
    const result = applyAuthored(data.posts, authored, checkSocial, (s, issues) =>
      console.log(formatSocialIssues(s, issues as Parameters<typeof formatSocialIssues>[1]))
    );

    if (result.attached) {
      attached += result.attached;
      writeAtomic(LINER_NOTES_PATH, JSON.stringify(data, null, 2));
      const hook = authored.get(candidate.post.slug)?.hook ?? "";
      console.log(`   ${position} ✓ ${candidate.post.slug} — hook ${graphemeLength(hook)} chars`);
      console.log(`        “${hook}”`);
    } else {
      // Two different failures land here: the API call itself failed, in which
      // case generateSocial has already warned and returned nothing for it, or
      // the copy came back and a voice check rejected it. Either way the note
      // is left exactly as it was and the next run will try it again.
      const reason = result.failed[0]?.reason ?? "no copy returned";
      failed.push({ slug: candidate.post.slug, reason });
      console.log(`   ${position} ✗ ${candidate.post.slug} — ${reason}`);
    }
  }

  console.log(
    `\n   ✓ ${attached}/${candidates.length} authored and passed voice checks` +
      (failed.length ? ` (${failed.length} failed)` : "")
  );
  for (const f of failed) console.log(`     ✗ ${f.slug}: ${f.reason}`);

  if (attached === 0) {
    console.log("\n⚠️  Nothing passed. Nothing written.\n");
    return;
  }

  const remaining = data.posts.filter((p) => !p.social).length;
  console.log("   ✓ Written: public/data/liner-notes.json (checkpointed after each note)");
  console.log(`\n✨ ${data.posts.length - remaining}/${data.posts.length} notes now carry social copy.`);
  if (remaining) console.log(`   ${remaining} still to go — re-run to continue.`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:", (err as Error).message ?? err);
  process.exit(1);
});
