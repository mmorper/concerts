/**
 * Automatic claim check (#529).
 *
 * Nothing in the pipeline verified what copy CLAIMS, only how it is worded.
 * `voice-check.ts` catches banned phrases, budgets and a handful of specific
 * fabrication shapes (an invented year, a lifted sentence); it cannot catch a
 * wrong count, a wrong "first/last/only", or a claim the setlists contradict.
 * The 2026-09-10 sweep found 180 false claims in 47 of 55 published notes —
 * see #526, #527, #528 for the fixes and this issue for the mechanism that
 * stops the next one from shipping.
 *
 * One Claude call per post: the deterministic fact sheet (`fact-sheet.ts`) plus
 * every copy field. It returns issues, never rewritten copy — "block and
 * report, never rewrite at post time" is the posture, and it holds at
 * authoring time too: a rewrite the verifier itself wrote would need its own
 * verifier.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ClaimKind =
  | "contradicted"
  | "invented-number"
  | "stale-relative-time"
  | "external"
  | "personal-invented"
  | "internal";

export type ClaimSeverity = "must-fix" | "review";

export interface ClaimIssue {
  /** "headline" | "prose" | "hook" | "caption" | "beat 1" | ... */
  field: string;
  /** The exact sentence (or clause) the issue is about. */
  sentence: string;
  kind: ClaimKind;
  severity: ClaimSeverity;
  /** Why — what the fact sheet says, or why the claim cannot be confirmed. */
  evidence: string;
  /** A true replacement, in the same field, voice and budget. Absent when there isn't a clean one. */
  replacement?: string;
}

export interface CopyFields {
  headline?: string;
  prose?: string;
  hook?: string;
  caption?: string;
  beats?: string[];
}

/* Sonnet 5, adaptive thinking at effort "medium" — decided in #529. The errors
   worth catching are arithmetic (day gaps, month counts, 17 vs 18 years), which
   is exactly what thinking buys; effort "medium" is the calibrated middle
   between catching those and the per-call cost (~$0.05-0.09; ~$4-7/mo at the
   measured ~80 calls). Keep in sync with any future switch decision in #529. */
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16000;

const SYSTEM_PROMPT = `You are a fact-checker for a personal concert archive spanning 1984 to present. You are given a FACT SHEET — everything the archive's own data can support about the artists and venues a piece of copy is about — and the COPY itself: a headline, prose, and/or social text (hook, caption, beats) about one post.

Check every sentence in every field. Flag a sentence if it is one of:

1. **contradicted** — the fact sheet says otherwise: dates, days of week, counts ("hundreds"), durations ("three years after", "six weeks"), order words ("first", "last", "only", "never again", "started", "closed it out"), places ("never left California"), who headlined or opened, venue names and cities, album timing. Scope matters: "it started in 1988" must hold for the WHOLE archive unless the sentence clearly limits it to something narrower.
2. **invented-number** — a stated age, or any number with no basis in the fact sheet. The fact sheet gives no birth year, so any stated age is invented.
3. **stale-relative-time** — "last year", "this year", "recently" that is wrong as of TODAY (given in the fact sheet). For an anniversary post, "N years ago today" is relative to its own anniversary date, not to today.
4. **external** — charts, sales, "commercial peak", "was everywhere", formation years or release dates not in the fact sheet. Chart and sales claims are banned outright regardless of truth. For anything else external, say whether it is true and how confident you are in the evidence field.
5. **personal-invented** — a concrete personal fact the fact sheet cannot know, stated as fact ("I drove to…", "I counted the stubs", an age, a residence) — UNLESS it appears in the fact sheet's OWNER-CONFIRMED PERSONAL FACTS section, in which case it is true and must not be flagged. Do not flag feelings or impressions ("I felt like a teenager again") — only concrete facts stated as fact.
6. **internal** — contradicts another field of the same post (e.g. the hook and a beat give different counts for the same thing).

SEVERITY — decide per issue, not per kind:
- **must-fix**: every contradicted, invented-number, stale-relative-time and internal issue; any chart or sales claim; and any external claim you are CONFIDENT is false.
- **review**: an external claim you cannot confirm either way, and personal-invented claims not covered by OWNER-CONFIRMED PERSONAL FACTS.

Do NOT flag feelings, metaphor, voice or style. A false positive costs as much as a miss — a check that blocks true sentences gets switched off, and the whole point of this check is that it stays on. When in doubt whether a sentence contradicts the fact sheet, only flag it if you can name the specific fact sheet line it disagrees with — that line is what "evidence" must quote or point at.

Replacements, when you offer one: true against the fact sheet, in the same field and voice, within the same length the field already used, and — if a "prose" field is present in the copy — using no run of 8 or more consecutive words shared with it.

OUTPUT
Return ONLY a JSON array, no prose around it, no code fence. One object per issue:
[{"field": "...", "sentence": "...", "kind": "...", "severity": "...", "evidence": "...", "replacement": "..." }]
Return [] if the copy has no issues. "replacement" is optional — omit it rather than guess at one you are not confident in.`;

