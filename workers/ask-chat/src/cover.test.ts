import { afterEach, describe, expect, it, vi } from "vitest";
import { artAt, bareTitle, fold, handleCover, pickAlbum, type ItunesAlbum } from "./cover.js";
import type { Env } from "./types.js";

const DARE = "e8e7999e-0b87-3298-947d-2ad22717fc27";
const art = (n: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/${n}/100x100bb.jpg`;
const album = (collectionName: string, artistName: string, n = collectionName): ItunesAlbum => ({ collectionName, artistName, artworkUrl100: art(n) });

describe("matching", () => {
  it("folds case, accents, ampersands and a leading 'the'", () => {
    expect(fold("The Human League")).toBe(fold("human league"));
    expect(fold("Hüsker Dü")).toBe("husker du");
    expect(fold("Echo & the Bunnymen")).toBe(fold("Echo and The Bunnymen"));
  });

  it("strips edition dressing from titles", () => {
    expect(bareTitle("Crash (Bonus Track Version)")).toBe("crash");
    expect(bareTitle("Dare [2012 Remaster]")).toBe("dare");
    expect(bareTitle("Hysteria - EP")).toBe("hysteria");
    expect(bareTitle("Romantic?")).toBe("romantic");
  });

  it("takes the undressed edition when both are on iTunes", () => {
    const r = [album("Dare (Deluxe Edition)", "The Human League", "deluxe"), album("Dare", "The Human League", "plain")];
    expect(pickAlbum(r, "The Human League", "Dare")?.artworkUrl100).toBe(art("plain"));
  });

  it("refuses a same-titled album by someone else, and a different album by them", () => {
    const r = [album("Crash", "Dave Matthews Band"), album("Greatest Hits", "The Human League")];
    expect(pickAlbum(r, "The Human League", "Crash")).toBeNull();
  });

  it("asks the CDN for the size the card draws", () => {
    expect(artAt(art("x"), 600)).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg");
  });
});

describe("handleCover", () => {
  afterEach(() => vi.unstubAllGlobals());

  const kv = () => {
    const m = new Map<string, string>();
    return {
      m,
      get: vi.fn(async (k: string) => (m.has(k) ? JSON.parse(m.get(k)!) : null)),
      put: vi.fn(async (k: string, v: string) => void m.set(k, v)),
    };
  };
  const ctx = { waitUntil: (p: Promise<unknown>) => p } as unknown as ExecutionContext;
  const req = (size = "250") => new Request(`https://concerts.morperhaus.org/api/ask/cover/${DARE}?size=${size}`);

  function stubUpstream(results: ItunesAlbum[], mbStatus = 200) {
    const f = vi.fn(async (url: string) => {
      if (url.startsWith("https://musicbrainz.org/")) {
        return new Response(JSON.stringify({ title: "Dare", "artist-credit": [{ name: "The Human League", joinphrase: "" }] }), { status: mbStatus });
      }
      return new Response(JSON.stringify({ results }));
    });
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("redirects to the matched sleeve and remembers it, so upstream is asked once", async () => {
    const store = kv();
    const env = { ASK_CONTROL: store } as unknown as Env;
    const f = stubUpstream([album("Dare", "The Human League", "dare")]);
    const r1 = await handleCover(req("500"), env, ctx, DARE);
    expect(r1.status).toBe(302);
    expect(r1.headers.get("Location")).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/dare/600x600bb.jpg");
    const r2 = await handleCover(req(), env, ctx, DARE);
    expect(r2.headers.get("Location")).toContain("/300x300bb.jpg");
    expect(f).toHaveBeenCalledTimes(2); // one MusicBrainz + one iTunes, for both requests
  });

  it("404s on no match and remembers the miss", async () => {
    const store = kv();
    stubUpstream([album("Crash", "Dave Matthews Band")]);
    const r = await handleCover(req(), { ASK_CONTROL: store } as unknown as Env, ctx, DARE);
    expect(r.status).toBe(404);
    expect(JSON.parse(store.m.get(`cover:${DARE}`)!)).toEqual({ art: null });
  });

  it("does not remember an upstream failure", async () => {
    const store = kv();
    stubUpstream([], 503);
    const r = await handleCover(req(), { ASK_CONTROL: store } as unknown as Env, ctx, DARE);
    expect(r.status).toBe(404);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("rejects anything that is not an mbid without calling out", async () => {
    const f = stubUpstream([]);
    const r = await handleCover(req(), { ASK_CONTROL: kv() } as unknown as Env, ctx, "../../etc");
    expect(r.status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });
});
