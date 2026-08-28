/**
 * Social Syndication — canonical payload builder (#329).
 *
 * Assembles a `SyndicationPayload` from a published liner note. The split is
 * deliberate and load-bearing:
 *
 * - The **text** (`hook`, `beats`, `caption`) is authored by the generation
 *   step and read off `post.social`. This module never writes it, never
 *   truncates prose into it, and refuses to publish a post that does not have
 *   it. See scripts/liner-notes/social.ts.
 * - Everything else — credit, media, tags, url — is **structured off the
 *   record**. Names on the card are furniture, not prose the generator is
 *   trusted to include.
 *
 * `eligible: false` is where the imagery rubric and the #327 provenance record
 * are enforced in code. `ineligibleReasons` exists so a suppressed post shows
 * up in the run log with a reason instead of silently not appearing.
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { classifyImageUrl, hostOf } from "./provenance.ts";
import { regionLabel } from "./region.ts";
import { entityTags } from "./tags.ts";
import { isPublishableTier, type MediaAsset, type PayloadCredit, type SyndicationPayload } from "./types.ts";
import { HOOK_MAX, BEATS_MAX, BEATS_MIN, CAPTION_MAX } from "./budgets.ts";
import { graphemeLength } from "./text.ts";
import { normalizeArtistName } from "../../src/utils/normalize.js";
import type { Concert } from "../../src/types/concert.ts";
import type { LinerNotesPost } from "../../src/types/liner-notes.ts";
import type { OnThisDayPost } from "../on-this-day/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..");

export const SITE_URL = "https://concerts.morperhaus.org";

/**
 * The card the wide channels post — the frozen `WideSplit` design (#361), drawn at post time.
 *
 * 🔴 NOT COMMITTED, AND DRAWN BY THE RUN THAT POSTS IT.
 *
 * A rendition is a pure function of (master, channel), so a committed one is stale the
 * moment that function changes (#342). That is not a theoretical risk here: `public/og/`
 * holds 67 cards composited by a renderer that has since been rewritten twice, and nothing
 * regenerates them.
 *
 * Drawing it in the run that posts it removes the staleness by construction — a card cannot
 * disagree with the design that made it. It has to be that run specifically: Liner Notes and
 * Syndicate are separate scheduled jobs on separate machines, each starting from a fresh
 * checkout, so anything Monday's job renders and does not commit is gone by Tuesday.
 *
 * The cost, named: a headless browser in a daily workflow. `DECISIONS.md` §8 accepted that
 * when it chose browser rendering over hand-built SVG.
 *
 * THE LEGACY OG CARD IS UNAFFECTED. `public/og/liner-notes/` stays exactly where it is and
 * keeps serving the site's own `<meta>` tags, where a committed file is the right answer
 * because it is fetched by strangers' link unfurlers rather than by us.
 */
export function cardPath(slug: string): string {
  return `.renditions/${slug}-wide.png`;
}

export interface PayloadSources {
  concerts: Concert[];
  artistsMetadata: Record<string, { name?: string }>;
  venuesMetadata: Record<string, { name?: string; city?: string; state?: string }>;
  /** Injected so the builder is testable without a filesystem. */
  cardExists?: (path: string) => boolean;
}

// ── Credit ───────────────────────────────────────────────────────────────────

/**
 * The night a post is anchored to.
 *
 * A post about a 38-year span still renders one date on the card, because the
 * credit stack is furniture identifying *a* show, not a summary of the story.
 * The chain narrows from exact to earliest:
 *
 *   1. The `?show=` deep link, when the post has one — that IS the night, and
 *      the pipeline only emits it when a setlist backs it up.
 *   2. Artist ∩ venue ∩ years resolving to exactly one concert.
 *   3. Artist ∩ years resolving to exactly one concert.
 *   4. The earliest concert by the lead artist inside the post's years. For a
 *      longevity post that is the right anchor anyway: the first night is what
 *      the span is measured from.
 *
 * Returning undefined is a publishable outcome — the post is simply not
 * eligible, and says why — never a thrown error in a weekly unattended run.
 */
