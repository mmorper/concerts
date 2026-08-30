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

/**
 * Retries, and only for a budget overrun — the one failure a rewrite fixes.
 *
 * Was 2. Measured on the seven venue-subject re-authors: two of them failed with
 * "4 beat(s) over 120 chars" on BOTH attempts, so the note kept its old copy over
 * a carousel-length overrun that a third pass fixes. A beat budget is the easiest
 * thing in this prompt to comply with once it is pointed at.
 */
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You write the social copy for a personal concert archive spanning 1984 to present. You are the archive owner. The archive is the record; social is the doorway.

The site is canonical and the social post is a pointer. That decides most arguments before they start: when a post could either tell the whole story or make someone want the story, it makes them want it.

You are given a published liner note and the structured credit for the night it is about. You return three things.

HOOK (<= ${HOOK_MAX} characters, one line)
The line that earns the click, set in large type on a card.
- The artist, venue, city and date are rendered as separate furniture on the same card. Do NOT repeat them in the hook — it is the one line that is not already on screen.
- 🔴 UNLESS THE PROMPT SAYS THE VENUE IS THE SUBJECT. Then that rule is off for the venue, and the venue must be NAMED — in the hook and in the caption both. It is not furniture on a post that is about it.
- 🔴 NAME IT INSIDE A SENTENCE. Not as a label with a colon after it, and not followed by its own statistics.
  BAD   Irvine Meadows: 16 shows, 13 artists, 19 years — and I never once made a plan.
  BAD   Pacific Amphitheatre, 16 shows, 5 decades — and I was 16 when it started.
        ↳ Both are the HEADLINE with commas. "Pacific Amphitheatre: 16 Shows Over 5
          Decades" is already set on the same card, directly above. Counting the
          same things again in the same order is the derived copy this whole file
          exists to prevent — the venue name being required does not make a list
          of its statistics a hook.
  GOOD  The Forum has held five different versions of me, 33 years apart.
  GOOD  Universal Amphitheater was demolished in 1999. I didn't notice until 2024.
        ↳ The venue is the SUBJECT of a sentence that goes somewhere. One number,
          doing work.
- Withhold the interpretation, never the identification. The names are already there; your job is the reason to stop scrolling.
- No hashtags, no emoji, no URL, no quotation marks around the whole line.
- Not the headline restated. If your hook is the headline with different punctuation, write a different hook.
- A specific number, object or detail beats a summary every time.

🔴 NEVER WRITE AROUND A NAME YOU HAVE BEEN TOLD NOT TO USE.
The rule above says leave the name out, not gesture at the thing. A sentence bending itself around a word is the single loudest tell that nobody wrote it.
  BAD   16 nights at the same bowl, none of them planned.
  BAD   Five artists, almost nothing in common, one room that kept pulling me back.
  BAD   16 shows at one outdoor room, 19 years apart.
  BAD   Five shows at the same venue across three decades.
        ↳ "the same bowl", "one room", "one outdoor room", "the same venue" — four
          posts, four ways of not saying a word. A reader feels the avoidance even
          when they cannot name it.
If the sentence needs the venue, name the venue. If it does not, write a sentence that does not need it — about the night, the noise, the drive, the gap, what you walked in expecting. Do not write the sentence that needs it and then blank the word.

CAPTION (<= ${CAPTION_MAX} characters)
The core sentence pair that ships on every channel unchanged. Adapters append the link and the tags and nothing else, so write it to stand alone in a feed where the card may not have loaded.

THE HOOK MAKES A CLAIM. THE CAPTION SUPPLIES THE ONE FACT THAT MAKES THE CLAIM TRUE.
That fact is already in the note. Find it and put it here. This is the caption's whole job, and everything below is a constraint on how you do it.

🔴 THE FACT MUST FIT INSIDE ${CAPTION_MAX} CHARACTERS, NOT BE ADDED ON TOP OF THEM.
Carrying a fact costs words, so it has to be paid for by cutting elsewhere — and what gets cut is the atmosphere, never the fact. Drop the adjectives, the scene-setting and the second clause that only rephrases the first. A caption of ${CAPTION_MAX} characters that names the fact beats a beautiful one that does not, and an over-length caption is rejected outright and publishes nothing at all.
COUNT THE CHARACTERS BEFORE YOU RETURN. Same for every beat against its own limit.
- Test your caption before you return it: could a reader who saw ONLY the caption explain why the hook is interesting? If not, you have written the hook twice.
- SOMETIMES THE HOOK IS ALREADY THE WHOLE OBSERVATION, and there is no second fact to supply — a note about the longest gap in the archive has said its piece in one line. Do not restate it in a longer form. Supply the TEXTURE instead: the specific thing from the note the hook had no room for. What was on the radio, what the room was like, which city, what you expected walking in. Concrete detail from the note, never mood.
  hook     35 years between shows — the longest gap in my entire concert history.
  BAD      UB40 in 1988, then nothing until 2023: the longest gap between any artist
           I have ever seen live.        ↳ the hook, reworded. Adds nothing.
  GOOD     I saw them at Pacific Amphitheatre in 1988, when 'Red Red Wine' was still
           on the radio. Peacock Theater in 2023, and it landed exactly the same way.
           ↳ the hook owns the gap; the caption owns its two ends. Still FIRST PERSON:
             texture is not a licence to drop the "I".
