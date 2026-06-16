/**
 * Build-time narration generator for the MCP server's hybrid tools.
 *
 * Authors the `context` + `closingArc` prose that `get_artist_history` and
 * `get_venue_history` read from `public/data/narrations/{artists,venues}.json`.
 * Haiku runs at BUILD time only — the MCP Worker stays a static-file reader.
 *
 * Hash-based regen (Addendum 2026-05-17 §"Hash-based regeneration"): each entity's
 * structural facts + PROMPT_VERSION hash to a fingerprint; only entities whose hash
 * changed are regenerated. Steady state is a $0 no-op.
 *
 * Not wired into `build-data` — run on its own so the default pipeline stays
 * Anthropic-free. Requires ANTHROPIC_API_KEY.
 *
 *   npm run generate:narrations -- --dry-run           # report what would regen, no spend
 *   npm run generate:narrations -- --kind=venues       # one kind only
 *   npm run generate:narrations -- --limit=5           # cap entities (cost control)
 *   npm run generate:narrations -- --force             # regen everything (or bump PROMPT_VERSION)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 400;
const PROMPT_VERSION = 1; // bump to force a full regen after a prompt rewrite

const DATA_DIR = join(process.cwd(), "public", "data");
const NARRATIONS_DIR = join(DATA_DIR, "narrations");
const PROMPT_PATH = join(process.cwd(), "scripts", "narrations", "prompt.md");

type Kind = "venues" | "artists";

interface Narration {
  context: string;
  closingArc: string;
}
interface NarrationRecord {
  narration: Narration;
  inputHash: string;
  generatedAt: string;
  promptVersion: number;
}
type NarrationFile = Record<string, NarrationRecord>;

// Hash-input shapes — exactly what we send to the model, so prose and hash never drift.
type EntityInput = Record<string, unknown>;
interface Entity {
  slug: string;
  input: EntityInput;
}

// ---------- args ----------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const kindArg = args.find((a) => a.startsWith("--kind="));
const KINDS: Kind[] = kindArg
  ? [kindArg.split("=")[1] as Kind]
  : ["venues", "artists"];

// ---------- io ----------

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}
function readNarrations(kind: Kind): NarrationFile {
  const path = join(NARRATIONS_DIR, `${kind}.json`);
  return existsSync(path) ? readJson<NarrationFile>(path) : {};
}
function hashInput(input: EntityInput): string {
  const canonical = JSON.stringify(input) + `|v${PROMPT_VERSION}`;
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

// ---------- entity builders ----------

interface VenueMeta {
  name: string;
  cityState: string;
  status?: string;
  closedDate?: string;
  notes?: string;
  stats?: {
    totalConcerts?: number;
    firstEvent?: string;
    lastEvent?: string;
    uniqueArtists?: number;
  };
  concerts?: { headliner: string; date: string }[];
}

function topN(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

// Venue hash inputs (spec): name, cityState, status, closedDate, notes, stats.*,
// top-3 headliners from concerts[].
function buildVenues(): Entity[] {
  const venues = readJson<Record<string, VenueMeta>>(join(DATA_DIR, "venues-metadata.json"));
  return Object.entries(venues).map(([slug, v]) => {
    const headliners = new Map<string, number>();
    for (const c of v.concerts ?? []) headliners.set(c.headliner, (headliners.get(c.headliner) ?? 0) + 1);
    const sorted = [...(v.concerts ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    return {
      slug,
      input: {
        name: v.name,
        cityState: v.cityState,
        status: v.status ?? null,
        closedDate: v.closedDate ?? null,
        notes: v.notes ?? null,
        totalConcerts: v.stats?.totalConcerts ?? (v.concerts?.length ?? 0),
        firstEvent: v.stats?.firstEvent ?? null,
        firstHeadliner: sorted[0]?.headliner ?? null,
        lastEvent: v.stats?.lastEvent ?? null,
        lastHeadliner: sorted[sorted.length - 1]?.headliner ?? null,
        uniqueArtists: v.stats?.uniqueArtists ?? null,
        topHeadliners: topN(headliners, 3),
      },
    };
  });
}

interface Concert {
  headliner: string;
  headlinerNormalized: string;
  venue: string;
  year: number;
  date: string;
}

// Artist hash inputs (spec): name, concert count, dateRange first–last, top venue +
// count, top year.
function buildArtists(): Entity[] {
  const { concerts } = readJson<{ concerts: Concert[] }>(join(DATA_DIR, "concerts.json"));
  const byArtist = new Map<string, Concert[]>();
  for (const c of concerts) {
    const list = byArtist.get(c.headlinerNormalized) ?? [];
    list.push(c);
    byArtist.set(c.headlinerNormalized, list);
  }
  return [...byArtist.entries()].map(([slug, shows]) => {
    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    const venueCounts = new Map<string, number>();
    const yearCounts = new Map<string, number>();
    for (const s of shows) {
      venueCounts.set(s.venue, (venueCounts.get(s.venue) ?? 0) + 1);
      yearCounts.set(String(s.year), (yearCounts.get(String(s.year)) ?? 0) + 1);
    }
    const topVenue = topN(venueCounts, 1)[0];
    return {
      slug,
      input: {
        name: shows[0].headliner,
        count: shows.length,
        firstYear: sorted[0].year,
        firstVenue: sorted[0].venue,
        lastYear: sorted[sorted.length - 1].year,
        lastVenue: sorted[sorted.length - 1].venue,
        topVenue,
        topVenueCount: venueCounts.get(topVenue) ?? 0,
        topYear: Number(topN(yearCounts, 1)[0]),
      },
    };
  });
}

// ---------- generation ----------

let PROMPT = "";
let client: Anthropic;
let tokensIn = 0;
let tokensOut = 0;

async function generate(kind: Kind, entity: Entity): Promise<Narration> {
  const noun = kind === "venues" ? "venue" : "artist";
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: PROMPT,
    tools: [
      {
        name: "record_narration",
        description: "Record the two-part narration for this entity.",
        input_schema: {
          type: "object",
          properties: {
            context: { type: "string", description: "Opening context line (1–2 sentences)." },
            closingArc: { type: "string", description: "Closing reflection (1 sentence)." },
          },
          required: ["context", "closingArc"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_narration" },
    messages: [
      {
        role: "user",
        content: `Write the narration for this ${noun}, using only these facts:\n\n${JSON.stringify(entity.input, null, 2)}`,
      },
    ],
  });
  tokensIn += resp.usage.input_tokens;
  tokensOut += resp.usage.output_tokens;

  const block = resp.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!block) throw new Error(`No tool_use block for ${kind}/${entity.slug}`);
  const { context, closingArc } = block.input as Narration;
  return { context, closingArc };
}

async function runKind(kind: Kind): Promise<void> {
  const entities = kind === "venues" ? buildVenues() : buildArtists();
  const existing = readNarrations(kind);

  const stale = entities.filter((e) => {
    const hash = hashInput(e.input);
    return FORCE || existing[e.slug]?.inputHash !== hash;
  });

  console.log(`[${kind}] ${entities.length} entities, ${stale.length} need regeneration`);
  if (DRY_RUN) {
    stale.slice(0, 20).forEach((e) => console.log(`  would regen: ${e.slug}`));
    if (stale.length > 20) console.log(`  …and ${stale.length - 20} more`);
    return;
  }

  const todo = stale.slice(0, LIMIT);
  if (todo.length < stale.length) {
    console.log(`[${kind}] --limit=${LIMIT}: generating ${todo.length} of ${stale.length} this run`);
  }

  const out: NarrationFile = { ...existing };
  let done = 0;
  for (const entity of todo) {
    const narration = await generate(kind, entity);
    out[entity.slug] = {
      narration,
      inputHash: hashInput(entity.input),
      generatedAt: new Date().toISOString(),
      promptVersion: PROMPT_VERSION,
    };
    done++;
    if (done % 25 === 0 || done === todo.length) {
      console.log(`  [${kind}] ${done}/${todo.length}`);
    }
  }

  writeFileSync(
    join(NARRATIONS_DIR, `${kind}.json`),
    JSON.stringify(out, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[${kind}] wrote ${Object.keys(out).length} records (${done} regenerated)`);
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN) {
    throw new Error("ANTHROPIC_API_KEY is required (or pass --dry-run).");
  }
  PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  client = new Anthropic();

  for (const kind of KINDS) {
    await runKind(kind);
  }

  if (!DRY_RUN && tokensIn + tokensOut > 0) {
    // Haiku 4.5: $1/MTok in, $5/MTok out (verified 2026-06-16).
    const cost = (tokensIn / 1e6) * 1 + (tokensOut / 1e6) * 5;
    console.log(
      `\nTokens: ${tokensIn} in / ${tokensOut} out — ~$${cost.toFixed(4)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
