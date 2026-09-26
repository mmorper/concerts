/**
 * Bluesky adapter (#332).
 *
 * One of the two zero-friction channels: an app password with **no expiry**,
 * revocable, no review process, and no penalty on outbound links. Between
 * Bluesky and Mastodon the whole architecture is validated — everything after
 * this is one more adapter against a proven canonical payload.
 *
 * Three things here are Bluesky-specific and all three are load-bearing:
 *
 * - **Facets are byte offsets.** See facets.ts; this module never computes an
 *   offset itself.
 * - **The card is an image post, not a link card** (2026-09-26,
 *   `docs/specs/future/social-portrait-posts.md`). A 1.91:1 link card is the
 *   shortest thing the app draws full-width — about a fifth of a phone screen.
 *   The 4:5 card is uploaded as a blob and posted as `app.bsky.embed.images`,
 *   and the link rides in the text as a facet. Bluesky allows one or the
 *   other, never both.
 * - **The limit is 300 graphemes**, a third unit again from bytes or code units.
 *
 * Credentials: `BLUESKY_IDENTIFIER` (the handle) and `BLUESKY_APP_PASSWORD`.
 * Never the account password — an app password is scoped and revocable.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { CHANNEL_LIMITS } from "../budgets.ts";
import { FacetedText, graphemeLength } from "../facets.ts";
import { mentionsForPost, type HandlesFile, type Mention } from "../handles.ts";
import { ROOT } from "../payload.ts";
import { TAG_LIMITS, tagsForChannel, toHashtag } from "../tags.ts";
import { withUtm } from "../utm.ts";
import type { LedgerEntry, MediaAsset, SyndicationPayload } from "../types.ts";
import { normalizeArtistName } from "../../../src/utils/normalize.js";
import type { Adapter, PostResult } from "./types.ts";

const SERVICE = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
const COLLECTION = "app.bsky.feed.post";

interface Session {
  accessJwt: string;
  did: string;
}

interface BlobRef {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
}

/** For a payload built before `linkText` existed. */
const DEFAULT_LINK_TEXT = "See it in the archive →";

/**
 * The `record.text` and its facets, split out so it is testable without a
 * network.
 *
 * Layout: the caption, the link on its own line, then one line of mentions and tags.
 *
 * `handles` is an injection seam for the tests and nothing else. Left out, the
 * lookup reads the committed `data/social-handles.json`, which is what every
 * real call does. Pinning a specific artist in a test against the live file
 * would turn an ordinary curation edit — somebody asking not to be tagged —
 * into a red build.
 */
export function composeBlueskyText(
  payload: SyndicationPayload,
  handles?: HandlesFile
): FacetedText {
  const url = withUtm(payload.url, "bluesky", payload.kind);

  // A mention REPLACES its own entity's tag rather than joining it:
  // `@depechemode.com #DepecheMode` in one line is the tell of an automated
  // account. Which tag goes is decided by WHICH ENTITY was mentioned, never by
  // position — a venue mention that dropped tags[0] would throw away the artist.
  const allMentions = mentionsForPost(payload.refs, "bluesky", {
    file: handles,
    text: payload.caption,
  }).filter((m) => m.did);
  const displaced = new Set(allMentions.map((m) => displacedTag(m, payload)));

  // 1–2 inline, per DECISIONS.md §7: real here (clickable facets, followable
  // feeds), but stacking them reads as spam. `entityTags` already put the lead
  // artist and the genre first.
  let tags = tagsForChannel(
    payload.tags.filter((t) => !displaced.has(t)),
    "bluesky"
  ).slice(0, TAG_LIMITS.bluesky.max);
  let mentions = allMentions;

  const build = (): FacetedText => {
    const text = new FacetedText();
    text.append(payload.caption);
    text.append("\n");
    text.appendLink(payload.linkText ?? DEFAULT_LINK_TEXT, url);
    if (mentions.length || tags.length) text.append("\n\n");
    let first = true;
    for (const m of mentions) {
      if (!first) text.append(" ");
      text.appendMention(m.handle, m.did!);
      first = false;
    }
    for (const tag of tags) {
      if (!first) text.append(" ");
      text.appendTag(tag);
      first = false;
    }
    return text;
  };

  /* THE TRIM ORDER, when two mentions and two tags do not fit in 300 graphemes. The caption
     and the link are never cut — they are the post. Then, cheapest first: the second tag
     (usually the genre), the second mention, the remaining tag. `budgets.ts` has the
     arithmetic for why this can happen at all. */
  let text = build();
  while (graphemeLength(text.text) > CHANNEL_LIMITS.bluesky) {
    if (tags.length > 1) tags = tags.slice(0, -1);
    else if (mentions.length > 1) mentions = mentions.slice(0, -1);
    else if (tags.length) tags = [];
    else break;
    text = build();
  }
  return text;
}

