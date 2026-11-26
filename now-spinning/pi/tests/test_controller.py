"""The rules, driven through whole scenarios with a fake clock.

Each scenario is one the owner will check on the real equipment (#697); these run without it.
"""

from now_spinning.controller import RETURN_AFTER_S, STOPPED_AFTER_S, Action, Controller, Session
from now_spinning.levels import Level
from now_spinning.receiver import ReceiverStatus

ON_PHONO = ReceiverStatus(power_on=True, main_on=True, source="PHONO", zone2_on=True, zone2_source="PHONO")
ON_PHONO_Z2_OFF = ReceiverStatus(power_on=True, main_on=True, source="PHONO", zone2_on=False, zone2_source="PHONO")
ON_APPLE_TV = ReceiverStatus(power_on=True, main_on=True, source="MPLAY", zone2_on=False, zone2_source="PHONO")
ON_APPLE_TV_Z2_ON = ReceiverStatus(power_on=True, main_on=True, source="MPLAY", zone2_on=True, zone2_source="PHONO")
MAIN_OFF_Z2_ON = ReceiverStatus(power_on=True, main_on=False, source="PHONO", zone2_on=True, zone2_source="PHONO")
STANDBY_PHONO = ReceiverStatus(power_on=False, main_on=False, source="PHONO", zone2_on=False, zone2_source="PHONO")
STANDBY_APPLE_TV = ReceiverStatus(power_on=False, main_on=False, source="MPLAY", zone2_on=False, zone2_source="PHONO")


def run(c: Controller, start: float, seconds: int, level: Level) -> list[tuple[float, Action]]:
    """Feed `level` once a second for `seconds`; return the actions with their times."""
    out = []
    for i in range(seconds):
        t = start + i
        out += [(t, a) for a in c.on_level(t, level)]
    return out


# ── Zone 2 follows Phono ─────────────────────────────────────────────────────────────────────


def test_switching_to_phono_turns_zone2_on():
    c = Controller()
    assert c.on_status(0, ON_PHONO_Z2_OFF) == [Action.ZONE2_ON]


def test_zone2_is_turned_back_on_after_its_auto_standby():
    c = Controller()
    c.on_status(0, ON_PHONO)
    assert c.on_status(8 * 3600, ON_PHONO_Z2_OFF) == [Action.ZONE2_ON]


def test_zone2_on_another_source_is_set_to_phono():
    c = Controller()
    st = ReceiverStatus(power_on=True, main_on=True, source="PHONO", zone2_on=True, zone2_source="TUNER")
    assert c.on_status(0, st) == [Action.ZONE2_ON]


def test_leaving_phono_turns_zone2_off():
    c = Controller()
    c.on_status(0, ON_PHONO)
    assert c.on_status(5, ON_APPLE_TV_Z2_ON) == [Action.ZONE2_OFF]
    assert c.session is Session.IDLE


def test_main_zone_off_turns_zone2_off_then_standby_on_phono_returns():
    c = Controller()
    c.on_status(0, ON_PHONO)
    assert c.on_status(5, MAIN_OFF_Z2_ON) == [Action.ZONE2_OFF]
    assert c.on_status(10, STANDBY_PHONO) == [Action.RETURN_FROM_STANDBY]


def test_nothing_to_do_on_the_apple_tv_input():
    c = Controller()
    assert c.on_status(0, ON_APPLE_TV) == []
    assert run(c, 1, 3600, Level.MUSIC) == []  # the Apple TV playing music isn't a record


# ── The return to the Apple TV input ─────────────────────────────────────────────────────────


def test_standby_on_phono_returns_at_once_and_only_once():
    c = Controller()
    assert c.on_status(0, STANDBY_PHONO) == [Action.RETURN_FROM_STANDBY]
    assert c.on_status(5, STANDBY_PHONO) == []  # the next poll, before it has taken effect
    assert c.on_status(10, STANDBY_APPLE_TV) == []


def test_standby_return_is_retried_if_it_did_not_take():
    c = Controller()
    c.on_status(0, STANDBY_PHONO)
    assert c.on_status(599, STANDBY_PHONO) == []
    assert c.on_status(600, STANDBY_PHONO) == [Action.RETURN_FROM_STANDBY]