export function resolveAnchorConcert(
  post: LinerNotesPost,
  concerts: Concert[]
): Concert | undefined {
  const showLink = post.deepLinks?.find((l) => l.type === "setlist");
  const showDate = showLink?.url.match(/[?&]show=([^&]+)/)?.[1];
  if (showDate) {
    const exact = concerts.find((c) => c.date === decodeURIComponent(showDate));
    if (exact) return exact;
  }

  const lead = post.artists[0];
  if (!lead) return undefined;

  const years = new Set(post.years);
  const venues = new Set(post.venues);

  const byArtist = concerts.filter(
    (c) => c.headlinerNormalized === lead || c.openers?.some((o) => normalizedOpener(o) === lead)
  );

  const inYears = byArtist.filter((c) => years.has(c.year));
  const pool = inYears.length ? inYears : byArtist;

  const atVenue = pool.filter((c) => venues.has(c.venueNormalized));
  if (atVenue.length === 1) return atVenue[0];
  if (pool.length === 1) return pool[0];

  const ordered = (atVenue.length ? atVenue : pool)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return ordered[0];
}

/**
 * `concert.openers` holds DISPLAY names ("The Reflex"), while `post.artists`
 * holds normalized slugs — so the two only compare after normalizing, through
 * the same function the rest of the project uses. Comparing them raw looks
 * like it works and silently never matches, which would leave every
 * opener-subject post unable to resolve a night.
 *
 * A shape we do not recognise returns undefined and simply does not match: an
 * opener we cannot identify must not anchor a post to the wrong night.
 */
function normalizedOpener(opener: unknown): string | undefined {
  if (typeof opener === "string") return normalizeArtistName(opener);
  if (opener && typeof opener === "object") {
    const value = opener as { normalizedName?: string; nameNormalized?: string; name?: string };
    return value.normalizedName ?? value.nameNormalized ?? (value.name ? normalizeArtistName(value.name) : undefined);
  }
  return undefined;
}

export function buildCredit(
  post: LinerNotesPost,
  concert: Concert,
  sources: PayloadSources
): PayloadCredit {
  const artists = post.artists
    .map((slug) => sources.artistsMetadata[slug]?.name ?? displayFromSlug(slug))
    .filter(Boolean);

  const venueSlug = post.venues.includes(concert.venueNormalized)
    ? concert.venueNormalized
    : post.venues[0] ?? concert.venueNormalized;
  const venueMeta = sources.venuesMetadata[venueSlug];

  return {
    artists: artists.length ? artists : [concert.headliner],
    // Most posts have no track. The meta stack must not look short when it is
    // absent — it renders three lines or two, and two is the common case.
    song: post.audio?.role === "subject" ? post.audio.trackName : undefined,
    venue: venueMeta?.name ?? concert.venue,
    city: venueMeta?.city ?? concert.city,
    region: regionLabel(venueMeta?.state).label || undefined,
    date: concert.date,
  };
}

/** Last resort only: every artist in the archive has metadata, but a rename can race it. */
function displayFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// ── Media ────────────────────────────────────────────────────────────────────

/**
 * Alt text is required, never optional — so it is never `post.image.alt ?? ""`.
 *
 * The stored alt describes the *source photograph* ("Born to Kill"), which is
 * accurate for the artist scene and useless as the alt for a social card that
 * also carries a headline. What ships describes the card.
 */
