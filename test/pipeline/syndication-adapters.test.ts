/**
 * Bluesky and Mastodon adapters (#332), against a stubbed `fetch`.
 *
 * These assert the parts of each protocol that are easy to get wrong and
 * invisible until a real post looks broken: the blob upload that has to happen
 * before the link card can reference a thumbnail, the alt text that rides on
 * the attachment rather than the status, and the idempotency key that covers
 * the one gap the ledger cannot — a request that succeeds on the server and
 * fails on the way back.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, writeFileSync } from "fs";
import { join } from "path";

import { BlueskyAdapter } from "../../scripts/syndication/adapters/bluesky.ts";
import { MastodonAdapter, composeMastodonStatus, mastodonWeight } from "../../scripts/syndication/adapters/mastodon.ts";
import { ROOT } from "../../scripts/syndication/payload.ts";
import type { SyndicationPayload } from "../../scripts/syndication/types.ts";

const CARD = "public/og/liner-notes/__adapter-test__.png";

function payload(): SyndicationPayload {
  return {
    slug: "__adapter-test__",
    kind: "liner-note",
    hook: "Forty years to the day, in the same amphitheatre.",
    caption: "I was seventeen the first time. I keep coming back to this room.",
    credit: {
      artists: ["Björk"],
      venue: "Greek Theatre",
      city: "Los Angeles",
      date: "1997-08-09",
    },
    refs: { artists: ["bjork"], venue: "greek-theatre" },
    url: "https://concerts.morperhaus.org/liner-notes/__adapter-test__",
    media: [
      {
        role: "card",
        aspect: "1.91:1",
        path: CARD,
        alt: "Björk at the Greek Theatre, Los Angeles, 9 August 1997.",
        tier: 2,
        source: "artist-audiodb",
      },
    ],
    tags: ["Bjork", "GreekTheatre", "LosAngeles", "1990s"],
    eligible: true,
    ineligibleReasons: [],
  };
}

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[];
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  calls = [];
  env = { ...process.env };
  // A real PNG is not needed — nothing decodes it — but a real file is.
  writeFileSync(join(ROOT, CARD), Buffer.from("not-really-a-png"));
});

afterEach(() => {
  process.env = env;
  rmSync(join(ROOT, CARD), { force: true });
  vi.restoreAllMocks();
});

function stubFetch(responder: (url: string, init: RequestInit) => unknown) {
  vi.stubGlobal("fetch", async (input: URL | string, init: RequestInit = {}) => {
    const url = input.toString();
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => responder(url, init),
      text: async () => "",
    } as unknown as Response;
  });
}

describe("BlueskyAdapter", () => {
  beforeEach(() => {
    process.env.BLUESKY_IDENTIFIER = "concerts.morperhaus.org";
    process.env.BLUESKY_APP_PASSWORD = "app-password";
  });

  it("uploads the thumbnail as a blob before creating the record", async () => {
    stubFetch((url) => {
      if (url.includes("createSession")) return { accessJwt: "jwt", did: "did:plc:x" };
      if (url.includes("uploadBlob")) {
        return { blob: { $type: "blob", ref: { $link: "bafy" }, mimeType: "image/png", size: 16 } };
      }
      return { uri: "at://did:plc:x/app.bsky.feed.post/abc123", cid: "cid" };
    });

    const result = await new BlueskyAdapter().post(payload());

    const order = calls.map((c) => c.url.split("/xrpc/")[1]);
    expect(order).toEqual([
      "com.atproto.server.createSession",
      "com.atproto.repo.uploadBlob",
      "com.atproto.repo.createRecord",
    ]);

    // Bluesky will not scrape our OG tag: the embed carries the blob we just
    // uploaded, or the card renders with no image at all.
    const record = JSON.parse(calls[2].init.body as string).record;
    expect(record.embed.$type).toBe("app.bsky.embed.external");
    expect(record.embed.external.thumb.ref.$link).toBe("bafy");
    expect(record.embed.external.uri).toContain("utm_source=bluesky");
    expect(record.embed.external.title).toBe(payload().hook);

    expect(result).toMatchObject({
      uri: "at://did:plc:x/app.bsky.feed.post/abc123",
      rkey: "abc123",
    });
  });

  it("sends facets whose byte spans survive a multi-byte name", async () => {
    stubFetch((url) => {
      if (url.includes("createSession")) return { accessJwt: "jwt", did: "did:plc:x" };
      if (url.includes("uploadBlob")) return { blob: { $type: "blob", ref: { $link: "b" }, mimeType: "image/png", size: 1 } };
      return { uri: "at://did:plc:x/app.bsky.feed.post/abc", cid: "c" };
    });

    await new BlueskyAdapter().post(payload());
    const record = JSON.parse(calls[2].init.body as string).record;
    const bytes = new TextEncoder().encode(record.text);

    for (const facet of record.facets) {
      const slice = new TextDecoder().decode(bytes.slice(facet.index.byteStart, facet.index.byteEnd));
      if (facet.features[0].$type === "app.bsky.richtext.facet#tag") {
        expect(slice).toBe(`#${facet.features[0].tag}`);
      } else {
        expect(facet.features[0].uri).toContain("concerts.morperhaus.org");
      }
    }
  });

  it("refuses to post without a card — never bare type", async () => {
    stubFetch(() => ({}));
    await expect(new BlueskyAdapter().post({ ...payload(), media: [] })).rejects.toThrow(
      /never bare type/
    );
  });

  it("deletes by record key on retraction", async () => {
    stubFetch((url) => (url.includes("createSession") ? { accessJwt: "j", did: "did:plc:x" } : {}));
    await new BlueskyAdapter().retract({
      slug: "s",
      platform: "bluesky",
      status: "posted",
      uri: "at://did:plc:x/app.bsky.feed.post/abc",
      rkey: "abc",
    });
    const body = JSON.parse(calls[1].init.body as string);
    expect(calls[1].url).toContain("com.atproto.repo.deleteRecord");
    expect(body).toMatchObject({ collection: "app.bsky.feed.post", rkey: "abc" });
  });

  it("recovers the record key from the URI when the row predates rkey", async () => {
    stubFetch((url) => (url.includes("createSession") ? { accessJwt: "j", did: "did:plc:x" } : {}));
    await new BlueskyAdapter().retract({
      slug: "s",
      platform: "bluesky",
      status: "posted",
      uri: "at://did:plc:x/app.bsky.feed.post/legacy",
    });
    expect(JSON.parse(calls[1].init.body as string).rkey).toBe("legacy");
  });

  it("reports itself unconfigured when the credentials are absent", () => {
    delete process.env.BLUESKY_APP_PASSWORD;
    expect(new BlueskyAdapter().configured()).toBe(false);
  });
});

describe("MastodonAdapter", () => {
  beforeEach(() => {
    process.env.MASTODON_BASE_URL = "https://mastodon.social";
    process.env.MASTODON_ACCESS_TOKEN = "token";
  });

  it("uploads media with alt text, then posts with an idempotency key", async () => {
    stubFetch((url) => (url.includes("/api/v2/media") ? { id: "media-1" } : { id: "status-1", url: "https://mastodon.social/@x/1" }));

    const result = await new MastodonAdapter().post(payload());

    expect(calls[0].url).toBe("https://mastodon.social/api/v2/media");
    const form = calls[0].init.body as FormData;
    // Alt text rides on the attachment, not the status. Required, never optional.
    expect(form.get("description")).toBe(payload().media[0].alt);

    const headers = calls[1].init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("morperhaus-liner-note-__adapter-test__");

    const body = JSON.parse(calls[1].init.body as string);
    expect(body.media_ids).toEqual(["media-1"]);
    expect(body.status).toContain("utm_source=mastodon");
    expect(result).toEqual({ uri: "status-1", permalink: "https://mastodon.social/@x/1" });
  });

  it("carries the 4–5 CamelCase tags Mastodon needs most", () => {
    const status = composeMastodonStatus(payload());
    expect(status).toContain("#Bjork #GreekTheatre #LosAngeles #1990s");
  });

  it("counts a URL as 23 however long it is", () => {
    const short = mastodonWeight("word https://a.co");
    const long = mastodonWeight(`word https://concerts.morperhaus.org/liner-notes/${"x".repeat(80)}`);
    expect(short).toBe(long);
  });

  it("deletes the status on retraction", async () => {
    stubFetch(() => ({}));
    await new MastodonAdapter().retract({ slug: "s", platform: "mastodon", status: "posted", uri: "42" });
    expect(calls[0].url).toBe("https://mastodon.social/api/v1/statuses/42");
    expect(calls[0].init.method).toBe("DELETE");
  });
});
