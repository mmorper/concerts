/**
 * Automated voice checks for generated prose.
 *
 * `.claude/skills/liner-notes-voice/SKILL.md` has carried a "Validation
 * Checklist" since v4.4 and nothing ever ran it — every check was a human
 * reading output and remembering to look. Two defects reached generated prose
 * during v5.4 (#272): an invented distance ("two miles from where they grew
 * up") and a negative field rendered as its absolute value ("four years into
 * their existence" from careerYear: -4).
 *
 * This module is that checklist as code. It runs after generation and before
 * anything is written, so a bad post is caught in the run that produced it.
 *
 * ── SEVERITY ────────────────────────────────────────────────────────────────
 * `error`   — never publish. Banned phrases, perishable claims, critical
 *             verdicts: things the voice rules forbid outright.
 * `warning` — worth a human glance. Structural drift, or a distinctive number
 *             with no visible source, where a false positive is likely enough
 *             that failing the run would be worse than flagging it.
 *
 * Deliberately NOT a general number-provenance checker. Small integers appear
 * everywhere in this data, so matching them proves nothing; only distinctive
 * values (>= 10, and 4-digit years) are checked, and unit conversions are
 * allowed because "17 years" from monthsAway: 209 is correct prose.
 */

import type { ScoredFinding } from "./types.ts";

export type VoiceIssueSeverity = "error" | "warning";

export interface VoiceIssue {
  severity: VoiceIssueSeverity;
  rule: string;
  detail: string;
}

/** Anti-Patterns table in the voice skill. */
const BANNED_PHRASES: Array<[RegExp, string]> = [
  [/\bjourney\b/i, '"journey" — vague, overused'],
  [/\btapestry\b/i, '"tapestry" — vague, overused'],
  [/\blegendary\b/i, '"legendary" without evidence — empty superlative'],
  [/it goes without saying/i, '"it goes without saying" — filler'],
  [/a diverse range of/i, '"a diverse range of" — filler'],
  [/^over the years/i, '"over the years" as an opener — weak opening'],
];

/**
 * Perishable claims (voice skill §"Perishable claims", v5.4).
 *
 * These are true until the day they aren't, and a post is permalinked and
 * never revisited. The Roots and Blondie are both active bands sitting in the
 * data with no album after their last show.
 */
const PERISHABLE: Array<[RegExp, string]> = [
  [/never (?:made|released|recorded) another/i, '"never made another record" — perishable'],
  [/\btheir last (?:album|record)\b/i, '"their last album" — perishable unless pinned to a year'],
  [/\bnothing since\b/i, '"nothing since" — perishable'],
  [/that was the end of them/i, '"that was the end of them" — perishable'],
  [/\bfinal album\b/i, '"final album" — perishable'],
];

/**
 * Critical verdicts the corpus cannot support (voice skill §"The
 * defining-album citation"). Enduring popularity is evidence about the
 * listener; "masterpiece" is a judgment about the record.
 */
const VERDICTS: Array<[RegExp, string]> = [
  [/\bmasterpiece\b/i, '"masterpiece" — critical verdict, unsupported'],
  [/\b(?:their|the) (?:greatest|finest|best) (?:album|record|work)\b/i, "critical verdict — unsupported"],
  [/\bmost important (?:album|record)\b/i, "critical verdict — unsupported"],
  [/one of the greatest/i, '"one of the greatest" — unsupported comparison'],
];