export interface VerifyPrompt {
  system: string;
  user: string;
}

function fieldBlocks(copy: CopyFields): string {
  const lines: string[] = [];
  if (copy.headline) lines.push(`Headline: ${copy.headline}`);
  if (copy.prose) lines.push(`Prose: ${copy.prose}`);
  if (copy.hook) lines.push(`Hook: ${copy.hook}`);
  if (copy.caption) lines.push(`Caption: ${copy.caption}`);
  if (copy.beats?.length) copy.beats.forEach((b, i) => lines.push(`Beat ${i + 1}: ${b}`));
  return lines.join("\n");
}

/**
 * Pure and side-effect-free so it can run without an API key — `--dump-prompts`
 * writes exactly what this returns, and calibration checks the dumped prompt
 * against a Claude Code subagent instead of the API (#529, "Testing without
 * API spend").
 */
export function buildVerifyPrompt(factSheet: string, copy: CopyFields): VerifyPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: `FACT SHEET\n${factSheet}\n\nCOPY TO CHECK\n${fieldBlocks(copy)}\n\nReturn the JSON array now.`,
  };
}

/** Models fence JSON even when told not to; unfencing is cheaper than a retry. */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

const CLAIM_KINDS = new Set<ClaimKind>([
  "contradicted",
  "invented-number",
  "stale-relative-time",
  "external",
  "personal-invented",
  "internal",
]);
const CLAIM_SEVERITIES = new Set<ClaimSeverity>(["must-fix", "review"]);

/**
 * Parses the verifier's JSON array. Throws on anything that is not a JSON
 * array of well-formed issues — ambiguity means stop, the same posture as the
 * kill switch. A caller that gets an exception here should skip the post this
 * run, never publish it unchecked and never guess at what a garbled response meant.
 */
export function parseVerifierResponse(text: string): ClaimIssue[] {
  const parsed: unknown = JSON.parse(stripFence(text));
  if (!Array.isArray(parsed)) throw new Error("verifier response was not a JSON array");

  return parsed.map((raw, i) => {
    const issue = raw as Partial<ClaimIssue>;
    if (
      typeof issue.field !== "string" ||
      typeof issue.sentence !== "string" ||
      typeof issue.evidence !== "string" ||
      !CLAIM_KINDS.has(issue.kind as ClaimKind) ||
      !CLAIM_SEVERITIES.has(issue.severity as ClaimSeverity)
    ) {
      throw new Error(`verifier response issue ${i} is malformed: ${JSON.stringify(raw)}`);
    }
    return {
      field: issue.field,
      sentence: issue.sentence,
      kind: issue.kind as ClaimKind,
      severity: issue.severity as ClaimSeverity,
      evidence: issue.evidence,
      ...(typeof issue.replacement === "string" && issue.replacement ? { replacement: issue.replacement } : {}),
    };
  });
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("API response contained no text block");
  return block.text.trim();
}

/**
 * One verification call. Throws on any failure — a bad API response, a
 * malformed JSON body — so the caller can apply "ambiguity means stop": skip
 * this post rather than publish it with an unknown verdict.
 */
export async function verifyClaims(
  factSheet: string,
  copy: CopyFields,
  client: Pick<Anthropic["messages"], "create">
): Promise<ClaimIssue[]> {
  const prompt = buildVerifyPrompt(factSheet, copy);
  const message = await client.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt.user }],
  });
  return parseVerifierResponse(extractText(message));
}

/** True when at least one issue is severe enough to block publication. */
export function hasMustFix(issues: ClaimIssue[]): boolean {
  return issues.some((i) => i.severity === "must-fix");
}

/** One line per issue, in the style of `formatSocialIssues`/`formatVoiceIssues`. */
export function formatClaimIssues(label: string, issues: ClaimIssue[]): string {
  const lines = [`   ${label}`];
  for (const i of issues) {
    lines.push(
      `     ${i.severity === "must-fix" ? "✗" : "⚠"} [${i.kind}] ${i.field}: "${i.sentence}" — ${i.evidence}`
    );
  }
  return lines.join("\n");
}

export { SYSTEM_PROMPT as VERIFY_CLAIMS_SYSTEM_PROMPT };
