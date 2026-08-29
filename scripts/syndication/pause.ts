/**
 * Syndication kill switch.
 *
 * Nothing posts to a social channel while this is engaged. It exists because
 * "stop everything until I say so" has to be a thing one person can do in
 * seconds, and be certain of — not a thing that depends on remembering which
 * of five workflows, secrets and crons to touch.
 *
 * ── WHY A COMMITTED FILE ────────────────────────────────────────────────────
 *
 * Same argument the ledger makes: diffable, reviewable, greppable, and visible
 * to anyone reading the repo. A workflow disabled in the GitHub UI is
 * invisible in the code — six months later nobody knows why, or that it
 * happened at all. A pause with a reason and a date in version control
 * explains itself.
 *
 * Kept in its OWN file rather than as a field on the ledger, because the
 * lifecycles differ: the ledger is machine-written on every run, the pause is
 * human-written and rare. Sharing a file means an automated ledger commit can
 * clobber a human's pause, which is precisely the failure this must not have.
 *
 * ── THE DEFAULTS ARE DELIBERATELY ASYMMETRIC ────────────────────────────────
 *
 * Ambiguity means STOP:
 *
 * - Missing file           → not paused. The normal state needs no ceremony.
 * - `paused: true`         → paused.
 * - Malformed / unreadable → **paused**, and says so. The ledger throws on a
 *                            corrupt file because starting fresh there would
 *                            re-post everything; here, refusing to post is the
 *                            safe reading of "I cannot tell".
 * - `SYNDICATION_PAUSED=1` → paused, whatever the file says.
 *
 * There is deliberately **no environment variable that can force a resume**.
 * An emergency stop should be available from anywhere; an emergency start
 * should require editing the file that records why it was stopped.
 *
 * ── PER CHANNEL ─────────────────────────────────────────────────────────────
 *
 * A `channels` map stops one channel without stopping the rest. Mastodon
 * misbehaving should not cost Bluesky its posts, and before this the only
 * honest option was to stop both.
 *
 * Every rule above applies again, scoped: a channel entry that is malformed
 * pauses THAT channel, `SYNDICATION_PAUSED_CHANNELS=mastodon` pauses it
 * whatever the file says, and no environment variable can resume one.
 *
 * The global switch still outranks everything. `paused: true` at the top level
 * stops all channels regardless of what the map says, because "stop
 * everything" has to mean it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

import { ROOT } from "./payload.ts";
import { CHANNELS, type Channel } from "./types.ts";

export const PAUSE_PATH = join(ROOT, "data", "syndication-pause.json");

export interface ChannelPause {
  paused: boolean;
  reason?: string;
  pausedAt?: string;
  resumedAt?: string;
}

export interface PauseState {
  paused: boolean;
  /** Why. Shown in every run log, so a future reader is never guessing. */
  reason?: string;
  pausedAt?: string;
  resumedAt?: string;
  /** Channels stopped on their own, while the rest keep posting. */
  channels?: Partial<Record<Channel, ChannelPause>>;
}

export interface PauseVerdict {
  /** The global switch. When true, no channel posts. */
  paused: boolean;
  /** One line for the run log. Empty when not paused. */
  detail: string;
  /**
   * Channels stopped individually, each with its own line for the log.
   * Populated even when `paused` is true, so `--status` can show the whole
   * picture rather than hiding the detail behind the global switch.
   */
  channels: Partial<Record<Channel, string>>;
}

/** `SYNDICATION_PAUSED_CHANNELS=bluesky,mastodon`. Stops, never resumes. */
function pausedByEnv(): Channel[] {
  const raw = process.env.SYNDICATION_PAUSED_CHANNELS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
}

