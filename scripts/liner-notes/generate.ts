/**
 * Agentic Liner Notes — Story Generator
 *
 * Transforms ScoredFinding objects into first-person editorial prose using
 * the Anthropic API. Each finding gets one API call; results are validated
 * before being attached to the finding.
 *
 * Input:  ScoredFinding[]  (output of score.ts)
 * Output: ScoredFinding[]  with prose field populated on each finding
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ScoredFinding } from "./types.ts";

// ── Public interface ──────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** artists-metadata.json keyed by normalized artist name */
  artistsMetadata: Record<string, { bio?: string; formed?: string; genres?: string[] }>;
  /** artists-top-tracks.json keyed by normalized artist name */
  artistsTopTracks: Record<string, { tracks: Array<{ name: string; albumName?: string; previewUrl?: string }> }>;
  /**
   * When true, skip API calls and attach placeholder prose.
   * Used for pipeline dry-runs and testing.
   */
  dryRun?: boolean;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 400;
const TEMPERATURE = 0.7;

/** Minimum and maximum acceptable prose word counts. */
const MIN_WORDS = 40;
const MAX_WORDS = 500;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You write short, first-person liner notes for a personal concert archive spanning 1984 to present. You are the archive owner.

VOICE
- Always write in first person: "I saw," "I remember," "my concert history." Never "you" or "the archive owner."
- Tone: Product Marketer — warm, inviting, slightly reverent about live music. Like telling a friend about your record collection.
- Self-contained. Never reference "as mentioned above" or anything outside this post.

STRUCTURE
- 2–5 sentences. Aim for 60–150 words.
- Name specific artists, venues, and years from the data provided.
- Include at least one number (years, count, span, gap).
- End with something human: a reaction, a reflection, or a wry observation.

CATEGORY GUIDANCE
- Cultural Context: lead with the broader musical significance, bridge to "my experience of it."
- Personal Connection: lead with "I" and the personal moment, bridge to what it meant.
- Deep-Cut Correlation: lead with the surprising discovery, prove it with specific data, react to it.

CULTURAL CONTEXT RULES
You may include one cultural reference per post — but only if you are confident in it:
- ALWAYS ALLOWED: album names from the data I provide, artist formation years from the data, genres from the data.
- ALLOWED WITH CARE: major album release years for well-known artists, career milestones (breakups, reunions, hall of fame). Frame as approximate memory: "around the time," "they had just released," "that was the era of." Never cite specific dates or numbers not in my data.
- NEVER: chart positions, sales figures, cultural events unrelated to the artist, exact release dates not in the data, comparisons like "one of the greatest."
When in doubt, leave it out — the concert data is interesting enough on its own.

ANTI-PATTERNS
- No superlatives without data evidence ("legendary," "iconic").
- No vague gestures ("a celebrated career," "decades of influence").
- No filler ("it goes without saying," "needless to say").
- Never use the words "journey" or "tapestry."
- Every sentence must contain a specific fact.

