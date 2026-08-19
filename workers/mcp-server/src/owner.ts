/**
 * Who "Mike" is.
 *
 * Every concert in this archive was attended by one person — the archive's owner —
 * and the archive speaks in his first person ("I saw…"). People asking questions
 * don't always use that frame: through the MCP connector especially, the natural
 * phrasing is third-person — "How many times has Mike seen the Cure?" Nothing in
 * the tool surface said who Mike was, so a model had two bad options: answer that
 * it doesn't know him, or look him up as a performer. The second is the dangerous
 * one — `get_artist_history("Mike")` partial-matched a real headliner whose name
 * starts with Mike and answered confidently about the wrong person.
 *
 * This module is the single source of truth for the owner's identity, shared by
 * both Workers (ask-chat imports from mcp-server/src, as it does for the tools and
 * the data layer). It covers the two halves of the fix:
 *   - IDENTITY prose (OWNER_IDENTITY_RULE) injected into every system prompt and
 *     the MCP server instructions, so the model resolves the reference itself;
 *   - a resolver guard (isOwnerReference) so that when a model looks Mike up
 *     anyway, it gets told who he is instead of a plausible wrong artist.
 */

/** The person whose shows these are. Matches the JSON-LD `creator` in index.html. */
export const OWNER_NAME = "Mike Morper";

/** What people actually type. */
export const OWNER_FIRST_NAME = "Mike";

/**
 * Ways a question refers to the owner rather than to someone on a bill.
 *
 * Deliberately whole-string, never substring: "Mike Ness" is a real headliner and
 * must keep resolving to himself. Second-person entries ("you", "yourself") are
 * here because the archive answers as "I" — a client asking the tools about "you"
 * means the same person.
 */
const OWNER_ALIASES: ReadonlySet<string> = new Set([
  "mike",
  "mike morper",
  "michael morper",
  "morper",
  // The handle he goes by outside here (github.com/mmorper, linkedin.com/in/morps),
  // so a question that uses it lands with the person and not with a near-miss act.
  "morps",
  "morperhaus",
  "the owner",
  "the archive owner",
  "the owner of the archive",
  "the archivist",
  "the collector",
  "you",
  "yourself",
  "me",
  "myself",
]);

/**
 * True when a lookup string names the owner rather than an act.
 *
 * Call this AFTER exact name and slug matching, never before: if the archive ever
 * holds a band literally called "Me", the band wins its own name back. Only the
 * fuzzy/partial path — the one that would otherwise guess — is guarded.
 */
export function isOwnerReference(query: string): boolean {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:about|for|by)\s+/, "");
  return OWNER_ALIASES.has(q);
}

/**
 * What the tools say when they're asked to look the owner up as an artist.
 *
 * In the archive's own voice (see `.claude/skills/liner-notes-voice/SKILL.md`:
 * always "I", never "the archive owner"), and it re-poses the question the way the
 * tools CAN answer it — a model that lands here has enough to retry correctly.
 */
export function ownerNotAnArtist(totalShows?: number): string {
  const scale =
    totalShows && totalShows > 0
      ? `all ${totalShows} shows in it are nights I was there`
      : "every show in it is a night I was there";
  return [
    `${OWNER_NAME} is me — this is his archive, and ${scale}.`,
    `So "how many times has ${OWNER_FIRST_NAME} seen them" is just "how many times have I seen them."`,
    "Name the artist or the venue and I'll count.",
  ].join(" ");
}

/**
 * The IDENTITY rule for system prompts — the in-app agent loop, the MCP
 * `explore_archive` prompt, and the `query` escape hatch all carry it.
 *
 * Written as instruction rather than lore: the failure it prevents is a model
 * treating "Mike" as a lookup key, so it says out loud what to do instead.
 */
export const OWNER_IDENTITY_RULE =
  `IDENTITY — this archive is ${OWNER_NAME}'s, and you speak as it. "${OWNER_FIRST_NAME}", ` +
  `"${OWNER_NAME}", "the owner", and "he" all mean the same person as your own "I", and every ` +
  `show on record is one he went to. So "How many times has ${OWNER_FIRST_NAME} seen Depeche Mode?" ` +
  `means exactly "How many times have I seen Depeche Mode?" — route it to the artist tool for ` +
  `Depeche Mode and answer in first person. Never look ${OWNER_FIRST_NAME} up as a performer: he is ` +
  `on no bill in here, and an act whose name merely contains "${OWNER_FIRST_NAME}" is a different, ` +
  `real artist who counts only when the question names them in full.`;

/**
 * The same fact, compressed for the MCP server instructions — one paragraph a host
 * shows alongside every other connector, so it stays short and names the tool.
 */
export const OWNER_IDENTITY_NOTE =
  `The archive belongs to ${OWNER_NAME} — every concert in it is a show ${OWNER_FIRST_NAME} went to, ` +
  `so "${OWNER_FIRST_NAME}", "the owner", and the archive's own "I" are the same person. ` +
  `"How many times has ${OWNER_FIRST_NAME} seen X?" is a question about X: answer it with ` +
  `get_artist_history for X, and never look ${OWNER_FIRST_NAME} up as a performer.`;
