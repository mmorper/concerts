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
 *   npm run generate:narrations -- --rehash            # accept today's text as current, no spend
 *
 * 🔴 `--force` DISCARDS HAND CORRECTIONS. Narrations are fact-checked and corrected in the JSON
 * (the 2026-11 audit changed 84 fields). `--rehash` is the way to change the inputs or the
 * prompt without losing them: it records the new hashes and leaves the text alone. Only use it
 * when the text has been checked against the new inputs.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildArtistInputs,
  buildVenueInputs,
  type Entity,
  type EntityInput,
  type NarrationAliases,
  type NarrationConcert,
  type NarrationVenueMeta,
} from "./narrations/inputs.ts";

// Load .env so `npm run generate:narrations` picks up ANTHROPIC_API_KEY locally
// (matches the other scripts). In CI the key comes from the workflow's env block.
config();

// Thinking OFF. Sonnet 5 runs adaptive thinking by default and its tokens come out
// of `max_tokens`; on a 400-token budget that leaves nothing for the answer. Measured
// on the sibling social-copy prompt: 699 of 700 tokens spent thinking, no answer.
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 400;
const PROMPT_VERSION = 3; // bump to force a full regen after a prompt rewrite

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

// ---------- args ----------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const REHASH = args.includes("--rehash");
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

const today = new Date().toISOString().slice(0, 10);

function readConcerts(): NarrationConcert[] {
  return readJson<{ concerts: NarrationConcert[] }>(join(DATA_DIR, "concerts.json")).concerts;
}

function buildVenues(): Entity[] {
  const venues = readJson<Record<string, NarrationVenueMeta>>(join(DATA_DIR, "venues-metadata.json"));
  return buildVenueInputs(venues, readConcerts(), today);
}

function buildArtists(): Entity[] {
  const aliases = readJson<NarrationAliases>(join(DATA_DIR, "artist-aliases.json"));
  return buildArtistInputs(readConcerts(), aliases, today);
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
    thinking: { type: "disabled" },
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

  if (REHASH) {
    const out: NarrationFile = { ...existing };
    let stamped = 0;
    for (const e of entities) {
      const record = out[e.slug];
      if (!record) continue;
      out[e.slug] = { ...record, inputHash: hashInput(e.input), promptVersion: PROMPT_VERSION };
      stamped++;
    }
    if (!DRY_RUN) {
      writeFileSync(join(NARRATIONS_DIR, `${kind}.json`), JSON.stringify(out, null, 2) + "\n", "utf-8");
    }
    console.log(`[${kind}] rehashed ${stamped} of ${entities.length} entities, text unchanged`);
    return;
  }

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
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN && !REHASH) {
    throw new Error("ANTHROPIC_API_KEY is required (or pass --dry-run).");
  }
  PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "unused" });

  for (const kind of KINDS) {
    await runKind(kind);
  }

  if (!DRY_RUN && tokensIn + tokensOut > 0) {
    // Sonnet 5: $2/MTok in, $10/MTok out.
    const cost = (tokensIn / 1e6) * 2 + (tokensOut / 1e6) * 10;
    console.log(
      `\nTokens: ${tokensIn} in / ${tokensOut} out — ~$${cost.toFixed(4)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
