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

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { analyze, type AlbumErasSlim, type SongAlbumsSlim } from "./analyze.ts";
import { checkVoice, formatVoiceIssues } from "./voice-check.ts";
import { score } from "./score.ts";
import { select, buildPosts, fetchSubjectTracks, POSTS_PER_RUN } from "./curate.ts";
import type { ImageSources } from "./image-refs.ts";
import { iTunesClient } from "../utils/itunes-client.ts";
import { refreshPostImages } from "./refresh-images.ts";
import { generate } from "./generate.ts";
import { generateSocial, type SocialContext } from "./social.ts";
import { checkSocial, formatSocialIssues } from "./voice-check.ts";
import { resolveAnchorConcert } from "../syndication/payload.ts";
import { buildSetlistIndex, type SetlistIndex } from "./setlists.ts";
import { buildAliasMap, EMPTY_ALIAS_MAP, type AliasMap } from "./artist-aliases.ts";
import type { PipelineOptions, ScoredFinding } from "./types.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesData, LinerNotesPost } from "../../src/types/liner-notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "public", "data");
const LINER_NOTES_PATH = join(DATA_DIR, "liner-notes.json");

/** Posts published in `--seed` mode. Normal runs publish POSTS_PER_RUN. */
const SEED_POST_COUNT = 10;

/**
 * Generate prose for ranked candidates until `target` posts have valid prose.
 *
 * Before #231 the pipeline generated prose for every selected finding and then
 * discarded all but one in a post-prose filter — 2–3 Claude API calls per
 * published post. Selection now decides the winner before any prose is written,
 * so this walks the ranked list and stops as soon as it has enough. The reserve
 * candidates below the target exist only so one failed validation doesn't cost
 * the whole run; in the normal case they are never touched.
 *
 * `generateOne` is injected so the loop is testable without an API key.
 * It resolves to `undefined`, or to a finding without `prose`, when generation
 * or validation fails — `generate()` catches per-finding failures rather than
 * throwing.
 */
