/**
 * The rules of the room, apart from the runtime: what each event does to the state, whether
 * displays need telling, and when the alarm should next fire.
 *
 * Pure (state, event and clock in; new state and next alarm out), so the rules are tested with
 * plain vitest like the repo's other Workers. The Durable Object (room.ts) is a thin shell that
 * stores the result, broadcasts it, and sets the alarm.
 *
 * Privacy: the room holds exactly two things, the current state and the listener's health. No
 * history, no list. Stopping the record erases the last track.
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Behaviour, §Listener health
 */

import { INDEX_VERSION, type Kind, type NowSpinningState, type Track } from "./types.js";

/** A track, idle or not, with no ingest for this long → idle. A Pi that dies can't leave a song up. */
export const LIVENESS_MS = 3 * 60_000;
/** No heartbeat of any kind for this long → the idle screen says the listener is offline. */
export const OFFLINE_MS = 15 * 60_000;

export interface Listener {
  lastSeenAt: string | null;
  recognizer: "ok" | "failing" | null;
  receiver: "ok" | "unreachable" | null;
  appleTv: "ok" | "unreachable" | null;
  version: string | null;
}

/** Stored under the "state" key. `now` is added when a message is sent. */
export interface RoomState {
  state: Omit<NowSpinningState, "now">;
  /** Identifies the current track, so a repeat of it pushes nothing. */
  trackKey: string | null;
  lastIngestAt: string | null;
}

export type RoomEvent =
  | { event: "track"; track: Track; key: string }
  | { event: "gap" }
  | { event: "unmatched" }
  | { event: "stopped" }
  | { event: "alive" }
  | { event: "status"; recognizer: "ok" | "failing"; receiver: "ok" | "unreachable"; appleTv: "ok" | "unreachable"; version: string }
  | { event: "alarm" };

export interface Outcome {
  room: RoomState;
  listener: Listener;
  /** Did the state change in a way displays need to hear about? */
  push: boolean;
  /** Epoch ms for the next alarm, or null for none. */
  alarmAt: number | null;
}

export const emptyListener = (): Listener => ({ lastSeenAt: null, recognizer: null, receiver: null, appleTv: null, version: null });

export const initialRoom = (nowIso: string): RoomState => ({
  state: { v: INDEX_VERSION, kind: "idle", at: nowIso },
  trackKey: null,
  lastIngestAt: null,
});

/** Format a time for the idle notice, in the home's time zone. */
export function noticeTime(iso: string, nowMs: number, tz: string): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
  const day = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric" }).format(d);
  return day(at) === day(new Date(nowMs)) ? time : `${day(at).replace(/, \d{4}$/, "")}, ${time}`;
}

/** The one line the idle screen may carry, or undefined. */
export function noticeFor(listener: Listener, nowMs: number, tz: string): string | undefined {
  if (listener.lastSeenAt && nowMs - Date.parse(listener.lastSeenAt) >= OFFLINE_MS) {
    return `The listener has been offline since ${noticeTime(listener.lastSeenAt, nowMs, tz)}.`;
  }
  if (listener.recognizer === "failing") return "Song recognition isn't working right now.";
  return undefined;
}

function idle(nowIso: string, notice: string | undefined): RoomState["state"] {
  return { v: INDEX_VERSION, kind: "idle", at: nowIso, ...(notice ? { notice } : {}) };
}

/** Apply one event. Never mutates its inputs. */
export function reduce(room: RoomState, listener: Listener, ev: RoomEvent, nowMs: number, tz: string): Outcome {
  const nowIso = new Date(nowMs).toISOString();
  let r: RoomState = room;
  let l: Listener = listener;
  let push = false;
  const set = (state: RoomState["state"], trackKey: string | null = r.trackKey) => {
    r = { ...r, state, trackKey };
    push = true;
  };
  const kind: Kind = room.state.kind;

  // Every ingest event is a sign of life.
  if (ev.event !== "alarm") {
    l = { ...l, lastSeenAt: nowIso };
    r = { ...r, lastIngestAt: nowIso };
  }

  switch (ev.event) {
    case "track":
      // The same song again while it's showing: keep the screen as it is.
      if (kind === "track" && r.trackKey === ev.key) break;
      set({ v: INDEX_VERSION, kind: "track", at: nowIso, track: ev.track }, ev.key);
      break;
    case "gap":
      if (kind === "track" && r.state.track) set({ v: INDEX_VERSION, kind: "gap", at: nowIso, track: r.state.track });
      break;
    case "unmatched":
      if (kind !== "unmatched") set({ v: INDEX_VERSION, kind: "unmatched", at: nowIso }, null);
      break;
    case "stopped":
      if (kind !== "idle") set(idle(nowIso, noticeFor(l, nowMs, tz)), null);
      break;
    case "alive":
      break;
    case "status":
      l = { ...l, recognizer: ev.recognizer, receiver: ev.receiver, appleTv: ev.appleTv, version: ev.version };
      break;
    case "alarm":
      if (kind !== "idle" && r.lastIngestAt && nowMs - Date.parse(r.lastIngestAt) >= LIVENESS_MS) {
        set(idle(nowIso, noticeFor(l, nowMs, tz)), null);
      }
      break;
  }

  // On the idle screen, keep the notice in step with the listener's health.
  if (r.state.kind === "idle") {
    const notice = noticeFor(l, nowMs, tz);
    if (notice !== r.state.notice) {
      r = { ...r, state: { v: INDEX_VERSION, kind: "idle", at: r.state.at, ...(notice ? { notice } : {}) } };
      push = true;
    }
  }

  return { room: r, listener: l, push, alarmAt: nextAlarm(r, l, nowMs, tz) };
}

/** The local wall clock at an instant, as if it were UTC, to the second. */
function wallClock(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(ms);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
}

/** The start of the next calendar day in `tz`, in epoch ms. Always later than `nowMs`. */
export function nextLocalMidnight(nowMs: number, tz: string): number {
  const second = nowMs - (nowMs % 1000);
  const wall = new Date(wallClock(second, tz));
  const midnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);
  // Right unless the clocks change before then. If they do, use the offset in force at midnight.
  const guess = midnight - (wall.getTime() - second);
  const at = midnight - (wallClock(guess, tz) - guess);
  // Where the clocks go forward at midnight itself there is no 12:00 AM: the day starts at `guess`.
  return wallClock(at, tz) === midnight ? at : guess;
}

/**
 * One alarm, three deadlines: the earliest of liveness, the offline notice, and the local midnight
 * that puts a date on a notice already showing ("since 5:06 PM" must not outlive its day).
 */
export function nextAlarm(room: RoomState, listener: Listener, nowMs: number, tz: string): number | null {
  const deadlines: number[] = [];
  if (room.state.kind !== "idle" && room.lastIngestAt) deadlines.push(Date.parse(room.lastIngestAt) + LIVENESS_MS);
  if (listener.lastSeenAt) {
    const offlineAt = Date.parse(listener.lastSeenAt) + OFFLINE_MS;
    if (offlineAt > nowMs) deadlines.push(offlineAt);
    // Offline and idle: the notice is up, and it stays true only until the day changes.
    else if (room.state.kind === "idle") deadlines.push(nextLocalMidnight(nowMs, tz));
  }
  const future = deadlines.filter((d) => d > nowMs);
  return future.length ? Math.min(...future) : deadlines.length ? nowMs + 1000 : null;
}