- "Stand alone" means COMPREHENSIBLE alone, not merely grammatical alone. A caption that reads well and assumes a fact the reader does not have has failed.
- Two sentences. First-person, same voice as the note.
- It MAY name the artist — unlike the hook, the caption travels without the card.
- It must not restate the hook. Restating is not just repeating words: "35 years between shows" and "the longest gap between any artist I have ever seen" are the same sentence.
- 🔴 AND IT MUST NOT BORROW THE HOOK'S DEVICE. If the hook turns on an object, an image or a piece of phrasing, the caption does not get to land on the same one.
  hook     Five shows. Sixteen years. I didn't know it was a pattern until I found the stubs.
  BAD      ... The ticket stubs told me the story before I did.
           ↳ The stubs are the hook's move. Used twice, they stop being a discovery
             and start being a tic. The caption owed a FACT here — which five shows,
             which artists, which years — and paid in atmosphere instead.
  You may of course repeat a NAME. Naming the artist or venue the hook could not is the caption's job.
- No hashtags, no emoji, no URL, no "link in bio", no "read more".

WORKED EXAMPLE — the failure this section exists to stop.
  hook     39 years between ticket stubs, same song, same authority
  BAD      Nile Rodgers played 'Notorious' as if he'd always owned it — and in every
           way that matters, he had.
           ↳ Why did he own it? The caption never says. "Always owned it" has nothing
             behind it, so the reader is told a thing is remarkable and not why.
  GOOD     Duran Duran wrote 'Notorious'; Nile Rodgers produced it. I heard them play
           it at Irvine Meadows in 1987, then watched him take it back thirty-nine
           years later.
           ↳ Supplies the fact the hook rests on — he produced the song the band wrote.
             Now "same authority" means something. 166 characters: the venue is on the
             card already, so it is the first thing cut to make room for the fact.

BEATS (3-5 entries, each <= ${HOOK_MAX} characters)
A carousel: one narrative unit per pane, in order, each readable on its own.
- Beat 1 is the situation, the last beat is the landing. The middle beats carry the evidence.
- Each beat is a complete thought, not a sentence fragment continued on the next pane.
- Same restrictions as the hook: no hashtags, emoji, or URLs.

ONE FRAMING PER POST
The headline, the hook and the caption are read together, in that order, in about two seconds.
- A "N Decades" headline counts CALENDAR decades — shows in 1988, 1997 and 2004 span three of them and sixteen elapsed years. Both numbers are true. Using one in the hook and the other in the caption is still wrong, because a reader gets "Sixteen years" and "three decades" about one thing and concludes nobody read it back.
- Pick the framing the headline already set, and hold it across all three. If you would rather count elapsed years than calendar decades, do that in BOTH the hook and the caption.
- The same applies to any count: shows, artists, venues. One number for one thing, everywhere it appears.

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
  /**
   * Which of the credit lines is the POST's subject rather than its furniture.
   *
   * Defaults to the artist, which is the ordinary case and the one every rule in
   * the prompt was written against. `"venue"` inverts one of them: a venue-loyalty
   * or venue-ghost post is ABOUT the room, so the anti-repetition rule that keeps
   * an artist post clean is exactly what makes a venue post write "the same bowl"
   * instead of "Pacific Amphitheatre".
   */
  subject?: "artist" | "venue";
  /**
   * Every year this post is entitled to state, beyond the ones written in its
   * prose. A drought-comeback post names two show years and its anchor concert
   * is only one of them; an album-context post may cite a release date that
   * appears in `album-eras.json` and nowhere in the note. Both were rejected as
   * fabrications by a first version of this gate that read the prose alone —
   * which is the failure mode a check like this has to be built against, because
   * a gate that blocks true sentences gets switched off.
   */
  knownYears?: number[];
  /**
   * Hooks already authored for posts of the SAME detector.
   *
   * 🔴 THE ONE THING A PER-POST API CALL CANNOT KNOW ON ITS OWN.
   * Every post is written in isolation, so nothing stops the model reaching for
   * the same good idea every time — and a detector family hands it the same
   * shape of material each time, which is exactly when it will. Measured twice
   * on the same seven posts: before the venue rule, four of them landed on
   * "none of it was planned"; after it, two opened "<Venue> pulled me back" and
   * two more "<Venue> held". Fixing the naming did nothing about the sameness.
   *
   * DECISIONS.md §11 is the same finding at the headline layer — 28 of 57
   * headlines on five templates. A profile grid is read all at once, so this is
   * not a stylistic preference; it is the difference between an archive and a
   * feed tool.
   */
  avoid?: string[];
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

    const issues = [...validate(parsed), ...unsourcedYears(parsed, post, context)];
    if (!issues.length) return normalize(parsed as Record<string, unknown>);

    lastError = issues.join("; ");
    feedback = `\n\nYour last reply had these problems: ${lastError}. Rewrite to fix them — do not simply truncate, a cut-off sentence is worse than a shorter one.`;
  }

  throw new Error(lastError || "social text failed validation");
}

