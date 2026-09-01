/**
 * Agentic Liner Notes — social payload authoring (#329).
 *
 * The social text is written **on purpose**, in the archive's voice, by the
 * same run that writes the prose. It is not chopped out of the first
 * paragraph. Every RSS-to-social bridge in existence fails at exactly that,
 * and Phase 0 measured the cost of the failure directly: 28 of the 57
 * published headlines follow one of five detector templates, and "Caught Once,
 * Never Again" alone accounts for nine (DECISIONS.md §11). A nine-up grid of
 * derived copy reads as robotic no matter how it is art-directed.
 *
 * This is a SEPARATE API call from prose generation, not an extra field on it.
 * Prose generation is a tuned, validated path with two production defects
 * already fixed inside it; adding a second output to that call would put every
 * one of those regressions back in play for a feature that can simply fail on
 * its own and leave the note publishable.
 *
 * Requires: ANTHROPIC_API_KEY.
 */

import Anthropic from "@anthropic-ai/sdk";
import { HOOK_MAX, BEATS_MIN, BEATS_MAX, CAPTION_MAX } from "../syndication/budgets.ts";
import { graphemeLength } from "../syndication/text.ts";
import { checkSocial } from "./voice-check.ts";
import type { PostSocial } from "../../src/types/liner-notes.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 700;
const TEMPERATURE = 0.8;

/**
 * Two retries. Budget overruns need one — truncation is a mechanical fix.
 *
 * The voice failures added in this change are harder: "you paraphrased the
 * note" asks for a different idea, not a shorter sentence. Measured on the
 * published corpus, 21 of 58 notes would fail that check on the first attempt,
 * and a post that exhausts its attempts is dropped from syndication entirely.
 * At POSTS_PER_RUN = 1 the third call costs a fraction of a cent a week.
 */
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You write the social copy for a personal concert archive spanning 1984 to present. You are the archive owner. The archive is the record; social is the doorway.

The site is canonical and the social post is a pointer. That decides most arguments before they start: when a post could either tell the whole story or make someone want the story, it makes them want it.

You are given a published liner note and the structured credit for the night it is about. You return three things.

HOOK (<= ${HOOK_MAX} characters, one line)
The line that earns the click, set in large type on a card.
- The artist, venue, city and date are rendered as separate furniture on the same card. Do NOT repeat them in the hook — it is the one line that is not already on screen.
- Withhold the interpretation, never the identification. The names are already there; your job is the reason to stop scrolling.
- No hashtags, no emoji, no URL, no quotation marks around the whole line.
- Not the headline restated. If your hook is the headline with different punctuation, write a different hook.
- A specific number, object or detail beats a summary every time.

CAPTION (<= ${CAPTION_MAX} characters)
The core sentence pair that ships on every channel unchanged. Adapters append the link and the tags and nothing else, so write it to stand alone in a feed where the card may not have loaded.
- Two sentences. First-person, same voice as the note.
- It MAY name the artist — unlike the hook, the caption travels without the card.
- It must not restate the hook.
- No hashtags, no emoji, no URL, no "link in bio", no "read more".

BEATS (3-5 entries, each <= ${HOOK_MAX} characters)
A carousel: one narrative unit per pane, in order, each readable on its own.
- Beat 1 is the situation, the last beat is the landing. The middle beats carry the evidence.
- Each beat is a complete thought, not a sentence fragment continued on the next pane.
- Same restrictions as the hook: no hashtags, emoji, or URLs.

VOICE — identical to the note itself
- First person. Warm, specific, slightly reverent about live music.
- Every line contains a fact from the data you were given.
- NEVER invent a number, a date, an album, a distance, or a biographical detail. A number that sounds right and is wrong is the single worst thing this pipeline can produce.
- Never the words "journey" or "tapestry". No "legendary", "iconic", "masterpiece", no "one of the greatest".
- No chart positions, sales figures, or certifications.

PERISHABLE CLAIMS — harder here than in the note
A note deleted from the site leaves its social copies standing on servers we do not control. Anything true today and false next year is simply wrong, under my name, forever.
- NEVER "they never made another record", "their last album", "nothing since", "that was the end of them".
- Facts about the future RELATIVE TO THE SHOW are permanent and welcome: "Violator was still twenty months away" is true about June 1988 for good.

