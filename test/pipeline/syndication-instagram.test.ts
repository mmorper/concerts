/**
 * Instagram adapter (#334) and the R2 card host it depends on.
 *
 * No network: the Graph API and R2 are both replaced by recorded fakes. What is pinned
 * here is the request SHAPE and the failure behaviour — the two places a channel goes
 * wrong quietly.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

import { InstagramAdapter, composeInstagramCaption } from "../../scripts/syndication/adapters/instagram.ts";
import { R2Host, hostConfigFromEnv, type CardHost } from "../../scripts/syndication/host.ts";
import { ROOT } from "../../scripts/syndication/payload.ts";
import type { LedgerEntry, SyndicationPayload } from "../../scripts/syndication/types.ts";

function payload(over: Partial<SyndicationPayload> = {}): SyndicationPayload {
  return {
    slug: "ig-test",
    kind: "liner-note",
    hook: "Forty years to the day.",
    caption: "I keep coming back to this room.",
    linkText: "Read the note →",
    credit: { artists: ["Björk"], venue: "Greek Theatre", city: "Los Angeles", date: "1997-08-09" },
    refs: { artists: ["bjork"], venue: "greek-theatre" },
    url: "https://concerts.morperhaus.org/liner-notes/ig-test",
    media: [
      { role: "card", aspect: "4:5", path: "card.jpg", alt: "Björk at the Greek Theatre.", tier: 2, source: "artist-audiodb" },
    ],
    tags: ["Bjork", "GreekTheatre", "LosAngeles", "1990s", "NewWave", "Extra"],
    eligible: true,
    ineligibleReasons: [],
    ...over,
  } as SyndicationPayload;
}

class FakeHost implements CardHost {
  published: string[] = [];
  removed: string[] = [];
  async publish(path: string) {
    this.published.push(path);
    return { key: `cards/1-${path}`, url: `https://pub.example/cards/1-${path}` };
  }
  async remove(key: string) {
    this.removed.push(key);
  }
}

interface Call { method: string; url: string; body?: string }

/** A Graph API stand-in: routes by method + path, records every call. */
function fakeGraph(opts: { recent?: Array<{ id: string; caption?: string }>; statuses?: string[]; failDelete?: boolean } = {}) {
  const calls: Call[] = [];
  const statuses = [...(opts.statuses ?? ["IN_PROGRESS", "FINISHED"])];
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
  const impl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url: url.toString(), body: init?.body ? String(init.body) : undefined });
    const p = url.pathname;
    if (method === "GET" && p.endsWith("/123/media")) return json({ data: opts.recent ?? [] });
    if (method === "POST" && p.endsWith("/123/media")) return json({ id: "container-1" });
    if (method === "GET" && p.endsWith("/container-1")) return json({ status_code: statuses.shift() ?? "FINISHED" });
    if (method === "POST" && p.endsWith("/123/media_publish")) return json({ id: "media-9" });
    if (method === "GET" && p.endsWith("/media-9")) return json({ permalink: "https://instagram.com/p/x" });
    if (method === "DELETE") return opts.failDelete ? json({ error: "unsupported" }, 400) : json({ success: true });
    return json({ error: "unexpected" }, 500);
  }) as typeof fetch;
  return { calls, impl };
}

let env: NodeJS.ProcessEnv;
beforeEach(() => {
  env = { ...process.env };
  process.env.INSTAGRAM_USER_ID = "123";
  process.env.INSTAGRAM_ACCESS_TOKEN = "tok";
});
afterEach(() => {
  process.env = env;
});

