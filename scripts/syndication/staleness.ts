/**
 * Facts that were true when a note was written and are not true now.
 *
 * A liner note is generated once and syndicated later — sometimes months later,
 * because the back-catalogue drip reaches back through the archive oldest-first.
 * In that gap the archive keeps moving, and the note does not.
 *
 * The specific rot this catches: a show that was **future-dated** in
 * `concerts.json` when the note was generated, and has since happened. The
 * detector counts shows that have occurred, so the note's arithmetic was right
 * on the day and silently stops being right afterwards. Nothing downstream can
 * notice — the prose reads well, the card renders, every voice check passes.
 *
 * Measured case: `venue-loyalty-pacific-amphitheatre`, generated 2026-07-20 as
 * "16 Shows Over 5 Decades". Nile Rodgers played there on 2026-07-31 — already
 * in the archive at generation time, eleven days in the future. By September the
 * note said 16 where the archive said 17, and its social copy read "The English
 * Beat closed it in 2024" about a venue the owner had returned to since.
 *
 * `doNotSyndicate` is the same judgement made by hand — its own docstring names
 * Blancmange, a note that is "accurate as written" until they open for Thompson
 * Twins on 2026-09-16. This is that check, run mechanically, for the cases
 * nobody remembers to look for.
 *
 * It is a measurement, not an opinion about wording: it never reads the prose.
 * A note is stale when a show **by its own subject** has happened since it was
 * published. That is why the subject is taken from the post `id` rather than
 * from `artists`/`venues` — a venue-loyalty note cross-references every act seen
 * in the room, and any of those fourteen playing anywhere else would otherwise
 * flag a note that is perfectly true.
 */

import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";

/**
 * Detectors whose finding is a RUNNING TOTAL or a TERMINAL claim, and which a
 * later show can therefore falsify. Derived from the corpus, by reading what
 * each detector actually puts in a headline:
 *
 *   venue-loyalty        "Pacific Amphitheatre: 16 Shows Over 5 Decades"
 *   artist-longevity     "Depeche Mode: 38 Years of Shows"
 *   drought-comeback     "UB40: 35 Years Between Shows"
 *   venue-ghost          "Irvine Meadows: 16 Shows Before It Was Demolished"
 *   rare-sighting        "Blancmange: Caught Once, Never Again"
 *   geographic-chapter   "My West Coast Chapter: 26 Concerts Over 11 Years"
 *   most-witnessed-album "Garbage — 17 Songs From The Album ..., Live"
 *
 * Every one of those is a number the archive can move, or a "never again" the
 * archive can contradict.
 *
 * Everything else is ANCHORED to a particular night and stays true forever:
 * `festival-mega-bill` ("The Human League + 8 More: 2018 Festival Bill"),
 * `calendar-anniversary`, `city-pulse`, `concert-streak`, `album-context`,
 * `road-tested`, `genre-outlier`, `full-circle` ("39 Years Apart" — two fixed
 * points), and `opener-to-headliner` (a completed arc; playing again does not
 * un-complete it).
 *
 * The distinction is not cosmetic. Without it this check blocks
 * `festival-mega-bill-2018-05-12-the-human-league` because The Human League
 * played the Hollywood Bowl in June 2026 — a fact that has no bearing on a note
 * about one night in 2018, and the note would be suppressed for no reason.
 */
export const CUMULATIVE_DETECTORS = new Set([
  "venue-loyalty",
  "artist-longevity",
  "drought-comeback",
  "venue-ghost",
  "rare-sighting",
  "geographic-chapter",
  "most-witnessed-album",
]);

export interface StaleFact {
  /** Normalized entity the note is about. */
  subject: string;
  /** "venue" | "artist" — what the subject resolved to in the archive. */
  kind: "venue" | "artist";
  /** Shows by this subject that happened after the note was published. */
  since: string[];
}

/**
 * The entities a note is actually ABOUT.
 *
 * `post.id` is deterministic and built from the detector plus its subject
 * (`venue-loyalty-pacific-amphitheatre`), so an entity whose normalized name
 * appears in the id is the subject and one that does not is a cross-reference.
 */
export function subjectsOf(post: LinerNotesPost): string[] {
  const id = (post.id ?? "").toLowerCase();
  const candidates = [...(post.venues ?? []), ...(post.artists ?? [])];
  return candidates.filter((e) => e && id.includes(e.toLowerCase()));
}

function showsFor(subject: string, concerts: Concert[]): { kind: "venue" | "artist"; dates: string[] } | undefined {
  const venue = concerts.filter((c) => c.venueNormalized === subject);
  if (venue.length) return { kind: "venue", dates: venue.map((c) => c.date) };
  const artist = concerts.filter(
    (c) =>
      c.headlinerNormalized === subject ||
      (c.openers ?? []).some((o) => normalize(o) === subject)
  );
  if (artist.length) return { kind: "artist", dates: artist.map((c) => c.date) };
  return undefined;
}

/** Mirrors the archive's own convention: hyphenated lowercase. */
function normalize(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Shows by the note's own subject that happened after it was published.
 *
 * `today` is injected so a run is reproducible and the tests do not depend on
 * the wall clock. A show still in the future is NOT stale — the note remains
 * true until the night actually happens, which is the whole mechanism.
 */
export function staleFacts(
  post: LinerNotesPost,
  concerts: Concert[],
  today: string = new Date().toISOString().slice(0, 10)
): StaleFact[] {
  if (!CUMULATIVE_DETECTORS.has(post.detector)) return [];

  // `factsAsOf` when the post has been repaired, `publishedAt` otherwise. A
  // regenerated post keeps its original publication date by design (#232), so
  // publication is not when its numbers were counted.
  const publishedDay = (post.factsAsOf ?? post.publishedAt ?? "").slice(0, 10);
  if (!publishedDay) return [];

  const out: StaleFact[] = [];
  for (const subject of subjectsOf(post)) {
    const hits = showsFor(subject, concerts);
    if (!hits) continue;
    const since = hits.dates
      .filter((d) => d > publishedDay && d <= today)
      .sort();
    if (since.length) out.push({ subject, kind: hits.kind, since });
  }
  return out;
}

/** One line per stale subject, for `ineligibleReasons`. */
export function describeStaleFacts(facts: StaleFact[]): string[] {
  return facts.map(
    (f) =>
      `stale: ${f.kind} "${f.subject}" has played ${f.since.length} show(s) since this note was written (${f.since.join(", ")}) — its counts and its "last time" framing are out of date`
  );
}
