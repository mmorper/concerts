"""Loudness: one RMS reading a second from the Blackjack, turned into what the needle is doing.

Thresholds were measured in Phase 0 check 3 (30 s RMS through the line feed, Zone 2 at 60 and
GAIN at U, #688): loud music -31 dBFS, quiet music -35 (sparsest intro -36), the run-out
groove -52, needle lifted -96. Measure again if the Zone 2 level or GAIN changes.
"""

from __future__ import annotations

import math
from enum import Enum

import numpy as np

MUSIC_DBFS = -45.0  # at or above: music, recognised or not
LIFTED_DBFS = -75.0  # below: the needle is off the record (or the platter stopped)
# Between the two: the run-out groove's clicks and surface noise.


class Level(Enum):
    MUSIC = "music"
    RUNOUT = "runout"  # clicks / surface noise: not music, not silence
    LIFTED = "lifted"


# How many consecutive one-second readings in a band before the level changes to it. Long
# enough that a quiet bar inside a song, or one loud click in the run-out, changes nothing.
HOLD_S = {Level.MUSIC: 3, Level.RUNOUT: 3, Level.LIFTED: 5}


def band(dbfs: float) -> Level:
    if dbfs >= MUSIC_DBFS:
        return Level.MUSIC
    if dbfs < LIFTED_DBFS:
        return Level.LIFTED
    return Level.RUNOUT


def rms_dbfs(samples: np.ndarray) -> float:
    """RMS of float samples in [-1, 1], in dBFS. Stereo is mixed down to mono first."""
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    if samples.size == 0:
        return -math.inf
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    return 20 * math.log10(rms) if rms > 0 else -math.inf


class LevelTracker:
    """Turns one reading a second into a steady Level. Starts as LIFTED: nothing is playing
    until the readings say otherwise."""

    def __init__(self) -> None:
        self.level = Level.LIFTED
        self._run_band = Level.LIFTED
        self._run = 0

    def add(self, dbfs: float) -> Level:
        b = band(dbfs)
        if b is self._run_band:
            self._run += 1
        else:
            self._run_band, self._run = b, 1
        if b is not self.level and self._run >= HOLD_S[b]:
            self.level = b
        return self.level
