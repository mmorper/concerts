import asyncio

import pytest

from now_spinning import config, display, worker
from now_spinning.display import magic_packet, wake_display


def test_magic_packet():
    p = magic_packet("aa:bb:cc:dd:ee:ff")
    assert len(p) == 102 and p[:6] == b"\xff" * 6 and p[6:12] == bytes.fromhex("aabbccddeeff")
    with pytest.raises(ValueError):
        magic_packet("aa:bb:cc")


class FakeAtv:
    def __init__(self, playing=False, fail=False):
        self.playing, self.fail, self.launched = playing, fail, []

    async def is_playing(self):
        if self.fail:
            raise ConnectionError("unreachable")
        return self.playing

    async def wake_and_launch(self, bundle_id):
        self.launched.append(bundle_id)

    async def reachable(self):
        return not self.fail


@pytest.fixture
def wol(monkeypatch):
    sent = []
    monkeypatch.setattr(display, "wake_on_lan", lambda mac, bc: sent.append((mac, bc)))

    async def no_sleep(_):
        return None

    monkeypatch.setattr(display.asyncio, "sleep", no_sleep)
    return sent


def test_wake_turns_the_tv_on_then_brings_music_forward(wol):
    atv = FakeAtv()
    assert asyncio.run(wake_display(atv, "aa:bb:cc:dd:ee:ff", "192.168.1.255", "com.apple.TVMusic"))
    assert wol == [("aa:bb:cc:dd:ee:ff", "192.168.1.255")]
    assert atv.launched == ["com.apple.TVMusic"]


def test_never_interrupts_something_playing(wol):
    atv = FakeAtv(playing=True)
    assert asyncio.run(wake_display(atv, "aa:bb:cc:dd:ee:ff", "x", "com.apple.TVMusic"))
    assert atv.launched == [] and wol == []


def test_apple_tv_unreachable_still_wakes_the_tv(wol):
    atv = FakeAtv(fail=True)
    assert not asyncio.run(wake_display(atv, "aa:bb:cc:dd:ee:ff", "x", "com.apple.TVMusic"))
    assert len(wol) == 1 and atv.launched == []


def test_status_body_is_honest_about_recognition():
    b = worker.status_body(receiver_ok=True, apple_tv_ok=False)
    assert b == {"event": "status", "recognizer": "off", "receiver": "ok", "appleTv": "unreachable", "version": b["version"]}
    assert b["version"].startswith("pi-")


def test_post_never_raises_when_the_worker_is_down():
    assert asyncio.run(worker.post("http://127.0.0.1:1/api/now-spinning", "t", {"event": "status"})) is False


ENV = {
    "NS_WORKER_URL": "https://concerts.morperhaus.org/",
    "NS_INGEST_TOKEN": "x" * 64,
    "NS_RECEIVER_HOST": "192.168.1.240",
    "NS_APPLE_TV_ID": "00000000-0000-0000-0000-000000000000",
    "NS_APPLE_TV_HOST": "192.168.1.111",
    "NS_TV_MAC": "aa:bb:cc:dd:ee:ff",
}


def test_config_defaults():
    c = config.load(ENV)
    assert c.worker_url == "https://concerts.morperhaus.org"
    assert c.app_bundle_id == "com.apple.TVMusic" and c.audio_device == "Blackjack"
    assert c.wol_broadcast == "255.255.255.255" and not c.dry_run


def test_config_names_the_missing_setting():
    env = dict(ENV, NS_TV_MAC="")
    with pytest.raises(config.ConfigError, match="NS_TV_MAC"):
        config.load(env)


def test_wake_on_lan_never_raises(monkeypatch):
    class Bad:
        def __init__(self, *a):
            pass

        def __enter__(self):
            raise OSError("network is unreachable")

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(display.socket, "socket", Bad)
    assert display.wake_on_lan("aa:bb:cc:dd:ee:ff") is False
    assert display.wake_on_lan("not a mac") is False


def test_recognizer_setting(monkeypatch):
    assert config.load(ENV).recognizer == "shazam"
    assert config.load({**ENV, "NS_RECOGNIZER": "OFF"}).recognizer == "off"
    with pytest.raises(config.ConfigError, match="NS_RECOGNIZER"):
        config.load({**ENV, "NS_RECOGNIZER": "acrcloud"})


def test_wav_mode_runs_the_loop_on_a_file(tmp_path, monkeypatch, capsys):
    """`--wav FILE` needs no settings, receiver or Worker; with recognition off it shows the
    silence gate on its own: 40 s of tone, 200 s of silence."""
    import wave

    import numpy as np

    from now_spinning.__main__ import main

    rate = 8_000
    t = np.arange(rate * 40) / rate
    pcm = np.concatenate([0.3 * np.sin(2 * np.pi * 440 * t), np.zeros(rate * 200)])
    path = tmp_path / "side.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())
    monkeypatch.setenv("NS_RECOGNIZER", "off")
    assert main(["--wav", str(path)]) == 0
    assert "would POST" not in capsys.readouterr().out  # nothing shown, so no gap or stopped to say