OUTPUT
Return ONLY a JSON object, no prose around it, no code fence:
{"hook": "...", "caption": "...", "beats": ["...", "...", "..."]}`;

export interface SocialOptions {
  /** Skip the API and return deterministic placeholder text, for pipeline dry-runs. */
  dryRun?: boolean;
  /** Injected in tests so the loop runs without an API key. */
  client?: Pick<Anthropic["messages"], "create">;
}

/**
 * The minimum an authoring request needs.
 *
 * Structural rather than `LinerNotesPost`, because On This Day posts are not
 * liner notes and should not have to pretend to be one to get copy written.
 * A `LinerNotesPost` satisfies this shape already.
 */
export interface SocialSubject {
  slug: string;
  headline: string;
  category: string;
  /** The published prose. Absent for On This Day, which has none. */
  prose?: string;
  /**
   * `timely` or `evergreen`.
   *
   * An evergreen post promises to stay true, so it may not count years to
   * today. A timely one IS that count and is exempt. See `perishableCounts`.
   */
  temporality?: string;
}

/** What the card's credit furniture will say, so the hook does not duplicate it. */
export interface SocialContext {
  artists: string[];
  venue: string;
  city: string;
  date: string;
  song?: string;
  /**
   * Every other act on the bill.
   *
   * Not furniture — the card never prints them. They are here so the voice
   * check knows they are NAMES: a beat listing the bill shares a long run with
   * the prose for reasons that have nothing to do with derivation, and without
   * these two of the corpus's flagged fields are false positives.
   */
  openers?: string[];
  /** Every show year the note covers, for the perishable-count arithmetic. */
  years?: number[];
}

/**
 * The fields `checkSocial` needs beyond the copy itself, derived in ONE place.
 *
 * The retry loop and the pipeline's final gate must judge by identical inputs.
 * They diverged once already — the pipeline passed a `headline` the retry loop
 * never saw, so a hook could restate its headline, pass every check the loop
 * ran, and be thrown away after the call was paid for. Deriving both from this
 * function is what stops that recurring for `prose`, `entities` and `years`.
 */
export function socialCheckExtras(post: SocialSubject, context: SocialContext) {
  return {
    headline: post.headline,
    prose: post.prose,
    temporality: post.temporality,
    years: context.years,
    entities: [...context.artists, ...(context.openers ?? []), context.venue, context.city],
  };
}

/**
 * Author social text for each post. Failures are per-post and non-fatal: the
 * note still publishes, and simply is not eligible to syndicate. That is the
 * right trade — a missing tweet is not a reason to lose a liner note.
 */
export async function generateSocial(
  posts: Array<{ post: SocialSubject; context: SocialContext }>,
  options: SocialOptions = {}
): Promise<Map<string, PostSocial>> {
  const out = new Map<string, PostSocial>();
  const authoredAt = new Date().toISOString();

  if (options.dryRun) {
    for (const { post } of posts) {
      out.set(post.slug, {
        hook: `[DRY RUN] hook for ${post.slug}`.slice(0, HOOK_MAX),
        caption: `[DRY RUN] caption for ${post.slug}`.slice(0, CAPTION_MAX),
        authoredAt,
      });
    }
    return out;
  }

  const client = options.client ?? new Anthropic().messages;

  for (const { post, context } of posts) {
    try {
      const social = await authorOne(post, context, client);
      out.set(post.slug, { ...social, authoredAt });
    } catch (err) {
      console.warn(`   ⚠️  Social text failed for ${post.slug}: ${(err as Error).message}`);
    }
  }

  return out;
}

// ── Internals ────────────────────────────────────────────────────────────────

async function authorOne(
  post: SocialSubject,
  context: SocialContext,
  client: Pick<Anthropic["messages"], "create">
): Promise<Omit<PostSocial, "authoredAt">> {
  let feedback = "";
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await client.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(post, context) + feedback }],
    });

    const text = extractText(message);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFence(text));
    } catch {
      lastError = "response was not JSON";
      feedback = "\n\nYour last reply was not valid JSON. Return only the JSON object.";
      continue;
    }

    const issues = validate(parsed);
    if (issues.length) {
      lastError = issues.join("; ");
      feedback = `\n\nYour last reply had these problems: ${lastError}. Rewrite to fix them — do not simply truncate, a cut-off sentence is worse than a shorter one.`;
      continue;
    }

    // The SAME guard the pipeline gates on, run where a rewrite is still
    // possible. Before this it ran only afterwards: a lift was caught after the
    // call was paid for, the copy was dropped, and the note published silently
    // ineligible to syndicate. On the published corpus that path would have
    // taken 21 of 58 notes out of the queue without ever asking for a rewrite.
    const social = normalize(parsed as Record<string, unknown>);
    const voice = checkSocial({ ...social, ...socialCheckExtras(post, context) }).filter(
      (i) => i.severity === "error"
    );
    if (!voice.length) return social;

    lastError = voice.map((i) => i.detail).join("; ");
    feedback =
      `\n\nYour last reply failed the voice check: ${lastError}\n\n` +
      `Write it again from the FACTS, not from the note's sentences. If a line reuses the ` +
      `note's phrasing, say the same thing a different way or say something else the facts ` +
      `support. Never state a number of years counted from the show to today — it is true ` +
      `the day you write it and wrong every year after.`;
  }

  throw new Error(lastError || "social text failed validation");
}

