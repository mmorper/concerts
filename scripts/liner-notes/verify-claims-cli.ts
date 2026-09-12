/**
 * CLI for the claim verifier (#529).
 *
 * `--dump-prompts <dir>` is the load-bearing mode: it writes the exact system
 * and user prompt for every post, with NO network call, so calibration can run
 * through Claude Code subagents on the owner's Max plan instead of spending API
 * money — see #529's "Testing without API spend" comment. `--check` runs the
 * real API call for anyone who wants to see live output for a slug or two.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

import { buildFactSheet, loadOwnerFacts, type FactSheetSources } from "./fact-sheet.ts";
import { buildVerifyPrompt, verifyClaims, formatClaimIssues, type CopyFields } from "./verify-claims.ts";
import { buildSetlistIndex } from "./setlists.ts";
import { buildAliasMap, EMPTY_ALIAS_MAP } from "./artist-aliases.ts";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesData, LinerNotesPost } from "../../src/types/liner-notes.ts";
import type { OnThisDayData, OnThisDayPost } from "../on-this-day/types.ts";
import type { AlbumErasSlim } from "./analyze.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "public", "data");

const args = process.argv.slice(2);
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function argValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

interface Subject {
  slug: string;
  subjects: { artists: string[]; venues: string[] };
  copy: CopyFields;
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

function loadSubjects(): Subject[] {
  const linerNotes = readJson<LinerNotesData | undefined>(join(DATA_DIR, "liner-notes.json"), undefined);
  const onThisDay = readJson<OnThisDayData | undefined>(join(DATA_DIR, "on-this-day.json"), undefined);

  const fromLinerNotes: Subject[] = (linerNotes?.posts ?? []).map((p: LinerNotesPost) => ({
    slug: p.slug,
    subjects: { artists: p.artists, venues: p.venues },
    copy: {
      headline: p.headline,
      prose: p.prose,
      hook: p.social?.hook,
      caption: p.social?.caption,
      beats: p.social?.beats,
    },
  }));

  const fromOnThisDay: Subject[] = (onThisDay?.posts ?? []).map((p: OnThisDayPost) => ({
    slug: p.slug,
    subjects: { artists: [p.artistNormalized], venues: [p.venueNormalized] },
    copy: { hook: p.social?.hook, caption: p.social?.caption },
  }));

  return [...fromLinerNotes, ...fromOnThisDay];
}

function loadSources(today?: string): FactSheetSources {
  const concerts: Concert[] = readJson<{ concerts: Concert[] }>(join(DATA_DIR, "concerts.json"), { concerts: [] }).concerts;
  const venuesMetadata = readJson(join(DATA_DIR, "venues-metadata.json"), {});
  const artistsMetadata = readJson(join(DATA_DIR, "artists-metadata.json"), {});
  const aliasesPath = join(ROOT, "data", "artist-aliases.json");
  const aliases = existsSync(aliasesPath) ? buildAliasMap(JSON.parse(readFileSync(aliasesPath, "utf8"))) : EMPTY_ALIAS_MAP;
  const ownerFactsPath = join(ROOT, "data", "owner-facts.json");
  const ownerFacts = existsSync(ownerFactsPath)
    ? loadOwnerFacts(JSON.parse(readFileSync(ownerFactsPath, "utf8")))
    : undefined;
  const albumEras = readJson<AlbumErasSlim | undefined>(join(DATA_DIR, "album-eras.json"), undefined);
  const setlistsRaw = readJson(join(DATA_DIR, "setlists-cache.json"), undefined);
  const setlists = setlistsRaw ? buildSetlistIndex(setlistsRaw) : undefined;

  return { concerts, venuesMetadata, artistsMetadata, aliases, albumEras, setlists, ownerFacts, today };
}

async function main(): Promise<void> {
  const dumpDir = argValue("dump-prompts");
  const limit = argValue("limit") ? Number(argValue("limit")) : undefined;
  const onlySlug = argValue("slug");
  const today = argValue("today");
  const doCheck = flag("check");

  const sources = loadSources(today);
  let subjects = loadSubjects();
  if (onlySlug) subjects = subjects.filter((s) => s.slug === onlySlug);
  if (limit) subjects = subjects.slice(0, limit);

  if (!subjects.length) {
    console.log("No posts found — run the liner notes / on this day pipelines first.");
    return;
  }

  if (dumpDir) {
    mkdirSync(dumpDir, { recursive: true });
    for (const s of subjects) {
      const factSheet = buildFactSheet(s.subjects, sources);
      const prompt = buildVerifyPrompt(factSheet, s.copy);
      writeFileSync(join(dumpDir, `${s.slug}.system.txt`), prompt.system);
      writeFileSync(join(dumpDir, `${s.slug}.user.txt`), prompt.user);
    }
    console.log(`📝 Dumped ${subjects.length} prompt pair(s) to ${dumpDir} — no API calls made.`);
    return;
  }

  if (doCheck) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required for --check (use --dump-prompts to inspect without spending).");
    }
    const client = new Anthropic().messages;
    for (const s of subjects) {
      const factSheet = buildFactSheet(s.subjects, sources);
      const issues = await verifyClaims(factSheet, s.copy, client);
      console.log(issues.length ? formatClaimIssues(s.slug, issues) : `   ${s.slug}: no issues`);
    }
    return;
  }

  console.log("Nothing to do. Pass --dump-prompts <dir> or --check.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
