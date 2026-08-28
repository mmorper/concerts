/**
 * Artist and venue handles — the mention half of an entity reference.
 *
 * `tags.ts` already answers "how do we name The Human League in a post": a
 * generated `#TheHumanLeague`, artists first, venue second. This module
 * answers the narrower question of when we can name their *account* instead,
 * and it is built almost entirely out of reasons to decline.
 *
 * ## Why this is an allowlist and not a resolver
 *
 * Finding an artist's real account cannot be automated. Measured against
 * Bluesky's public API across all 257 artists, the strongest rule the platform
 * offers — a verification badge plus an exact display-name match — returned
 * `interpol.int` (INTERPOL, the international police organisation, verified,
 * 17k followers) for the band Interpol, and an MP for Edinburgh East for the
 * ska musician Chris Murray. Two wrong out of nineteen.
 *
 * Loosening is worse, not better: 80 artists have an account whose display
 * name is character-for-character theirs, and 41 of those have two or more.
 * The top hit for "New Order" is a private individual.
 *
 * This pipeline posts unattended on a daily schedule. So nothing here searches,
 * guesses, or reaches the network — a mention is a lookup in a reviewed file or
 * it does not happen. `harvest-handles.ts` does the finding, writes a
 * worksheet, and a human promotes rows into `data/social-handles.json`.
 *
 * ## Declining is free
 *
 * Every "no" in this module lands on the same fallback, and the fallback is
 * already shipping: `entityTags()` emits the hashtag whether or not a handle
 * exists. There is no error path, nothing logs a warning, and no caller has to
 * handle absence specially. That is what makes it safe for the rules below to
 * be as strict as they are.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { ROOT } from "./payload.ts";
import type { Channel } from "./types.ts";

export const HANDLES_PATH = join(ROOT, "data/social-handles.json");

/**
 * Where the identification came from — a closed union, and the publish gate.
 *
 * Same move `MediaSource` makes for imagery, for the same reason: if a mention
 * ever lands on the wrong person, "every post that used a handle from source
 * X" has to be one `grep` rather than an archaeology project.
 *
 * The absence of a member for search results is the point. A handle found by
 * scoring search hits has nowhere to be recorded, so it cannot publish even by
 * accident — the same structural "never" that keeps detector tags out of posts
 * by never reading `post.tags` at all.
 *
 * - `site-domain`  A Bluesky handle identical to the entity's official website
 *                  domain. Proven by DNS TXT or an HTTPS well-known file, so
 *                  whoever controls the official site set it. Stronger than
 *                  platform verification and the only rule safe to promote
 *                  unattended.
 * - `musicbrainz`  A curated URL relationship on the MusicBrainz entity.
 * - `wikidata`     A curated Wikidata property (P12361, P4033, P2002, P2003).
 * - `owner-checked` Mike looked at the account and said yes.
 */
export type HandleEvidence = "site-domain" | "musicbrainz" | "wikidata" | "owner-checked";

const EVIDENCE: readonly HandleEvidence[] = [
  "site-domain",
  "musicbrainz",
  "wikidata",
  "owner-checked",
];

/**
 * Strip a name to comparable letters: no diacritics, no punctuation, no
 * leading article. "Echo & The Bunnymen" → "echothebunnymen".
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Is this domain plausibly the ENTITY's, and not merely a domain somebody
 * proved they control?
 *
 * The DNS check answers a narrower question than it looks like it does. It
 * proves whoever set the record owns the domain — which is only an
 * identification if the domain is the artist's own. MusicBrainz lists
 * `lojinx.com` as Fountains of Wayne's official homepage; Lojinx is their
 * record label, and `lojinx.com` does resolve as a Bluesky handle. The proof
 * held perfectly and identified the wrong party.
 *
 * So the registrable name has to look like the entity's: one contains the
 * other, and the shorter is a substantial fraction of the longer. That keeps
 * `bunnymen` for Echo & The Bunnymen, `satriani` for Joe Satriani and
 * `emftheband` for EMF, and drops `lojinx` for Fountains of Wayne.
 *
 * The 0.3 floor is what `emf` inside `emftheband` needs. Below it, short
 * common words start matching long names by coincidence.
 */
export function domainMatchesEntity(domain: string, name: string): boolean {
  const left = fold(domain.replace(/^www\./, "").split(".").slice(0, -1).join("."));
  const right = fold(name);
  if (!left || !right) return false;
  if (!left.includes(right) && !right.includes(left)) return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 3 && shorter.length / longer.length >= 0.3;
}

/**
 * How long an unconfirmed row keeps publishing.
 *
 * This is a backstop, not the mechanism. The real check is `--verify`, which
 * re-resolves each stored DID and reports drift; the date catches the case
 * where that check itself quietly stopped running. An expired row is not an
 * error — it is the archive declining to vouch for something nobody has looked
 * at since the last presidential election cycle.
 *
 * ⚠️ X and Instagram will need a shorter number and a liveness probe. They
 * store a bare username with no stable identifier behind it and both platforms
 * recycle usernames, so a stale row there can genuinely point at a different
 * person. A Bluesky DID cannot be reassigned, which is why 18 months is
 * defensible here and would not be there. Set that number against those
 * platforms' behaviour when #334/#335 land, not by analogy to this one.
 */
export const VERIFIED_MAX_AGE_MONTHS = 18;

