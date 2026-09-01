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

import { HOOK_MAX, BEATS_MIN, BEATS_MAX, CAPTION_MAX } from "../syndication/budgets.ts";
import { graphemeLength } from "../syndication/text.ts";
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

/**
 * v6.0 §5e — the fabrication this feature makes newly available.
 *
 * road-tested knows ONE thing: the album we attribute the song to came out
 * after the night. It does NOT know the song was unwritten, unreleased or
 * unheard. Garbage's "No Horses" was a standalone 2017 single that only reached
 * an album in 2021 — the song existed the night it was heard. Only the ALBUM
 * was in the future, and the album is the only thing the detector can claim.
 *
 * Errors, not warnings: each of these is a first-person claim about a night the
 * archive owner was in the room, published unreviewed and permalinked.
 */
const SONG_EXISTENCE: Array<[RegExp, string]> = [
  [/before (?:the |that |this )?song (?:existed|was written|was recorded)/i, '"before the song existed" — claim the ALBUM, not the song'],
  [/\bsong (?:did ?n[o']t|had ?n[o']t) (?:exist|been written|been recorded)/i, "claims the song did not exist — only the album was ahead"],
  [/\b(?:un(?:written|released|recorded))\b/i, '"unwritten/unreleased" — unsupported; the song may predate the album'],
  [/\bhad ?n[o']t (?:written|recorded) (?:it|the song)\b/i, "claims the song was unwritten — unsupported"],
  [/\bno[- ]one had heard (?:it|this|the song)\b/i, "claims nobody had heard it — unsupported"],
];

/**
 * v6.0 §5e — road-tested prose is RETROSPECTIVE, never foresight in the moment.
 *
 * "I'd heard it a year before the record came out" is a true sentence written
 * from now. "I knew it would be huge" puts knowledge in the room that nobody
 * had, which is the same fabrication as inventing a biographical detail.
 */
const FORESIGHT: Array<[RegExp, string]> = [
  [/\bI (?:knew|could tell|sensed|had a feeling)\b[^.!?]*\b(?:would|was going to|it'd)\b/i, "foresight in the moment — road-tested prose must be retrospective"],
  [/\bwe (?:all )?knew\b[^.!?]*\b(?:would|was going to)\b/i, "foresight in the moment — retrospective framing only"],
  [/\blittle did (?:I|we) know\b/i, '"little did I know" — narrates the moment as foresight'],
  [/\byou could (?:already )?tell (?:it|they) would\b/i, "foresight in the moment — retrospective framing only"],
];

/**
 * v6.1 — a song is heard, a performance is watched.
 *
 * You listen to a song; you watch a performer. "I watched the same song twice"
 * mismatches the verb to its object, which reads as slightly wrong without a
 * reader being able to say why.
 *
 * Deliberately narrow: it fires only where a watch verb takes a song noun as its
 * DIRECT object. "Watched Sting perform it" and "watched them play the song" are
 * both correct and both pass, because a performer intervenes. Bare "music" is
 * excluded too — "watching music fill an outdoor amphitheatre" is a scene, not a
 * mis-agreement, and it is already published.
 */
const VERB_OBJECT: Array<[RegExp, string]> = [
  [
    /\bwatch(?:ed|ing|es)?\s+(?:the|that|this|a|an|my|his|her|their)?\s*(?:same\s+)?(?:song|track|tune|single)\b/i,
    "a song is heard, not watched — use \"heard\", or name the performer as the object",
  ],
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
  for (const [re, detail] of SONG_EXISTENCE) if (re.test(prose)) push("error", "song-existence", detail);
  for (const [re, detail] of VERB_OBJECT) if (re.test(prose)) push("error", "verb-object", detail);

  // Foresight is only wrong where the narrator is positioned before a release.
  // Elsewhere "I knew they would be back" is ordinary retrospective writing.
  if (finding.detector === "road-tested") {
    for (const [re, detail] of FORESIGHT) if (re.test(prose)) push("error", "foresight", detail);
  }

  // The hallucination vector §5e names first: an album stated where the data
  // holds none. Only checkable for the detectors that carry an album, but those
  // are exactly the ones whose prose is about a record.
  if (finding.detector === "road-tested" || finding.detector === "most-witnessed-album") {
    const album = (finding.dataPoints as Record<string, unknown>)?.albumTitle;
    if (typeof album !== "string" || !album.trim()) {
      push("error", "album-without-attribution", "album prose with no albumTitle in the data");
    }
  }

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

// ── Social payload checks (#329) ─────────────────────────────────────────────
//
// The syndication ratchet, stated once: a note deleted from the site leaves its
// social copies standing on servers we do not control. Every rule the prose
// checks enforce applies here at least as hard, so the banned-phrase,
// perishable-claim, verdict and Tier-3 tables are reused verbatim rather than
// restated — one voice-check failure blocks syndication everywhere by
// construction, which is the whole argument for one canonical payload.
//
// What is added on top is social-specific and structural: the measured budgets
// from DECISIONS.md §2, and the marks that make a post look like it came out of
// a feed tool rather than out of the archive.

/** Rendered as furniture by the adapter, never authored into the copy. */
const SOCIAL_FURNITURE: Array<[RegExp, string]> = [
  [/#\w/, "hashtag in authored copy — tags are generated per channel, not written"],
  [/https?:\/\//i, "URL in authored copy — the adapter appends the link"],
  [/\blink in bio\b/i, '"link in bio" — feed-tool boilerplate'],
  [/\b(?:read|see) more\b/i, '"read more" — feed-tool boilerplate'],
  [
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u,
    "emoji — not the archive's register",
  ],
];

export interface SocialCheckInput {
  hook: string;
  caption: string;
  beats?: string[];
  /** The published note's headline. A hook that restates it is not authored copy. */
  headline?: string;
  /**
   * The published prose the copy is written ALONGSIDE, never out of.
   *
   * Absent for On This Day, which has no note behind it — and correctly so: with
   * nothing to paraphrase there is nothing for `derived-copy` to catch.
   */
  prose?: string;
  /**
   * Names the copy may reuse freely — artists, openers, venues, cities.
   *
   * You cannot paraphrase a band. Without these masked out, a beat listing the
   * bill shares a long run with the prose for reasons that have nothing to do
   * with derivation. See `sharedRun`.
   */
  entities?: string[];
  /** Show years the note covers. A year count must match a real gap between two. */
  years?: number[];
  /** `timely` counts to today by design; `evergreen` must not. See `perishableCounts`. */
  temporality?: string;
}

/**
 * `hook` and `headline` differing only in punctuation and case.
 *
 * DECISIONS.md §11 is the measured version of this: 28 of 57 headlines follow
 * one of five detector templates, so a hook that mirrors its headline inherits
 * the template — and three of them land adjacent in a profile grid, verbatim.
 * The grid is what makes an account read as robotic, and the cause is copy.
 */
function isRestatement(hook: string, headline: string): boolean {
  const flatten = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return flatten(hook) === flatten(headline);
}

/**
 * Eight words of shared PHRASING — measured against the corpus, not chosen.
 *
 * At 8, every one of the 24 flagged fields across the 58 published notes is a
 * genuine lift. At 7 the rule starts catching factual descriptors — "welsh
 * alternative rock band formed in 1981" — which are facts the copy is entitled
 * to restate. The boundary is that sharp precisely because names are masked
 * out first; without masking, 7 and 8 are both full of false positives.
 */
const LIFTED_RUN_MAX = 8;

const wordsOf = (s: string | undefined): string[] => (s ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** Entity words can never open or extend a run. `null` matches nothing, including itself. */
const maskEntities = (words: string[], vocab: Set<string>): Array<string | null> =>
  words.map((w) => (vocab.has(w) ? null : w));

/**
 * The longest run of words a field shares with the prose, names excluded.
 *
 * 🔴 `isRestatement` COMPARES THE HOOK TO THE HEADLINE AND NOTHING ELSE. The
 * prose was never passed to this module, so the one failure it exists to
 * prevent — copy chopped out of the paragraph — was structurally invisible.
 * Measured on the corpus: 24 of 388 fields carry a run of 8+ words, and the
 * Ziggy Marley caption carries 13 ("sits in the archive like a polaroid found
 * in a jacket pocket vivid") against a 90-word single-paragraph note.
 *
 * The derivation also CORRUPTS as it copies, which is why this is an error and
 * not a style note. That note's prose says the night sits there "like a
 * polaroid" — a simile. Beat 2 dropped the "like" and asserted a polaroid in an
 * archive whose image for that post is a TheAudioDB press shot.
 */
function sharedRun(field: Array<string | null>, prose: Array<string | null>): { length: number; text: string } {
  let best = 0;
  let end = 0;
  let prev: number[] = new Array(prose.length + 1).fill(0);
  for (let i = 1; i <= field.length; i++) {
    const cur: number[] = new Array(prose.length + 1).fill(0);
    for (let j = 1; j <= prose.length; j++) {
      if (field[i - 1] !== null && field[i - 1] === prose[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) {
          best = cur[j];
          end = i;
        }
      }
    }
    prev = cur;
  }
  return { length: best, text: field.slice(end - best, end).join(" ") };
}

/** An age never changes. "I was 15 years old" is a fact about 1986, not a countdown. */
const AGE_COUNT = /\b(?:i was|was|turned|aged)\s+\d{1,3}\s+years?\b|\b\d{1,3}\s+years?\s+old\b/i;

const YEAR_COUNT = /\b(\d{1,3})\s+years?\b/g;

/**
 * Year counts that can only have been reached by counting to TODAY.
 *
 * 🔴 EVERY "N YEARS" IN THE rare-sighting NOTES WAS FROZEN AT 2024. Ziggy
 * Marley (1988) claimed 36, Run-D.M.C. (1987) claimed 37, Blancmange and The
 * Alarm (1986) both claimed 38 — all four land on 2024, and it is 2026. Each
 * was true the day it was authored and has been wrong every day since, under
 * the owner's name, on servers we do not control. That is exactly what the
 * PERISHABLE table exists to stop; the table bans phrases, and a bare number
 * needs arithmetic instead.
 *
 * The test is whether the number matches a real gap between two shows the note
 * covers. "35 years between shows" across 1988-2023 measures two events and is
 * permanent. "36 years" on a note holding one 1988 show cannot be anything but
 * a count to now.
 *
 * Run-D.M.C. shows why the mislabelling matters as much as the staleness: the
 * prose said "I let 37 years pass" (show to now, at least the right kind of
 * number) and the caption mutated it into "37 years of concertgoing". The
 * archive spans 1984-2026. Concert-going is 42 years. Same digits, different
 * claim, false either way.
 *
 * `timely` posts are exempt. A calendar anniversary IS the count, it publishes
 * on the day it is true, and On This Day would fail on every post otherwise.
 */
function perishableCounts(text: string, gaps: Set<number>): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(YEAR_COUNT)) {
    const around = text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 6);
    if (AGE_COUNT.test(around)) continue;
    if (!gaps.has(Number(m[1]))) out.push(m[0]);
  }
  return out;
}

export function checkSocial(input: SocialCheckInput): VoiceIssue[] {
  const issues: VoiceIssue[] = [];
  const push = (severity: VoiceIssueSeverity, rule: string, detail: string) =>
    issues.push({ severity, rule, detail });

  const hook = input.hook?.trim() ?? "";
  const caption = input.caption?.trim() ?? "";
  const beats = input.beats?.map((b) => b.trim()).filter(Boolean);

  if (!hook) push("error", "empty", "no hook");
  if (!caption) push("error", "empty", "no caption");

  // Graphemes, not code units. A combining acute is two code units and one
  // character to anyone reading it, and the budgets are stated in what a
  // reader sees.
  const len = graphemeLength;

  if (hook && len(hook) > HOOK_MAX) {
    push("error", "budget", `hook is ${len(hook)} chars (max ${HOOK_MAX})`);
  }
  if (caption && len(caption) > CAPTION_MAX) {
    push("error", "budget", `caption is ${len(caption)} chars (max ${CAPTION_MAX})`);
  }
  if (beats) {
    if (beats.length < BEATS_MIN || beats.length > BEATS_MAX) {
      push("error", "budget", `${beats.length} beats (want ${BEATS_MIN}–${BEATS_MAX})`);
    }
    for (const beat of beats) {
      if (len(beat) > HOOK_MAX) {
        push("error", "budget", `beat is ${len(beat)} chars (max ${HOOK_MAX}): "${beat.slice(0, 40)}…"`);
      }
    }
  }

  const surfaces: Array<[string, string]> = [
    ["hook", hook],
    ["caption", caption],
    ...(beats ?? []).map((b, i) => [`beat ${i + 1}`, b] as [string, string]),
  ];

  for (const [label, text] of surfaces) {
    if (!text) continue;
    for (const [re, detail] of BANNED_PHRASES) if (re.test(text)) push("error", "banned-phrase", `${label}: ${detail}`);
    for (const [re, detail] of PERISHABLE) if (re.test(text)) push("error", "perishable-claim", `${label}: ${detail}`);
    for (const [re, detail] of VERDICTS) if (re.test(text)) push("error", "critical-verdict", `${label}: ${detail}`);
    for (const [re, detail] of TIER_THREE) if (re.test(text)) push("error", "tier-3", `${label}: ${detail}`);
    for (const [re, detail] of SOCIAL_FURNITURE) if (re.test(text)) push("error", "social-furniture", `${label}: ${detail}`);
  }

  if (input.headline && hook && isRestatement(hook, input.headline)) {
    push("error", "derived-copy", "hook restates the headline — authored, never derived");
  }

  // Names, venues, openers, cities and every year the note touches. Reusing a
  // fact is not derivation; reusing the sentence around it is.
  const vocab = new Set([
    ...(input.entities ?? []).flatMap(wordsOf),
    ...wordsOf(input.headline),
    ...(input.years ?? []).map(String),
  ]);
  const prose = maskEntities(wordsOf(input.prose), vocab);
  if (prose.length) {
    for (const [label, text] of surfaces) {
      if (!text) continue;
      const run = sharedRun(maskEntities(wordsOf(text), vocab), prose);
      if (run.length >= LIFTED_RUN_MAX) {
        push(
          "error",
          "derived-copy",
          `${label}: ${run.length} words lifted from the prose — "${run.text}"`
        );
      }
    }
  }

  // An evergreen post promises to stay true. A count to today cannot.
  if (input.temporality !== "timely") {
    const years = input.years ?? [];
    const gaps = new Set(years.flatMap((a) => years.map((b) => Math.abs(a - b))));
    for (const [label, text] of surfaces) {
      if (!text) continue;
      for (const claim of perishableCounts(text, gaps)) {
        push(
          "error",
          "perishable-claim",
          `${label}: "${claim}" matches no gap between shows — it counts to today and ages`
        );
      }
    }
  }

  // The caption travels without the card, so it carries the voice on its own.
  // The hook does not: it sits above a credit stack that supplies the subject,
  // and forcing "I" into 120 characters of display type produces worse copy.
  if (caption && !/\b(I|my|me|I'd|I've)\b/.test(caption)) {
    push("warning", "person", "caption is not written in first person");
  }

  return issues;
}

export function formatSocialIssues(slug: string, issues: VoiceIssue[]): string {
  const lines = [`   ${slug}`];
  for (const i of issues) {
    lines.push(`     ${i.severity === "error" ? "✗" : "⚠"} [${i.rule}] ${i.detail}`);
  }
  return lines.join("\n");
}
