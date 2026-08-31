/**
 * On This Day — turning a scored candidate into a publishable post (#333).
 *
 * Everything here is deterministic and testable without a network: image
 * resolution, cross-linking and URL construction. The two side-effecting steps
 * — rendering the card and authoring the social copy — live in the CLI, so
 * this module can be exercised in full without sharp or an API key.
 */

import { absoluteUrl, artistDeepLink, setlistDeepLink } from "../../src/utils/deepLinks.js";
import { classifyImageUrl } from "../syndication/provenance.ts";
import { SITE_URL } from "../syndication/payload.ts";
import { otdSlug, type OnThisDayPost } from "./types.ts";
import type { OnThisDayCandidate } from "./detect.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";
import type { Concert } from "../../src/types/concert.ts";

export interface BuildSources {
  artistsMetadata: Record<string, { name?: string; image?: string }>;
  venuesMetadata: Record<string, { name?: string; city?: string }>;
  /** Published liner notes, for cross-linking. */
  linerNotes: LinerNotesPost[];
  /**
   * Every concert, for `narrativeFacts`. Optional so the existing tests and any
   * caller that only wants a URL keep working — absent means the copy is
   * authored from the credit stack alone, which is what it did before.
   */
  concerts?: Concert[];
  /** The night's setlist, if one was cached. */
  setlists?: Map<string, { songs: string[] }>;
  /**
   * Dates a setlist actually exists for. A `?show=` link to a night with no
   * setlist opens an empty panel, so the liner-notes pipeline gates on this
   * and so does this one — a link we cannot stand behind is worse than a
   * less specific one.
   */
  datesWithSetlists: Set<string>;
}

/**
 * The liner note that covers this exact show, if one does.
 *
 * The spec: "When an On This Day hit lands on a show an existing liner note
 * already covers, link **the liner note**, not the generic deep link." It
 * recycles evergreen content into fresh impressions, which is most of how
 * small accounts actually accumulate clicks.
 *
 * **"Covers" means "is about that night", and matching loosely gets it
 * confidently wrong.** A first cut matched artist + year and linked a 40-years
 * -since-Oingo-Boingo post (Caliente Racetrack, 1987) to a `venue-ghost` note
 * about Irvine Meadows — because that note spans 13 artists and 16 years, so
 * Oingo Boingo and 1987 both appeared in it. The reader would have clicked
 * through to a post about a different venue.
 *
 * So there are two tiers, and no third:
 *
 * 1. **An explicit `?show=` deep link on the date.** The liner-notes pipeline
 *    only emits one when a setlist backs that specific night, so this is an
 *    exact match and needs no other evidence.
 * 2. **A single-artist note matching artist, venue AND year.** Requiring one
 *    artist is what excludes the venue-spanning and festival posts: a note
 *    listing thirteen acts is not about any one of them.
 *
 * Anything looser links to something that is merely adjacent, which is worse
 * than the deep link it would replace.
 */
export function findCoveringNote(
  candidate: OnThisDayCandidate,
  notes: LinerNotesPost[]
): LinerNotesPost | undefined {
  const show = candidate.shows[0];
  if (!show) return undefined;
  const showYear = Number(show.date.slice(0, 4));

  const exact = notes.find((n) =>
    n.deepLinks?.some(
      (l) => l.type === "setlist" && l.url.includes(`show=${encodeURIComponent(show.date)}`)
    )
  );
  if (exact) return exact;

  return notes.find(
    (n) =>
      !n.aggregate &&
      n.artists.length === 1 &&
      n.artists[0] === show.headlinerNormalized &&
      n.venues.includes(show.venueNormalized) &&
      n.years.includes(showYear)
  );
}

/**
 * Where the post sends a reader.
 *
 * Never hand-built — `src/utils/deepLinks.ts` is the single source of truth
 * for URL shape and is asserted against `test/fixtures/deep-link-urls.json`.
 */
export function resolveUrl(
  candidate: OnThisDayCandidate,
  sources: BuildSources
): { url: string; linerNoteSlug?: string } {
  const note = findCoveringNote(candidate, sources.linerNotes);
  if (note) {
    return { url: `${SITE_URL}/liner-notes/${note.slug}`, linerNoteSlug: note.slug };
  }

  const show = candidate.shows[0];
  const path = sources.datesWithSetlists.has(show.date)
    ? setlistDeepLink(show.headlinerNormalized, show.date)
    : artistDeepLink(show.headlinerNormalized);

  return { url: absoluteUrl(path, SITE_URL) };
}