export interface HandleRecord {
  /** Display text. What the reader sees; never the identity. */
  handle: string;
  /**
   * Bluesky only, and REQUIRED there. Handles are mutable and re-assignable;
   * a DID is permanent. The facet carries this, so a mention always points at
   * the account that was actually verified even if it has since been renamed.
   */
  did?: string;
  evidence: HandleEvidence;
  /** `YYYY-MM-DD`. When a human or the domain rule last confirmed it. */
  verifiedAt: string;
  /**
   * An opt-out, and deliberately not a deleted row.
   *
   * A deleted row is indistinguishable from one that was never harvested, so
   * the next harvest would re-propose it and silently undo the request. The
   * row stays and carries the refusal.
   */
  blocked?: true;
}

export type EntityHandles = Partial<Record<Channel, HandleRecord>>;

export interface HandlesFile {
  version: 1;
  updatedAt: string;
  artists: Record<string, EntityHandles>;
  venues: Record<string, EntityHandles>;
}

export type EntityKind = "artist" | "venue";

export interface Mention {
  /** Rendered as `@handle`. */
  handle: string;
  /** Bluesky facet target. */
  did?: string;
  evidence: HandleEvidence;
  /**
   * Which entity this names — the artist or the venue.
   *
   * The adapter needs it to know WHICH tag the mention displaces. Dropping the
   * first tag instead would, on a venue mention, throw away the artist tag and
   * still print `@theanthem #TheAnthem`.
   */
  kind: EntityKind;
}

const EMPTY: HandlesFile = { version: 1, updatedAt: "", artists: {}, venues: {} };

let cache: HandlesFile | undefined;

/**
 * A missing file means "no handles on file", which is a normal state and the
 * one every artist starts in. It is emphatically NOT the ledger, where an
 * unreadable file throws because starting fresh would re-post the back
 * catalogue. The worst a missing file can do here is emit the hashtags we were
 * already emitting.
 */
export function loadHandles(path: string = HANDLES_PATH): HandlesFile {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as HandlesFile;
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? "",
      artists: parsed.artists ?? {},
      venues: parsed.venues ?? {},
    };
  } catch {
    return EMPTY;
  }
}

function handles(): HandlesFile {
  if (!cache) cache = loadHandles();
  return cache;
}

/**
 * `date` shifted by whole months, clamping rather than overflowing.
 *
 * 31 August minus 18 months is 28 February, not 3 March. The naive
 * `setUTCMonth(m - 18)` produces the latter because day 31 does not exist in
 * February and JavaScript rolls it forward, which would quietly grant three
 * extra days of validity on exactly the dates most likely to be month-ends.
 */
function shiftMonths(date: Date, delta: number): Date {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/**
 * Has this row gone past the point where the archive will still vouch for it?
 *
 * Day-precise on purpose. Counting whole months and flooring would let a row
 * verified eighteen months and twenty-nine days ago keep publishing, which
 * makes the stated window a lie by up to a month.
 *
 * An unparseable date reads as stale. A row whose own date we cannot
 * understand is exactly the row not to trust.
 */
export function isStale(
  verifiedAt: string,
  now: Date,
  maxMonths: number = VERIFIED_MAX_AGE_MONTHS
): boolean {
  const then = new Date(`${verifiedAt}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return true;
  return then.getTime() < shiftMonths(now, -maxMonths).getTime();
}

/**
 * The account to name for one entity on one channel, or nothing.
 *
 * Every gate below returns `undefined`, and `undefined` means "emit the
 * hashtag" — which is what the post was going to do anyway.
 */
export function mentionFor(
  kind: EntityKind,
  slug: string,
  channel: Channel,
  options: { now?: Date; file?: HandlesFile } = {}
): Mention | undefined {
  const now = options.now ?? new Date();
  const file = options.file ?? handles();
  const record = (kind === "artist" ? file.artists : file.venues)?.[slug]?.[channel];
  if (!record) return undefined;

  // Asked not to be tagged. Checked before anything else so no later rule can
  // accidentally resurrect the row.
  if (record.blocked) return undefined;

  if (!record.handle?.trim()) return undefined;

  // Evidence outside the union does not publish. A file hand-edited to say
  // `"evidence": "looked right"` fails here rather than at review time.
  if (!EVIDENCE.includes(record.evidence)) return undefined;

  // Bluesky mentions are addressed by DID, not by handle. A row without one
  // cannot be posted correctly, so it is not posted at all.
  if (channel === "bluesky" && !record.did) return undefined;

  if (isStale(record.verifiedAt, now)) return undefined;

  return { handle: record.handle, did: record.did, evidence: record.evidence, kind };
}

/**
 * The one mention a post may carry, following the tag priority in `tags.ts`
 * rather than inventing a second order: the lead artist, and the venue only
 * when the lead artist has no account.
 *
 * One, not several, for two reasons. The budget arithmetic in `budgets.ts`
 * only balances if a mention *replaces* the artist tag, and a post can only
 * replace the tag it has room for. And the blast radius has to stay bounded:
 * 40 of 58 liner notes name a single artist, but one venue-loyalty note names
 * twenty-two, and that post must never tag twenty-two accounts.
 *
 * The lead artist is the billing name and nothing reaches past it. A post
 * billed to Echo & The Bunnymen mentions the Bunnymen, never Ian McCulloch,
 * however much livelier his account is.
 */
export function mentionForPost(
  refs: { artists: string[]; venue?: string },
  channel: Channel,
  options: { now?: Date; file?: HandlesFile } = {}
): Mention | undefined {
  const lead = refs.artists[0];
  if (lead) {
    const artist = mentionFor("artist", lead, channel, options);
    if (artist) return artist;
  }
  if (refs.venue) return mentionFor("venue", refs.venue, channel, options);
  return undefined;
}