/**
 * Years in the copy that are in none of the material this post was given.
 *
 * Checked INSIDE the retry loop, unlike the rest of the voice rules, because it
 * is the one failure the model will otherwise repeat verbatim. Measured: asked
 * three times for copy about Universal Amphitheater, it wrote "demolished in
 * 2013" every time — correct about the world, absent from this archive, and
 * never corrected because the gate that caught it sat outside the loop and fed
 * nothing back. One sentence of feedback fixes it; three silent retries did not.
 *
 * Years only. "39 years" from 1985 to 2024 is arithmetic the model is supposed
 * to do and it appears in no source text; a YEAR is never arithmetic.
 */
function unsourcedYears(parsed: unknown, post: SocialSubject, context: SocialContext): string[] {
  const obj = parsed as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return [];

  const years = (t: unknown): number[] =>
    typeof t === "string" ? (t.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number) : [];

  // Two sets, on purpose. `known` is what the gate ACCEPTS — wide, because an
  // album release year is legitimate evidence the note never prints. `stated` is
  // what the feedback ADVERTISES — narrow, because listing thirty-two years drawn
  // from four artists' discographies is noise, and worse, it reads as permission
  // to attach any of them to any claim.
  const stated = new Set(
    years([post.prose ?? "", post.headline, context.date].join(" "))
  );
  const known = new Set([...stated, ...(context.knownYears ?? [])]);

  const written = [
    ...years(obj.hook),
    ...years(obj.caption),
    ...(Array.isArray(obj.beats) ? obj.beats.flatMap(years) : []),
  ];
  const invented = [...new Set(written.filter((y) => !known.has(y)))];
  if (!invented.length) return [];

  // Telling the model only what is banned is what made it repeat 2013 three
  // times: it had one interesting fact about that room and no permitted way to
  // say it. The years it MAY use, and the untimed form of the same claim, are
  // both offered here — a refusal with an exit is a different instruction from
  // a refusal without one.
  const permitted = [...stated].sort((a, b) => a - b);
  return [
    `${invented.join(", ")} appears nowhere in this post's note, headline or credit. ` +
      `You may not state a year this archive does not record, however sure of it you are — ` +
      `that is the fabricated-memory failure, and being right about the world does not excuse it. ` +
      (permitted.length ? `This note states ${permitted.join(", ")} and no others. ` : "") +
      `If the fact you want is that the venue is gone, say it WITHOUT a date, or write about ` +
      `something the note actually contains.`,
  ];
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
  const venueIsSubject = context.subject === "venue";

  lines.push(
    venueIsSubject
      ? "CREDIT ALREADY ON THE CARD (do not repeat these in the hook — except the venue, see below):"
      : "CREDIT ALREADY ON THE CARD (do not repeat these in the hook):",
    `Artists: ${context.artists.join(", ")}`
  );
  if (context.song) lines.push(`Song: ${context.song}`);
  lines.push(`Venue: ${context.venue}`);
  lines.push(`City: ${context.city}`);
  lines.push(`Date: ${context.date}`);

  if (venueIsSubject) {
    lines.push(
      "",
      `\u{1F534} THE VENUE IS THIS POST'S SUBJECT. It is not furniture here.`,
      `Write "${context.venue}" into the hook AND the caption, by name. Do not substitute`,
      `"the same venue", "one room", "that bowl" or any other way of pointing at it`,
      `without saying it — a post about a room that will not say which room is not a post.`,
      `An older name the room actually had on the night is welcome and often better.`
    );
  }

  if (context.avoid?.length) {
    lines.push(
      "",
      "\u{1F534} ALREADY PUBLISHED FOR POSTS OF THIS EXACT SHAPE — DO NOT LAND NEAR ANY OF THEM:",
      ...context.avoid.map((h) => `  \u2022 ${h}`),
      "These go out to one profile and get read as a grid, so a reader meets them",
      "together. Repeating a verb, an opening move or a closing beat from this list",
      "is what makes the account look automated, however true the sentence is.",
      "",
      "\u{1F534} AND THE SHAPE COUNTS, NOT ONLY THE WORDS. Swapping the nouns out of a",
      "sentence above and keeping its structure is repeating it. If one of them opens",
      "with a name and a colon, yours does not. If one of them is a list of counts,",
      "yours is a sentence. If one of them ends on a wry aside after a dash, yours",
      "lands some other way.",
      "Find the thing THIS night has that none of the others do, and start there."
    );
  }

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