/** Tier 3: chart positions and sales figures, unchanged since v4.4. */
const TIER_THREE: Array<[RegExp, string]> = [
  [/\b(?:debuted|peaked|charted) at #?\d+/i, "chart position — Tier 3"],
  [/#\d+\s+on the (?:billboard|charts?)/i, "chart position — Tier 3"],
  [/\b\d[\d.,]*\s*(?:million|thousand|k)\s+(?:copies|records|albums|units)\b/i, "sales figure — Tier 3"],
  [/\bwent (?:gold|platinum|multi-platinum)\b/i, "sales certification — Tier 3"],
];

/** Units that legitimately appear as conversions of a stored value. */
const CONVERSIONS: Array<(n: number) => number[]> = [
  (n) => [n],
  (n) => [n * 12, Math.round(n * 12)], // years -> months
  (n) => [n / 12, Math.round(n / 12)], // months -> years
  (n) => [Math.round(n * 30.44)], // months -> days
  (n) => [Math.round(n / 30.44)], // days -> months
  (n) => [Math.round(n / 365.25)], // days -> years
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/** Every number reachable in a finding's data points, plus its dates' parts. */
function numbersInData(finding: ScoredFinding): Set<number> {
  const found = new Set<number>();

  const walk = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) {
      found.add(Math.abs(value));
      found.add(Math.abs(Math.round(value)));
      return;
    }
    if (typeof value === "string") {
      // Dates carry year/month/day that prose legitimately quotes.
      for (const part of value.match(/\d+/g) ?? []) found.add(Number(part));
      return;
    }
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") return Object.values(value).forEach(walk);
  };

  walk(finding.dataPoints);
  finding.years?.forEach((y) => found.add(y));

  // Anything derivable from a stored value by a unit change is fair prose.
  for (const n of [...found]) {
    for (const convert of CONVERSIONS) {
      for (const candidate of convert(n)) {
        if (Number.isFinite(candidate) && candidate > 0) found.add(Math.round(candidate));
      }
    }
  }

  return found;
}

/** Distinctive numbers only: small integers are ambient in this corpus. */
function distinctiveNumbers(prose: string): number[] {
  const out: number[] = [];
  for (const match of prose.match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? []) {
    const n = Number(match.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 10) out.push(Math.round(n));
  }
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (n >= 10 && new RegExp(`\\b${word}\\b`, "i").test(prose)) out.push(n);
  }
  return [...new Set(out)];
}

export function checkVoice(finding: ScoredFinding): VoiceIssue[] {
  const prose = (finding.prose ?? "").trim();
  const issues: VoiceIssue[] = [];
  if (!prose) return [{ severity: "error", rule: "empty", detail: "no prose generated" }];

  const push = (severity: VoiceIssueSeverity, rule: string, detail: string) =>
    issues.push({ severity, rule, detail });

  for (const [re, detail] of BANNED_PHRASES) if (re.test(prose)) push("error", "banned-phrase", detail);
  for (const [re, detail] of PERISHABLE) if (re.test(prose)) push("error", "perishable-claim", detail);
  for (const [re, detail] of VERDICTS) if (re.test(prose)) push("error", "critical-verdict", detail);
  for (const [re, detail] of TIER_THREE) if (re.test(prose)) push("error", "tier-3", detail);

  if (!/\b(I|my|me)\b/.test(prose)) push("error", "person", "not written in first person");

  const sentences = prose.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1);
  if (sentences.length < 2 || sentences.length > 5) {
    push("warning", "length", `${sentences.length} sentences (want 2–5)`);
  }

  const words = prose.split(/\s+/).filter(Boolean).length;
  if (words < 40 || words > 500) push("warning", "length", `${words} words (want 40–500)`);

  if (!/\d/.test(prose) && !Object.keys(WORD_NUMBERS).some((w) => new RegExp(`\\b${w}\\b`, "i").test(prose))) {
    push("warning", "specificity", "no number in the post");
  }

  // Distinctive numbers with no visible source. Warning, not error: prose
  // legitimately converts units, and a false positive should not fail a run.
  const known = numbersInData(finding);
  const unsourced = distinctiveNumbers(prose).filter((n) => !known.has(n));
  if (unsourced.length) {
    push("warning", "unsourced-number", `${unsourced.join(", ")} not traceable to a data point`);
  }

  return issues;
}

export function formatVoiceIssues(finding: ScoredFinding, issues: VoiceIssue[]): string {
  const lines = [`   ${finding.headline}`];
  for (const i of issues) {
    lines.push(`     ${i.severity === "error" ? "✗" : "⚠"} [${i.rule}] ${i.detail}`);
  }
  return lines.join("\n");
}