export async function generateUpTo(
  candidates: ScoredFinding[],
  target: number,
  generateOne: (candidate: ScoredFinding) => Promise<ScoredFinding | undefined>
): Promise<{ withProse: ScoredFinding[]; attempted: number }> {
  const withProse: ScoredFinding[] = [];
  let attempted = 0;

  for (const candidate of candidates) {
    if (withProse.length >= target) break;
    attempted++;
    const result = await generateOne(candidate);
    if (result?.prose) {
      withProse.push(result);
    } else {
      console.warn(`   ⚠️  Prose failed for "${candidate.headline}" — falling through to reserve`);
    }
  }

  return { withProse, attempted };
}

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
  const setlists = loadSetlistIndex();
  const aliases = loadAliasMap();
  // Optional (#270). Absent -> the discography detectors return [], album art
  // falls back to iTunes, and every other detector is byte-identical.
  const albumEras = loadAlbumEras();
  /* The archive's own photography (#340). Optional by design: it covers 3 of 184 shows
     today, so absent or sparse is the normal case and every post it cannot serve falls
     back exactly as before. */
  const mediaIndex = loadMediaIndex();
  const songAlbums = loadSongAlbums();
  const discographyKeys = loadDiscographyKeys();
  const albumTrackCounts = loadAlbumTrackCounts();
  // Same source, two uses: the detectors join against it, and buildDeepLinks
  // uses the dates to decide whether a ?show= link would open an empty panel.
  const datesWithSetlists = new Set([...setlists.keys()].map((k) => k.split("::")[0]));

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
  const { findings, stats } = analyze(concerts, today, {
    venuesMetadata,
    artistsMetadata,
    setlists,
    aliases,
    eras: albumEras,
    songAlbums,
    discographyKeys,
    albumTrackCounts,
  });
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
  const scoredFindings = score(findings, { artistsMetadata, artistsTopTracks, concertCountByArtist, albumEras }, today);
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
  console.log("\n🎯 Stage 3: Selecting candidates (detector rotation)...");
  // `--force` skips the rerun cooldown but must NOT hide publication history:
  // rotation reads it to decide which detector is stalest (#231).
  const target = options.seed ? SEED_POST_COUNT : POSTS_PER_RUN;
  const selected = select(scoredFindings, existingPosts, {
    maxPosts: target,
    force: options.force,
    today,
  });
  console.log(`   Publishing ${target}, with ${Math.max(0, selected.length - target)} in reserve:`);
  selected.forEach((f, i) => {
    const role = i < target ? "→" : "  reserve:";
    console.log(`   ${role} [${f.score}/60] [${f.category}] ${f.detector} — ${f.headline}`);
  });

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
  const { withProse, attempted } = await generateUpTo(selected, target, async (candidate) => {
    const [result] = await generate([candidate], { artistsMetadata, artistsTopTracks });
    return result;
  });
  console.log(`   Prose generated for ${withProse.length}/${target} (${attempted} API call${attempted !== 1 ? "s" : ""})`);

  // ── Stage 4b: Voice checks ───────────────────────────────────────────────
  //
  // The voice skill has carried a validation checklist since v4.4 and nothing
  // ever ran it. Two defects reached generated prose during v5.4 — an invented
  // distance, and a negative field rendered as its absolute value — both of
  // which a human had already read past. Errors block the run; warnings print.
  const clean: typeof withProse = [];
  let voiceErrors = 0;
  for (const candidate of withProse) {
    const issues = checkVoice(candidate);
    if (issues.length) console.log(formatVoiceIssues(candidate, issues));
    if (issues.some((i) => i.severity === "error")) {
      voiceErrors++;
      continue; // Drop it rather than publish it. Reserve candidates remain.
    }
    clean.push(candidate);
  }
  if (voiceErrors > 0) {
    console.log(`   ⚠️  ${voiceErrors} post(s) failed voice checks and were dropped`);
  }
  if (clean.length === 0) {
    console.log("\n⚠️  Nothing passed voice checks — nothing to publish this run.");
    return;
  }

  // ── Stage 5: Build posts ─────────────────────────────────────────────────
  //
  // Subject songs are fetched first, for the posts that are about one. It runs
  // here rather than inside buildPosts so the build stays synchronous and every
  // fallback tier is testable without a network (#299). A failure is not fatal:
  // an empty map means every post falls back to a labelled best-known track.
  console.log("\n🏗️  Stage 5: Building posts...");
  const subjectTracks = await fetchSubjectTracks(clean, artistsMetadata, new iTunesClient());

  const publishedAt = new Date().toISOString();
  const newPosts = buildPosts(clean, {
    artistsMetadata,
    mediaIndex,
    artistsTopTracks,
    venuesMetadata,
    albumEras,
    datesWithSetlists,
    existingPosts,
    publishedAt,
    subjectTracks,
  });
  console.log(`   Built ${newPosts.length} post${newPosts.length !== 1 ? "s" : ""}`);

  // Stage 5b — the post-prose "pick one, discard the rest" filter — is gone.
  // It was a depth-1 detector cooldown ("don't repeat the previous detector")
  // applied after the API calls had already been paid for. Rotation generalizes
  // it into the selection stage with a memory longer than a single post (#231).

  // ── Stage 5b: Author the social payload ──────────────────────────────────
  //
  // Authored, never derived (#329). This is a separate API call from prose
  // generation so that a social failure costs a tweet, not a liner note: the
  // post is written, validated and published either way, and simply is not
  // eligible to syndicate without it.
  //
  // It runs on the built posts rather than the findings because the credit
  // stack the hook must NOT repeat is resolved off the post — the same
  // resolution the payload builder uses, so the hook is written against
  // exactly the furniture the card will render.
  console.log("\n📣 Stage 5b: Authoring social payloads...");
  try {
    const requests = newPosts.map((post) => {
      const concert = resolveAnchorConcert(post, concerts);
      const context: SocialContext = {
        artists: post.artists.map((slug) => artistsMetadata[slug]?.name ?? slug),
        venue: concert ? (venuesMetadata[concert.venueNormalized]?.name ?? concert.venue) : "",
        city: concert?.city ?? "",
        date: concert?.date ?? "",
        song: post.audio?.role === "subject" ? post.audio.trackName : undefined,
        // The years the detector says this post is about — see knownYears().
        knownYears: post.years ?? [],
      };
      return { post, context };
    });

    const authored = await generateSocial(requests);
    let socialErrors = 0;
    for (const post of newPosts) {
      const social = authored.get(post.slug);
      if (!social) continue;
      // A venue-subject post is held to the venue rule here too — the weekly run
      // and the backfill must not be able to publish to different standards.
      const context = requests.find((r) => r.post.slug === post.slug)?.context;
      const issues = checkSocial({
        ...social,
        headline: post.headline,
        sourceText: [
          post.prose ?? "",
          post.headline,
          context?.date ?? "",
          ...(context?.artists ?? []),
          context?.venue ?? "",
          ...(context?.knownYears ?? []).map(String),
        ].join(" "),
        ...(context?.subject === "venue"
          ? { venue: { name: context.venue, city: context.city } }
          : {}),
      });
      if (issues.length) console.log(formatSocialIssues(post.slug, issues));
      // Errors drop the social text, never the post. The note publishes; the
      // syndication payload is simply not eligible, which the run loop reports.
      if (issues.some((i) => i.severity === "error")) {
        socialErrors++;
        continue;
      }
      post.social = social;
    }
    const attached = newPosts.filter((p) => p.social).length;
    console.log(
      `   ✓ ${attached}/${newPosts.length} post${newPosts.length !== 1 ? "s" : ""} carry social text` +
        (socialErrors ? ` (${socialErrors} failed voice checks)` : "")
    );
  } catch (err) {
    // Never fail the run over social text — same posture as image refresh.
    console.warn("   ⚠️  Social authoring skipped:", (err as Error).message);
  }

  // ── Stage 5c: Refresh images ─────────────────────────────────────────────
  // Deliberately ahead of the no-new-posts early return: published posts hold
  // third-party image URLs that can be revoked at any time, and that rot is
  // independent of whether this week produced content. Skipping it on a quiet
  // week is exactly how a post stays broken indefinitely (#252).
  const allPosts = mergePosts(newPosts, existingPosts);

  console.log("\n🖼️  Stage 5c: Refreshing post images...");
  let refreshedSlugs: string[] = [];
  // Backfilling a `ref` mutates a post without changing its URL, so it must
  // count toward "something changed" or the write below would discard it.
  let refreshMutated = false;
  try {
    const refresh = await refreshPostImages(
      allPosts,
      { artistsMetadata, artistsTopTracks, venuesMetadata, albumEras, mediaIndex },
      { validate: true, verbose: true }
    );
    refreshedSlugs = refresh.changedSlugs;
    refreshMutated = refresh.backfilled > 0 || refresh.changedSlugs.length > 0;
    // `changedSlugs` already carries every upgrade, so `refreshMutated` covers them.
    console.log(
      `   ✓ ${refresh.posts} post${refresh.posts !== 1 ? "s" : ""} checked — ` +
        `${refresh.upgraded} upgraded to our own photography, ` +
        `${refresh.backfilled} ref backfilled, ${refresh.reresolved} re-resolved, ` +
        `${refresh.repaired} repaired, ${refresh.fellBack} to placeholder`
    );
    for (const dead of refresh.deadUrls) {
      console.warn(`   ⚠️  Dead image URL — ${dead}`);
    }
    for (const slug of refresh.mismatched) {
      console.error(`   ❌ ${slug}: byline does not match the photograph — see #441`);
    }
  } catch (err) {
    // Never fail the run over image refresh; posts are still publishable.
    console.warn("   ⚠️  Image refresh skipped:", (err as Error).message);
  }

  if (newPosts.length === 0 && !refreshMutated) {
    console.log("\n⚠️  No posts built and no image changes. Nothing written.");
    return;
  }
  if (newPosts.length === 0) {
    console.log("\n📝 No new posts, but the image refresh made changes — writing.");
  }

  // ── Stage 6: Merge and write ─────────────────────────────────────────────
  console.log("\n💾 Stage 6: Writing liner-notes.json...");
  // Counts prose generations actually performed, not candidates ranked — the
  // reserve is usually never touched, so `selected.length` would overstate it.
  const totalGenerated = (existingData?.metadata.totalGenerated ?? 0) + attempted;
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
  // New posts plus any whose image changed in Stage 5c — an OG card composited
  // from a since-revoked photo is stale in exactly the same way the post was.
  try {
    console.log("\n🖼️  Stage 8: Generating OG images...");
    const { generateOgImages } = await import("./og-image.ts");
    const changed = new Set(refreshedSlugs);
    const newSlugs = new Set(newPosts.map((p) => p.slug));
    const ogTargets = [
      ...newPosts,
      ...allPosts.filter((p) => changed.has(p.slug) && !newSlugs.has(p.slug)),
    ];
    // `changed` must be passed as `force`: cards are skipped when a PNG already
    // exists, so a repaired post — which by definition already has one — would
    // otherwise be silently ignored.
    const og = await generateOgImages(ogTargets, { force: changed });
    console.log(
      `   ✓ Generated OG images for ${ogTargets.length} post${ogTargets.length !== 1 ? "s" : ""}` +
        ` (${newPosts.length} new, ${ogTargets.length - newPosts.length} refreshed)`
    );

    // A card whose image could not be fetched is type on a solid ground —
    // bare type, which the imagery rubric forbids. The card is still written,
    // because for the site's own og:image a plain card beats a broken one, but
    // syndication has to refuse it. Nothing downstream can work this out for
    // itself: buildPayload classifies tier and source from the image URL,
    // which still looks perfectly good, and only checks the file exists.
    //
    // Recorded after the Stage 6 write, so the file is rewritten when it
    // changes. Rare enough that the second write is not worth avoiding.
    const fellBack = new Set(og.fellBack);
    const renderedOk = new Set(og.rendered);
    let flagsChanged = false;
    for (const post of allPosts) {
      const wasFlagged = post.image.cardFallback === true;
      if (fellBack.has(post.slug) && !wasFlagged) {
        post.image.cardFallback = true;
        flagsChanged = true;
      } else if (renderedOk.has(post.slug) && wasFlagged) {
        delete post.image.cardFallback;
        flagsChanged = true;
      }
    }
    if (og.fellBack.length) {
      console.warn(
        `   ⚠️  ${og.fellBack.length} card(s) fell back to a solid ground and will not syndicate: ${og.fellBack.join(", ")}`
      );
    }
    if (flagsChanged) {
      output.posts = allPosts;
      writeFileSync(LINER_NOTES_PATH, JSON.stringify(output, null, 2));
      console.log("   ✓ Re-written with card-fallback flags");
    }
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

/**
 * Setlist index for the detectors and the deep-link gate. Missing or unreadable
 * cache degrades to an empty index: every detector then behaves exactly as it
 * did before #229 and simply carries no song detail, and no `?show=` link is
 * emitted — rather than emitting links we can't stand behind.
 */
/**
 * Hand-maintained artist billing aliases (#227). A missing file means every
 * billing is treated as its own act — exactly the behaviour before the map.
 */
/**
 * album-eras.json (#270). Missing is a supported state, not an error: the three
 * discography detectors return [] and album art falls back to iTunes, so the
 * pipeline produces exactly its pre-v5.4 output.
 */
/**
 * `media-index.json` — the archive's own photography.
 *
 * Degrades the same way loadAlbumEras does, and for a stronger reason: this covers 3 of 184
 * shows today. Missing or unreadable must mean "no show photographs available", never a
 * failed run — every post it cannot serve falls back to the artist or venue image exactly
 * as it did before this existed.
 */
function loadMediaIndex(): ImageSources["mediaIndex"] {
  const path = join(DATA_DIR, "media-index.json");
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ImageSources["mediaIndex"];
    const n = parsed?.assets?.filter((a) => a.kind === "image" && a.url).length ?? 0;
    console.log(`   📸 media-index: ${n} published still${n === 1 ? "" : "s"} available to posts`);
    return parsed;
  } catch (err) {
    console.warn(`   ⚠️  Could not read media-index.json (${(err as Error).message})`);
    return undefined;
  }
}

