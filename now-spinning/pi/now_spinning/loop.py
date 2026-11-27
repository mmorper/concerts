"""The identification loop (Phase 4b): loudness and recognition results in, Worker events out.

Pure rules, no I/O, like controller.py, so whole evenings run in the tests with a fake clock. The
spec's §Pi listener "Identification loop":

- Silence is RMS below −50 dBFS: for 4 s → `gap` once; for 3 minutes → `stopped`.
- First match fast: a 12 s clip as soon as there are 12 s of sound, and again right after a gap.
- Then slow down: with a song established, a clip every 30 s.
- No flapping: replacing an established song needs two results in a row that agree. The first
  result after a gap, `unmatched` or idle posts at once.
- No match: three misses in a row → `unmatched` once. Five minutes of sound with no match (the
  run-out groove, a record Shazam doesn't know) → `stopped`, then a clip every 2 minutes until
  something matches or real silence (a gap) resets the loop.
- `alive` every 60 s while the screen shows a song, a gap or `unmatched`.
- Recognition errors (not "no match") count separately: three in a row → the health check-in
  says `failing`. An error is not a miss (it never posts `unmatched`), but the five minutes
  without a match run on through errors: after a long outage the song clears rather than stay
  up stale, and the idle screen says recognition isn't working.
- Resync: when an event is dropped after its retries, the Worker may have lost the current state,
  so the next reading re-posts it. `alive` alone can't: the Worker ignores it while idle, and the
  same song posts nothing new. After an audio outage the loop starts afresh instead: the next clip
  posts what is playing then.

The loop runs only while the gate is open: the main zone on Phono, or the receiver unreachable.
Closing the gate posts `stopped`. The return to the Apple TV input is not decided here: it stays
with controller.py's loudness rule, so it works even when Shazam doesn't (see the spec).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .recognition import CLIP_S, Match

SILENCE_DBFS = -50.0
GAP_AFTER_S = 4
STOPPED_AFTER_S = 180
RECHECK_S = 30
RETRY_S = 10  # no song yet: the next clip, mostly fresh audio
MISSES_FOR_UNMATCHED = 3
NO_MATCH_STOP_S = 300
SLOW_RETRY_S = 120
ALIVE_EVERY_S = 60
ERROR_RETRY_S = 30
FAILING_AFTER = 3


@dataclass
class Clip:
    """A recognition the app should start now. `epoch` comes back with the result."""

    epoch: int


class NoMatch:
    """Recognition answered: nothing matched."""


class Failed:
    """Recognition couldn't answer (network, blocked)."""


Result = Match | NoMatch | Failed


