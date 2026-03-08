/**
 * Agentic Liner Notes — Pipeline Orchestrator
 *
 * Wires all stages together:
 *   analyze → score → select → generate → buildPosts → write
 *
 * Also generates RSS feed and OG images after writing posts.
 * Reads/merges into public/data/liner-notes.json (history-aware).
 *
 * Called by index.ts (CLI) and by build-data.ts (full pipeline).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { analyze } from "./analyze.ts";
import { score } from "./score.ts";
import { select, buildPosts } from "./curate.ts";
import { generate } from "./generate.ts";
import type { PipelineOptions } from "./types.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesData, LinerNotesPost } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "public", "data");
const LINER_NOTES_PATH = join(DATA_DIR, "liner-notes.json");

/** Posts selected per normal weekly run. Seed mode uses 10. */
const SEED_POST_COUNT = 10;

// ── Main export ───────────────────────────────────────────────────────────────

export async function run(options: PipelineOptions): Promise<void> {
  const today = options.date ? new Date(options.date) : new Date();
  console.log(`📅 Pipeline date: ${today.toISOString().slice(0, 10)}`);

  // ── Load data files ──────────────────────────────────────────────────────
  const concertsRaw = readFileSync(join(DATA_DIR, "concerts.json"), "utf8");
  const concertsData = JSON.parse(concertsRaw);
  const concerts: Concert[] = concertsData.concerts;

  const artistsMetadata = JSON.parse(
    readFileSync(join(DATA_DIR, "artists-metadata.json"), "utf8")
  );
  const artistsTopTracks = JSON.parse(
    readFileSync(join(DATA_DIR, "artists-top-tracks.json"), "utf8")
  );
  const venuesMetadata = JSON.parse(
    readFileSync(join(DATA_DIR, "venues-metadata.json"), "utf8")
  );

  const dataHash = createHash("sha256")
    .update(concertsRaw)
    .digest("hex")
    .slice(0, 8);

  // ── Load existing posts ──────────────────────────────────────────────────
  const existingData = loadExistingData();
  const existingPosts: LinerNotesPost[] = existingData?.posts ?? [];
  console.log(`📚 Existing posts: ${existingPosts.length}`);

  // ── Stage 1: Analyze ─────────────────────────────────────────────────────
  console.log("\n🔍 Stage 1: Analyzing concert patterns...");
  const { findings, stats } = analyze(concerts, today, { venuesMetadata });
  console.log(`   Found ${findings.length} raw findings (${stats.concertsAnalyzed} concerts analyzed)`);
  for (const [detector, count] of Object.entries(stats.findingsByDetector)) {
    console.log(`   • ${detector}: ${count}`);
  }

  // ── Stage 2: Score ───────────────────────────────────────────────────────
  console.log("\n📊 Stage 2: Scoring findings...");
  const concertCountByArtist: Record<string, number> = {};
  for (const c of concerts) {
    concertCountByArtist[c.headlinerNormalized] =
      (concertCountByArtist[c.headlinerNormalized] ?? 0) + 1;
  }
  const scoredFindings = score(findings, { artistsMetadata, artistsTopTracks, concertCountByArtist }, today);
  console.log(`   ${scoredFindings.length}/${findings.length} findings pass threshold (≥20)`);

  if (options.analyzeOnly) {
    console.log("\n✅ --analyze-only: stopping after scoring.\n");
    console.log("Top 10 findings:");
    for (const f of scoredFindings.slice(0, 10)) {
      console.log(`  [${f.score}/60] [${f.category}] ${f.headline}`);
    }
    return;
  }

  // ── Stage 3: Select candidates ───────────────────────────────────────────
  console.log("\n🎯 Stage 3: Selecting candidates...");
  const dedupeSource = options.force ? [] : existingPosts;
  const maxPosts = options.seed ? SEED_POST_COUNT : undefined;
  const selected = select(scoredFindings, dedupeSource, maxPosts);
  console.log(`   Selected ${selected.length} candidate${selected.length !== 1 ? "s" : ""}:`);
  for (const f of selected) {
    console.log(`   • [${f.score}/60] [${f.category}] ${f.headline}`);
  }

  if (selected.length === 0) {
    console.log("\n⚠️  No candidates selected — nothing to publish this run.");
    return;
  }

  if (options.dryRun) {
    console.log("\n✅ --dry-run: stopping before prose generation. No files written.\n");
    return;
  }

  // ── Stage 4: Generate prose ──────────────────────────────────────────────
  console.log("\n✍️  Stage 4: Generating prose...");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required for prose generation.");
  }
  const withProse = await generate(selected, { artistsMetadata, artistsTopTracks });
  const proseCount = withProse.filter((f) => f.prose).length;
  console.log(`   Prose generated for ${proseCount}/${selected.length} findings`);

  // ── Stage 5: Build posts ─────────────────────────────────────────────────
  console.log("\n🏗️  Stage 5: Building posts...");
  const publishedAt = new Date().toISOString();
  const newPosts = buildPosts(withProse, {
    artistsMetadata,
    artistsTopTracks,
    venuesMetadata,
    existingPosts,
    publishedAt,
  });
  console.log(`   Built ${newPosts.length} post${newPosts.length !== 1 ? "s" : ""}`);

  if (newPosts.length === 0) {
    console.log("\n⚠️  No posts built (prose may have failed validation). Nothing written.");
    return;
  }

  // ── Stage 6: Merge and write ─────────────────────────────────────────────
  console.log("\n💾 Stage 6: Writing liner-notes.json...");
  const allPosts = mergePosts(newPosts, existingPosts);
  const totalGenerated = (existingData?.metadata.totalGenerated ?? 0) + selected.length;
  const averageScore =
    allPosts.reduce((sum, p) => sum + p.score, 0) / allPosts.length;

  const output: LinerNotesData = {
    generatedAt: publishedAt,
    dataHash,
    posts: allPosts,
    metadata: {
      totalPosts: allPosts.length,
      totalGenerated,
      averageScore: Math.round(averageScore * 10) / 10,
      lastPipelineRun: publishedAt,
      concertsAnalyzed: stats.concertsAnalyzed,
      feedUrl: "/liner-notes.xml",
    },
  };

  writeFileSync(LINER_NOTES_PATH, JSON.stringify(output, null, 2));
  console.log(`   ✓ Written: public/data/liner-notes.json (${allPosts.length} total posts)`);

  // ── Stage 7: RSS feed ────────────────────────────────────────────────────
  try {
    console.log("\n📡 Stage 7: Generating RSS feed...");
    const { generateRss } = await import("./rss.ts");
    generateRss(allPosts);
    console.log("   ✓ Written: public/liner-notes.xml");
  } catch (err) {
    console.warn("   ⚠️  RSS generation skipped:", (err as Error).message);
  }

  // ── Stage 8: OG images ───────────────────────────────────────────────────
  try {
    console.log("\n🖼️  Stage 8: Generating OG images...");
    const { generateOgImages } = await import("./og-image.ts");
    await generateOgImages(newPosts);
    console.log(`   ✓ Generated OG images for ${newPosts.length} new post${newPosts.length !== 1 ? "s" : ""}`);
  } catch (err) {
    console.warn("   ⚠️  OG image generation skipped:", (err as Error).message);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log("\n✨ Pipeline complete!");
  for (const post of newPosts) {
    console.log(`   • ${post.slug} [${post.score}/60]`);
  }
  console.log();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadExistingData(): LinerNotesData | null {
  if (!existsSync(LINER_NOTES_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LINER_NOTES_PATH, "utf8")) as LinerNotesData;
  } catch {
    console.warn("⚠️  Could not parse existing liner-notes.json — starting fresh.");
    return null;
  }
}

/**
 * Merge new posts into existing, newest first, deduplicating by id.
 */
function mergePosts(
  newPosts: LinerNotesPost[],
  existingPosts: LinerNotesPost[]
): LinerNotesPost[] {
  const byId = new Map<string, LinerNotesPost>();
  // Existing first (lower priority), then new (higher priority — overwrites)
  for (const p of existingPosts) byId.set(p.id, p);
  for (const p of newPosts) byId.set(p.id, p);
  return [...byId.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
