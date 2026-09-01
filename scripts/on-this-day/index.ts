#!/usr/bin/env tsx
/**
 * On This Day — CLI (#333).
 *
 * Usage:
 *   npm run generate:on-this-day                    # today
 *   npm run generate:on-this-day -- --date 2026-06-04
 *   npm run generate:on-this-day -- --dry-run       # no API calls, no files
 *   npm run generate:on-this-day -- --survey        # a year of supply, no writes
 *   npm run generate:on-this-day -- --force         # regenerate an existing day
 *
 * Runs daily. Most days produce nothing, and that is correct — 145 of 366
 * calendar days carry a show, and only the ones scoring above the threshold
 * publish. The spec is explicit that widening the window to manufacture a
 * daily cadence turns the account into a content mill.
 *
 * Requires ANTHROPIC_API_KEY, except for --dry-run and --survey.
 */

import { config } from "dotenv";
config({ override: true });

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { generateSocial } from "../liner-notes/social.ts";
import { checkSocial, formatSocialIssues } from "../liner-notes/voice-check.ts";
import { buildPost, type BuildSources } from "./build.ts";
import { renderCard } from "./card.ts";
import { candidateForDay, isPublishable, PUBLISH_THRESHOLD } from "./detect.ts";
import type { OnThisDayData, OnThisDayPost } from "./types.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesData } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "public", "data");
const STORE = join(DATA_DIR, "on-this-day.json");

/** How far back to look when deciding an artist was "posted recently". */
const REPEAT_WINDOW = 20;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
function value(n: string): string | undefined {
  const i = args.indexOf(`--${n}`);
  if (i === -1) return undefined;
  const next = args[i + 1];
  if (next === undefined || next.startsWith("--")) throw new Error(`--${n} requires a value`);
  return next;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
}

function loadStore(): OnThisDayData {
  if (!existsSync(STORE)) return { generatedAt: new Date(0).toISOString(), posts: [] };
  return JSON.parse(readFileSync(STORE, "utf8")) as OnThisDayData;
}

/**
 * Dates a setlist exists for, so a `?show=` link never opens an empty panel.
 * Missing cache degrades to "no setlists", which costs specificity and never
 * correctness — the same trade the liner-notes pipeline makes.
 */
function loadSetlistDates(): Set<string> {
  const path = join(DATA_DIR, "setlists-cache.json");
  if (!existsSync(path)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    return new Set(Object.keys(raw).map((k) => k.split("::")[0]));
  } catch {
    return new Set();
  }
}

function sources(): BuildSources {
  return {
    artistsMetadata: readJson("artists-metadata.json"),
    venuesMetadata: readJson("venues-metadata.json"),
    linerNotes: readJson<LinerNotesData>("liner-notes.json").posts,
    datesWithSetlists: loadSetlistDates(),
  };
}

/** A year of supply at a glance — how the threshold gets re-checked. */
function survey(concerts: Concert[], from: Date): void {
  let hit = 0, publishable = 0, deferred = 0, below = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    const c = candidateForDay(concerts, d);
    if (!c) continue;
    hit++;
    if (c.deferred) deferred++;
    else if (isPublishable(c)) publishable++;
    else below++;
  }
  console.log(`📅 Next 365 days from ${from.toISOString().slice(0, 10)}\n`);
  console.log(`   days with a hit:   ${hit}`);
  console.log(`   publishable:       ${publishable}  (${(publishable / 52).toFixed(1)}/week)`);
  console.log(`   deferred:          ${deferred}  (multi-show — needs tier-3 artwork)`);
  console.log(`   below threshold:   ${below}  (< ${PUBLISH_THRESHOLD})\n`);
}