/** The bare tag (no `#`) this mention stands in for. */
function displacedTag(mention: Mention, payload: SyndicationPayload): string {
  if (mention.kind === "venue") return toHashtag(payload.credit.venue);
  if (!mention.slug) return toHashtag(payload.credit.artists[0] ?? "");
  const name = payload.credit.artists.find((n) => normalizeArtistName(n) === mention.slug);
  return name ? toHashtag(name) : "";
}

/**
 * Bluesky's `aspectRatio` is two integers, used only for layout before the image loads.
 * Without it the app reserves a square and jumps when the 4:5 image arrives.
 */
const ASPECT_RATIO: Record<MediaAsset["aspect"], { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1.91:1": { width: 1200, height: 630 },
};

export class BlueskyAdapter implements Adapter {
  readonly channel = "bluesky" as const;
  private session?: Session;

  configured(): boolean {
    return Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD);
  }

  async post(payload: SyndicationPayload): Promise<PostResult> {
    // Belt and braces on top of the run loop's own check. An adapter that can
    // be called directly must not be the place "never bare type" is assumed
    // rather than asserted.
    const card = payload.media.find((m) => m.role === "card");
    if (!card) throw new Error("no card asset — never bare type");

    const session = await this.login();
    const composed = composeBlueskyText(payload);

    const length = graphemeLength(composed.text);
    if (length > CHANNEL_LIMITS.bluesky) {
      throw new Error(
        `Bluesky post is ${length} graphemes (max ${CHANNEL_LIMITS.bluesky}) — ` +
          `the caption and link alone are over — CAPTION_MAX in budgets.ts`
      );
    }

    const image = await this.uploadBlob(session, card.path);

    const record = {
      $type: COLLECTION,
      text: composed.text,
      createdAt: new Date().toISOString(),
      facets: composed.facets,
      embed: {
        $type: "app.bsky.embed.images",
        images: [{ image, alt: card.alt, aspectRatio: ASPECT_RATIO[card.aspect] }],
      },
      langs: ["en"],
    };

    const created = await this.call<{ uri: string; cid: string }>(
      "com.atproto.repo.createRecord",
      { repo: session.did, collection: COLLECTION, record },
      session
    );

    const rkey = created.uri.split("/").pop() ?? "";
    return {
      uri: created.uri,
      rkey,
      permalink: `https://bsky.app/profile/${session.did}/post/${rkey}`,
    };
  }

  async retract(entry: LedgerEntry): Promise<void> {
    const session = await this.login();
    // Prefer the stored rkey; fall back to parsing the at:// URI so a row
    // written before rkey was recorded is still retractable. Retraction that
    // works only on new rows would defeat the reason retraction ships in
    // Phase 1 at all.
    const rkey = entry.rkey ?? entry.uri?.split("/").pop();
    if (!rkey) throw new Error(`no record key for ${entry.slug} on bluesky`);
    await this.call("com.atproto.repo.deleteRecord", {
      repo: session.did,
      collection: COLLECTION,
      rkey,
    }, session);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async login(): Promise<Session> {
    if (this.session) return this.session;
    const identifier = process.env.BLUESKY_IDENTIFIER;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (!identifier || !password) throw new Error("BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD not set");

    const res = await fetch(`${SERVICE}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) throw new Error(`Bluesky login failed: ${res.status} ${await res.text()}`);
    this.session = (await res.json()) as Session;
    return this.session;
  }

  private async uploadBlob(session: Session, path: string): Promise<BlobRef> {
    const bytes = readFileSync(join(ROOT, path));
    const res = await fetch(`${SERVICE}/xrpc/com.atproto.repo.uploadBlob`, {
      method: "POST",
      headers: {
        "Content-Type": mimeFor(path),
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Bluesky blob upload failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { blob: BlobRef };
    return body.blob;
  }

  private async call<T>(method: string, body: unknown, session: Session): Promise<T> {
    const res = await fetch(`${SERVICE}/xrpc/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Bluesky ${method} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
}

function mimeFor(path: string): string {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}