describe("composeInstagramCaption", () => {
  it("carries no URL, points at the bio, and keeps 3–5 tags", () => {
    const caption = composeInstagramCaption(payload());
    expect(caption).not.toMatch(/https?:\/\//);
    expect(caption).toContain("Read the note: link in bio.");
    const tags = caption.match(/#\w+/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(caption.startsWith("I keep coming back to this room.")).toBe(true);
  });

  it("falls back to a plain pointer when the payload has no link text", () => {
    expect(composeInstagramCaption(payload({ linkText: undefined }))).toContain("Link in bio.");
  });
});

describe("InstagramAdapter", () => {
  it("is not configured without hosting, even with a token", () => {
    for (const k of Object.keys(process.env)) if (k.startsWith("R2_")) delete process.env[k];
    expect(new InstagramAdapter().configured()).toBe(false);
    expect(new InstagramAdapter({ host: new FakeHost() }).configured()).toBe(true);
  });

  it("hosts the card, creates a container with alt text, waits, publishes, then cleans up", async () => {
    const host = new FakeHost();
    const graph = fakeGraph();
    const result = await new InstagramAdapter({ host, fetchImpl: graph.impl, sleep: async () => {} }).post(payload());

    expect(result).toEqual({ uri: "media-9", permalink: "https://instagram.com/p/x" });
    expect(host.published).toEqual(["card.jpg"]);
    expect(host.removed).toEqual(["cards/1-card.jpg"]);

    const create = graph.calls.find((c) => c.method === "POST" && c.url.endsWith("/123/media"))!;
    const body = new URLSearchParams(create.body);
    expect(body.get("image_url")).toBe("https://pub.example/cards/1-card.jpg");
    expect(body.get("alt_text")).toBe("Björk at the Greek Theatre.");
    expect(body.get("caption")).toBe(composeInstagramCaption(payload()));

    const publish = graph.calls.find((c) => c.url.endsWith("/media_publish"))!;
    expect(new URLSearchParams(publish.body).get("creation_id")).toBe("container-1");
  });

  it("does not post twice: a recent post with the same caption is recorded instead", async () => {
    const host = new FakeHost();
    const graph = fakeGraph({ recent: [{ id: "media-old", caption: composeInstagramCaption(payload()) }] });
    const result = await new InstagramAdapter({ host, fetchImpl: graph.impl, sleep: async () => {} }).post(payload());
    expect(result.uri).toBe("media-old");
    expect(host.published).toEqual([]);
    expect(graph.calls.some((c) => c.url.endsWith("/media_publish"))).toBe(false);
  });

  it("fails — and still cleans up — when the container errors", async () => {
    const host = new FakeHost();
    const graph = fakeGraph({ statuses: ["ERROR"] });
    await expect(
      new InstagramAdapter({ host, fetchImpl: graph.impl, sleep: async () => {} }).post(payload())
    ).rejects.toThrow(/ERROR/);
    expect(host.removed).toEqual(["cards/1-card.jpg"]);
  });

  it("fails rather than waiting forever on a container that never finishes", async () => {
    const graph = fakeGraph({ statuses: Array(30).fill("IN_PROGRESS") });
    await expect(
      new InstagramAdapter({ host: new FakeHost(), fetchImpl: graph.impl, sleep: async () => {} }).post(payload())
    ).rejects.toThrow(/still processing/);
  });

  it("refuses to post without a card — never bare type", async () => {
    await expect(new InstagramAdapter({ host: new FakeHost() }).post(payload({ media: [] }))).rejects.toThrow(/no card/);
  });

  it("asks for a manual delete when the API will not delete", async () => {
    const graph = fakeGraph({ failDelete: true });
    const entry = { slug: "ig-test", platform: "instagram", status: "posted", uri: "media-9" } as LedgerEntry;
    await expect(new InstagramAdapter({ host: new FakeHost(), fetchImpl: graph.impl }).retract(entry)).rejects.toThrow(
      /Manual action needed.*media-9/
    );
  });

  it("retracts normally when the API does delete", async () => {
    const graph = fakeGraph();
    const entry = { slug: "ig-test", platform: "instagram", status: "posted", uri: "media-9" } as LedgerEntry;
    await new InstagramAdapter({ host: new FakeHost(), fetchImpl: graph.impl }).retract(entry);
    expect(graph.calls.some((c) => c.method === "DELETE" && c.url.includes("/media-9"))).toBe(true);
  });
});

describe("R2Host", () => {
  const dir = join(ROOT, ".renditions");
  const file = ".renditions/__r2-test__.jpg";
  beforeEach(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(ROOT, file), Buffer.from([0xff, 0xd8, 0xff]));
  });
  afterEach(() => rmSync(join(ROOT, file), { force: true }));

  const config = {
    accountId: "acct",
    accessKeyId: "AKID",
    secretAccessKey: "secret",
    bucket: "concerts-syndication",
    publicUrl: "https://pub-x.r2.dev",
  };

  it("PUTs a signed request to the bucket and returns the public URL", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const host = new R2Host(config, fetchImpl, () => new Date("2026-10-11T12:00:00Z"));

    const { key, url } = await host.publish(file);
    expect(key).toBe(`cards/${Date.parse("2026-10-11T12:00:00Z")}-__r2-test__.jpg`);
    expect(url).toBe(`https://pub-x.r2.dev/${key}`);
    expect(seen[0].url).toBe(`https://acct.r2.cloudflarestorage.com/concerts-syndication/${key}`);
    const headers = seen[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKID\/20261011\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
    );
  });

  it("never throws on delete — the lifecycle rule is the backstop", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(new R2Host(config, fetchImpl).remove("cards/x.jpg")).resolves.toBeUndefined();
  });

  it("reads its config only when every R2 variable is present", () => {
    expect(hostConfigFromEnv({ R2_ACCOUNT_ID: "a" })).toBeUndefined();
    expect(
      hostConfigFromEnv({
        R2_ACCOUNT_ID: "a",
        R2_ACCESS_KEY_ID: "b",
        R2_SECRET_ACCESS_KEY: "c",
        R2_BUCKET: "d",
        R2_PUBLIC_URL: "https://pub/",
      })?.publicUrl
    ).toBe("https://pub");
  });
});
