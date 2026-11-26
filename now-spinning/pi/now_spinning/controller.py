"""The rules, as plain logic: a receiver status and a loudness level in, actions out.

No network, no audio, no clock of its own: the caller passes `now` (seconds). That is what lets
the tests drive a whole evening in a few milliseconds.

Spec: global-now-spinning-spec.md §Pi listener, "Gating on the receiver" and "Putting the app on
the screen". Phase 4a has no song recognition yet, so "the record has stopped" here means three
minutes without music-level sound; Phase 4b adds Shazam's no-match path.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .levels import Level
from .receiver import ReceiverStatus

STOPPED_AFTER_S = 180  # no music for 3 minutes: the record has stopped
RETURN_AFTER_S = {Level.LIFTED: 15 * 60, Level.RUNOUT: 60 * 60}  # owner's choice, 2026-11-26
WAKE_MIN_INTERVAL_S = 60
STANDBY_RETRY_S = 600  # if a standby return didn't take, try again after this long


class Action(Enum):
    ZONE2_ON = "zone2_on"  # Z2ON, Z2PHONO
    ZONE2_OFF = "zone2_off"  # Z2OFF
    RETURN_TO_APPLE_TV = "return_to_apple_tv"  # main zone on: SIMPLAY, PWSTANDBY
    RETURN_FROM_STANDBY = "return_from_standby"  # standby: ZMON, SIMPLAY, PWSTANDBY
    WAKE_DISPLAY = "wake_display"  # Wake-on-LAN the TV, wake the Apple TV, bring the app forward


class Session(Enum):
    IDLE = "idle"  # the main zone isn't on Phono
    PLAYING = "playing"  # music within the last 3 minutes
    STOPPED = "stopped"  # on Phono, no music: a return timer is running


@dataclass
class Controller:
    session: Session = Session.IDLE
    last_music_at: float | None = None
    quiet_kind: Level | None = None
    deadline: float | None = None
    last_level: Level = Level.LIFTED
    last_wake_at: float | None = None
    on_phono: bool = False  # last known: main zone on, input Phono
    standby_return_at: float | None = None

    # ── receiver ─────────────────────────────────────────────────────────────────────────────

    def on_status(self, now: float, st: ReceiverStatus) -> list[Action]:
        """A fresh receiver status (every poll). Zone 2 follows Phono; standby on Phono returns."""
        actions: list[Action] = []
        was_on_phono, self.on_phono = self.on_phono, st.main_on_phono

        if st.main_on_phono:
            # Keep Zone 2 on while it's needed, including after its 8-hour Auto Standby.
            if not st.zone2_on or st.zone2_source != "PHONO":
                actions.append(Action.ZONE2_ON)
            if not was_on_phono:
                # Phono just chosen: start waiting for music, so selecting Phono and walking
                # away still returns the receiver to the Apple TV input.
                self._stop()
        else:
            # Zone 2 is the listener's feed only. Off as soon as the main zone leaves Phono; with
            # the main zone off, that puts the receiver into standby.
            if st.zone2_on and st.zone2_source == "PHONO":
                actions.append(Action.ZONE2_OFF)
            self.session, self.deadline, self.quiet_kind = Session.IDLE, None, None

        if st.standby and st.source == "PHONO":
            if self.standby_return_at is None or now - self.standby_return_at >= STANDBY_RETRY_S:
                actions.append(Action.RETURN_FROM_STANDBY)
                self.standby_return_at = now
        else:
            self.standby_return_at = None
        return actions

    # ── loudness, once a second ──────────────────────────────────────────────────────────────

    def on_level(self, now: float, level: Level) -> list[Action]:
        actions: list[Action] = []
        started = level is Level.MUSIC and self.last_level is not Level.MUSIC
        self.last_level = level
        if not self.on_phono:
            return actions

        if level is Level.MUSIC:
            if started and (self.last_wake_at is None or now - self.last_wake_at >= WAKE_MIN_INTERVAL_S):
                # Sound after silence on Phono: put the app on the screen, before anything else.
                actions.append(Action.WAKE_DISPLAY)
                self.last_wake_at = now
            self.session, self.last_music_at = Session.PLAYING, now
            self.deadline, self.quiet_kind = None, None
            return actions

        if self.session is Session.PLAYING and self.last_music_at is not None and now - self.last_music_at >= STOPPED_AFTER_S:
            self._stop()

        if self.session is Session.STOPPED:
            if level is not self.quiet_kind:
                # Lifted needle: 15 minutes, to find the next record. Run-out: 60. Each starts
                # (or restarts) when the sound changes to it.
                self.quiet_kind, self.deadline = level, now + RETURN_AFTER_S[level]
            if self.deadline is not None and now >= self.deadline:
                actions.append(Action.RETURN_TO_APPLE_TV)
                self.session, self.deadline, self.quiet_kind = Session.IDLE, None, None
                self.on_phono = False  # until the next poll says otherwise
        return actions

    def _stop(self) -> None:
        self.session, self.quiet_kind, self.deadline = Session.STOPPED, None, None