export function cardAlt(post: LinerNotesPost, credit: PayloadCredit): string {
  const subject = post.image?.alt?.trim();
  const names = credit.artists.join(", ");
  const base = `${names} at ${credit.venue}, ${credit.city}, ${formatDate(credit.date)}.`;
  const overlay = ` Card reads: ${post.headline}.`;

  // The stored alt is usually an album title, which adds real information. It
  // is sometimes just the artist's name, which would read "Nile Rodgers. Nile
  // Rodgers, Duran Duran at…" — a stutter for anyone actually listening to it.
  const redundant =
    !subject ||
    subject === names ||
    credit.artists.some((a) => a.toLowerCase() === subject.toLowerCase());

  return redundant ? `${base}${overlay}` : `${subject}. ${base}${overlay}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][(m ?? 1) - 1];
  return `${d} ${month} ${y}`;
}

// ── Payload ──────────────────────────────────────────────────────────────────

export function buildPayload(
  post: LinerNotesPost,
  sources: PayloadSources
): SyndicationPayload {
  const reasons: string[] = [];
  const exists = sources.cardExists ?? ((p: string) => existsSync(join(ROOT, p)));

  const concert = resolveAnchorConcert(post, sources.concerts);
  const credit: PayloadCredit = concert
    ? buildCredit(post, concert, sources)
    : { artists: [], venue: "", city: "", date: "" };
  if (!concert) reasons.push("no concert resolves for the credit stack");

  // ── Text: authored, never derived ──────────────────────────────────────
  const social = post.social;
  if (!social) {
    reasons.push("no authored social text (post predates the syndication stage)");
  } else {
    if (!social.hook?.trim()) reasons.push("empty hook");
    else if (graphemeLength(social.hook) > HOOK_MAX) reasons.push(`hook ${graphemeLength(social.hook)} chars (max ${HOOK_MAX})`);
    if (!social.caption?.trim()) reasons.push("empty caption");
    else if (graphemeLength(social.caption) > CAPTION_MAX) reasons.push(`caption ${graphemeLength(social.caption)} chars (max ${CAPTION_MAX})`);
    if (social.beats) {
      if (social.beats.length < BEATS_MIN || social.beats.length > BEATS_MAX) {
        reasons.push(`${social.beats.length} beats (want ${BEATS_MIN}–${BEATS_MAX})`);
      }
      const over = social.beats.filter((b) => graphemeLength(b) > HOOK_MAX);
      if (over.length) reasons.push(`${over.length} beat(s) over ${HOOK_MAX} chars`);
    }
  }

  // ── Media: never bare type ─────────────────────────────────────────────
  const media: MediaAsset[] = [];
  const provenance = classifyImageUrl(post.image?.url);
  const path = cardPath(post.slug);

  if (!provenance) {
    reasons.push(`unclassified image host: ${hostOf(post.image?.url)}`);
  } else if (!exists(path)) {
    /* Not a failure at THIS point in a real run — the card is drawn after selection, so it
       cannot exist yet. `renderSelected` in run.ts re-checks and drops anything that failed
       to draw, with its own reason. The guard moved; it did not go away, and a post with no
       renderable card still never reaches a channel.

       `cardExists` is injected by the run for exactly this, and defaults to a real
       filesystem check so every other caller — tests, one-off scripts — behaves as before. */
    reasons.push(`card not rendered: ${path}`);
  } else if (post.image?.cardFallback) {
    // The card exists and the URL classifies fine, but the image could not be
    // fetched when it was rendered — so the card is type on a solid ground.
    // That is bare type, and the source URL gives no hint of it.
    reasons.push("card fell back to a solid ground — bare type");
  } else {
    const asset: MediaAsset = {
      role: "card",
      aspect: "1.91:1",
      path,
      alt: cardAlt(post, credit),
      tier: provenance.tier,
      source: provenance.source,
    };
    // Tier 1 ONLY. The absence on tiers 2 and 3 is what makes the rubric
    // visible, so this is never filled in "for consistency".
    if (provenance.tier === 1 && post.image?.credit) asset.byline = post.image.credit;
    media.push(asset);
  }

  // "Never bare type" as the last gate. Exactly one reason is recorded: the
  // earlier branches already said *why* there is no asset, and repeating
  // "no publishable media" after "card not rendered" tells an operator nothing
  // they did not already know.
  const publishable = media.filter(isPublishableTier);
  if (media.length && !publishable.length) {
    reasons.push("only a generic site fallback image — below the tier-3 floor");
  }
  // Belt and braces rather than the common case: `media` is only empty when a
  // branch above already recorded why, and repeating "no publishable media"
  // after "card not rendered" tells an operator nothing new.
  if (!publishable.length && !reasons.length) {
    reasons.push("no publishable media — never bare type");
  }

  const tags = concert
    ? entityTags({
        artists: credit.artists,
        venue: credit.venue,
        city: credit.city,
        date: credit.date,
      })
    : [];

  return {
    slug: post.slug,
    kind: "liner-note",
    hook: social?.hook ?? "",
    ...(social?.beats?.length ? { beats: social.beats } : {}),
    caption: social?.caption ?? "",
    credit,
    url: `${SITE_URL}/liner-notes/${post.slug}`,
    media: publishable,
    tags,
    eligible: reasons.length === 0,
    ineligibleReasons: reasons,
  };
}

// ── On This Day ──────────────────────────────────────────────────────────────

/**
 * The second stream, on the SAME canonical payload (#333).
 *
 * This function exists to prove the architecture rather than to extend it:
 * nothing downstream of here knows there are two content streams. No adapter
 * changed, no channel formatting branched, and the ledger keys On This Day
 * rows exactly as it keys liner-note rows. `kind` is the only field that
 * differs, and it is consumed by `withUtm` for campaign attribution — not by
 * any adapter.
 *
 * Where the liner-note builder resolves an anchor concert out of a post that
 * only implies one, On This Day already carries its show. Almost everything
 * here is a read rather than a resolution, which is why it is short.
 */
export function buildOnThisDayPayload(post: OnThisDayPost): SyndicationPayload {
  const reasons: string[] = [];

  const credit: PayloadCredit = {
    artists: [post.artist],
    venue: post.venue,
    city: post.city,
    date: post.showDate,
  };

  const social = post.social;
  if (!social) {
    reasons.push("no authored social text");
  } else {
    if (!social.hook?.trim()) reasons.push("empty hook");
    else if (graphemeLength(social.hook) > HOOK_MAX) {
      reasons.push(`hook ${graphemeLength(social.hook)} chars (max ${HOOK_MAX})`);
    }
    if (!social.caption?.trim()) reasons.push("empty caption");
    else if (graphemeLength(social.caption) > CAPTION_MAX) {
      reasons.push(`caption ${graphemeLength(social.caption)} chars (max ${CAPTION_MAX})`);
    }
  }

  const media: MediaAsset[] = [];
  if (!existsSync(join(ROOT, post.cardPath))) {
    reasons.push(`card not rendered: ${post.cardPath}`);
  } else {
    media.push({
      role: "card",
      aspect: "1.91:1",
      path: post.cardPath,
      alt: onThisDayAlt(post),
      tier: post.tier,
      source: post.source,
    });
  }

  const publishable = media.filter(isPublishableTier);
  if (media.length && !publishable.length) {
    reasons.push("only a generic site fallback image — below the tier-3 floor");
  }
  if (!publishable.length && !reasons.length) {
    reasons.push("no publishable media — never bare type");
  }

  return {
    slug: post.slug,
    kind: "on-this-day",
    hook: social?.hook ?? "",
    ...(social?.beats?.length ? { beats: social.beats } : {}),
    caption: social?.caption ?? "",
    credit,
    url: post.url,
    media: publishable,
    tags: entityTags({
      artists: [post.artist],
      venue: post.venue,
      city: post.city,
      // Tagged by the DECADE OF THE SHOW, not of the anniversary. A 1987 show
      // posted in 2027 belongs in #1980s; tagging it #2020s would file the
      // archive's own history under the year someone happened to read it.
      date: post.showDate,
    }),
    eligible: reasons.length === 0,
    ineligibleReasons: reasons,
  };
}

/**
 * Alt text describing the card, not the source photograph.
 *
 * The date leads, because the card leads with it — a screen-reader user should
 * meet the post the same way a sighted one does.
 */
export function onThisDayAlt(post: OnThisDayPost): string {
  return (
    `${post.age} years ago today: ${post.artist} at ${post.venue}, ${post.city}, ` +
    `${formatDate(post.showDate)}.`
  );
}