/**
 * The image the card composites over.
 *
 * Single-show days only, so the subject is unambiguous and tier 2 routes by
 * subject exactly as the rubric says: an artist post takes the artist. Venue
 * photos are deliberately not reached for — #315 has 65 of 67 dead, and the
 * spec says not to design a tier-2 venue path around them until it closes.
 */
export function resolveImage(
  candidate: OnThisDayCandidate,
  sources: BuildSources
): string | undefined {
  const show = candidate.shows[0];
  return sources.artistsMetadata[show.headlinerNormalized]?.image;
}


/**
 * What the archive knows about this night, in sentences the model may use.
 *
 * 🔴 THE FIX FOR PADDING IS MATERIAL, NOT A RULE FORBIDDING IT.
 * An On This Day post has no prose behind it. Before this, the prompt received
 * five fields — artist, venue, city, date, age — and an instruction not to
 * invent anything, which is the correct instruction and leaves nothing to say.
 * So the copy talked about the filing instead of the night: "now 23 years in the
 * archive", "the full entry is on the site", "still in the log". All four
 * pending posts did it, and two of four hooks landed on the same move.
 *
 * Every line here is computed from concerts.json or the setlist cache, so the
 * model is choosing among true sentences rather than reaching for filler. It is
 * still told to use at most a couple — a list of facts recited in order is its
 * own kind of robotic.
 */
/** The project's normalization, matching `src/utils/normalize.ts`. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function narrativeFacts(
  candidate: OnThisDayCandidate,
  sources: BuildSources
): string[] {
  const show = candidate.shows[0];
  if (!show) return [];
  const concerts = sources.concerts;
  if (!concerts?.length) return [];

  const facts: string[] = [];
  const year = Number(show.date.slice(0, 4));

  // ── Where this night sits in the artist's run ──────────────────────────────
  //
  // 🔴 OPENER CREDITS ARE SIGHTINGS. 89 of 184 shows carry openers, so counting
  // headliner rows alone reports "the ONLY time I have seen them" about an act
  // seen twice. The same blind spot put "Caught Once, Never Again" on three
  // published headlines — The Alarm headlined UCLA in 1986 and opened for The
  // Human League in 2018.
  const byArtist = concerts
    .filter(
      (c) =>
        c.headlinerNormalized === show.headlinerNormalized ||
        (c.openers ?? []).some((o) => slugify(o) === show.headlinerNormalized)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  /** Which of those nights they OPENED, so the copy never calls one a headline slot. */
  const openedOn = new Set(
    byArtist
      .filter((c) => c.headlinerNormalized !== show.headlinerNormalized)
      .map((c) => c.date)
  );

  if (byArtist.length === 1) {
    facts.push(`This is the ONLY time I have seen ${show.headliner}. Once, and never again.`);
  } else {
    const index = byArtist.findIndex((c) => c.date === show.date);
    const asOpener = [...openedOn];
    facts.push(
      `I have seen ${show.headliner} ${byArtist.length} times; this was number ${index + 1}.`
    );
    if (asOpener.length) {
      facts.push(
        `${asOpener.length === 1 ? "One of those" : `${asOpener.length} of those`} was an opening slot, not a headline set` +
          ` (${asOpener.join(", ")}).`
      );
    }
    if (index === 0) {
      const next = byArtist[1];
      const gap = Number(next.date.slice(0, 4)) - year;
      facts.push(
        `It was the FIRST time. I did not see them again until ${next.date.slice(0, 4)}` +
          (gap >= 5 ? ` — ${gap} years later.` : ".")
      );
    } else if (index === byArtist.length - 1) {
      facts.push(`It is the most recent time I have seen them, and the last so far.`);
    }
    // A long silence on either side is the most reliably interesting shape here.
    // The forward gap is skipped on a first show because the branch above has
    // already said it — stated twice, it reads as two facts and is one.
    const prev = byArtist[index - 1];
    const next = index === 0 ? undefined : byArtist[index + 1];
    for (const [label, other] of [["before", prev], ["after", next]] as const) {
      if (!other) continue;
      const gap = Math.abs(Number(other.date.slice(0, 4)) - year);
      if (gap >= 8) {
        facts.push(
          label === "before"
            ? `The previous time I saw them was ${gap} years earlier, in ${other.date.slice(0, 4)}.`
            : `I did not see them again for ${gap} years, until ${other.date.slice(0, 4)}.`
        );
      }
    }
  }

  // ── Who else was on the bill ───────────────────────────────────────────────
  const thisShow = concerts.find((c) => c.date === show.date && c.headlinerNormalized === show.headlinerNormalized);
  if (thisShow?.openers?.length) {
    facts.push(`${thisShow.openers.join(" and ")} opened.`);
  }
  if (thisShow?.genre) facts.push(`Filed under ${thisShow.genre}.`);

  // ── The room ───────────────────────────────────────────────────────────────
  const atVenue = concerts.filter((c) => c.venueNormalized === show.venueNormalized);
  if (atVenue.length > 1) {
    facts.push(`I have been to ${show.venue} ${atVenue.length} times in all.`);
  } else {
    facts.push(`This is the only show I have ever seen at ${show.venue}.`);
  }

  // ── The year around it ─────────────────────────────────────────────────────
  const sameYear = concerts.filter((c) => c.year === year && c.date !== show.date);
  if (sameYear.length) {
    const names = [...new Set(sameYear.map((c) => c.headliner))];
    facts.push(
      `Other acts I saw in ${year}: ${names.slice(0, 6).join(", ")}` +
        (names.length > 6 ? `, and ${names.length - 6} more.` : ".")
    );
  } else {
    facts.push(`This was the only concert I went to in all of ${year}.`);
  }

  // ── What was actually played ───────────────────────────────────────────────
  //
  // 🔴 A SHORT SETLIST IS MISSING DATA, NOT A SHORT NIGHT. setlist.fm entries are
  // crowd-sourced and frequently partial: The Smithereens at the Birchmere has
  // exactly one song on file, which produced "They opened with 'Behind the Wall
  // of Sleep' and closed with 'Behind the Wall of Sleep'" and "1 songs on the
  // setlist". Neither is true of the night — both are true of the record of it.
  // Three is the floor at which an opener and a closer are different songs and
  // the count is worth stating.
  const MIN_SETLIST = 3;
  const songs =
    sources.setlists?.get(`${show.date}::${show.headlinerNormalized}`)?.songs ??
    sources.setlists?.get(show.date)?.songs;
  if (songs && songs.length >= MIN_SETLIST) {
    facts.push(`They opened with "${songs[0]}" and closed with "${songs[songs.length - 1]}".`);
    facts.push(`${songs.length} songs on the setlist that night.`);
  }

  return facts;
}