function loadAlbumEras(): AlbumErasSlim | undefined {
  const path = join(DATA_DIR, "album-eras.json");
  if (!existsSync(path)) {
    console.warn("   ⚠️  album-eras.json missing — discography detectors will find nothing");
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AlbumErasSlim;
  } catch (err) {
    console.warn(`   ⚠️  Could not read album-eras.json (${(err as Error).message})`);
    return undefined;
  }
}

/**
 * Absent means `road-tested` returns [] and every other detector is untouched —
 * the same degradation loadAlbumEras uses.
 */
function loadSongAlbums(): SongAlbumsSlim | undefined {
  const path = join(DATA_DIR, "song-albums.json");
  if (!existsSync(path)) {
    console.warn("   ⚠️  song-albums.json missing — road-tested will find nothing");
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SongAlbumsSlim;
  } catch (err) {
    console.warn(`   ⚠️  Could not read song-albums.json (${(err as Error).message})`);
    return undefined;
  }
}

/**
 * Hop 2 for the song-albums lookup. Reads the SAME file loadAliasMap does, but
 * a different relation — `canonicalOf` returns the concert-side slug, which is
 * deliberately not the discography key.
 */
function loadDiscographyKeys(): Array<{ act: string; discographyKey: string }> | undefined {
  const path = join(ROOT, "data", "artist-aliases.json");
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      discographyKeys?: Array<{ act: string; discographyKey: string }>;
    };
    return raw.discographyKeys;
  } catch {
    return undefined;
  }
}