OUTPUT
Return only the prose. No headline, no label, no preamble. Just the sentences.`;

// ── Category-specific instruction snippets ─────────────────────────────────

const CATEGORY_INSTRUCTION: Record<string, string> = {
  cultural:
    'This is a Cultural Context post. Lead with the broader musical significance of this finding, then bridge to your personal experience of it. Start strong — the opening line should frame why this matters beyond just your concert history.',
  personal:
    'This is a Personal Connection post. Lead with "I" and the specific personal moment. Make it feel like a memory being surfaced for the first time, not a summary of facts.',
  "deep-cut":
    'This is a Deep-Cut Correlation post. Lead with the surprising discovery, prove it with specific data points from what I provide, then react to it with genuine surprise or delight.',
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate prose for each finding in the batch. Returns the same array with
 * the `prose` field populated on successfully generated findings.
 * Findings that fail validation are returned without prose (not thrown).
 */
export async function generate(
  findings: ScoredFinding[],
  options: GenerateOptions
): Promise<ScoredFinding[]> {
  if (options.dryRun) {
    return findings.map((f) => ({
      ...f,
      prose: `[DRY RUN] Prose placeholder for: ${f.headline}`,
    }));
  }

  const client = new Anthropic();
  const results: ScoredFinding[] = [];

  for (const finding of findings) {
    try {
      const prose = await generateProse(finding, options, client);
      results.push({ ...finding, prose });
    } catch (err) {
      console.error(`[generate] Failed for "${finding.headline}":`, err);
      results.push(finding); // Return without prose — curator will skip prose-less findings
    }
  }

  return results;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function generateProse(
  finding: ScoredFinding,
  options: GenerateOptions,
  client: Anthropic
): Promise<string> {
  if (finding.detector === "historical-moment") {
    return generateProseWithWebSearch(finding, options, client);
  }

  const userPrompt = buildUserPrompt(finding, options);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const prose = extractText(message);
  validateProse(prose, finding);
  return prose;
}

async function generateProseWithWebSearch(
  finding: ScoredFinding,
  options: GenerateOptions,
  client: Anthropic
): Promise<string> {
  const userPrompt = buildUserPromptHistorical(finding, options);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  // web_search_20250305 is Anthropic's built-in server-side search tool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSearchTool: any = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  };

  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 800, // More tokens needed for tool use turns
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    tools: [webSearchTool],
    messages,
  });

  // Agentic loop: handle tool_use turns until end_turn or no more tool calls
  let iterations = 0;
  while (response.stop_reason === "tool_use" && iterations < 5) {
    iterations++;
    messages.push({ role: "assistant", content: response.content });
    // For built-in server-side tools, Anthropic handles execution.
    // We still need to send back a user turn to continue the conversation.
    // The tool results are embedded in the assistant response by Anthropic.
    const toolResults = response.content
      .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
      .map((block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: "Search completed by Anthropic.",
      }));
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages,
    });
  }

  const prose = extractText(response);
  validateProse(prose, finding);
  return prose;
}

function buildUserPromptHistorical(finding: ScoredFinding, options: GenerateOptions): string {
  const lines: string[] = [];
  const dp = finding.dataPoints as Record<string, unknown>;

  lines.push(`CATEGORY: ${finding.category}`);
  lines.push(`HEADLINE: ${finding.headline}`);
  lines.push(`DETECTOR: ${finding.detector}`);
  lines.push("");

  lines.push("DATA POINTS:");
  lines.push(JSON.stringify(finding.dataPoints, null, 2));
  lines.push("");

  const culturalData = buildCulturalContextData(finding, options);
  if (culturalData) {
    lines.push("ARTIST CONTEXT (from our data):");
    lines.push(culturalData);
    lines.push("");
  }

  lines.push("INSTRUCTION:");
  lines.push(CATEGORY_INSTRUCTION["deep-cut"]);
  lines.push("");
  lines.push(`SEARCH TASK: Before writing, search the web for major world events and cultural happenings in ${dp.month ?? ""} ${dp.year} and in ${dp.city ?? ""} during ${dp.year}. Focus on events that would resonate with a concert-goer: music industry news, cultural moments, political events, sports, anything that defined that moment in time. Only reference events you find in search results — do not invent historical context.`);
  lines.push("");
  lines.push("Write the liner note prose now, weaving in 1–2 real historical details from your search to place this concert in its moment.");

  return lines.join("\n");
}

function buildUserPrompt(finding: ScoredFinding, options: GenerateOptions): string {
  const lines: string[] = [];

  lines.push(`CATEGORY: ${finding.category}`);
  lines.push(`HEADLINE: ${finding.headline}`);
  lines.push(`DETECTOR: ${finding.detector}`);
  lines.push("");

  // Core data points
  lines.push("DATA POINTS:");
  lines.push(JSON.stringify(finding.dataPoints, null, 2));
  lines.push("");

  // Cultural context data (Tier 1 — grounded in our data)
  const culturalData = buildCulturalContextData(finding, options);
  if (culturalData) {
    lines.push("ADDITIONAL CONTEXT (grounded in our data — Tier 1 only):");
    lines.push(culturalData);
    lines.push("");
  }

  // Category instruction
  const catInstruction = CATEGORY_INSTRUCTION[finding.category] ?? CATEGORY_INSTRUCTION.personal;
  lines.push("INSTRUCTION:");
  lines.push(catInstruction);
  lines.push("");
  lines.push("Write the liner note prose now.");

  return lines.join("\n");
}

/**
 * Assembles Tier 1 cultural context data from the enriched metadata files.
 * Only includes data we actually have — never fabricated.
 */
function buildCulturalContextData(
  finding: ScoredFinding,
  options: GenerateOptions
): string {
  const parts: string[] = [];

  for (const artistSlug of finding.artists.slice(0, 2)) {
    const meta = options.artistsMetadata[artistSlug];
    const topTracks = options.artistsTopTracks[artistSlug];

    if (!meta && !topTracks) continue;

    const artistLabel = artistSlug;
    const contextParts: string[] = [];

    if (meta?.formed) contextParts.push(`formed: ${meta.formed}`);
    if (meta?.genres?.length) contextParts.push(`genres: ${meta.genres.join(", ")}`);

    // Collect unique album names from top tracks
    if (topTracks?.tracks?.length) {
      const albums = [
        ...new Set(
          topTracks.tracks
            .filter((t) => t.albumName)
            .map((t) => t.albumName as string)
        ),
      ].slice(0, 3);
      if (albums.length) contextParts.push(`albums in data: ${albums.join(", ")}`);
    }

    if (contextParts.length) {
      parts.push(`${artistLabel}: ${contextParts.join(" | ")}`);
    }
  }

  return parts.join("\n");
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("API response contained no text block");
  }
  return block.text.trim();
}

/**
 * Validates generated prose against the spec's acceptance criteria.
 * Throws on failure — caller logs and continues.
 */
function validateProse(prose: string, finding: ScoredFinding): void {
  const words = prose.split(/\s+/).filter(Boolean);

  if (words.length < MIN_WORDS) {
    throw new Error(`Prose too short: ${words.length} words (min ${MIN_WORDS})`);
  }
  if (words.length > MAX_WORDS) {
    throw new Error(`Prose too long: ${words.length} words (max ${MAX_WORDS})`);
  }

  const lowerProse = prose.toLowerCase();

  // Must be in first person
  if (!lowerProse.includes(" i ") && !lowerProse.startsWith("i ") && !lowerProse.includes(" my ") && !lowerProse.startsWith("my ")) {
    throw new Error('Prose is not in first person (must contain "I" or "my")');
  }

  // Must mention at least one year from the finding
  if (finding.years.length > 0) {
    const hasYear = finding.years.some((y) => prose.includes(String(y)));
    if (!hasYear) {
      throw new Error(`Prose does not mention any of the finding's years: ${finding.years.join(", ")}`);
    }
  }
}
