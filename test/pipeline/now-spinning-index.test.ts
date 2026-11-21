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
import { buildIndex, readInputs } from "../../scripts/build-now-spinning-index.ts";
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

  it("gives every song at least one strict key", () => {
    for (const a of acts) for (const s of a.songs) expect(s.k.length, `${a.slug} "${s.n}"`).toBeGreaterThan(0);
  });

  it("agrees with the site's song index on how many nights each song was heard (#690)", async () => {
    // Every act's setlist counts in both. Compared by act and the setlist's spelling.
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
