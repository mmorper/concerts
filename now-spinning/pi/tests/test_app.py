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