async function main(): Promise<void> {
  const dryRun = flag("dry-run");
  const force = flag("force");
  const dateArg = value("date");
  const today = dateArg ? new Date(`${dateArg}T12:00:00Z`) : new Date();
  if (Number.isNaN(today.getTime())) throw new Error(`--date must be YYYY-MM-DD, got "${dateArg}"`);

  const concerts = readJson<{ concerts: Concert[] }>("concerts.json").concerts;

  if (flag("survey")) return survey(concerts, today);

  console.log("📅 On This Day\n");
  if (dryRun) console.log("   Mode: dry-run (no API calls, no files written)");
  console.log(`   Date: ${today.toISOString().slice(0, 10)}\n`);

  const store = loadStore();
  const slugsAlready = new Set(store.posts.map((p) => p.slug));

  // The last N posts decide whether an artist is too fresh to repeat.
  const recentArtists = new Set(
    [...store.posts]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, REPEAT_WINDOW)
      .map((p) => p.artistNormalized)
  );

  const candidate = candidateForDay(concerts, today, { recentArtists });
  if (!candidate) {
    console.log("📭 Nothing happened on this day. That is the normal case.\n");
    return;
  }

  console.log(
    `   ${candidate.shows.length} show${candidate.shows.length === 1 ? "" : "s"}, score ${candidate.score}:`
  );
  for (const r of candidate.reasons) console.log(`     · ${r.detail} (+${Math.round(r.points)})`);

  if (candidate.deferred) {
    console.log(`\n⏭  Deferred: ${candidate.deferred}\n`);
    return;
  }
  if (!isPublishable(candidate)) {
    console.log(`\n⏭  Below threshold (${candidate.score} < ${PUBLISH_THRESHOLD}) — not worth a post.\n`);
    return;
  }

  const built = buildPost(candidate, sources());
  if (built.ineligible) {
    console.log(`\n⏭  ${built.ineligible}\n`);
    return;
  }
  if (slugsAlready.has(built.post.slug) && !force) {
    console.log(`\n✓ ${built.post.slug} already generated. Use --force to regenerate.\n`);
    return;
  }

  console.log(`\n   → ${built.post.artist} · ${built.post.age} years · ${built.post.venue}`);
  console.log(`     ${built.post.linerNoteSlug ? `cross-linked to liner note ${built.post.linerNoteSlug}` : built.post.url}`);

  if (dryRun) {
    console.log("\n✅ --dry-run: stopping before the card and the API call.\n");
    return;
  }

  // ── Card ───────────────────────────────────────────────────────────────
  const card = await renderCard(
    built.post.slug,
    {
      date: built.post.showDate,
      age: built.post.age,
      artist: built.post.artist,
      venue: built.post.venue,
      city: built.post.city,
      imageUrl: built.post.imageUrl,
    },
    { force }
  );

  // A card composited on a solid ground is bare type, which the rubric
  // forbids. The image resolved but could not be fetched — so this day does
  // not publish rather than publishing badly.
  if (card.usedFallback) {
    console.log(`\n⏭  Image could not be fetched — card would be bare type. Not publishing.\n`);
    return;
  }

  // ── Social copy ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required.");

  const authored = await generateSocial([
    {
      // No `prose` — On This Day has none, and buildPrompt takes the
      // anniversary branch rather than being handed fabricated prose to
      // summarise. The voice rules are identical either way.
      post: {
        slug: built.post.slug,
        headline: `${built.post.age} years ago today: ${built.post.artist} at ${built.post.venue}`,
        category: "personal",
        // The whole stream IS a count to today — "37 years ago today" is the
        // premise, and it is published on the one day it is true. Evergreen
        // copy gets the opposite rule; see `perishableCounts`.
        temporality: "timely",
      },
      context: {
        artists: [built.post.artist],
        venue: built.post.venue,
        city: built.post.city,
        date: built.post.showDate,
        years: [Number(built.post.showDate.slice(0, 4))],
      },
    },
  ]);

  const social = authored.get(built.post.slug);
  if (!social) {
    console.log("\n⚠️  Social copy failed. Not publishing.\n");
    return;
  }
  const issues = checkSocial({
    ...social,
    headline: `${built.post.age} years ago today: ${built.post.artist} at ${built.post.venue}`,
    // No prose behind an On This Day post, so `derived-copy` has nothing to
    // compare against and correctly never fires.
    temporality: "timely",
    years: [Number(built.post.showDate.slice(0, 4))],
    entities: [built.post.artist, built.post.venue, built.post.city],
  });
  if (issues.length) console.log(formatSocialIssues(built.post.slug, issues));
  if (issues.some((i) => i.severity === "error")) {
    console.log("\n⚠️  Social copy failed voice checks. Not publishing.\n");
    return;
  }

  // ── Write ──────────────────────────────────────────────────────────────
  const post: OnThisDayPost = {
    ...built.post,
    cardPath: card.path,
    social,
    publishedAt: new Date().toISOString(),
  };

  store.posts = [post, ...store.posts.filter((p) => p.slug !== post.slug)];
  store.generatedAt = new Date().toISOString();
  writeFileSync(STORE, JSON.stringify(store, null, 2) + "\n");

  console.log(`\n✨ ${post.slug} written. ${store.posts.length} On This Day posts total.\n`);
}

main().catch((err) => {
  console.error("\n❌ On This Day failed:", (err as Error).message ?? err);
  process.exit(1);
});
