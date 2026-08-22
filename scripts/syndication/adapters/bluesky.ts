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
 * - **The link card will not scrape our OG tag.** Bluesky renders an external
 *   embed from what we hand it, so the thumbnail has to be uploaded as a blob
 *   first and referenced by its returned `blob` object.
 * - **The limit is 300 graphemes**, a third unit again from bytes or code units.
 *
 * Credentials: `BLUESKY_IDENTIFIER` (the handle) and `BLUESKY_APP_PASSWORD`.
 * Never the account password — an app password is scoped and revocable.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { CHANNEL_LIMITS, LINK_DISPLAY_MAX } from "../budgets.ts";
import { FacetedText, displayUrl, graphemeLength } from "../facets.ts";
import { ROOT } from "../payload.ts";
import { tagsForChannel } from "../tags.ts";
import { withUtm } from "../utm.ts";
import type { LedgerEntry, SyndicationPayload } from "../types.ts";
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

/** The `record.text` and its facets, split out so it is testable without a network. */
export function composeBlueskyText(payload: SyndicationPayload): FacetedText {
  const text = new FacetedText();
  const url = withUtm(payload.url, "bluesky", payload.kind);

  text.append(payload.caption);
  text.append("\n\n");
  text.appendLink(displayUrl(payload.url, LINK_DISPLAY_MAX), url);

  // 1–2 inline, per DECISIONS.md §7: real here (clickable facets, followable
  // feeds), but stacking them reads as spam.
  const tags = tagsForChannel(payload.tags, "bluesky");
  for (const tag of tags) {
    text.append(" ");
    text.appendTag(tag);
  }

  return text;
}

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
          `caption budget is CAPTION_MAX in budgets.ts, not something to trim here`
      );
    }

    const thumb = await this.uploadBlob(session, card.path);
    const url = withUtm(payload.url, "bluesky", payload.kind);

    const record = {
      $type: COLLECTION,
      text: composed.text,
      createdAt: new Date().toISOString(),
      facets: composed.facets,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: url,
          title: payload.hook,
          // The credit stack in one line: the card carries it visually, and
          // the embed description is where it survives for anyone whose client
          // does not render the image.
          description: describe(payload),
          thumb,
        },
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

/**
 * The credit stack as one line, for the embed description.
 *
 * Deliberately the structured fields and not the hook: the description sits
 * under the title in a link card, and repeating the hook there wastes the one
 * place the names can appear for a reader whose client shows no image.
 */
export function describe(payload: SyndicationPayload): string {
  const { artists, venue, city, date } = payload.credit;
  const parts = [artists.join(", "), venue, city, date].filter(Boolean);
  return parts.join(" · ");
}

function mimeFor(path: string): string {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}
