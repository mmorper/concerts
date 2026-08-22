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
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

import { ROOT } from "./payload.ts";

export const PAUSE_PATH = join(ROOT, "data", "syndication-pause.json");

export interface PauseState {
  paused: boolean;
  /** Why. Shown in every run log, so a future reader is never guessing. */
  reason?: string;
  pausedAt?: string;
  resumedAt?: string;
}

export interface PauseVerdict {
  paused: boolean;
  /** One line for the run log. Empty when not paused. */
  detail: string;
}

export function readPause(path: string = PAUSE_PATH): PauseVerdict {
  if (process.env.SYNDICATION_PAUSED === "1") {
    return { paused: true, detail: "SYNDICATION_PAUSED=1 is set in the environment" };
  }

  if (!existsSync(path)) return { paused: false, detail: "" };

  let state: PauseState;
  try {
    state = JSON.parse(readFileSync(path, "utf8")) as PauseState;
  } catch (err) {
    // Cannot tell → do not post. See the asymmetry note above.
    return {
      paused: true,
      detail: `pause file is unreadable (${(err as Error).message}) — refusing to post`,
    };
  }

  if (typeof state.paused !== "boolean") {
    return { paused: true, detail: "pause file has no boolean `paused` — refusing to post" };
  }
  if (!state.paused) return { paused: false, detail: "" };

  const since = state.pausedAt ? ` since ${state.pausedAt.slice(0, 10)}` : "";
  return { paused: true, detail: `paused${since}${state.reason ? ` — ${state.reason}` : ""}` };
}

export function writePause(state: PauseState, path: string = PAUSE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function pause(reason: string, path: string = PAUSE_PATH): PauseState {
  const state: PauseState = { paused: true, reason, pausedAt: new Date().toISOString() };
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
  const previous = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as PauseState)
    : {};
  const state: PauseState = {
    ...previous,
    paused: false,
    resumedAt: new Date().toISOString(),
  };
  writePause(state, path);
  return state;
}
