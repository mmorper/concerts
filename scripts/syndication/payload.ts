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
  /* JPEG, not PNG. #342: "JPEG (mozjpeg, q82) as the universal primary". The cards were
     written as PNG screenshots at ~875KB against Bluesky's 1MB ceiling — which read as a
     quality-ladder problem and was a format one. The same card at q82 is 124KB. */
  return `.renditions/${slug}-wide.jpg`;
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

/**
 * The venue of the night the card is about.
 *
 * Shared by the credit stack and `refs`, so a venue mention can never be addressed to a
 * different venue than the one printed on the card.
 */
export function resolveVenueSlug(_post: LinerNotesPost, concert: Concert): string {
  /* 🔴 THE VENUE AND THE DATE COME FROM THE SAME SHOW, ALWAYS.

     This used to prefer `post.venues[0]` when the concert's venue was not one the post
     named, on the reasoning that the credit stack should follow the post. The date never
     followed with it — `buildCredit` takes that straight off the concert — so the two
     could describe different nights, and did: "Hard Rock Cafe · November 2017", a venue
     from a 1995 show and a date from a 2017 one.

     Naming a night is `cardConcert`'s job and it makes that call once. By the time a
     concert reaches here it IS the answer, and the credit's only remaining job is to
     describe it consistently.

     Measured before removing: the override branch fires on 0 of 58 posts through the
     anchor path, so this changes nothing that is currently correct. It only closes the
     path that produced a show which never happened. */
  return concert.venueNormalized;
}

/**
 * The night the CARD is about — one rule, used by the payload and the renderer alike.
 *
 * 🔴 THEY CHOSE DIFFERENTLY, AND THE ALT TEXT PAID FOR IT.
 * `resolveAnchorConcert` always returns a concert; for a span post it falls through to
 * "earliest by the lead artist", which its own doc calls furniture rather than a claim. The
 * renderer overrode that for a tier-1 card so the credit stack would follow the photograph,
 * and `cardAlt` kept using the payload's answer. Measured on
 * `crowded-house-from-opener-to-headliner`:
 *
 *     the card says   The Wiltern · Los Angeles, CA · May 2023   ← the photograph's night
 *     the alt says    Olympic Velodrome, Carson, 18 September 1993
 *
 * A sighted reader and a screen-reader user were given different shows. That is an
 * accessibility failure before it is a factual one, and it is the same class of bug as the
 * renderer re-deciding tier: two places answering one question.
 *
 * The rule, in one place now:
 *   - a post ABOUT ONE NIGHT (it has a `?show=` link) → that night, always. It is the
 *     subject, and the byline discloses the photograph's own date separately.
 *   - a post about a SPAN carrying a tier-1 photograph → the night it was taken. There is no
 *     subject night to name, and naming an arbitrary one puts the picture and its caption
 *     in disagreement.
 *   - anything else → `resolveAnchorConcert`.
 */
export function cardConcert(
  post: LinerNotesPost,
  concerts: Concert[],
  shotOn?: string
): Concert | undefined {
  const showLink = post.deepLinks?.find((l) => l.type === "setlist");
  const postNight = showLink?.url.match(/[?&]show=([^&]+)/)?.[1];

  /* 🔴 A `?show=` LINK IS NOT THE TEST FOR "IS THIS ABOUT ONE NIGHT". It is the test for
     "does setlist.fm have this night", which is a different question with a different
     answer on 12 of 58 posts.

     `the-brian-setzer-orchestra-days-after-the-bends-dropped` names one year and one venue
     — Hard Rock Cafe, 1995, days after The Bends dropped. It is as single-night as a post
     gets. It carries no `?show=` link only because no setlist exists for a 1995 club show,
     and that absence read as "span", so the card followed a 2017 photograph and announced
     a Hard Rock Cafe show in November 2017. That show never happened.

     The post's own data answers the question directly: one year and one venue is one night.
     Ask that, and the setlist's existence stops deciding what the card is about. */
  const singleNight = post.years?.length === 1 && post.venues?.length === 1;

  if (!postNight && !singleNight && shotOn) {
    const thatNight = concerts.find((c) => c.date === shotOn);
    if (thatNight) return thatNight;
  }
  return resolveAnchorConcert(post, concerts);
}

export function buildCredit(
  post: LinerNotesPost,
  concert: Concert,
  sources: PayloadSources
): PayloadCredit {
  const artists = post.artists
    .map((slug) => sources.artistsMetadata[slug]?.name ?? displayFromSlug(slug))
    .filter(Boolean);

  const venueMeta = sources.venuesMetadata[resolveVenueSlug(post, concert)];

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

  const concert = cardConcert(post, sources.concerts, post.image?.shotOn);
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
      sourceUrl: post.image!.url,
      alt: cardAlt(post, credit),
      tier: provenance.tier,
      source: provenance.source,
    };
    // Tier 1 only, and only when the owner drew one. An absent box is not {0,0,1,1} — the
    // renderer must be able to tell "unreviewed" from "cropped to the full frame".
    if (post.image?.crop) asset.crop = { ...post.image.crop };
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
        /* EVERY venue the post covers, anchor first. `credit.venue` alone meant a post about
           three venues could only ever surface under one of them. Display names, resolved
           through venuesMetadata the same way the credit stack resolves its own. */
        venues: [
          credit.venue,
          ...post.venues
            .map((slug) => sources.venuesMetadata[slug]?.name)
            .filter((name): name is string => Boolean(name) && name !== credit.venue),
        ],
        city: credit.city,
        date: credit.date,
      })
    : [];

  return {
    slug: post.slug,
    kind: "liner-note",
    category: post.category,
    hook: social?.hook ?? "",
    ...(social?.beats?.length ? { beats: social.beats } : {}),
    caption: social?.caption ?? "",
    credit,
    // Slugs straight off the record, never re-derived from the display names
    // in `credit` — see the note on `refs` in types.ts for the 23 artists that
    // do not survive the round trip and the two that collide.
    refs: {
      artists: post.artists,
      venue: concert ? resolveVenueSlug(post, concert) : undefined,
    },
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
  /* 🔴 ON THIS DAY DRAWS THE SAME CARD NOW.
     It used to attach `post.cardPath` — a 1200x630 composited by the legacy sharp + SVG
     path and committed to the repo. That meant two visual identities in one feed: a
     follower would see the frozen `WideSplit` design on a liner note and the old card on an
     On This Day post, an hour apart, from the same account.
     
     Nothing here had to be rebuilt for it. Once the renderer takes a payload instead of a
     post, and once `sourceUrl` says where the photograph comes from, both streams are just
     payloads and the card is drawn the same way for each. That is the refactor paying for
     itself rather than a second implementation.

     `existsSync` is gone for the same reason it went on the liner-notes path: the card is
     drawn after selection, and `renderSelected` re-checks for real. */
  if (!post.imageUrl) {
    reasons.push("no image — never bare type");
  } else {
    media.push({
      role: "card",
      aspect: "1.91:1",
      path: cardPath(post.slug),
      sourceUrl: post.imageUrl,
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
    refs: { artists: [post.artistNormalized], venue: post.venueNormalized },
    url: post.url,
    media: publishable,
    tags: entityTags({
      artists: [post.artist],
      // An On This Day post is one night at one venue by construction.
      venues: [post.venue],
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