/**
 * Two shapes, one voice.
 *
 * A liner note hands the model prose to draw a hook out of. An On This Day
 * post has none — it is a date and a show — so it gets the facts and is told
 * so, rather than being handed fabricated prose to summarise. The SYSTEM
 * prompt is identical either way: the rules do not change with the stream,
 * only the material does.
 */
function buildPrompt(post: SocialSubject, context: SocialContext): string {
  const lines = post.prose
    ? [
        "THE PUBLISHED NOTE",
        `Headline: ${post.headline}`,
        `Category: ${post.category}`,
        "",
        post.prose,
        "",
      ]
    : [
        "AN ANNIVERSARY POST — there is no published note behind this one.",
        "Write from the facts below. Do not invent a story around them, and do",
        "not claim to remember anything the facts do not contain.",
        `Framing: ${post.headline}`,
        "",
      ];
  lines.push(
    "CREDIT ALREADY ON THE CARD (do not repeat these in the hook):",
    `Artists: ${context.artists.join(", ")}`
  );
  if (context.song) lines.push(`Song: ${context.song}`);
  lines.push(`Venue: ${context.venue}`);
  lines.push(`City: ${context.city}`);
  lines.push(`Date: ${context.date}`);
  lines.push("");
  lines.push("Write the hook, caption and beats now. JSON only.");
  return lines.join("\n");
}

/** Models fence JSON even when told not to; unfencing is cheaper than a retry. */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function validate(value: unknown): string[] {
  const issues: string[] = [];
  if (!value || typeof value !== "object") return ["response was not an object"];
  const obj = value as Record<string, unknown>;

  const hook = typeof obj.hook === "string" ? obj.hook.trim() : "";
  if (!hook) issues.push("hook missing");
  else if (graphemeLength(hook) > HOOK_MAX) issues.push(`hook is ${graphemeLength(hook)} chars (max ${HOOK_MAX})`);

  const caption = typeof obj.caption === "string" ? obj.caption.trim() : "";
  if (!caption) issues.push("caption missing");
  else if (graphemeLength(caption) > CAPTION_MAX) issues.push(`caption is ${graphemeLength(caption)} chars (max ${CAPTION_MAX})`);

  // Beats are optional in the payload, but if the model returns them they must
  // be usable — a 2-beat or over-length carousel is worse than none, because
  // Phase 3 would ship it without re-authoring.
  if (obj.beats !== undefined) {
    if (!Array.isArray(obj.beats) || obj.beats.some((b) => typeof b !== "string")) {
      issues.push("beats must be an array of strings");
    } else {
      const beats = (obj.beats as string[]).map((b) => b.trim()).filter(Boolean);
      if (beats.length < BEATS_MIN || beats.length > BEATS_MAX) {
        issues.push(`${beats.length} beats (want ${BEATS_MIN}–${BEATS_MAX})`);
      }
      const over = beats.filter((b) => graphemeLength(b) > HOOK_MAX);
      if (over.length) issues.push(`${over.length} beat(s) over ${HOOK_MAX} chars`);
    }
  }

  return issues;
}

function normalize(obj: Record<string, unknown>): Omit<PostSocial, "authoredAt"> {
  const beats = Array.isArray(obj.beats)
    ? (obj.beats as string[]).map((b) => b.trim()).filter(Boolean)
    : undefined;
  return {
    hook: (obj.hook as string).trim(),
    caption: (obj.caption as string).trim(),
    ...(beats?.length ? { beats } : {}),
  };
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("API response contained no text block");
  return block.text.trim();
}

export { validate as validateSocialShape, SYSTEM_PROMPT as SOCIAL_SYSTEM_PROMPT };
