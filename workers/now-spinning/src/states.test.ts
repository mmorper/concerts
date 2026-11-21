/**
 * test/fixtures/now-spinning-states.json — the state contract, one example of every `screen` and
 * `kind`. The web page renders any of them with `?fixture=<name>`, and the tvOS app's SwiftUI
 * previews load the same file, so all three agree on what a state looks like.
 *
 * This test produces the states from the frozen index and checks the committed file matches.
 * After a deliberate change to the copy or the contract, regenerate it:
 *   UPDATE_FIXTURES=1 npx vitest run src/states.test.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lookup, unknownTrack } from "./identify.js";
import { fixtureLoader } from "./test-loader.js";
import type { NowSpinningState, Track } from "./types.js";

const FILE = join(__dirname, "..", "..", "..", "test", "fixtures", "now-spinning-states.json");
const AT = "2026-11-21T20:00:00.000Z";
const NOW = "2026-11-21T20:01:30.000Z";

const track = (t: Track): NowSpinningState => ({ v: 1, kind: "track", at: AT, now: NOW, track: t });

async function produce(): Promise<Record<string, NowSpinningState>> {
  const l = (artist: string, title: string, album?: string) => lookup({ artist, title, album }, fixtureLoader);
  const heard = await l("Depeche Mode", "Everything Counts (Remastered 2006)");
  return {
    heard: track(heard),
    "heard-medley": track(await l("Tears for Fears", "Head Over Heels")),
    "seen-cover": track(await l("Oingo Boingo", "Only a Lad")),
    seen: track(await l("Depeche Mode", "Barrel of a Gun", "Ultra")),
    "seen-near": track(await l("Devo", "Mr. DNA")),
    "seen-maybe": track(await l("Tears for Fears", "A Song Nobody Has Written")),
    "cover-of-this": track(await l("David Bowie", "Let's Dance - 2018 Remaster")),
    covers: track(await l("The Rolling Stones", "Paint It Black")),
    none: track(await l("Fleetwood Mac", "Dreams", "Rumours")),
    unknown: track(unknownTrack({ artist: "Depeche Mode", title: "Enjoy the Silence", album: "Violator" })),
    idle: { v: 1, kind: "idle", at: AT, now: NOW },
    "idle-offline": { v: 1, kind: "idle", at: AT, now: NOW, notice: "The listener has been offline since 3:12 PM." },
    "idle-recognition": { v: 1, kind: "idle", at: AT, now: NOW, notice: "Song recognition isn't working right now." },
    gap: { v: 1, kind: "gap", at: AT, now: NOW, track: heard },
    unmatched: { v: 1, kind: "unmatched", at: AT, now: NOW },
  };
}

describe("now-spinning-states.json", () => {
  it("matches what the lookup produces", async () => {
    const states = await produce();
    const doc = {
      _comment:
        "The Now Spinning state contract: one example of every screen and kind. Produced by workers/now-spinning/src/states.test.ts from the frozen index; regenerate with UPDATE_FIXTURES=1. The web page renders these with ?fixture=<name>; the tvOS app's previews load this file.",
      ...states,
    };
    if (process.env.UPDATE_FIXTURES) writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
    expect(JSON.parse(readFileSync(FILE, "utf-8"))).toEqual(doc);
  });

  it("covers every screen and every kind", async () => {
    const doc = JSON.parse(readFileSync(FILE, "utf-8")) as Record<string, NowSpinningState | string>;
    const states = Object.values(doc).filter((s): s is NowSpinningState => typeof s === "object");
    const screens = new Set(states.map((s) => s.track?.screen).filter(Boolean));
    const kinds = new Set(states.map((s) => s.kind));
    expect([...screens].sort()).toEqual(["cover-of-this", "covers", "heard", "none", "seen", "seen-cover", "unknown"]);
    expect([...kinds].sort()).toEqual(["gap", "idle", "track", "unmatched"]);
  });
});
