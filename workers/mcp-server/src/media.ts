// What the site holds of the owner's photos and clips, as one line a tool result can carry.
// Pure functions over media-index.json, so the model is told a count rather than guessing one.
//
// ONLY WHAT IS PUBLIC COUNTS. A kept clip has no `url` until the owner publishes it, and a kept
// clip is not a yes to showing it, so an unpublished clip never reaches a count or a song title.
//
// THE ACT COMES FROM THE ASSET. 48% of shows have openers, so a night's frames are never credited
// to its headliner as a group (.claude/skills/media-pipeline/SKILL.md, "Attribution").

export interface MediaAsset {
  kind: string;
  url: string | null;
  date: string;
  /** The act as billed that night. Null on a room frame: marquee, exterior, stub. */
  artist: string | null;
  artistNormalized: string | null;
  /** The song a clip shows. Confirmed by the owner. */
  song?: string;
}

export interface MediaIndexFile {
  assets: MediaAsset[];
}

/**
 * The label every note starts with. `buildSystemPrompt` names it, so the model can tell "no
 * media" from a tool that simply does not report any.
 */
export const MEDIA_NOTE_LABEL = "Media on the site";

/** A load failure must not read as "there are no photos". */
const UNAVAILABLE = `**${MEDIA_NOTE_LABEL}:** I can't check right now.`;

const FOOTER = "\n\n---\n**Open on the site:**";

const published = (media: MediaIndexFile): MediaAsset[] => media.assets.filter((a) => !!a.url);

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** "3 photos and 1 clip", or just the half that exists. Empty for no assets. */
function counts(assets: MediaAsset[]): string {
  const clips = assets.filter((a) => a.kind === "video").length;
  const photos = assets.length - clips;
  return [photos ? plural(photos, "photo") : "", clips ? plural(clips, "clip") : ""]
    .filter(Boolean)
    .join(" and ");
}

/** Clip songs in curly quotes, deduped. Empty when no clip carries one. */
function songs(assets: MediaAsset[]): string {
  const titles = [...new Set(assets.flatMap((a) => (a.kind === "video" && a.song ? [a.song] : [])))];
  return titles.map((t) => `“${t}”`).join(", ");
}

/** " The clips show “Lies”.", or nothing. */
function songSentence(assets: MediaAsset[]): string {
  const list = songs(assets);
  if (!list) return "";
  const clips = assets.filter((a) => a.kind === "video").length;
  return ` ${clips === 1 ? "The clip shows" : "The clips show"} ${list}.`;
}

/** Every billing of one act. `slugs` comes from `resolveArtist`, which collapses aliases. */
export function artistMediaNote(
  media: MediaIndexFile | null,
  name: string,
  slugs: readonly string[],
): string {
  if (!media) return UNAVAILABLE;
  const mine = published(media).filter(
    (a) => a.artistNormalized !== null && slugs.includes(a.artistNormalized),
  );
  if (!mine.length) return "";
  const nights = new Set(mine.map((a) => a.date)).size;
  const across = nights > 1 ? ` across ${nights} nights` : "";
  return `**${MEDIA_NOTE_LABEL}:** ${counts(mine)} of ${name}${across}.${songSentence(mine)}`;
}

/** One night, act by act, then the room. Never a single total under the headliner's name. */
export function nightMediaNote(media: MediaIndexFile | null, date: string): string {
  if (!media) return UNAVAILABLE;
  const night = published(media).filter((a) => a.date === date);
  if (!night.length) return "";

  const acts = new Map<string, MediaAsset[]>();
  for (const a of night) {
    const key = a.artist ?? "";
    acts.set(key, [...(acts.get(key) ?? []), a]);
  }
  const room = acts.get("");
  acts.delete("");

  const parts = [...acts].map(([act, assets]) => {
    const list = songs(assets);
    return `${counts(assets)} of ${act}${list ? ` (${list})` : ""}`;
  });
  if (room) parts.push(`${counts(room)} of the room`);
  return `**${MEDIA_NOTE_LABEL} from this night:** ${parts.join("; ")}.`;
}

/** A set of nights, as one total: a venue's shows, or the rows a search returned. */
export function nightsMediaNote(media: MediaIndexFile | null, dates: readonly string[]): string {
  if (!media) return UNAVAILABLE;
  const wanted = new Set(dates);
  const found = published(media).filter((a) => wanted.has(a.date));
  if (!found.length) return "";
  const nights = new Set(found.map((a) => a.date)).size;
  const from = wanted.size === 1 ? "this night" : `${nights} of these ${wanted.size} nights`;
  return `**${MEDIA_NOTE_LABEL}:** ${counts(found)} from ${from}.${songSentence(found)}`;
}

/**
 * Puts a note above the "Open on the site" footer, which clients are told ends the result.
 * An empty note leaves the text alone.
 */
export function withMediaNote(text: string, note: string): string {
  if (!note) return text;
  const at = text.lastIndexOf(FOOTER);
  if (at === -1) return `${text}\n\n${note}`;
  return `${text.slice(0, at)}\n\n${note}${text.slice(at)}`;
}
