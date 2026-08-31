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
  // "the" is optional, because it was not, and a beat reading "The archive is on
  // the site — link in the bio" sat in the publish queue passing this rule.
  [/\blink in (?:the )?bio\b/i, '"link in bio" — feed-tool boilerplate'],
  [/\b(?:read|see) more\b/i, '"read more" — feed-tool boilerplate'],
  [
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u,
    "emoji — not the archive's register",
  ],
  // ── Writing about the filing instead of the night ──────────────────────────
  //
  // "read more" and "link in bio" were banned above from the start; this is the
  // same move in the archive's own vocabulary, and it walked straight past them.
  // All four pending On This Day posts did it — "now 23 years in the archive",
  // "the full entry is on the site", "it's been in the archive ever since", "the
  // entry still stands" — because an anniversary post had no material and filled
  // the space with the fact that a record exists. A reader did not come for that.
  //
  // The cure is the facts now passed to the prompt; this is the ratchet that
  // stops it coming back.
  [
    /\b(?:in|into|to) (?:the|my|our) (?:archive|log|books)\b/i,
    "\"in the archive\" — the post is about the night, not about it being filed",
  ],
  [
    /\b(?:full|complete) (?:entry|story|write-?up)\b/i,
    "\"the full entry\" — feed-tool boilerplate wearing the archive's vocabulary",
  ],
  [
    /\bthe (?:entry|record|post|log) (?:still )?(?:stands|remains|lives)\b/i,
    "\"the entry still stands\" — writing about the filing, not the night",
  ],
  [
    /\bstill (?:in|on) (?:the|my) (?:archive|log|site|books)\b/i,
    "\"still in the log\" — same filler, different wording",
  ],
  [
    /\bon the site\b/i,
    "\"on the site\" — the adapter appends the link; the copy never points at it",
  ],
];

