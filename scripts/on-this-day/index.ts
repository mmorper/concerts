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
import { buildPost, narrativeFacts, type BuildSources } from "./build.ts";
import { renderCard } from "./card.ts";
import { calendarDay, candidateForDay, isPublishable, PUBLISH_THRESHOLD } from "./detect.ts";
import { otdSlug, type OnThisDayData, type OnThisDayPost } from "./types.ts";
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
 * The setlist cache, by date and by date::artist.
 *
 * 🔴 THIS READ THE WRONG SHAPE AND NOBODY NOTICED, because its only consumer
 * degrades silently. The file is `{version, generatedAt, entries[]}`, so
 * `Object.keys(raw)` returned exactly three strings — "version", "generatedAt",
 * "entries" — and `datesWithSetlists` has therefore never contained a date. Every
 * On This Day post ever published fell through to the artist deep link, and the
 * `?show=` branch below is dead code that looks alive.
 *
 * 🔴 ONLY EXACT-DATE ENTRIES. #440 established that the matcher used to accept a
 * setlist from a nearby night, and `dateGap` records how far off the survivors
 * are. A post quoting the opening song of a show five days away is a fabricated
 * memory with a citation, so a gap of any size is excluded here rather than
 * rounded away.
 */
interface SetlistCache {
  entries?: Array<{
    date?: string;
    artistName?: string;
    dateGap?: number;
    setlist?: { sets?: { set?: Array<{ song?: Array<{ name?: string }> }> } };
  }>;
}

function loadSetlists(): { dates: Set<string>; byKey: Map<string, { songs: string[] }> } {
  const path = join(DATA_DIR, "setlists-cache.json");
  const dates = new Set<string>();
  const byKey = new Map<string, { songs: string[] }>();
  if (!existsSync(path)) return { dates, byKey };

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as SetlistCache;
    for (const entry of raw.entries ?? []) {
      if (!entry.date || entry.dateGap) continue;
      const songs = (entry.setlist?.sets?.set ?? [])
        .flatMap((s) => s.song ?? [])
        .map((s) => s.name)
        .filter((n): n is string => Boolean(n?.trim()));
      if (!songs.length) continue;
      dates.add(entry.date);
      byKey.set(entry.date, { songs });
      if (entry.artistName) {
        byKey.set(`${entry.date}::${normalizeName(entry.artistName)}`, { songs });
      }
    }
  } catch {
    // A malformed cache costs specificity, never correctness.
  }
  return { dates, byKey };
}

/** The project's normalization, kept local so this module stays dependency-light. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sources(concerts: Concert[]): BuildSources {
  const setlists = loadSetlists();
  return {
    artistsMetadata: readJson("artists-metadata.json"),
    venuesMetadata: readJson("venues-metadata.json"),
    linerNotes: readJson<LinerNotesData>("liner-notes.json").posts,
    concerts,
    setlists: setlists.byKey,
    datesWithSetlists: setlists.dates,
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
  //
  // 🔴 A POST IS NOT TOO SOON AFTER ITSELF. The day being generated is excluded
  // from its own recency window — without it, `--force` on an existing day defers
  // with "New Order was posted recently", meaning the post already there. The
  // rule exists to stop the same act appearing twice in twenty posts; rewriting
  // one in place adds nothing to that count.
  const regeneratingSlug = otdSlug(today.getUTCFullYear(), calendarDay(today));
  const recentArtists = new Set(
    [...store.posts]
      .filter((p) => p.slug !== regeneratingSlug)
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

  const src = sources(concerts);
  const built = buildPost(candidate, src);
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

  const otdHeadline = `${built.post.age} years ago today: ${built.post.artist} at ${built.post.venue}`;
  let facts = narrativeFacts(candidate, src);

  // 🔴 ANNIVERSARY POSTS CONVERGE HARDER THAN LINER NOTES, because every one of
  // them draws from the same short menu of fact shapes. Two consecutive posts
  // both opened "They opened with X and closed with Y" — the most concrete line
  // available, so the model took it twice. Liner notes have carried an avoid-list
  // since the venue posts did the same thing; this stream never got one.
  //
  // Every previous post, not same-detector siblings: there is only one detector
  // here, and the whole stream lands on one profile.
  const avoid = [...store.posts]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-8)
    .filter((p) => p.slug !== built.post.slug && p.social?.hook)
    .flatMap((p) => [p.social!.hook, p.social!.caption].filter(Boolean));

  // 🔴 REMOVE THE TEMPTATION RATHER THAN FORBID IT.
  //
  // The setlist's two ends are the most concrete line on offer, so the model
  // takes them every time. Told in the prompt not to reuse the move, it reused
  // it anyway — three of four posts quoted a song two regenerations running.
  //
  // A fact that is not in the list cannot be reached for. When the post before
  // this one quoted a song, the setlist facts are simply withheld and the copy
  // is written from the gap, the bill, or the room instead. They come back as
  // soon as the previous post did something else.
  const previousQuotedASong = avoid.some((line) => /['"\u2018\u201C][^'"\u2019\u201D]{2,60}['"\u2019\u201D]/.test(line));
  if (previousQuotedASong) {
    const before = facts.length;
    facts = facts.filter((f) => !/opened with "|closed with "|songs on the setlist/.test(f));
    if (facts.length !== before) {
      console.log(`\n   ↩︎  withholding the setlist — the previous post already quoted a song`);
    }
  }
  if (facts.length) {
    console.log(`\n📇 ${facts.length} facts from the archive for this night:`);
    for (const f of facts) console.log(`   • ${f}`);
  }

  const authored = await generateSocial([
    {
      // No `prose` — On This Day has none, and buildPrompt takes the
      // anniversary branch rather than being handed fabricated prose to
      // summarise. The voice rules are identical either way.
      post: {
        slug: built.post.slug,
        headline: otdHeadline,
        category: "personal",
      },
      context: {
        artists: [built.post.artist],
        venue: built.post.venue,
        city: built.post.city,
        date: built.post.showDate,
        // What the archive knows about this night. Without it the model has five
        // fields and an instruction not to invent, so it writes about the filing.
        facts,
        avoid,
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
    headline: otdHeadline,
    // The same year gate the liner-notes paths use. An anniversary post has no
    // prose, so its facts ARE its source text.
    sourceText: [otdHeadline, built.post.showDate, ...facts].join(" "),
    // The anniversary is this post's whole reason to exist; the caption travels
    // without the card that carries it.
    anniversary: { age: built.post.age },
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
