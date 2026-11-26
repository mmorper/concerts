"""The AV7703, over its telnet control port (23).

What Phase 0 checks 6 and 6b found (#688):
- Replies end in a bare `\\r`. A command doesn't always get a reply (`Z2ON` sent none when the
  receiver was already on), so the result is confirmed by asking again.
- While another controller (the Marantz app) is connected, the receiver sends status lines to
  every client, nonstop. So a reply is read until a fixed deadline, not until a pause, and only
  `PW`, `ZM`, `SI` and `Z2` lines are kept.
- More than one client at a time works. Each poll opens a short connection and closes it, so this
  listener never holds the port.
- `SI?` reports PHONO in standby too, so a record can only be playing when `ZM` is ON as well.
- In standby the receiver ignores `SIMPLAY`; `ZMON`, `SIMPLAY`, `PWSTANDBY` works.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)

PORT = 23
REPLY_WINDOW_S = 1.5  # how long to collect lines after the last query is sent
CONNECT_TIMEOUT_S = 3.0
KEEP = ("PW", "ZM", "SI", "Z2")


@dataclass(frozen=True)
class ReceiverStatus:
    power_on: bool  # PWON (anything on) vs PWSTANDBY
    main_on: bool  # ZMON
    source: str  # main zone input, e.g. "PHONO", "MPLAY"
    zone2_on: bool
    zone2_source: str

    @property
    def standby(self) -> bool:
        return not self.power_on

    @property
    def main_on_phono(self) -> bool:
        return self.main_on and self.source == "PHONO"


def parse(lines: list[str]) -> ReceiverStatus | None:
    """The status from the kept lines, or None when a field is missing (a partial reply)."""
    pw = zm = si = z2p = z2s = None
    for line in lines:
        if line in ("PWON", "PWSTANDBY"):
            pw = line == "PWON"
        elif line in ("ZMON", "ZMOFF"):
            zm = line == "ZMON"
        elif line.startswith("SI"):
            si = line[2:]
        elif line in ("Z2ON", "Z2OFF"):
            z2p = line == "Z2ON"
        elif line.startswith("Z2") and line[2:].isalpha() and not line.startswith(("Z2MU", "Z2SLP", "Z2CV", "Z2PS", "Z2HPF", "Z2CS")):
            z2s = line[2:]
    if None in (pw, zm, si, z2p):
        return None
    return ReceiverStatus(power_on=pw, main_on=zm, source=si, zone2_on=z2p, zone2_source=z2s or "")


def split_lines(data: bytes) -> list[str]:
    text = data.decode("ascii", errors="replace")
    return [s.strip() for s in text.replace("\n", "\r").split("\r") if s.strip().startswith(KEEP)]


class Receiver:
    def __init__(self, host: str, port: int = PORT, reply_window_s: float = REPLY_WINDOW_S) -> None:
        self.host, self.port, self.reply_window_s = host, port, reply_window_s

    async def _exchange(self, commands: list[str], gap_s: float = 0.0) -> list[str]:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(self.host, self.port), CONNECT_TIMEOUT_S)
        try:
            for cmd in commands:
                writer.write(f"{cmd}\r".encode("ascii"))
                await writer.drain()
                if gap_s:
                    await asyncio.sleep(gap_s)
            data = b""
            loop = asyncio.get_running_loop()
            deadline = loop.time() + self.reply_window_s
            while (left := deadline - loop.time()) > 0:
                try:
                    chunk = await asyncio.wait_for(reader.read(4096), left)
                except asyncio.TimeoutError:
                    break
                if not chunk:
                    break
                data += chunk
            return split_lines(data)
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass

    async def status(self) -> ReceiverStatus | None:
        lines = await self._exchange(["PW?", "ZM?", "SI?", "Z2?"], gap_s=0.05)
        return parse(lines)

    async def send(self, *commands: str, gap_s: float = 0.3) -> None:
        log.info("receiver: %s", " ".join(commands))
        await self._exchange(list(commands), gap_s=gap_s)
