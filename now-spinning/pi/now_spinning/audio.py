"""Capture from the Blackjack: 44.1 kHz stereo, one RMS reading a second, nothing stored.

The device is chosen by name, not card number, which can change between boots. Samples stay in
memory only long enough to measure them; nothing is written to disk.
"""

from __future__ import annotations

import asyncio
import logging

from .levels import rms_dbfs

log = logging.getLogger(__name__)

SAMPLE_RATE = 44_100
CHANNELS = 2


def find_device(name: str) -> int:
    import sounddevice as sd

    for i, d in enumerate(sd.query_devices()):
        if name.lower() in d["name"].lower() and d["max_input_channels"] >= CHANNELS:
            return i
    raise LookupError(f"no input device named like {name!r}; is the Blackjack plugged in?")


class LevelStream:
    """Puts one dBFS reading a second on an asyncio queue, from the audio thread."""

    def __init__(self, device_name: str, loop: asyncio.AbstractEventLoop) -> None:
        self.device_name, self.loop = device_name, loop
        self.queue: asyncio.Queue[float] = asyncio.Queue(maxsize=120)
        self._stream = None

    def _callback(self, indata, frames, time, status) -> None:  # noqa: ARG002 - sounddevice's signature
        if status:
            log.debug("audio: %s", status)
        level = rms_dbfs(indata)
        self.loop.call_soon_threadsafe(self._put, level)

    def _put(self, level: float) -> None:
        if self.queue.full():
            self.queue.get_nowait()
        self.queue.put_nowait(level)

    def start(self) -> None:
        import sounddevice as sd

        device = find_device(self.device_name)
        self._stream = sd.InputStream(
            device=device, samplerate=SAMPLE_RATE, channels=CHANNELS, dtype="float32",
            blocksize=SAMPLE_RATE, callback=self._callback,
        )
        self._stream.start()
        log.info("audio: listening on %r", self.device_name)

    def stop(self) -> None:
        stream, self._stream = self._stream, None
        if stream is not None:
            try:
                stream.stop()
                stream.close()
            except Exception as e:  # noqa: BLE001 - a stream whose device has gone can fail to close
                log.debug("audio: closing: %s", e)

    def restart(self) -> None:
        """Close the stream and open it again, finding the device afresh (its number can change
        when the Blackjack is replugged). Raises if it isn't there."""
        self.stop()
        self.start()
