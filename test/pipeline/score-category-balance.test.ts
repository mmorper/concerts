/**
 * Category Balance must not be a cliff.
 *
 * It was `count < average ? 5 : 0`, which means a category one finding either
 * side of the mean differs by five points — a quarter of MIN_SCORE. That is not
 * a tuning preference; it makes every finding's publishability depend on the
 * exact size of the corpus around it.
 *
 * It fired for real. Fixing `rare-sighting` to count opener credits removed 13
 * false findings, which moved the average from 66.67 to 65.67 with `personal`
 * sitting at 66. Every personal finding lost five points at once and three
 * `milestone-marker` findings dropped under the floor — a correctness fix in an
 * unrelated detector deciding whether "My 50th Show" publishes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { analyze } from "../../scripts/liner-notes/analyze";
import { score, MIN_SCORE } from "../../scripts/liner-notes/score";
import type { Concert } from "../../src/types/concert";

const DATA = join(__dirname, "..", "..", "public", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const concerts: Concert[] = read("concerts.json").concerts;
const today = new Date("2026-08-31T12:00:00Z");

function findingsAndScores(cs: Concert[]) {
  const { findings } = analyze(cs, today, {
    venuesMetadata: read("venues-metadata.json"),
    artistsMetadata: read("artists-metadata.json"),
  });
  // Populated, not empty: it feeds the scoring rubric, and an empty map quietly
  // suppresses points for every finding — which looks exactly like the failure
  // this file is about and is not.
  const concertCountByArtist: Record<string, number> = {};
  for (const c of cs) {
    concertCountByArtist[c.headlinerNormalized] =
      (concertCountByArtist[c.headlinerNormalized] ?? 0) + 1;
  }
  const scored = score(
    findings,
    {
      artistsMetadata: read("artists-metadata.json"),
      artistsTopTracks: read("artists-top-tracks.json"),
      concertCountByArtist,
    },
    today
  );
  return { findings, scored };
}

describe("category balance is proportional, not a cliff", () => {
  it("does not swing a whole category by 5 points when the corpus changes by one", () => {
    // Drop a single concert. Under the cliff this could move the mean across an
    // integer count and re-price every finding in a category at once.
    const { findings: a, scored: sa } = findingsAndScores(concerts);
    const { findings: b, scored: sb } = findingsAndScores(concerts.slice(0, -1));

    const scoreOf = (list: typeof sa, id: string) => list.find((x) => x.id === id)?.score;
    const shared = a.filter((f) => b.some((g) => g.id === f.id));

    const swings = shared
      .map((f) => {
        const x = scoreOf(sa, f.id);
        const y = scoreOf(sb, f.id);
        return x !== undefined && y !== undefined ? Math.abs(x - y) : 0;
      })
      .filter((d) => d >= 5);

    expect(swings, "a one-concert change re-priced findings by 5+ points").toEqual([]);
  });

  it("still rewards the least-represented category over the most", () => {
    const { findings, scored } = findingsAndScores(concerts);
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.category] = (counts[f.category] ?? 0) + 1;

    const entries = Object.entries(counts).sort((x, y) => x[1] - y[1]);
    const fewest = entries[0][0];
    const most = entries[entries.length - 1][0];

    const balanceOf = (cat: string) =>
      scored.find((f) => f.category === cat)?.scoreBreakdown.categoryBalance ?? 0;

    expect(balanceOf(fewest)).toBeGreaterThan(balanceOf(most));
  });

  it("keeps milestones past a decade above the floor", () => {
    // The property #233 established, restated as an outcome rather than an
    // assumption about the corpus.
    const { findings, scored } = findingsAndScores(concerts);
    const deep = findings.filter(
      (f) =>
        f.detector === "milestone-marker" &&
        ((f.dataPoints as Record<string, unknown>).spanYears as number) > 10
    );
    expect(deep.length).toBeGreaterThan(0);
    for (const f of deep) {
      const s = scored.find((x) => x.id === f.id);
      expect(s, `${f.headline} fell below MIN_SCORE (${MIN_SCORE})`).toBeDefined();
    }
  });
});
