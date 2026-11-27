"""Song recognition: one interface, Shazam behind it (Phase 4b).

ShazamIO is an unofficial client for Shazam's private API and can break without notice, so the
listener only knows `Recognizer`: a paid, official service (ACRCloud, AudD) can replace it.
`NS_RECOGNIZER=off` turns recognition off without a code change.

What goes to Shazam (Phase 0 check 7, read from shazamio 0.9.0's source): a fingerprint of the
clip, made on the Pi by `shazamio-core` (an encoded set of frequency peaks, not audio), with its
length, the time zone, a timestamp, empty `context` and `geolocation` fields, and two random IDs
per request. No audio leaves the Pi, and clips are never written to disk.
"""

from __future__ import annotations

import asyncio
import io
import wave
from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np

SAMPLE_RATE = 44_100
# The window Shazam's own clients fingerprint; shazamio warns on any other, and Shazam answers no
# match from 15 s up.
CLIP_S = 12
TIMEOUT_S = 30  # one recognition, fingerprint and request together

# The Worker's limits on a `track` event (workers/now-spinning/src/index.ts, parseEvent).
_MAX_TEXT = 300
_MAX_URL = 1000
_MAX_ID = 100


class RecognitionError(Exception):
    """The recogniser couldn't answer (network, blocked, broken): not the same as no match."""


@dataclass(frozen=True)
class Match:
    title: str
    artist: str
    album: str | None = None
    artwork_url: str | None = None
    isrc: str | None = None
    shazam_id: str | None = None

    def same_song(self, other: Match | None) -> bool:
        if other is None:
            return False
        if self.shazam_id and other.shazam_id:
            return self.shazam_id == other.shazam_id
        return (self.artist.casefold(), self.title.casefold()) == (other.artist.casefold(), other.title.casefold())

    def event(self) -> dict[str, str]:
        """The `track` POST body. Fields the Worker would refuse for length are left out."""
        body = {"event": "track", "artist": self.artist[:_MAX_TEXT], "title": self.title[:_MAX_TEXT]}
        for key, value, limit in (
            ("album", self.album, _MAX_TEXT),
            ("artworkUrl", self.artwork_url, _MAX_URL),
            ("isrc", self.isrc, _MAX_ID),
            ("shazamId", self.shazam_id, _MAX_ID),
        ):
            if value and len(value) <= limit:
                body[key] = value
        return body


class Recognizer(Protocol):
    async def recognize(self, wav: bytes) -> Match | None:
        """The song in this clip, None when nothing matched. Raises RecognitionError."""
        ...


def _text(x: Any) -> str | None:
    return x.strip() if isinstance(x, str) and x.strip() else None


def _id(x: Any) -> str | None:
    """Shazam's `key` is a string in the raw answer; shazamio's own model reads it as an int."""
    return str(x) if isinstance(x, int) and not isinstance(x, bool) else _text(x)


def parse_shazam(answer: dict[str, Any]) -> Match | None:
    """Shazam's answer → a Match (the spec's §Pi listener "What the listener sends").

    | artist   | track.subtitle |
    | title    | track.title |
    | album    | the `text` of the track.sections[].metadata entry titled "Album" |
    | artwork  | track.images.coverart |
    | isrc     | track.isrc |
    | shazamId | track.key |
    """
    track = answer.get("track") if isinstance(answer, dict) else None
    if not isinstance(track, dict) or not answer.get("matches"):
        return None
    title, artist = _text(track.get("title")), _text(track.get("subtitle"))
    if not title or not artist:
        return None
    album = None
    for section in track.get("sections") or []:
        for item in (section.get("metadata") or []) if isinstance(section, dict) else []:
            if isinstance(item, dict) and item.get("title") == "Album":
                album = album or _text(item.get("text"))
    images = track.get("images") if isinstance(track.get("images"), dict) else {}
    return Match(
        title=title,
        artist=artist,
        album=album,
        artwork_url=_text(images.get("coverart")) or _text(images.get("coverarthq")),
        isrc=_text(track.get("isrc")),
        shazam_id=_id(track.get("key")),
    )


def wav_bytes(mono: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    """16-bit mono WAV, in memory. `mono` is float in −1..1 or int16."""
    if mono.dtype != np.int16:
        mono = (np.clip(mono, -1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(mono.astype("<i2").tobytes())
    return buf.getvalue()


class ShazamRecognizer:
    """shazamio, with its retries cut down: its default retries a request for up to a minute, and
    a clip a minute old is about the wrong song. The loop retries on its own schedule."""

    def __init__(self) -> None:
        self._shazam = None
        self._http = None

    async def close(self) -> None:
        """Close its connections (Phase 0 saw "Unclosed client session" otherwise)."""
        if self._http is not None:
            await self._http.close()
            self._http = self._shazam = None

    def _client(self):
        if self._shazam is None:
            from aiohttp_retry import ExponentialRetry
            from shazamio import Shazam
            from shazamio.client import HTTPClient

            self._http = HTTPClient(retry_options=ExponentialRetry(attempts=2, max_timeout=5, statuses={500, 502, 503, 504}))
            self._shazam = Shazam(language="en-US", endpoint_country="US", http_client=self._http)
        return self._shazam

    async def recognize(self, wav: bytes) -> Match | None:
        try:
            answer = await asyncio.wait_for(self._client().recognize(wav), TIMEOUT_S)
        except Exception as e:  # noqa: BLE001 - any failure is the recogniser failing, not "no match"
            raise RecognitionError(f"{type(e).__name__}: {e}"[:200]) from e
        return parse_shazam(answer)
