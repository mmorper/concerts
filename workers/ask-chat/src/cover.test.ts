import { afterEach, describe, expect, it, vi } from "vitest";
import { artAt, bareTitle, fold, handleCover, identifyLocally, pickAlbum, type ItunesAlbum } from "./cover.js";
import type { AlbumEras, SongAlbums } from "../../mcp-server/src/types.js";
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

describe("identifyLocally", () => {
  const eras = {
    artists: { "the-human-league": { displayName: "The Human League", studioAlbums: [{ mbid: DARE, title: "Dare" }] } },
  } as unknown as AlbumEras;
  it("names a studio album from album-eras without asking MusicBrainz", () => {
    expect(identifyLocally(DARE, eras, null)).toEqual({ artist: "The Human League", title: "Dare" });
  });
  it("routes a song-albums cover to the original act", () => {
    const songs = { songs: { "x::s": { mbid: "m", albumTitle: "Dare", originalArtistKey: "the-human-league" } } } as unknown as SongAlbums;
    expect(identifyLocally("m", eras, songs)).toEqual({ artist: "The Human League", title: "Dare" });
  });
  it("returns null for an id the archive doesn't hold", () => {
    expect(identifyLocally("nope", eras, null)).toBeNull();
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
  const req = (q = "size=250") => new Request(`https://concerts.morperhaus.org/api/ask/cover/${DARE}?${q}`);
  const envWith = (store: ReturnType<typeof kv>) => ({ ASK_CONTROL: store, DATA_BASE_URL: "https://data.test" }) as unknown as Env;
  const ERAS = { artists: { "the-human-league": { displayName: "The Human League", studioAlbums: [{ mbid: DARE, title: "Dare" }] } } };

  /** Stubs the archive's data files, MusicBrainz and iTunes; `inArchive` false hides Dare from album-eras. */
  function stubUpstream(results: ItunesAlbum[], opts: { mbStatus?: number; itunesStatus?: number; inArchive?: boolean } = {}) {
    vi.stubGlobal("caches", { default: { match: async () => undefined, put: async () => undefined } });
    const f = vi.fn(async (url: string) => {
      if (url.endsWith("/album-eras.json")) return Response.json(opts.inArchive === false ? { artists: {} } : ERAS);
      if (url.endsWith("/song-albums.json")) return Response.json({ songs: {} });
      if (url.startsWith("https://musicbrainz.org/")) {
        return new Response(JSON.stringify({ title: "Dare", "artist-credit": [{ name: "The Human League", joinphrase: "" }] }), { status: opts.mbStatus ?? 200 });
      }
      return new Response(JSON.stringify({ results }), { status: opts.itunesStatus ?? 200 });
    });
    vi.stubGlobal("fetch", f);
    return f;
  }
  const calls = (f: ReturnType<typeof stubUpstream>, host: string) => f.mock.calls.filter(([u]) => String(u).includes(host)).length;

  it("names the album from the archive's own data, redirects, and remembers it", async () => {
    const store = kv();
    const f = stubUpstream([album("Dare", "The Human League", "dare")]);
    const r1 = await handleCover(req("size=500"), envWith(store), ctx, DARE);
    expect(r1.status).toBe(302);
    expect(r1.headers.get("Location")).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/dare/600x600bb.jpg");
    expect(r1.headers.get("X-Cover")).toContain("archive data");
    expect(calls(f, "musicbrainz.org")).toBe(0);
    const r2 = await handleCover(req(), envWith(store), ctx, DARE);
    expect(r2.headers.get("Location")).toContain("/300x300bb.jpg");
    expect(calls(f, "itunes.apple.com")).toBe(1);
  });

  it("asks MusicBrainz only for an id the archive doesn't hold", async () => {
    const f = stubUpstream([album("Dare", "The Human League")], { inArchive: false });
    const r = await handleCover(req(), envWith(kv()), ctx, DARE);
    expect(r.status).toBe(302);
    expect(calls(f, "musicbrainz.org")).toBe(1);
  });

  it("falls back to a title-only search when artist+title finds nothing", async () => {
    stubUpstream([]);
    const inner = globalThis.fetch;
    let n = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("itunes.apple.com")) {
        n++;
        return Response.json({ results: n === 1 ? [] : [album("Dare", "The Human League")] });
      }
      return inner(url as unknown as RequestInfo);
    });
    const r = await handleCover(req(), envWith(kv()), ctx, DARE);
    expect(r.status).toBe(302);
    expect(n).toBe(2);
  });

  it("404s on no match, says why, and remembers the miss", async () => {
    const store = kv();
    stubUpstream([album("Crash", "Dave Matthews Band")]);
    const r = await handleCover(req(), envWith(store), ctx, DARE);
    expect(r.status).toBe(404);
    expect(r.headers.get("X-Cover")).toContain("no album matching");
    expect(JSON.parse(store.m.get(`cover:v2:${DARE}`)!).art).toBeNull();
  });

  it("does not remember an upstream failure, and names it", async () => {
    const store = kv();
    stubUpstream([], { itunesStatus: 403 });
    const r = await handleCover(req(), envWith(store), ctx, DARE);
    expect(r.status).toBe(404);
    expect(r.headers.get("X-Cover")).toContain("itunes: HTTP 403");
    expect(store.put).not.toHaveBeenCalled();
  });

  it("?fresh ignores a stored miss", async () => {
    const store = kv();
    store.m.set(`cover:v2:${DARE}`, JSON.stringify({ art: null, reason: "old" }));
    stubUpstream([album("Dare", "The Human League")]);
    expect((await handleCover(req(), envWith(store), ctx, DARE)).status).toBe(404);
    expect((await handleCover(req("fresh=1"), envWith(store), ctx, DARE)).status).toBe(302);
  });

  it("rejects anything that is not an mbid without calling out", async () => {
    const f = stubUpstream([]);
    const r = await handleCover(req(), envWith(kv()), ctx, "../../etc");
    expect(r.status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });
});
