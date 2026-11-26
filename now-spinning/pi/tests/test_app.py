"""The service carries each action out with the commands Phase 0 found to work (#688)."""

import asyncio

from now_spinning import app, worker
from now_spinning.app import Listener
from now_spinning.config import Config
from now_spinning.controller import Action
from now_spinning.receiver import ReceiverStatus

CFG = Config(
    worker_url="https://example.invalid", ingest_token="t", receiver_host="r",
    apple_tv_id="id", apple_tv_host="h", tv_mac="aa:bb:cc:dd:ee:ff",
)


class FakeReceiver:
    def __init__(self, statuses):
        self.statuses, self.sent = list(statuses), []

    async def status(self):
        st = self.statuses.pop(0)
        if isinstance(st, Exception):
            raise st
        return st

    async def send(self, *commands, gap_s=0.3):
        self.sent.append(commands)


class FakeAtv:
    async def is_playing(self):
        return False

    async def wake_and_launch(self, bundle_id):
        pass

    async def reachable(self):
        return True


def test_each_action_sends_the_tested_commands():
    rx = FakeReceiver([])
    lis = Listener(CFG, receiver=rx, apple_tv=FakeAtv())
    asyncio.run(lis.run([Action.ZONE2_ON, Action.ZONE2_OFF, Action.RETURN_TO_APPLE_TV, Action.RETURN_FROM_STANDBY]))
    assert rx.sent == [("Z2ON", "Z2PHONO"), ("Z2OFF",), ("SIMPLAY", "PWSTANDBY"), ("ZMON", "SIMPLAY", "PWSTANDBY")]


def test_dry_run_sends_nothing():
    rx = FakeReceiver([])
    lis = Listener(Config(**{**CFG.__dict__, "dry_run": True}), receiver=rx, apple_tv=FakeAtv())
    asyncio.run(lis.run([Action.ZONE2_ON, Action.RETURN_TO_APPLE_TV]))
    assert rx.sent == []


def test_receiver_is_unreachable_after_three_failed_polls_and_recovers():
    ok = ReceiverStatus(power_on=True, main_on=True, source="MPLAY", zone2_on=False, zone2_source="PHONO")
    rx = FakeReceiver([OSError("down"), None, asyncio.TimeoutError(), ok])
    lis = Listener(CFG, receiver=rx, apple_tv=FakeAtv())

    async def go():
        for i in range(3):
            await lis.poll_receiver(i)
        assert not lis.receiver_ok
        await lis.poll_receiver(3)
        assert lis.receiver_ok

    asyncio.run(go())


def test_heartbeat_reports_health_and_recognition_off(monkeypatch):
    posted = []

    async def fake_post(url, token, body):
        posted.append((url, body))
        return True

    monkeypatch.setattr(worker, "post", fake_post)
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    lis.receiver_failures = app.UNREACHABLE_AFTER
    asyncio.run(lis.heartbeat())
    url, body = posted[0]
    assert url == "https://example.invalid/api/now-spinning"
    assert body["recognizer"] == "off" and body["receiver"] == "unreachable" and body["appleTv"] == "ok"


# ── Audio stalls (QA round 1, #724) ──────────────────────────────────────────

PHONO = ReceiverStatus(power_on=True, main_on=True, source="PHONO", zone2_on=True, zone2_source="PHONO")


def _evening(lis, rx_statuses, seconds, reading_at):
    """Drive the listener one second at a time, like serve(); reading_at(t) is the dBFS reading
    that arrives at second t, or None for none."""
    lis.receiver = FakeReceiver(rx_statuses)
    q: asyncio.Queue = asyncio.Queue()

    async def go():
        lis._last_reading_at = 0.0
        await lis.poll_receiver(0.0)
        for t in range(1, seconds):
            r = reading_at(t)
            if r is not None:
                q.put_nowait(r)
            await lis.tick(float(t), q, lis_restart)
    restarts = []

    def lis_restart():
        restarts.append(True)
        raise LookupError("no Blackjack")

    asyncio.run(go())
    return restarts


def test_a_dead_stream_mid_record_never_returns_the_receiver():
    """The Blackjack drops while a record plays: no readings is unknown, not silence, so the
    receiver is never switched away from the record."""
    rx = FakeReceiver([])
    lis = Listener(CFG, receiver=rx, apple_tv=FakeAtv())
    sent = []
    lis.run = _recorder(lis, sent)
    restarts = _evening(lis, [PHONO], 3 * 3600, lambda t: -30.0 if t < 600 else None)
    assert Action.RETURN_TO_APPLE_TV not in sent
    assert not lis.audio_ok
    assert len(restarts) >= 3  # retried while it stays down


def test_silence_still_returns_the_receiver():
    """The same evening with the stream alive and the needle lifted: the timer does run."""
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    sent = []
    lis.run = _recorder(lis, sent)
    _evening(lis, [PHONO], 3 * 3600, lambda t: -30.0 if t < 600 else -96.0)
    assert Action.RETURN_TO_APPLE_TV in sent and lis.audio_ok


def test_audio_coming_back_clears_the_stall():
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    lis.run = _recorder(lis, [])
    _evening(lis, [PHONO], 200, lambda t: None if 10 < t < 100 else -30.0)
    assert lis.audio_ok


def _recorder(lis, sent):
    real = lis.run

    async def run(actions):
        sent.extend(actions)
        await real([a for a in actions if a is not Action.WAKE_DISPLAY])
    return run


def test_a_failing_wake_is_logged_not_lost(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("pyatv blew up")

    monkeypatch.setattr(app, "wake_display", boom)
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    asyncio.run(lis._wake())
    assert lis.apple_tv_ok is False


def test_an_outage_past_a_set_deadline_doesnt_return_on_the_first_readings():
    """Needle lifted (15-minute timer set), the Blackjack drops, a record starts, audio comes back
    after the deadline: no return; the timer starts again from zero (QA round 2, #724)."""
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    sent = []
    lis.run = _recorder(lis, sent)
    # music to 600 s, lifted to 1000 s (stopped at ~780, deadline ~1680), out to 2000 s, then music
    _evening(lis, [PHONO], 3000, lambda t: -30.0 if t < 600 else -96.0 if t < 1000 else None if t < 2000 else -30.0)
    assert Action.RETURN_TO_APPLE_TV not in sent
    assert lis.audio_ok


def test_after_an_outage_quiet_still_returns_after_a_fresh_interval():
    lis = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    sent = []
    lis.run = _recorder(lis, sent)
    _evening(lis, [PHONO], 2900, lambda t: -30.0 if t < 600 else -96.0 if t < 1000 else None if t < 2000 else -96.0)
    assert Action.RETURN_TO_APPLE_TV not in sent  # 2000 + 900 not reached yet
    lis2 = Listener(CFG, receiver=FakeReceiver([]), apple_tv=FakeAtv())
    sent2 = []
    lis2.run = _recorder(lis2, sent2)
    _evening(lis2, [PHONO], 2920, lambda t: -30.0 if t < 600 else -96.0 if t < 1000 else None if t < 2000 else -96.0)
    assert Action.RETURN_TO_APPLE_TV in sent2