class Loop:
    def __init__(self) -> None:
        self.open = False
        self.shown = "idle"  # what the Worker was last told: idle | track | gap | unmatched
        self.track: Match | None = None
        self.candidate: Match | None = None
        self.misses = 0
        self.errors = 0
        self.slow = False
        self.sound_since: float | None = None
        self.silent_since: float | None = None
        self.gapped = False
        self.last_match_at = -math.inf
        self.next_clip_at = -math.inf
        self.in_flight = False
        self.epoch = 0
        self.last_post_at = -math.inf
        self.need_resync = False

    @property
    def failing(self) -> bool:
        return self.errors >= FAILING_AFTER

    # ── the gate ──────────────────────────────────────────────────────────────────────────

    def set_gate(self, now: float, open_: bool) -> list[dict]:
        if open_ == self.open:
            return []
        out = self._post(now, "stopped") if not open_ and self.shown != "idle" else []
        self.open = open_
        self._reset()
        return out

    def audio_resumed(self) -> None:
        """Readings are back after an outage: nothing heard during it counts (as controller.py).
        What was showing may have ended, and the Worker went idle if the outage outlasted its
        3-minute liveness alarm. So start afresh, posting nothing: the next clip (12 s after sound
        returns) posts what is actually playing, never a stale song."""
        self.shown, self.track, self.candidate = "idle", None, None
        self.sound_since = self.silent_since = None
        self.next_clip_at = -math.inf
        self.epoch += 1
        self.in_flight = False

    def resync(self) -> None:
        """Re-post what the screen should show at the next reading (the Worker may have lost it)."""
        self.need_resync = True

    # ── loudness, once a second ───────────────────────────────────────────────────────────

    def on_level(self, now: float, dbfs: float) -> tuple[list[dict], Clip | None]:
        if not self.open:
            return [], None
        out: list[dict] = []
        if dbfs < SILENCE_DBFS:
            self.sound_since = None
            if self.silent_since is None:
                self.silent_since = now
            quiet = now - self.silent_since
            if quiet >= GAP_AFTER_S and not self.gapped:
                # Real silence. A clip from before it is about what just ended: drop its result.
                # The search starts afresh with the next sound.
                self.gapped = True
                self.epoch += 1
                self.in_flight = False
                self.misses, self.slow, self.candidate = 0, False, None
                if self.shown in ("track", "unmatched"):
                    out += self._post(now, "gap")
                    self.shown = "gap"
            if quiet >= STOPPED_AFTER_S and self.shown != "idle":
                out += self._stop(now)
        else:
            if self.sound_since is None:
                self.sound_since = now
                self.gapped = False
                if self.silent_since is not None:
                    self.next_clip_at = -math.inf  # right after any silence: listen again at once
                self.silent_since = None
            if (
                not self.slow
                and now - max(self.sound_since, self.last_match_at) >= NO_MATCH_STOP_S
            ):
                # Five minutes of sound and nothing matched: the run-out groove, or a record Shazam
                # doesn't know. Say stopped, keep trying slowly.
                out += self._stop(now) if self.shown != "idle" else []
                self.slow = True
                self.next_clip_at = now + SLOW_RETRY_S

        if self.need_resync:
            self.need_resync = False
            if self.shown == "track" and self.track is not None:
                out += self._show(now, self.track)
            elif self.shown in ("gap", "unmatched"):
                out += self._post(now, self.shown)
        if self.shown in ("track", "gap", "unmatched") and now - self.last_post_at >= ALIVE_EVERY_S:
            out += self._post(now, "alive")

        clip = None
        if (
            not self.in_flight
            and self.sound_since is not None
            and now - self.sound_since >= CLIP_S
            and now >= self.next_clip_at
        ):
            self.in_flight = True
            clip = Clip(self.epoch)
        return out, clip

    # ── a recognition comes back ──────────────────────────────────────────────────────────

    def on_result(self, now: float, epoch: int, result: Result) -> list[dict]:
        if epoch != self.epoch or not self.open:
            return []  # about audio from before a gap, an outage or the gate closing
        self.in_flight = False
        out: list[dict] = []

        if isinstance(result, Failed):
            self.errors += 1
            self.next_clip_at = now + ERROR_RETRY_S
            # Not a miss (never "unmatched"), but no match either: the five minutes run on, so a
            # long outage clears the song instead of leaving a stale one up. The idle screen then
            # says recognition isn't working (the check-in reports `failing`).
            return out
        self.errors = 0

        if isinstance(result, NoMatch):
            self.misses += 1
            self.candidate = None
            if self.misses >= MISSES_FOR_UNMATCHED and (
                self.shown in ("track", "gap") or (self.shown == "idle" and not self.slow)
            ):
                out += self._post(now, "unmatched")
                self.shown = "unmatched"
                self.track = None
            if self.slow:
                self.next_clip_at = now + SLOW_RETRY_S
            elif self.track is not None or self.misses >= MISSES_FOR_UNMATCHED:
                self.next_clip_at = now + RECHECK_S
            else:
                self.next_clip_at = now + RETRY_S
            return out

        match: Match = result
        self.misses, self.slow, self.last_match_at = 0, False, now
        self.next_clip_at = now + RECHECK_S
        if self.shown != "track" or self.track is None:
            out += self._show(now, match)  # the first result after a gap, unmatched or idle
        elif match.same_song(self.track):
            self.candidate = None
        elif match.same_song(self.candidate):
            out += self._show(now, match)  # two in a row agree: a new song
        else:
            self.candidate = match
            self.next_clip_at = now + RETRY_S  # confirm (or not) soon
        return out

    # ── helpers ───────────────────────────────────────────────────────────────────────────

    def _show(self, now: float, match: Match) -> list[dict]:
        self.track, self.candidate, self.shown = match, None, "track"
        self.last_post_at = now
        return [match.event()]

    def _stop(self, now: float) -> list[dict]:
        out = self._post(now, "stopped")
        self.shown, self.track, self.candidate = "idle", None, None
        self.epoch += 1
        self.in_flight = False
        return out

    def _post(self, now: float, event: str) -> list[dict]:
        self.last_post_at = now
        return [{"event": event}]

    def _reset(self) -> None:
        self.shown, self.track, self.candidate = "idle", None, None
        self.misses, self.slow = 0, False
        self.need_resync = False
        self.sound_since = self.silent_since = None
        self.gapped = False
        self.last_match_at = self.next_clip_at = -math.inf
        self.epoch += 1
        self.in_flight = False