export interface BuiltPost {
  post: Omit<OnThisDayPost, "cardPath" | "social" | "publishedAt">;
  /** Why it cannot publish, if it cannot. Never sent to a platform. */
  ineligible?: string;
}

/**
 * Assemble everything that does not require a network call.
 *
 * Returns an `ineligible` reason rather than throwing or returning undefined:
 * a day that cannot publish should still appear in the run log saying why,
 * the same posture `buildPayload` takes in Phase 1.
 */
export function buildPost(candidate: OnThisDayCandidate, sources: BuildSources): BuiltPost {
  const show = candidate.shows[0];
  const artist = sources.artistsMetadata[show.headlinerNormalized]?.name ?? show.headliner;
  const venueMeta = sources.venuesMetadata[show.venueNormalized];

  const imageUrl = resolveImage(candidate, sources);
  const provenance = classifyImageUrl(imageUrl);
  const { url, linerNoteSlug } = resolveUrl(candidate, sources);

  const post = {
    slug: otdSlug(candidate.publishYear, candidate.day),
    day: candidate.day,
    showDate: show.date,
    age: candidate.ages[0],
    artist,
    artistNormalized: show.headlinerNormalized,
    venue: venueMeta?.name ?? show.venue,
    venueNormalized: show.venueNormalized,
    city: venueMeta?.city ?? show.city,
    score: candidate.score,
    imageUrl,
    tier: provenance?.tier ?? 2,
    source: provenance?.source ?? "artist-audiodb",
    url,
    ...(linerNoteSlug ? { linerNoteSlug } : {}),
  } satisfies BuiltPost["post"];

  // Never bare type. An artist with no image cannot produce a card that
  // carries imagery, and a solid-ground card is exactly what the rubric
  // forbids — so it does not publish rather than publishing badly.
  if (!imageUrl) {
    return { post, ineligible: `no image for ${artist} — would render as bare type` };
  }
  if (!provenance) {
    return { post, ineligible: `unclassified image host for ${artist}` };
  }

  return { post };
}
