/**
 * Now Spinning's index, built from the real data in public/data.
 *
 * The builder runs inside `npm run build` and never throws — bad data is left out and listed in
 * the manifest's `problems` — so this test is what turns a problem red, on every PR and on the
 * daily scheduled CI run that catches automated data commits.
 *
 * Properties, not counts: counts move every time a show is added (see
 * .claude/skills/steward/SKILL.md). Exact behaviour is tested in workers/now-spinning against a
 * frozen fixture.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndex, readInputs, thumbBox } from "../../scripts/build-now-spinning-index.ts";
import { lookup } from "../../workers/now-spinning/src/identify.ts";
import type { ActFile, CoversFile } from "../../workers/now-spinning/src/types.ts";

const DATA = path.join(__dirname, "..", "..", "public", "data");
const built = buildIndex(readInputs(DATA));
const { manifest, files } = built;
const acts = Object.entries(files).filter(([p]) => p.startsWith("acts/")).map(([, f]) => f as ActFile);
const covers = Object.entries(files).filter(([p]) => p.startsWith("covers/")).map(([, f]) => f as CoversFile);

describe("Now Spinning index (real data)", () => {
  it("left nothing out: no song without a key, no two acts sharing a key", () => {
    expect(manifest.problems).toEqual([]);
    expect(manifest.ambiguous).toEqual([]);
  });

  it("has a file for every act the manifest lists, and for every covers key", () => {
    for (const slug of new Set(Object.values(manifest.acts))) expect(files[`acts/${slug}.json`], slug).toBeDefined();
    for (const key of manifest.covers) expect(files[`covers/${key}.json`], key).toBeDefined();
  });

  it("keeps every file small (the Worker reads them on Cloudflare's free tier)", () => {
    for (const [p, f] of Object.entries(files)) expect(JSON.stringify(f).length, p).toBeLessThan(64 * 1024);
  });

  it("names only file-safe paths", () => {
    for (const p of Object.keys(files)) expect(p).toMatch(/^(manifest\.json|acts\/[a-z0-9-]+\.json|covers\/[a-z0-9]+\.json)$/);
  });

  it("points every night and every cover row at a real show", () => {
    const shows = new Set(readInputs(DATA).concerts.map((c) => c.date));
    for (const a of acts) {
      for (const n of a.nights) expect(shows.has(n.d), `${a.slug} ${n.d}`).toBe(true);
      for (const s of a.songs) for (const i of s.on) expect(a.nights[i], `${a.slug} "${s.n}"`).toBeDefined();
    }
    for (const c of covers) for (const r of c.rows) expect(shows.has(r.d), `${r.by} ${r.d}`).toBe(true);
  });

  it("uses only published photos", () => {
    const published = new Set(readInputs(DATA).media.map((m) => m.url));
    for (const a of acts) for (const n of a.nights) for (const p of n.photos) expect(published.has(p.u), p.u).toBe(true);
  });

  it("gives every photo a 4:5 thumbnail box inside the image, around the centre of Mike's crop", () => {
    const media = new Map(readInputs(DATA).media.map((m) => [m.url, m]));
    for (const a of acts) {
      for (const n of a.nights) {
        for (const p of n.photos) {
          const m = media.get(p.u)!;
          if (!m.width || !m.height) continue; // no size: no box, and the thumbnail crops around fx/fy
          expect(p.t, p.u).toBeDefined();
          const [x, y, w, h] = p.t!;
          expect(Math.abs((w * m.width) / (h * m.height) - 0.8), p.u).toBeLessThan(0.01);
          expect(x >= 0 && y >= 0 && x + w <= 1.0005 && y + h <= 1.0005, p.u).toBe(true);
          expect(p.fx >= x && p.fx <= x + w && p.fy >= y && p.fy <= y + h, p.u).toBe(true);
        }
      }
    }
  });

  it("gives every song at least one strict key", () => {
    for (const a of acts) for (const s of a.songs) expect(s.k.length, `${a.slug} "${s.n}"`).toBeGreaterThan(0);
  });

  it("agrees with the site's song index, billing by billing, on how many nights each song was heard (#690)", async () => {
    // Every act's setlist counts in both. Compared per billing name and the setlist's spelling,
    // which is how the site's song index lists them.
    //
    // The number on the TV can be higher, on purpose: Now Spinning counts an act, and an act can
    // play under several billings. Brian Setzer's "Rock This Town" is three rows of 1 on the site
    // (brian-setzer, the-brian-setzer-orchestra, brian-setzer-68-comeback-special) and "3 times"
    // on the TV. Per billing, the two agree; that is what this checks.
    const siteIndex = JSON.parse(fs.readFileSync(path.join(DATA, "song-index.json"), "utf-8")).songs as { name: string; slug: string; dates: string[] }[];
    const ours = new Map<string, number>();
    for (const a of acts) {
      for (const s of a.songs) for (const i of s.on) {
        const key = `${a.nights[i].billing}|${s.n}`;
        ours.set(key, (ours.get(key) ?? 0) + 1);
      }
    }
    const differ = siteIndex.filter((s) => ours.has(`${s.slug}|${s.name}`) && ours.get(`${s.slug}|${s.name}`) !== s.dates.length);
    expect(differ.map((s) => `${s.slug} "${s.name}"`)).toEqual([]);
  });

  it("answers a known song end to end", async () => {
    const load = async (p: string) => (p in files ? files[p] : null);
    const r = await lookup({ artist: "Depeche Mode", title: "Everything Counts" }, load);
    expect(r.screen).toBe("heard");
    expect(r.count?.n).toBeGreaterThanOrEqual(5);
  });
});

describe("Now Spinning index builder", () => {
  describe("thumbBox", () => {
    const ratio = (b: number[], W: number, H: number) => (b[2] * W) / (b[3] * H);
    it("keeps a 4:5 crop as it is", () => {
      expect(thumbBox({ x: 0.1, y: 0, w: 0.6, h: 1 }, 2048, 1536)).toEqual([0.1, 0, 0.6, 1]);
    });
    it("widens a crop that's too narrow, keeping all of it", () => {
      const b = thumbBox({ x: 0.3, y: 0.2, w: 0.3, h: 0.6 }, 2000, 2000)!;
      expect(ratio(b, 2000, 2000)).toBeCloseTo(0.8, 2);
      expect(b[0] <= 0.3 && b[0] + b[2] >= 0.6 && b[1] <= 0.2 && b[1] + b[3] >= 0.8).toBe(true);
    });
    it("trims only where the photo runs out, and stays inside it", () => {
      const b = thumbBox({ x: 0, y: 0, w: 1, h: 1 }, 3000, 1000)!;
      expect(ratio(b, 3000, 1000)).toBeCloseTo(0.8, 2);
      expect(b[1]).toBe(0);
      expect(b[3]).toBe(1);
      expect(b[0] + b[2]).toBeLessThanOrEqual(1);
    });
    it("uses the whole photo without a crop, and gives no box without a size", () => {
      expect(ratio(thumbBox(null, 1080, 1350)!, 1080, 1350)).toBeCloseTo(0.8, 2);
      expect(thumbBox({ x: 0, y: 0, w: 1, h: 1 }, undefined, 1000)).toBeNull();
      expect(thumbBox({ x: 0, y: 0, w: 1, h: 1 }, 0, 1000)).toBeNull();
    });
  });

  it("leaves bad data out and reports it, and never throws", () => {
    const inputs = readInputs(DATA);
    const c = inputs.concerts[0];
    const twin = { ...c, id: "twin", date: "1999-01-01", headliner: "The Adam Ant", headlinerNormalized: "the-adam-ant", openers: [] };
    // "The The" folds to no act key at all
    const thethe = { ...c, id: "thethe", date: "1999-02-02", headliner: "The The", headlinerNormalized: "the-the", openers: [] };
    const bad = {
      ...inputs,
      concerts: [...inputs.concerts, twin, thethe],
      setlists: [
        ...inputs.setlists,
        { concertId: c.id, artistName: c.headliner, date: c.date, setlist: { sets: { set: [{ song: [{ name: "!!!" }] }] } } },
      ],
    };
    let result: ReturnType<typeof buildIndex> | undefined;
    expect(() => (result = buildIndex(bad))).not.toThrow();
    const kinds = result!.manifest.problems.map((p) => p.kind);
    expect(kinds).toContain("no-key");
    expect(kinds).toContain("ambiguous-act");
    expect(result!.manifest.problems).toContainEqual({ kind: "no-act-key", what: "The The (the-the)" });
    expect(result!.manifest.ambiguous).toContain("adamant");
  });
});