export interface SocialCheckInput {
  hook: string;
  caption: string;
  beats?: string[];
  /** The published note's headline. A hook that restates it is not authored copy. */
  headline?: string;
  /**
   * Set ONLY when the venue is the post's subject (`VENUE_SUBJECT_DETECTORS`).
   *
   * Absent means "the venue is furniture on the card" — the ordinary case, where
   * the hook is explicitly told NOT to repeat it. Present means the opposite is
   * true and the name is required. Two different posts, two different rules, and
   * the caller is the only thing that knows which is which.
   */
  venue?: { name: string; city?: string };
  /**
   * On a bill with several acts: the headliner, and the supporting acts.
   *
   * Set only when there is more than one act, because on a single-act post the
   * artist is furniture the hook is told NOT to repeat — the same inversion the
   * `venue` field carries.
   */
  bill?: { headliner: string; support: string[] };
  /**
   * Everything this post is allowed to have got a number from — its prose, its
   * headline, and the credit stack. Numbers in the copy that appear nowhere here
   * were not drawn from the archive.
   */
  sourceText?: string;
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
 * Does this text name the venue?
 *
 * Not a string match on the full name, because the copy that does this BEST does
 * not use it. "I first walked into the Forum at 19 for Erasure in 1990" is right
 * about a room that was not called the Kia Forum for another thirty years, and a
 * check demanding the current legal name would reject the most human sentence in
 * the corpus to accept a worse one.
 *
 * So: any distinctive word of the venue's name counts, where distinctive excludes
 * the city. That exclusion is the whole load-bearing part — "the same Anaheim
 * club" contains a word from "House of Blues Anaheim" and still does not name it,
 * and Anaheim is exactly the word a model reaches for when it has been told not
 * to say the venue.
 */
export function namesVenue(text: string, venue: { name: string; city?: string }): boolean {
  // theatre/theater and centre/center are the same room spelled two ways.
  const fold = (s: string) =>
    s
      .toLowerCase()
      .replace(/\btheatre\b/g, "theater")
      .replace(/\bamphitheatre\b/g, "amphitheater")
      .replace(/\bcentre\b/g, "center")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const stop = new Set(["the", "of", "and", "at", "a", "an"]);
  const cityWords = new Set(fold(venue.city ?? "").split(" ").filter(Boolean));
  const distinctive = fold(venue.name)
    .split(" ")
    .filter((w) => w.length >= 3 && !stop.has(w) && !cityWords.has(w));

  // A venue whose every word is its city ("Anaheim") leaves nothing to require;
  // demanding the full string there would be worse than not checking.
  if (!distinctive.length) return true;

  const words = new Set(fold(text).split(" ").filter(Boolean));
  return distinctive.some((w) => words.has(w));
}

/**
 * Words common enough in this corpus that sharing one proves nothing.
 *
 * The hook and caption of the SAME post are about the same night, so they share
 * vocabulary by necessity — "years", "show", "saw" appear in both halves of copy
 * the prompt holds up as its own worked GOOD example. Only a word outside this
 * set is evidence the caption reached for the hook's device instead of its own.
 */
const COMMON_TO_THE_CORPUS = new Set([
  "years", "year", "show", "shows", "night", "nights", "band", "album", "albums",
  "song", "songs", "record", "records", "time", "times", "first", "last", "again",
  "saw", "seen", "played", "play", "stage", "live", "room", "venue", "same",
  "still", "back", "into", "over", "between", "before", "after", "since", "later",
  "never", "every", "when", "then", "with", "that", "this", "they", "them", "their",
  "from", "have", "been", "were", "what", "would", "could", "about", "here", "there",
  "decade", "decades", "months", "month", "days", "week", "weeks", "tour", "set",
]);

/**
 * The caption reaching for the hook's device rather than supplying its own fact.
 *
 * Measured failure: a hook ending "until I found the stubs" beside a caption
 * ending "The ticket stubs told me the story before I did." The prompt already
 * forbids it in as many words; nothing checked, so it shipped.
 *
 * A WARNING, never an error. The signal is a shared distinctive word, and a post
 * whose actual subject is a ticket stub will say "stub" twice for good reason —
 * failing it would cost the archive a true sentence to catch a stylistic one.
 */
function echoedWords(hook: string, caption: string): string[] {
  const words = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  const capitalised = new Set(
    // Proper nouns are the caption's JOB — it may name what the hook could not.
    [...caption.matchAll(/\b[A-Z][a-z]+/g)].map((m) => m[0].toLowerCase())
  );
  const inCaption = new Set(words(caption));
  return [
    ...new Set(
      words(hook).filter(
        (w) =>
          w.length >= 5 &&
          !COMMON_TO_THE_CORPUS.has(w) &&
          !capitalised.has(w) &&
          inCaption.has(w)
      )
    ),
  ];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60,
};

/**
 * Spans of time stated in the copy, normalised to years.
 *
 * `(?<![\w-])` matters more than it looks: without it "thirty-nine years" also
 * reports a nine-year span, and a check built on that reports a contradiction in
 * copy that has none. Half the first run's findings were that artefact.
 */
function timeSpans(text: string): Array<{ years: number; raw: string }> {
  const out: Array<{ years: number; raw: string }> = [];
  for (const m of String(text).matchAll(
    /(?<![\w-])(\d{1,3}|[a-z]+(?:-[a-z]+)?)[\s-]+(year|decade)s?\b/gi
  )) {
    const token = m[1].toLowerCase();
    const n = /^\d+$/.test(token)
      ? Number(token)
      : token.split("-").reduce((a, w) => a + (NUMBER_WORDS[w] ?? NaN), 0);
    if (!Number.isFinite(n) || n <= 0) continue;
    out.push({ years: m[2].toLowerCase() === "decade" ? n * 10 : n, raw: m[0].trim() });
  }
  return out;
}

/**
 * How far two stated spans may drift before they read as a contradiction.
 *
 * Both numbers are usually TRUE — a detector headline counts calendar decades
 * (1988, the 90s, the 2000s = "3 Decades") while the model counts elapsed years
 * (16). Nothing is wrong and the post still reads as though three people wrote
 * it, which is why this is a warning about framing rather than an error about
 * facts.
 */
const SPAN_DRIFT_YEARS = 8;

/**
 * Years stated in the copy.
 *
 * Separate from every other number on purpose: a year is never the result of
 * arithmetic, so unlike "39 years" (1985 to 2024, correctly derived and nowhere
 * in the prose) a year either came from the data or was remembered from
 * somewhere else. Universal Amphitheater is the measured case — the model twice
 * wrote "demolished in 2013" for a post whose prose, headline and credit contain
 * no such year, because it knew when Gibson Amphitheatre came down. It happens
 * to be right about the world and wrong about this archive, which is the harder
 * failure to catch and the exact one the prompt calls the worst thing this
 * pipeline can produce.
 */
function yearsIn(text: string): number[] {
  return [
    ...new Set(
      (String(text).match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number)
    ),
  ];
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

  // ── The venue is the subject, not furniture ────────────────────────────────
  //
  // The hook rule says "do not repeat the credit stack" and it is right for the
  // post it was written for, where the artist is the subject and the venue is a
  // line of small type underneath. On a venue-loyalty or venue-ghost post that
  // reverses: the venue IS the post, and a hook forbidden from naming it writes
  // around it instead — "the same bowl", "one room", "one outdoor room", "the
  // same venue". Measured across the queue: 0 of 10 venue-subject hooks named
  // their venue, and every one of them had reached for a periphrasis.
  //
  // An error, not a warning. A post about a room that cannot say which room is
  // not a post, and the failure mode is safe — the note keeps whatever copy it
  // already had and the run reports it.
  if (input.venue) {
    if (hook && !namesVenue(hook, input.venue)) {
      push("error", "venue-unnamed", `hook never names ${input.venue.name} — the venue is this post's subject, not its furniture`);
    }
    // The caption travels without the card on every channel, so a reader can
    // reach it with the venue nowhere on screen at all.
    if (caption && !namesVenue(caption, input.venue)) {
      push("error", "venue-unnamed", `caption never names ${input.venue.name} — it ships without the card`);
    }
  }

  // ── Naming the eighth act and not the marquee ──────────────────────────────
  //
  // Measured: a ten-act RFK bill whose hook read "Ten acts, six decades of blues,
  // and a go-go band that never left D.C." and whose caption led with Trouble
  // Funk. Both are true and the detail is good — and Foo Fighters, the act the
  // card names first, appears in neither. To a reader who was there, that reads
  // as an error rather than a choice.
  //
  // Only fires when the copy names a supporting act. Copy that names nobody is
  // obeying the anti-furniture rule and is not the failure this describes.
  if (input.bill && input.bill.support.length) {
    const text = `${hook} ${caption} ${(beats ?? []).join(" ")}`;
    const names = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const body = names(text);
    const mentioned = (name: string) => body.includes(names(name).trim());
    const namedSupport = input.bill.support.filter(mentioned);
    if (namedSupport.length && !mentioned(input.bill.headliner)) {
      push(
        "error",
        "headliner-unnamed",
        `names ${namedSupport.slice(0, 2).join(", ")} but never ${input.bill.headliner}, who headlined`
      );
    }
  }

  // ── The caption borrowing the hook's device ────────────────────────────────
  if (hook && caption) {
    const echoed = echoedWords(hook, caption);
    if (echoed.length) {
      push("warning", "hook-echo", `caption reuses the hook's "${echoed.join('", "')}" — supply the fact instead of the phrase`);
    }
  }

  // ── A year that is not in the archive ──────────────────────────────────────
  if (input.sourceText) {
    const known = new Set(yearsIn(input.sourceText));
    for (const [label, text] of surfaces) {
      const invented = yearsIn(text).filter((y) => !known.has(y));
      if (invented.length) {
        push(
          "error",
          "unsourced-year",
          `${label}: ${invented.join(", ")} appears nowhere in this post's data — never write a year from memory`
        );
      }
    }
  }

  // ── One framing per post ───────────────────────────────────────────────────
  const spans = [
    ...timeSpans(input.headline ?? "").map((s) => ({ ...s, where: "headline" })),
    ...timeSpans(hook).map((s) => ({ ...s, where: "hook" })),
    ...timeSpans(caption).map((s) => ({ ...s, where: "caption" })),
  ];
  if (spans.length >= 2) {
    const lo = spans.reduce((a, b) => (a.years <= b.years ? a : b));
    const hi = spans.reduce((a, b) => (a.years >= b.years ? a : b));
    if (hi.years - lo.years >= SPAN_DRIFT_YEARS) {
      push("warning", "mixed-framing", `${lo.where} says "${lo.raw}", ${hi.where} says "${hi.raw}" — pick one framing and hold it`);
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
