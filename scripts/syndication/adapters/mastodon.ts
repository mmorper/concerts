/**
 * Mastodon adapter (#332).
 *
 * The other zero-friction channel: one access token from Settings →
 * Development, no expiry, no review process, no penalty on outbound links.
 *
 * Two things it gives us that Bluesky does not:
 *
 * - **`Idempotency-Key`.** A free second layer of double-post protection on
 *   top of the ledger, and the one that covers the gap the ledger cannot: a
 *   request that succeeds on the server and fails on the way back, leaving no
 *   row written. Keyed on `slug`, so the retry is recognised as the same post.
 * - **No facet arithmetic.** URLs are linkified server-side, and every URL
 *   counts as 23 characters against the limit however long it is — which is
 *   why the full UTM'd permalink rides in the text here, and a shortened
 *   display form is only needed on Bluesky.
 *
 * Credentials: `MASTODON_BASE_URL` (the instance, e.g. https://mastodon.social)
 * and `MASTODON_ACCESS_TOKEN`. The instance is configuration rather than a
 * constant because §"Questions for Review" leaves the choice of instance open;
 * nothing in this adapter cares which one it is.
 */

import { readFileSync } from "fs";
import { basename, join } from "path";

import { CHANNEL_LIMITS } from "../budgets.ts";
import { ROOT } from "../payload.ts";
import { tagsForChannel } from "../tags.ts";
import { withUtm } from "../utm.ts";
import type { LedgerEntry, SyndicationPayload } from "../types.ts";
import type { Adapter, PostResult } from "./types.ts";

/**
 * Mastodon counts any URL as this many characters regardless of its real
 * length, so a 121-character permalink with UTM parameters costs 23.
 */
const URL_WEIGHT = 23;

export function composeMastodonStatus(payload: SyndicationPayload): string {
  const url = withUtm(payload.url, "mastodon", payload.kind);
  // 4–5 CamelCase. Mastodon needs tags most of the four channels: there is no
  // recommendation algorithm and full-text search is opt-in per user, so a tag
  // is the only way a stranger finds this.
  const tags = tagsForChannel(payload.tags, "mastodon");
  return [payload.caption, url, tags.join(" ")].filter(Boolean).join("\n\n");
}

/** The platform's own accounting, not `String.length`. */
export function mastodonWeight(status: string): number {
  return status
    .split(/\s+/)
    .reduce((total, token) => total + (/^https?:\/\//.test(token) ? URL_WEIGHT : token.length + 1), 0);
}

export class MastodonAdapter implements Adapter {
  readonly channel = "mastodon" as const;

  configured(): boolean {
    return Boolean(process.env.MASTODON_BASE_URL && process.env.MASTODON_ACCESS_TOKEN);
  }

  async post(payload: SyndicationPayload): Promise<PostResult> {
    const card = payload.media.find((m) => m.role === "card");
    if (!card) throw new Error("no card asset — never bare type");

    const status = composeMastodonStatus(payload);
    const weight = mastodonWeight(status);
    if (weight > CHANNEL_LIMITS.mastodon) {
      throw new Error(`Mastodon status weighs ${weight} (max ${CHANNEL_LIMITS.mastodon})`);
    }

    const mediaId = await this.uploadMedia(card.path, card.alt);

    const res = await this.call("/api/v1/statuses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Keyed on the slug: a retry after a lost response is the same post,
        // and the instance recognises it as such rather than duplicating.
        "Idempotency-Key": `morperhaus-${payload.kind}-${payload.slug}`,
      },
      body: JSON.stringify({
        status,
        media_ids: [mediaId],
        visibility: "public",
        language: "en",
      }),
    });

    const body = (await res.json()) as { id: string; url?: string };
    return { uri: body.id, permalink: body.url };
  }

  async retract(entry: LedgerEntry): Promise<void> {
    if (!entry.uri) throw new Error(`no status id for ${entry.slug} on mastodon`);
    await this.call(`/api/v1/statuses/${encodeURIComponent(entry.uri)}`, { method: "DELETE" });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Alt text goes on the attachment at upload time, not on the status.
   * It is required, never optional — every asset, every channel.
   */
  private async uploadMedia(path: string, alt: string): Promise<string> {
    const bytes = readFileSync(join(ROOT, path));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeFor(path) }), basename(path));
    form.append("description", alt);

    // v2 returns 202 while the instance processes the file; the id is usable
    // immediately, which is the whole reason v2 exists.
    const res = await this.call("/api/v2/media", { method: "POST", body: form });
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    const base = process.env.MASTODON_BASE_URL;
    const token = process.env.MASTODON_ACCESS_TOKEN;
    if (!base || !token) throw new Error("MASTODON_BASE_URL / MASTODON_ACCESS_TOKEN not set");

    const res = await fetch(new URL(path, base), {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Mastodon ${path} failed: ${res.status} ${await res.text()}`);
    return res;
  }
}

function mimeFor(path: string): string {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}
