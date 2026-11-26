import math

import numpy as np

from now_spinning.levels import Level, LevelTracker, band, rms_dbfs

# Phase 0 check 3 measurements (#688), 30 s RMS: each must land in its band.
MEASURED = {-31.0: Level.MUSIC, -35.1: Level.MUSIC, -36.1: Level.MUSIC, -51.7: Level.RUNOUT, -95.9: Level.LIFTED}


def test_measured_levels_land_in_their_bands():
    for dbfs, level in MEASURED.items():
        assert band(dbfs) is level, dbfs


def test_rms_of_a_full_scale_sine_is_about_minus_3():
    t = np.arange(44_100) / 44_100
    assert abs(rms_dbfs(np.sin(2 * np.pi * 440 * t)) - (-3.01)) < 0.05


def test_rms_mixes_stereo_down_and_handles_silence():
    stereo = np.zeros((1000, 2))
    assert rms_dbfs(stereo) == -math.inf
    stereo[:, 0] = 0.5
    stereo[:, 1] = 0.5
    assert abs(rms_dbfs(stereo) - 20 * math.log10(0.5)) < 1e-9


def test_starts_lifted_and_needs_three_seconds_of_music():
    t = LevelTracker()
    assert t.level is Level.LIFTED
    assert [t.add(-30) for _ in range(3)] == [Level.LIFTED, Level.LIFTED, Level.MUSIC]


def test_a_quiet_bar_inside_a_song_stays_music():
    t = LevelTracker()
    for _ in range(5):
        t.add(-30)
    t.add(-52)
    t.add(-52)
    assert t.add(-30) is Level.MUSIC


def test_one_loud_click_in_the_runout_is_not_music():
    t = LevelTracker()
    for _ in range(5):
        t.add(-52)
    assert t.add(-20) is Level.RUNOUT
    assert t.add(-52) is Level.RUNOUT


def test_lifting_the_needle_takes_five_seconds_to_count():
    t = LevelTracker()
    for _ in range(5):
        t.add(-30)
    assert [t.add(-96) for _ in range(5)][-2:] == [Level.MUSIC, Level.LIFTED]


def test_no_reading_counts_as_lifted():
    t = LevelTracker()
    for _ in range(5):
        t.add(-30)
    for _ in range(5):
        t.add(-math.inf)
    assert t.level is Level.LIFTED
