/**
 * Held findings — the pipeline's memory of candidates that failed.
 *
 * 🔴 WHY THIS EXISTS. Selection is deterministic: the same data and the same
 * publication history pick the same candidates. Before this file, a finding
 * that failed the fact-checker was simply dropped for that run, and the next
 * Monday picked it again. Gwen Stefani's walk-on, "Concert #150" and the 1989–1999
 * West Coast run failed on 2026-09-28, 2026-10-05 and again on 2026-10-26 —
 * three of the four Mondays that published nothing were the same three findings.
 *
 * A held finding sits out selection for HOLD_WEEKS, so its detector nominates
 * its next-best finding instead. It returns afterwards on its own, because the
 * usual cause of a failure — a detector bug, a fact-sheet gap, an over-strict
 * check — is something that gets fixed. `--force` ignores the hold, so a repair
 * run (`--pick … --force`) can retry one on purpose.
 *
 * Committed (`data/liner-notes-held.json`) by the workflow alongside the posts,
 * because the memory is worthless if each CI run starts without it.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";

export const HOLD_WEEKS = 8;
const DAY_MS = 86_400_000;

export interface HeldFinding {
  id: string;
  headline: string;
  detector: string;
  /** Why it failed — the gate and its reason, trimmed. */
  reason: string;
  /** ISO date (YYYY-MM-DD) it was held. */
  heldAt: string;
}

export interface HeldFile {
  version: 1;
  held: HeldFinding[];
}

const EMPTY: HeldFile = { version: 1, held: [] };

/** Absent or malformed reads as empty — a lost memory costs one retry, never a crash. */
export function loadHeld(path: string): HeldFile {
  if (!existsSync(path)) return { ...EMPTY, held: [] };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<HeldFile>;
    const held = Array.isArray(raw.held)
      ? raw.held.filter((h): h is HeldFinding => Boolean(h && typeof h.id === "string" && typeof h.heldAt === "string"))
      : [];
    return { version: 1, held };
  } catch {
    return { ...EMPTY, held: [] };
  }
}

function isActive(entry: HeldFinding, today: Date, weeks: number): boolean {
  const heldAt = new Date(`${entry.heldAt}T00:00:00Z`).getTime();
  return today.getTime() - heldAt < weeks * 7 * DAY_MS;
}

/** IDs still inside their hold window as of `today`. */
export function activeHeldIds(file: HeldFile, today: Date, weeks = HOLD_WEEKS): Set<string> {
  return new Set(file.held.filter((h) => isActive(h, today, weeks)).map((h) => h.id));
}

/**
 * Adds this run's failures and drops expired entries. A finding held again
 * replaces its old entry, so the window restarts from the latest failure.
 */
export function recordHeld(
  file: HeldFile,
  failures: Array<Omit<HeldFinding, "heldAt">>,
  today: Date,
  weeks = HOLD_WEEKS
): HeldFile {
  const heldAt = today.toISOString().slice(0, 10);
  const failedIds = new Set(failures.map((f) => f.id));
  const kept = file.held.filter((h) => !failedIds.has(h.id) && isActive(h, today, weeks));
  const added = failures.map((f) => ({ ...f, reason: f.reason.slice(0, 500), heldAt }));
  return { version: 1, held: [...kept, ...added].sort((a, b) => a.heldAt.localeCompare(b.heldAt) || a.id.localeCompare(b.id)) };
}

export function saveHeld(path: string, file: HeldFile): void {
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
}
