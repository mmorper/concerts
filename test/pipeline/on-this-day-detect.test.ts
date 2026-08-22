/**
 * On This Day detection and anniversary scoring (#333).
 *
 * The spec gives one worked example — "a one-off show from 7 years ago scores
 * lowest and should usually not publish" — and `PUBLISH_THRESHOLD` is
 * calibrated to it rather than picked. That case is asserted directly, because
 * it is the only fixed point the scoring has.
 */

import { describe, it, expect } from "vitest";
import {
  calendarDay,
  showsOnDay,
  candidateForDay,
  isPublishable,
  scoreDay,
  PUBLISH_THRESHOLD,
} from "../../scripts/on-this-day/detect.ts";
import type { Concert } from "../../src/types/concert.ts";

let seq = 0;
function concert(date: string, headliner: string, venue = "The Venue"): Concert {
  return {
    id: `c${++seq}`,
    date,
    headliner,
    headlinerNormalized: headliner.toLowerCase().replace(/\s+/g, "-"),
    openers: [],
    venue,
    venueNormalized: venue.toLowerCase().replace(/\s+/g, "-"),
    city: "Los Angeles",
    state: "California",
    year: Number(date.slice(0, 4)),
  } as unknown as Concert;
}

const NOW = new Date(Date.UTC(2026, 5, 4)); // 2026-06-04

describe("calendarDay", () => {
  it("is month-day, zero padded", () => {
    expect(calendarDay(new Date(Date.UTC(2026, 0, 5)))).toBe("01-05");
    expect(calendarDay(new Date(Date.UTC(2026, 11, 31)))).toBe("12-31");
  });
});

describe("showsOnDay", () => {
  it("matches the calendar day across every earlier year", () => {
    const shows = showsOnDay(
      [concert("1986-06-04", "A"), concert("2001-06-04", "B"), concert("1990-07-04", "C")],
      NOW
    );
    expect(shows.map((s) => s.headliner)).toEqual(["A", "B"]);
  });

  it("sorts oldest first", () => {
    const shows = showsOnDay([concert("2001-06-04", "B"), concert("1986-06-04", "A")], NOW);
    expect(shows.map((s) => s.headliner)).toEqual(["A", "B"]);
  });

  it("excludes the current year — a show is not an anniversary of itself", () => {
    // Without this, a January show produces an "0 years ago today" post in
    // the same December.
    expect(showsOnDay([concert("2026-06-04", "A")], NOW)).toEqual([]);
  });
});

describe("scoreDay", () => {
  function score(shows: Concert[], all: Concert[], ages: number[]) {
    return scoreDay({ day: "06-04", publishYear: 2026, shows, ages }, all);
  }

  it("scores a round anniversary highest, and weights it by size", () => {
    const fortieth = concert("1986-06-04", "A");
    const fifth = concert("2021-06-04", "B");
    const a = score([fortieth], [fortieth], [40]);
    const b = score([fifth], [fifth], [5]);

    expect(a.reasons.some((r) => r.code === "round-anniversary")).toBe(true);
    expect(b.reasons.some((r) => r.code === "round-anniversary")).toBe(true);
    // A 40th is a bigger deal than a 5th.
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("credits a first sighting only when there were more", () => {
    const first = concert("1990-06-04", "Band");
    const later = concert("2000-01-01", "Band");
    const withMore = score([first], [first, later], [36]);
    expect(withMore.reasons.some((r) => r.code === "first-sighting")).toBe(true);

    // "The first of one" is just "one".
    const alone = score([first], [first], [36]);
    expect(alone.reasons.some((r) => r.code === "first-sighting")).toBe(false);
    expect(alone.reasons.some((r) => r.code === "only-sighting")).toBe(true);
  });

  it("credits a first show at a venue that became a regular", () => {
    const first = concert("1990-06-04", "A", "Regular Room");
    const rest = [
      concert("1995-01-01", "B", "Regular Room"),
      concert("2000-01-01", "C", "Regular Room"),
    ];
    const hit = score([first], [first, ...rest], [36]);
    expect(hit.reasons.some((r) => r.code === "first-at-venue")).toBe(true);

    // Two shows is not "became a regular".
    const thin = score([first], [first, rest[0]], [36]);
    expect(thin.reasons.some((r) => r.code === "first-at-venue")).toBe(false);
  });

  it("gives depth a small, capped contribution so it cannot outrank an anniversary", () => {
    const old = concert("1984-06-04", "A");
    const older = score([old], [old, concert("2000-01-01", "A")], [42]);
    const depth = older.reasons.find((r) => r.code === "long-ago");
    expect(depth!.points).toBeLessThanOrEqual(10);
  });
});

describe("the spec's worked example", () => {
  it("does not publish a one-off from seven years ago", () => {
    // "A one-off show from 7 years ago scores lowest and should usually not
    // publish." PUBLISH_THRESHOLD is calibrated to sit just above this.
    const oneOff = concert("2019-06-04", "Someone");
    const candidate = candidateForDay([oneOff], NOW)!;

    expect(candidate.score).toBeLessThan(PUBLISH_THRESHOLD);
    expect(isPublishable(candidate)).toBe(false);
  });

  it("does publish the same show once it is old enough to be interesting", () => {
    const oneOff = concert("1996-06-04", "Someone");
    const candidate = candidateForDay([oneOff], NOW)!;
    expect(isPublishable(candidate)).toBe(true);
  });
});

describe("candidateForDay", () => {
  it("returns nothing on an empty calendar day", () => {
    expect(candidateForDay([concert("1990-07-04", "A")], NOW)).toBeUndefined();
  });

  it("defers a multi-show day rather than dropping it", () => {
    // DECISIONS.md §10: a date with several shows has no single subject, so no
    // tier-1 or tier-2 image routes to it. Scored and reported, not silently
    // lost, so it lights up when tier-3 artwork lands.
    const shows = [concert("1986-06-04", "A"), concert("2001-06-04", "B")];
    const candidate = candidateForDay(shows, NOW)!;

    expect(candidate.shows).toHaveLength(2);
    expect(candidate.score).toBeGreaterThan(0);
    expect(candidate.deferred).toMatch(/no single subject/);
    expect(isPublishable(candidate)).toBe(false);
  });

  it("defers an artist posted recently rather than repeating the feed", () => {
    const show = concert("1986-06-04", "Depeche Mode");
    const candidate = candidateForDay([show], NOW, {
      recentArtists: new Set(["depeche-mode"]),
    })!;
    expect(candidate.deferred).toMatch(/recently/);
    expect(isPublishable(candidate)).toBe(false);
  });

  it("computes ages against the publishing year", () => {
    const candidate = candidateForDay([concert("1986-06-04", "A")], NOW)!;
    expect(candidate.publishYear).toBe(2026);
    expect(candidate.ages).toEqual([40]);
  });
});
