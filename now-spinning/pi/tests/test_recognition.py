"""Shazam's answer → the `track` event, the clip format, and errors kept apart from "no match"."""

import asyncio
import io
import wave

import numpy as np
import pytest

from now_spinning import recognition
from now_spinning.recognition import Match, RecognitionError, ShazamRecognizer, parse_shazam, wav_bytes

# Shaped like Shazam's raw answer, with the values Phase 0 check 2 recorded for the first record
# (#688): Yazoo, "Nobody's Diary", from You and Me Both. Fields the listener doesn't use are trimmed.
YAZOO = {
    "matches": [{"id": "x", "offset": 41.2, "timeskew": 0.0001, "frequencyskew": 0.0}],
    "track": {
        "key": "20066955",
        "title": "Nobody's Diary",
        "subtitle": "Yazoo",
        "isrc": "GBAJH0300158",
        "images": {"coverart": "https://is1-ssl.mzstatic.com/image/thumb/x/400x400cc.jpg", "coverarthq": "https://is1-ssl.mzstatic.com/image/thumb/x/400x400cc.jpg"},
        "sections": [
            {"type": "SONG", "metadata": [{"title": "Album", "text": "You and Me Both"}, {"title": "Label", "text": "Mute"}, {"title": "Released", "text": "1983"}]},
            {"type": "LYRICS", "text": ["…"]},
            {"type": "ARTIST", "id": "42"},
        ],
    },
}


def test_maps_the_spec_fields():
    m = parse_shazam(YAZOO)
    assert m == Match(
        title="Nobody's Diary",
        artist="Yazoo",
        album="You and Me Both",
        artwork_url="https://is1-ssl.mzstatic.com/image/thumb/x/400x400cc.jpg",
        isrc="GBAJH0300158",
        shazam_id="20066955",
    )
    assert m.event() == {
        "event": "track",
        "artist": "Yazoo",
        "title": "Nobody's Diary",
        "album": "You and Me Both",
        "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/x/400x400cc.jpg",
        "isrc": "GBAJH0300158",
        "shazamId": "20066955",
    }


def test_a_live_track_has_no_album_and_still_maps():
    # Phase 0: live tracks came back with no album ("Do It Clean (Live)").
    answer = {"matches": [{}], "track": {"key": 1, "title": "Do It Clean (Live)", "subtitle": "Echo And The Bunnymen", "sections": []}}
    m = parse_shazam(answer)
    assert m.album is None and m.shazam_id == "1" and "album" not in m.event()


def test_no_match_is_none():
    assert parse_shazam({"matches": [], "tagid": "x"}) is None
    assert parse_shazam({"matches": [], "track": YAZOO["track"]}) is None  # a rejected match
    assert parse_shazam({}) is None


def test_fields_too_long_for_the_worker_are_left_out():
    m = Match(title="t" * 400, artist="a", artwork_url="https://x/" + "y" * 1200, shazam_id="9" * 200)
    e = m.event()
    assert len(e["title"]) == 300 and "artworkUrl" not in e and "shazamId" not in e
    import json

    assert len(json.dumps(Match(title="t" * 300, artist="a" * 300, album="b" * 300, artwork_url="u" * 1000).event()).encode()) <= 2048


def test_same_song_by_id_else_by_name():
    a = Match(title="Pictures of You", artist="The Cure", shazam_id="1")
    assert a.same_song(Match(title="Pictures Of You", artist="the cure", shazam_id="1"))
    assert not a.same_song(Match(title="Pictures of You", artist="The Cure", shazam_id="2"))
    assert a.same_song(Match(title="pictures of you", artist="THE CURE"))
    assert not a.same_song(None)


def test_wav_is_16_bit_mono_44k_in_memory():
    data = wav_bytes(np.zeros(44_100 * 2, dtype=np.float32))
    with wave.open(io.BytesIO(data)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()) == (1, 2, 44_100, 88_200)


def test_the_fingerprint_is_made_on_the_pi_from_the_clip():
    """shazamio-core turns the in-memory clip into a signature with no network: what is sent is
    that signature, not audio (Phase 0 check 7)."""
    from shazamio_core import Recognizer

    t = np.arange(44_100 * recognition.CLIP_S) / 44_100
    clip = wav_bytes(0.3 * np.sin(2 * np.pi * 440 * t) + 0.05 * np.random.default_rng(1).standard_normal(len(t)))

    async def go():
        return await Recognizer(segment_duration_seconds=recognition.CLIP_S).recognize_bytes(value=clip, options=None)

    sig = asyncio.run(go())
    assert sig.signature.samples == recognition.CLIP_S * 1000 and sig.signature.uri.startswith("data:audio/vnd.shazam.sig;base64,")


def test_any_failure_is_a_recognition_error_not_no_match(monkeypatch):
    class Broken:
        async def recognize(self, data):
            raise OSError("network is unreachable")

    r = ShazamRecognizer()
    monkeypatch.setattr(r, "_client", lambda: Broken())
    with pytest.raises(RecognitionError):
        asyncio.run(r.recognize(b"RIFF"))


def test_a_slow_answer_times_out(monkeypatch):
    class Slow:
        async def recognize(self, data):
            await asyncio.sleep(10)

    r = ShazamRecognizer()
    monkeypatch.setattr(r, "_client", lambda: Slow())
    monkeypatch.setattr(recognition, "TIMEOUT_S", 0.05)
    with pytest.raises(RecognitionError):
        asyncio.run(r.recognize(b"RIFF"))
