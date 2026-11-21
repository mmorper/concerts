import { describe, expect, it } from "vitest";
import { emptyListener, initialRoom, LIVENESS_MS, nextAlarm, OFFLINE_MS, reduce, type Listener, type RoomEvent, type RoomState } from "./room-logic.js";
import type { Track } from "./types.js";

const TZ = "America/Los_Angeles";
const T0 = Date.parse("2026-11-21T23:00:00.000Z"); // 3:00 PM in Los Angeles

const track = (title: string): Track => ({
  title,
  artist: "Depeche Mode",
  album: null,
  screen: "heard",
  headline: "x",
  lines: [],
  nights: [],
  moreNights: 0,
  photos: [],
  accentHue: 1,
});

/** Apply events in order, each `dt` ms after the last. */
function run(events: [number, RoomEvent][], start: { room?: RoomState; listener?: Listener } = {}) {
  let room = start.room ?? initialRoom(new Date(T0).toISOString());
  let listener = start.listener ?? emptyListener();
  let now = T0;
  const pushes: boolean[] = [];
  let alarmAt: number | null = null;
  for (const [dt, ev] of events) {
    now += dt;
    const out = reduce(room, listener, ev, now, TZ);
    room = out.room;
    listener = out.listener;
    pushes.push(out.push);
    alarmAt = out.alarmAt;
  }
  return { room, listener, pushes, alarmAt, now };
}

const dm = (title = "Enjoy the Silence"): RoomEvent => ({ event: "track", track: track(title), key: `depechemode|${title}` });

describe("tracks", () => {
  it("shows a track and tells displays", () => {
    const r = run([[0, dm()]]);
    expect(r.room.state.kind).toBe("track");
    expect(r.room.state.track?.title).toBe("Enjoy the Silence");
    expect(r.pushes).toEqual([true]);
  });

  it("pushes nothing for the same song again while it's showing", () => {
    const r = run([[0, dm()], [30_000, dm()]]);
    expect(r.pushes).toEqual([true, false]);
  });

  it("shows the same song again after a gap, so replaying it works", () => {
    const r = run([[0, dm()], [1000, { event: "gap" }], [1000, dm()]]);
    expect(r.room.state.kind).toBe("track");
    expect(r.pushes).toEqual([true, true, true]);
  });

  it("keeps the last track through a gap", () => {
    const r = run([[0, dm()], [1000, { event: "gap" }]]);
    expect(r.room.state.kind).toBe("gap");
    expect(r.room.state.track?.title).toBe("Enjoy the Silence");
  });

  it("goes idle when the record stops, and forgets the track", () => {
    const r = run([[0, dm()], [1000, { event: "stopped" }]]);
    expect(r.room.state).toEqual({ v: 1, kind: "idle", at: new Date(T0 + 1000).toISOString() });
    expect(r.room.trackKey).toBeNull();
  });

  it("shows 'unmatched' once, not on every miss", () => {
    const r = run([[0, { event: "unmatched" }], [1000, { event: "unmatched" }]]);
    expect(r.room.state.kind).toBe("unmatched");
    expect(r.pushes).toEqual([true, false]);
  });
});

describe("liveness", () => {
  it("goes idle by itself if the listener stops reporting mid-song", () => {
    const r = run([[0, dm()], [LIVENESS_MS, { event: "alarm" }]]);
    expect(r.room.state.kind).toBe("idle");
    expect(r.pushes).toEqual([true, true]);
  });

  it("doesn't go idle while heartbeats keep coming", () => {
    const r = run([[0, dm()], [60_000, { event: "alive" }], [60_000, { event: "alive" }], [LIVENESS_MS - 60_000, { event: "alarm" }]]);
    expect(r.room.state.kind).toBe("track");
  });

  it("sets the alarm for the earlier deadline", () => {
    const r = run([[0, dm()]]);
    expect(r.alarmAt).toBe(T0 + LIVENESS_MS);
  });
});

describe("listener health", () => {
  it("puts an offline notice on the idle screen after 15 minutes of silence, in local time", () => {
    const r = run([[0, { event: "alive" }], [OFFLINE_MS, { event: "alarm" }]]);
    expect(r.room.state).toMatchObject({ kind: "idle", notice: "The listener has been offline since 3:00 PM." });
    expect(r.pushes.at(-1)).toBe(true);
  });

  it("clears the notice on the next heartbeat", () => {
    const r = run([[0, { event: "alive" }], [OFFLINE_MS, { event: "alarm" }], [60_000, { event: "alive" }]]);
    expect(r.room.state.notice).toBeUndefined();
    expect(r.pushes.at(-1)).toBe(true);
  });

  it("says when song recognition is failing", () => {
    const r = run([[0, { event: "status", recognizer: "failing", receiver: "ok", appleTv: "ok", version: "1" }]]);
    expect(r.room.state.notice).toBe("Song recognition isn't working right now.");
    expect(r.listener).toMatchObject({ recognizer: "failing", receiver: "ok", appleTv: "ok", version: "1" });
  });

  it("names the date when the listener went quiet on an earlier day", () => {
    const r = run([[0, { event: "alive" }], [24 * 60 * 60_000, { event: "alarm" }]]);
    expect(r.room.state.notice).toBe("The listener has been offline since Nov 21, 3:00 PM.");
  });

  it("schedules the offline check even when idle", () => {
    const r = run([[0, { event: "alive" }]]);
    expect(r.alarmAt).toBe(T0 + OFFLINE_MS);
  });
});

describe("nextAlarm", () => {
  it("is null with nothing to watch", () => {
    expect(nextAlarm(initialRoom(new Date(T0).toISOString()), emptyListener(), T0)).toBeNull();
  });
});

describe("privacy", () => {
  it("holds no history: after a hundred songs the room knows only the last", () => {
    const events: [number, RoomEvent][] = Array.from({ length: 100 }, (_, i) => [1000, dm(`Song ${i}`)] as [number, RoomEvent]);
    const r = run(events);
    expect(JSON.stringify(r.room)).not.toContain("Song 98");
    expect(r.room.state.track?.title).toBe("Song 99");
  });
});
