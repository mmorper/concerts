/**
 * Instagram adapter (#334).
 *
 * The card is the post; the caption is a footnote. Everything that decides what the post
 * says has already happened before this file sees a payload — this only turns a finished
 * payload into Instagram's request shape (spec: docs/specs/future/global-instagram-syndication.md).
 *
 * What is different from Bluesky and Mastodon:
 *
 * - **The image goes by URL.** The Graph API fetches `image_url` itself, so the card is put
 *   on public hosting first (`host.ts`, R2) and removed once Instagram has published it.
 * - **Two steps.** Create a media container, wait for it to finish processing, publish it.
 * - **No clickable links.** The caption points at the bio link instead of carrying a URL.
 * - **No idempotency key.** A publish that succeeds and loses its response would post twice
 *   on retry, so the account's most recent media are checked for the same caption first.
 * - **Deletion may not be offered by the API.** `retract` tries, and if Instagram refuses,
 *   fails with a message saying to delete by hand (owner decision, Q3).
 *
 * Credentials: `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` (a Business system-user
 * token that does not expire, Q2), plus the R2 variables `host.ts` reads.
 */

import { hostConfigFromEnv, R2Host, type CardHost } from "../host.ts";
import { CHANNEL_LIMITS } from "../budgets.ts";
import { tagsForChannel } from "../tags.ts";
import type { LedgerEntry, SyndicationPayload } from "../types.ts";
import type { Adapter, PostResult } from "./types.ts";

const GRAPH = "https://graph.facebook.com";
/** Overridable so a Graph version bump is configuration, not a code change. */
const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0";

/** Container processing is normally a few seconds; a minute means something is wrong. */
const POLL_INTERVAL_MS = 3_000;
const POLL_LIMIT = 20;

export function composeInstagramCaption(payload: SyndicationPayload): string {
  // The same words the other channels use ("Read the note →", "Setlist and the full
  // night →"), pointed at the bio link: an Instagram caption cannot carry a working URL.
  const pointer = payload.linkText
    ? `${payload.linkText.replace(/\s*→\s*$/, "")}: link in bio.`
    : "Link in bio.";
  const tags = tagsForChannel(payload.tags, "instagram");
  return [payload.caption, pointer, tags.join(" ")].filter(Boolean).join("\n\n");
}

type Fetch = typeof fetch;

export interface InstagramDeps {
  host?: CardHost;
  fetchImpl?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class InstagramAdapter implements Adapter {
  readonly channel = "instagram" as const;
  private readonly fetchImpl: Fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly hostOverride?: CardHost;

  constructor(deps: InstagramDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.hostOverride = deps.host;
  }

  configured(): boolean {
    return Boolean(
      process.env.INSTAGRAM_USER_ID &&
        process.env.INSTAGRAM_ACCESS_TOKEN &&
        (this.hostOverride || hostConfigFromEnv())
    );
  }

  async post(payload: SyndicationPayload): Promise<PostResult> {
    const card =
      payload.media.find((m) => m.role === "card" && m.aspect === "4:5") ??
      payload.media.find((m) => m.role === "card");
    if (!card) throw new Error("no card asset — never bare type");

    const caption = composeInstagramCaption(payload);
    if (caption.length > CHANNEL_LIMITS.instagram) {
      throw new Error(`Instagram caption is ${caption.length} chars (max ${CHANNEL_LIMITS.instagram})`);
    }

    const user = this.userId();

    // A retry after a lost publish response must not post twice.
    const existing = await this.findRecentByCaption(user, caption);
    if (existing) return existing;

    const host = this.host();
    const hosted = await host.publish(card.path);
    try {
      const container = await this.graph<{ id: string }>("POST", `/${user}/media`, {
        image_url: hosted.url,
        caption,
        alt_text: card.alt,
      });
      await this.waitUntilFinished(container.id);
      const published = await this.graph<{ id: string }>("POST", `/${user}/media_publish`, {
        creation_id: container.id,
      });
      const permalink = await this.permalink(published.id);
      return { uri: published.id, permalink };
    } finally {
      // Instagram has its own copy once published; on failure there is nothing to keep.
      await host.remove(hosted.key);
    }
  }

  async retract(entry: LedgerEntry): Promise<void> {
    if (!entry.uri) throw new Error(`no media id for ${entry.slug} on instagram`);
    try {
      await this.graph("DELETE", `/${entry.uri}`);
    } catch (err) {
      throw new Error(
        `Instagram would not delete ${entry.slug} (${(err as Error).message}). ` +
          `Manual action needed: delete it in the Instagram app (media id ${entry.uri}).`
      );
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private userId(): string {
    const id = process.env.INSTAGRAM_USER_ID;
    if (!id) throw new Error("INSTAGRAM_USER_ID not set");
    return id;
  }

  private host(): CardHost {
    if (this.hostOverride) return this.hostOverride;
    const config = hostConfigFromEnv();
    if (!config) throw new Error("R2 hosting not configured (R2_* variables)");
    return new R2Host(config);
  }

  private async findRecentByCaption(user: string, caption: string): Promise<PostResult | undefined> {
    const recent = await this.graph<{ data?: Array<{ id: string; caption?: string; permalink?: string }> }>(
      "GET",
      `/${user}/media`,
      { fields: "id,caption,permalink", limit: "5" }
    );
    const match = recent.data?.find((m) => m.caption === caption);
    if (!match) return undefined;
    console.log(`   ↺ instagram already has this post (${match.id}) — recording it, not posting again`);
    return { uri: match.id, permalink: match.permalink };
  }

  private async waitUntilFinished(containerId: string): Promise<void> {
    for (let i = 0; i < POLL_LIMIT; i++) {
      const { status_code } = await this.graph<{ status_code?: string }>("GET", `/${containerId}`, {
        fields: "status_code",
      });
      if (status_code === "FINISHED") return;
      if (status_code === "ERROR" || status_code === "EXPIRED") {
        throw new Error(`Instagram container ${containerId} ${status_code}`);
      }
      await this.sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Instagram container ${containerId} still processing after ${POLL_LIMIT} checks`);
  }

  private async permalink(mediaId: string): Promise<string | undefined> {
    try {
      const { permalink } = await this.graph<{ permalink?: string }>("GET", `/${mediaId}`, {
        fields: "permalink",
      });
      return permalink;
    } catch {
      // Posted is posted; a missing permalink only costs the run log a link.
      return undefined;
    }
  }

  private async graph<T = unknown>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");

    const url = new URL(`${GRAPH}/${GRAPH_VERSION}${path}`);
    const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
    if (method === "POST") {
      init.body = new URLSearchParams(params);
    } else {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const res = await this.fetchImpl(url, init);
    if (!res.ok) throw new Error(`Instagram ${method} ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
}