def test_needle_lifted_returns_15_minutes_after_the_record_stopped():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 600, Level.MUSIC)  # a side
    acts = run(c, 600, STOPPED_AFTER_S + RETURN_AFTER_S[Level.LIFTED] + 5, Level.LIFTED)
    assert [a for _, a in acts] == [Action.RETURN_TO_APPLE_TV]
    stopped_at = 599 + STOPPED_AFTER_S
    assert acts[0][0] == stopped_at + RETURN_AFTER_S[Level.LIFTED]


def test_needle_in_the_runout_returns_after_60_minutes():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 600, Level.MUSIC)
    acts = run(c, 600, STOPPED_AFTER_S + RETURN_AFTER_S[Level.RUNOUT] + 5, Level.RUNOUT)
    assert [a for _, a in acts] == [Action.RETURN_TO_APPLE_TV]
    assert acts[0][0] == 599 + STOPPED_AFTER_S + RETURN_AFTER_S[Level.RUNOUT]


def test_runout_does_not_return_at_15_minutes():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 600, Level.MUSIC)
    assert run(c, 600, STOPPED_AFTER_S + RETURN_AFTER_S[Level.LIFTED] + 60, Level.RUNOUT) == []


def test_a_new_record_within_the_window_cancels_the_return():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 600, Level.MUSIC)
    t = 600
    assert run(c, t, STOPPED_AFTER_S + 600, Level.LIFTED) == []  # 10 of the 15 minutes
    t += STOPPED_AFTER_S + 600
    acts = run(c, t, 1200, Level.MUSIC)  # the next record
    assert Action.RETURN_TO_APPLE_TV not in [a for _, a in acts]
    assert c.session is Session.PLAYING


def test_an_unrecognised_record_is_never_switched_away():
    # Music-level sound holds both timers off, whatever Shazam makes of it.
    c = Controller()
    c.on_status(0, ON_PHONO)
    acts = run(c, 0, 3 * 3600, Level.MUSIC)
    assert Action.RETURN_TO_APPLE_TV not in [a for _, a in acts]


def test_quiet_gaps_between_tracks_do_not_stop_the_record():
    c = Controller()
    c.on_status(0, ON_PHONO)
    t = 0
    for _ in range(10):  # ten tracks with a few seconds of groove between them
        run(c, t, 240, Level.MUSIC)
        t += 240
        assert run(c, t, 8, Level.RUNOUT) == []
        t += 8
    assert c.session is Session.PLAYING


def test_choosing_phono_and_walking_away_returns_after_15_minutes():
    c = Controller()
    c.on_status(0, ON_PHONO)
    acts = run(c, 0, RETURN_AFTER_S[Level.LIFTED] + 5, Level.LIFTED)
    assert [a for _, a in acts] == [Action.RETURN_TO_APPLE_TV]


def test_after_returning_nothing_more_happens_until_phono_again():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, RETURN_AFTER_S[Level.LIFTED] + 5, Level.LIFTED)
    assert run(c, 2000, 3600, Level.LIFTED) == []


# ── Waking the display ───────────────────────────────────────────────────────────────────────


def test_music_after_silence_on_phono_wakes_the_display_once():
    c = Controller()
    c.on_status(0, ON_PHONO)
    acts = run(c, 0, 600, Level.MUSIC)
    assert [a for _, a in acts] == [Action.WAKE_DISPLAY]


def test_the_next_side_wakes_the_display_again():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 600, Level.MUSIC)
    run(c, 600, 120, Level.LIFTED)  # flipping the record
    acts = run(c, 720, 60, Level.MUSIC)
    assert [a for _, a in acts] == [Action.WAKE_DISPLAY]


def test_wakes_are_at_least_a_minute_apart():
    c = Controller()
    c.on_status(0, ON_PHONO)
    run(c, 0, 10, Level.MUSIC)
    run(c, 10, 5, Level.RUNOUT)
    assert run(c, 15, 10, Level.MUSIC) == []


def test_no_wake_when_not_on_phono():
    c = Controller()
    c.on_status(0, ON_APPLE_TV)
    assert run(c, 0, 60, Level.MUSIC) == []
