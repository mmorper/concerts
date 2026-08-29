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
import type { PostSocial } from "../../src/types/liner-notes.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 700;
const TEMPERATURE = 0.8;

/** One retry, and only for a budget overrun — the one failure a rewrite fixes. */
const MAX_ATTEMPTS = 2;

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

THE HOOK MAKES A CLAIM. THE CAPTION SUPPLIES THE ONE FACT THAT MAKES THE CLAIM TRUE.
That fact is already in the note. Find it and put it here. This is the caption's whole job, and everything below is a constraint on how you do it.
- Test your caption before you return it: could a reader who saw ONLY the caption explain why the hook is interesting? If not, you have written the hook twice.
- "Stand alone" means COMPREHENSIBLE alone, not merely grammatical alone. A caption that reads well and assumes a fact the reader does not have has failed.
- Two sentences. First-person, same voice as the note.
- It MAY name the artist — unlike the hook, the caption travels without the card.
- It must not restate the hook. Restating is not just repeating words: "35 years between shows" and "the longest gap between any artist I have ever seen" are the same sentence.
- No hashtags, no emoji, no URL, no "link in bio", no "read more".

WORKED EXAMPLE — the failure this section exists to stop.
  hook     39 years between ticket stubs, same song, same authority
  BAD      Nile Rodgers played 'Notorious' as if he'd always owned it — and in every
           way that matters, he had.
           ↳ Why did he own it? The caption never says. "Always owned it" has nothing
             behind it, so the reader is told a thing is remarkable and not why.
  GOOD     Duran Duran wrote 'Notorious'; Nile Rodgers produced it. I heard them play
           it at Irvine Meadows in 1987, then watched him take it back at the Pacific
           Amphitheatre thirty-nine years later.
           ↳ Supplies the fact the hook rests on — he produced the song the band wrote.
             Now "same authority" means something.

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
}

/** What the card's credit furniture will say, so the hook does not duplicate it. */
export interface SocialContext {
  artists: string[];
  venue: string;
  city: string;
  date: string;
  song?: string;
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
    if (!issues.length) return normalize(parsed as Record<string, unknown>);

    lastError = issues.join("; ");
    feedback = `\n\nYour last reply had these problems: ${lastError}. Rewrite to fix them — do not simply truncate, a cut-off sentence is worse than a shorter one.`;
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