export function readPause(path: string = PAUSE_PATH): PauseVerdict {
  const channels: Partial<Record<Channel, string>> = {};
  for (const channel of pausedByEnv()) {
    channels[channel] = "SYNDICATION_PAUSED_CHANNELS names it in the environment";
  }

  if (process.env.SYNDICATION_PAUSED === "1") {
    return { paused: true, detail: "SYNDICATION_PAUSED=1 is set in the environment", channels };
  }

  if (!existsSync(path)) return { paused: false, detail: "", channels };

  let state: PauseState;
  try {
    state = JSON.parse(readFileSync(path, "utf8")) as PauseState;
  } catch (err) {
    // Cannot tell → do not post. See the asymmetry note above.
    return {
      paused: true,
      detail: `pause file is unreadable (${(err as Error).message}) — refusing to post`,
      channels,
    };
  }

  // Read the per-channel map BEFORE returning on the global switch, so
  // `--status` shows everything that is engaged rather than only the loudest.
  for (const [name, entry] of Object.entries(state.channels ?? {})) {
    if (!(CHANNELS as readonly string[]).includes(name)) continue;
    const channel = name as Channel;
    if (channels[channel]) continue; // the environment already stopped it
    if (typeof entry?.paused !== "boolean") {
      // Same asymmetry, scoped: an entry we cannot read stops its own channel.
      channels[channel] = "channel entry has no boolean `paused` — refusing to post";
      continue;
    }
    if (!entry.paused) continue;
    const since = entry.pausedAt ? ` since ${entry.pausedAt.slice(0, 10)}` : "";
    channels[channel] = `paused${since}${entry.reason ? ` — ${entry.reason}` : ""}`;
  }

  if (typeof state.paused !== "boolean") {
    return {
      paused: true,
      detail: "pause file has no boolean `paused` — refusing to post",
      channels,
    };
  }
  if (!state.paused) return { paused: false, detail: "", channels };

  const since = state.pausedAt ? ` since ${state.pausedAt.slice(0, 10)}` : "";
  return {
    paused: true,
    detail: `paused${since}${state.reason ? ` — ${state.reason}` : ""}`,
    channels,
  };
}

/**
 * Is this one channel stopped, by either switch?
 *
 * The global one outranks the map, because "stop everything" has to mean it.
 */
export function isChannelPaused(channel: Channel, verdict: PauseVerdict): boolean {
  return verdict.paused || channel in verdict.channels;
}

export function writePause(state: PauseState, path: string = PAUSE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

function readState(path: string): PauseState {
  try {
    return existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as PauseState)
      : ({} as PauseState);
  } catch {
    // A corrupt file must not block a PAUSE. Refusing to stop because the
    // record of stopping is malformed would be the worst possible reading of
    // the asymmetry — it is `readPause` that treats corruption as "stop", and
    // this is the function that gets you there.
    return {} as PauseState;
  }
}

export function pause(reason: string, path: string = PAUSE_PATH): PauseState {
  const previous = readState(path);
  const state: PauseState = {
    ...previous,
    paused: true,
    reason,
    pausedAt: new Date().toISOString(),
  };
  writePause(state, path);
  return state;
}

/**
 * Stop one channel and leave the others posting.
 *
 * Merged into whatever is already on file rather than replacing it, so pausing
 * Mastodon never quietly resumes Bluesky.
 */
export function pauseChannel(
  channel: Channel,
  reason: string,
  path: string = PAUSE_PATH
): PauseState {
  const previous = readState(path);
  const state: PauseState = {
    ...previous,
    paused: previous.paused ?? false,
    channels: {
      ...previous.channels,
      [channel]: { paused: true, reason, pausedAt: new Date().toISOString() },
    },
  };
  writePause(state, path);
  return state;
}

/**
 * Resume one channel.
 *
 * The row survives with `paused: false`, for the same reason the global resume
 * keeps its record: a deleted entry is indistinguishable from one that never
 * existed, and the audit trail is the point of a committed switch.
 *
 * This does NOT lift a global pause. Resuming one channel while "stop
 * everything" is engaged would be a surprising way to start posting again.
 */
export function resumeChannel(channel: Channel, path: string = PAUSE_PATH): PauseState {
  const previous = readState(path);
  const entry = previous.channels?.[channel] ?? {};
  const state: PauseState = {
    ...previous,
    paused: previous.paused ?? false,
    channels: {
      ...previous.channels,
      [channel]: { ...entry, paused: false, resumedAt: new Date().toISOString() },
    },
  };
  writePause(state, path);
  return state;
}

/**
 * Resume.
 *
 * The record is kept rather than deleted — `paused: false` with the dates
 * still on it says "this was paused and is now not", where a missing file says
 * only "nothing to see". The second is indistinguishable from never having
 * paused at all, and the whole point of a committed switch is the audit trail.
 */
export function resume(path: string = PAUSE_PATH): PauseState {
  const previous = readState(path);
  const state: PauseState = {
    ...previous,
    paused: false,
    resumedAt: new Date().toISOString(),
  };
  writePause(state, path);
  return state;
}