/**
 * album mbid → track count, from the MusicBrainz track cache the resolver
 * builds. Optional by design: absent means `most-witnessed-album` reports a
 * null track count and prose must not claim a fraction. This is the only
 * detector input that comes from `data/cache/` rather than `public/data/`,
 * because the count is not published anywhere else.
 */
function loadAlbumTrackCounts(): Record<string, number> | undefined {
  const path = join(ROOT, "data", "cache", "musicbrainz-tracks.json");
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      entries?: Record<string, { tracks?: string[] }>;
    };
    const counts: Record<string, number> = {};
    for (const [mbid, entry] of Object.entries(raw.entries ?? {})) {
      if (Array.isArray(entry?.tracks)) counts[mbid] = entry.tracks.length;
    }
    return counts;
  } catch {
    return undefined;
  }
}

function loadAliasMap(): AliasMap {
  const path = join(ROOT, "data", "artist-aliases.json");
  if (!existsSync(path)) {
    console.warn("   ⚠️  data/artist-aliases.json missing — billings will not be collapsed");
    return EMPTY_ALIAS_MAP;
  }
  try {
    return buildAliasMap(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    console.warn(`   ⚠️  Could not read artist-aliases.json (${(err as Error).message})`);
    return EMPTY_ALIAS_MAP;
  }
}

function loadSetlistIndex(): SetlistIndex {
  const path = join(DATA_DIR, "setlists-cache.json");
  if (!existsSync(path)) {
    console.warn("   ⚠️  setlists-cache.json missing — song joins and setlist links disabled this run");
    return new Map();
  }
  try {
    return buildSetlistIndex(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    console.warn(`   ⚠️  Could not read setlists-cache.json (${(err as Error).message}) — song joins disabled`);
    return new Map();
  }
}

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
