import { describe, expect, it } from "vitest";
import { emptyListener, initialRoom, LIVENESS_MS, nextAlarm, nextLocalMidnight, OFFLINE_MS, reduce, type Listener, type RoomEvent, type RoomState } from "./room-logic.js";
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
function run(events: [number, RoomEvent][], start: { room?: RoomState; listener?: Listener; at?: number; tz?: string } = {}) {
  let now = start.at ?? T0;
  let room = start.room ?? initialRoom(new Date(now).toISOString());
  let listener = start.listener ?? emptyListener();
  const pushes: boolean[] = [];
  let alarmAt: number | null = null;
  for (const [dt, ev] of events) {
    now += dt;
    const out = reduce(room, listener, ev, now, start.tz ?? TZ);
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

/** Run to the offline notice, then let each alarm fire exactly when the room asked for it. */
function overnight(at: number, tz: string, alarms: number) {
  let r = run([[0, { event: "alive" }], [OFFLINE_MS, { event: "alarm" }]], { at, tz });
  const steps = [{ notice: r.room.state.notice, push: r.pushes.at(-1), alarmAt: r.alarmAt }];
  for (let i = 0; i < alarms; i++) {
    r = run([[0, { event: "alarm" }]], { room: r.room, listener: r.listener, at: r.alarmAt!, tz });
    steps.push({ notice: r.room.state.notice, push: r.pushes.at(-1), alarmAt: r.alarmAt });
  }
  return steps;
}

describe("the offline notice overnight", () => {
  it("adds the date at the next local midnight, tells displays once, and then wakes once a day", () => {
    // Last seen 3:00 PM on Nov 21 in Los Angeles (UTC-8): midnight there is 08:00 UTC.
    expect(overnight(T0, TZ, 2)).toEqual([
      { notice: "The listener has been offline since 3:00 PM.", push: true, alarmAt: Date.parse("2026-11-22T08:00:00.000Z") },
      { notice: "The listener has been offline since Nov 21, 3:00 PM.", push: true, alarmAt: Date.parse("2026-11-23T08:00:00.000Z") },
      { notice: "The listener has been offline since Nov 21, 3:00 PM.", push: false, alarmAt: Date.parse("2026-11-24T08:00:00.000Z") },
    ]);
  });

  it("goes by the home's midnight, not UTC's: the case seen live on 2026-11-24", () => {
    // 01:06 UTC on the 24th is 5:06 PM on the 23rd in Los Angeles. UTC's date had already changed.
    expect(overnight(Date.parse("2026-11-24T01:06:00.000Z"), TZ, 1)).toEqual([
      { notice: "The listener has been offline since 5:06 PM.", push: true, alarmAt: Date.parse("2026-11-24T08:00:00.000Z") },
      { notice: "The listener has been offline since Nov 23, 5:06 PM.", push: true, alarmAt: Date.parse("2026-11-25T08:00:00.000Z") },
    ]);
  });

  it("works east of UTC and on a half-hour offset", () => {
    // 4:30 PM on Nov 22 in Kolkata (UTC+5:30): midnight there is 18:30 UTC.
    expect(overnight(Date.parse("2026-11-22T11:00:00.000Z"), "Asia/Kolkata", 2)).toEqual([
      { notice: "The listener has been offline since 4:30 PM.", push: true, alarmAt: Date.parse("2026-11-22T18:30:00.000Z") },
      { notice: "The listener has been offline since Nov 22, 4:30 PM.", push: true, alarmAt: Date.parse("2026-11-23T18:30:00.000Z") },
      { notice: "The listener has been offline since Nov 22, 4:30 PM.", push: false, alarmAt: Date.parse("2026-11-24T18:30:00.000Z") },
    ]);
  });

  it("writes the date straight away when the 15 minutes run past midnight", () => {
    // Last seen 11:50 PM on Nov 21: the notice first appears at 12:05 AM on the 22nd.
    const steps = overnight(Date.parse("2026-11-22T07:50:00.000Z"), TZ, 0);
    expect(steps).toEqual([
      { notice: "The listener has been offline since Nov 21, 11:50 PM.", push: true, alarmAt: Date.parse("2026-11-23T08:00:00.000Z") },
    ]);
  });

  it("sets no midnight alarm while the listener is online", () => {
    const r = run([[0, { event: "alive" }]]);
    expect(r.alarmAt).toBe(T0 + OFFLINE_MS);
  });

  it("leaves the midnight alarm out while a track is showing: liveness comes first", () => {
    // The alarm ran late, past both deadlines. The room is still on a track, so it retries at once.
    const r = run([[0, dm()]]);
    const late = T0 + OFFLINE_MS + 60_000;
    expect(nextAlarm(r.room, r.listener, late, TZ)).toBe(late + 1000);
  });
});

describe("nextLocalMidnight", () => {
  const at = (iso: string, tz = TZ) => new Date(nextLocalMidnight(Date.parse(iso), tz)).toISOString();

  it("is the start of the next day in the given time zone", () => {
    expect(at("2026-11-21T23:00:00.000Z")).toBe("2026-11-22T08:00:00.000Z");
    expect(at("2026-11-21T23:00:00.000Z", "UTC")).toBe("2026-11-22T00:00:00.000Z");
    expect(at("2026-11-21T23:00:00.000Z", "Australia/Sydney")).toBe("2026-11-22T13:00:00.000Z");
  });

  it("is always later than now, even at midnight exactly and a millisecond before it", () => {
    expect(at("2026-11-22T08:00:00.000Z")).toBe("2026-11-23T08:00:00.000Z");
    expect(at("2026-11-22T07:59:59.999Z")).toBe("2026-11-22T08:00:00.000Z");
  });

  it("allows for the 23-hour day when clocks go forward", () => {
    // Los Angeles, Sunday 2027-03-14: 12:30 AM PST, and the day ends 22.5 hours later, in PDT.
    expect(at("2027-03-14T08:30:00.000Z")).toBe("2027-03-15T07:00:00.000Z");
  });

  it("allows for the 25-hour day when clocks go back", () => {
    // Los Angeles, Sunday 2027-11-07: 12:30 AM PDT, and the day ends 24.5 hours later, in PST.
    expect(at("2027-11-07T07:30:00.000Z")).toBe("2027-11-08T08:00:00.000Z");
  });

  it("copes with a zone that changes its clocks at midnight", () => {
    // Santiago, 2026-09-06: Saturday's 11:59 PM is followed by 1:00 AM. There is no 12:00 AM.
    expect(at("2026-09-05T16:00:00.000Z", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
    expect(at("2026-09-06T03:00:00.000Z", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
    // Santiago, 2026-04-04: 11:59 PM is followed by 11:00 PM again, so midnight comes an hour later.
    expect(at("2026-04-04T16:00:00.000Z", "America/Santiago")).toBe("2026-04-05T04:00:00.000Z");
    expect(at("2026-04-05T03:30:00.000Z", "America/Santiago")).toBe("2026-04-05T04:00:00.000Z");
  });
});

describe("nextAlarm", () => {
  it("is null with nothing to watch", () => {
    expect(nextAlarm(initialRoom(new Date(T0).toISOString()), emptyListener(), T0, TZ)).toBeNull();
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
