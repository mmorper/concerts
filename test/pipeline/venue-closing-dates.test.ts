/**
 * A venue cannot have closed before the last show this archive records in it.
 *
 * `closedDate` is hand-maintained in `data/venue-status.csv`, and a wrong one
 * does not fail loudly — it flows into `venue-ghost`'s data points and the
 * generator writes a coherent, well-sourced, entirely false story out of it.
 * That happened: Universal Amphitheater carried 1999-12-31 beside shows in 2002
 * and 2005, and the published note explained the gap as the venue having been
 * "demolished in 1999 and rebuilt as Gibson Amphitheatre", making the last two
 * shows a different building. Every number in that sentence came from the data.
 *
 * This is the check that would have caught it the day the row was typed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");

interface VenueEntry {
  name: string;
  closedDate?: string | null;
  stats?: { lastEvent?: string };
}

describe("venue closing dates", () => {
  const venues: Record<string, VenueEntry> = JSON.parse(
    readFileSync(join(ROOT, "public/data/venues-metadata.json"), "utf8")
  );

  it("never records a show after the venue closed", () => {
    const contradictions = Object.entries(venues)
      .filter(([, v]) => v.closedDate && v.stats?.lastEvent)
      .filter(([, v]) => v.stats!.lastEvent! > v.closedDate!)
      .map(([slug, v]) => `${slug}: closed ${v.closedDate}, last show ${v.stats!.lastEvent}`);

    expect(contradictions, "fix data/venue-status.csv").toEqual([]);
  });
});
