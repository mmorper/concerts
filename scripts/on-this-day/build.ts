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

export interface BuildSources {
  artistsMetadata: Record<string, { name?: string; image?: string }>;
  venuesMetadata: Record<string, { name?: string; city?: string }>;
  /** Published liner notes, for cross-linking. */
  linerNotes: LinerNotesPost[];
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
