/**
 * Five model IDs in five files, agreeing only by coincidence.
 *
 * Every Claude call in the repo moved to `claude-sonnet-5` in #500 and #502.
 * Nothing ties the five constants together, and nothing ties ask-chat's price
 * table to the model it prices — so the failure mode is not a broken build, it
 * is SILENT OVERSPEND.
 *
 * That is not hypothetical. During #502 the model was changed and `RATE` was
 * left on Haiku's $1/$5, which would have let the $25/month cap authorise about
 * $50 of real spend while still calling itself $25. It was caught by a test
 * asserting arithmetic, and only because the author happened to re-read it —
 * `cost.test.ts` checks that 1000 input tokens cost 2000 microUSD, which stays
 * true no matter which model is configured.
 *
 * This closes that gap from the other side: the model each surface names, and
 * the price the cap is enforced against, must agree or the build fails.
 *
 * Deliberately reads the files as TEXT rather than importing them. The root
 * suite excludes `workers/**` and each Worker is its own package with its own
 * tsconfig, so an import would cross a workspace boundary; a regex over source
 * crosses nothing and works for scripts and Workers alike.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Every surface that names a Claude model, and the constant it uses.
 *
 * ADDING A SURFACE: add it here. A new Claude call site that is not in this list
 * is exactly the drift this test exists to catch, and the test cannot see what
 * it is not told about — so the list is the contract, and it is short on purpose.
 */
const MODEL_SITES = [
  { file: "scripts/generate-narrations.ts", constant: "MODEL" },
  { file: "scripts/liner-notes/generate.ts", constant: "MODEL" },
  { file: "scripts/liner-notes/social.ts", constant: "MODEL" },
  { file: "workers/ask-chat/src/agent-loop.ts", constant: "ANTHROPIC_MODEL" },
  { file: "workers/mcp-server/src/tools.ts", constant: "ANTHROPIC_MODEL" },
] as const;

/**
 * microUSD per token, by model. $1/MTok == exactly 1 microUSD/token, so these
 * are the published per-MTok dollar prices unchanged.
 *
 * Cache rates are DERIVED but STORED FLAT in cost.ts (5-minute cache write is
 * 1.25 × input, cache read is 0.1 × input), which is the trap: someone updating
 * `input` and `output` correctly can still leave the cache rates behind, and on
 * a surface whose system prompt is cached every turn the cache classes dominate.
 *
 * A model absent from this table fails the test rather than passing silently —
 * changing the model should force a deliberate look at what it costs.
 */
const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function modelIn(file: string, constant: string): string {
  const m = read(file).match(new RegExp(`const\\s+${constant}\\s*=\\s*["']([^"']+)["']`));
  if (!m) throw new Error(`no \`const ${constant} = "..."\` in ${file}`);
  return m[1];
}

function rateIn(field: string): number {
  const m = read("workers/ask-chat/src/cost.ts").match(
    new RegExp(`\\b${field}:\\s*([0-9.]+)`)
  );
  if (!m) throw new Error(`no \`${field}:\` in cost.ts RATE`);
  return Number(m[1]);
}

describe("model drift", () => {
  it("every surface names the same model", () => {
    const found = MODEL_SITES.map((s) => ({ ...s, model: modelIn(s.file, s.constant) }));
    const distinct = [...new Set(found.map((f) => f.model))];
    expect(
      distinct.length,
      `Claude surfaces disagree:\n${found.map((f) => `  ${f.model}  ${f.file}`).join("\n")}`
    ).toBe(1);
  });

  it("names a model this repo knows the price of", () => {
    const model = modelIn(MODEL_SITES[0].file, MODEL_SITES[0].constant);
    expect(
      PRICING[model],
      `${model} has no entry in PRICING. Look up its per-MTok rates and add one — ` +
        `the $25/month cap is enforced in dollars, so an unpriced model is an unenforced cap.`
    ).toBeDefined();
  });

  /**
   * The one that would have caught #502's near-miss. `cost.test.ts` asserts the
   * arithmetic and passes under any model; this asserts the table matches the
   * model actually configured.
   */
  it("ask-chat prices the model it actually calls", () => {
    const model = modelIn("workers/ask-chat/src/agent-loop.ts", "ANTHROPIC_MODEL");
    const want = PRICING[model];
    expect(want, `${model} is not in PRICING`).toBeDefined();

    for (const field of ["input", "output", "cacheWrite", "cacheRead"] as const) {
      expect(
        rateIn(field),
        `cost.ts RATE.${field} does not match ${model}. The $25/month cap is enforced ` +
          `against RATE — if the model moved and this did not, the counter under-reports ` +
          `and the cap allows more than it names.`
      ).toBe(want[field]);
    }
  });

  /** Derived, stored flat — the half that got missed the first time. */
  it("keeps the cache rates consistent with the input rate", () => {
    expect(rateIn("cacheWrite")).toBeCloseTo(rateIn("input") * 1.25, 10);
    expect(rateIn("cacheRead")).toBeCloseTo(rateIn("input") * 0.1, 10);
  });
});
