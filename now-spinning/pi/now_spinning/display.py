"""Putting the app on the screen: the TV by Wake-on-LAN, then the Apple TV over pyatv.

What Phase 0 check 5 and the Wake-on-LAN tests found (#688):
- Waking the Apple TV over the network never turns the TV on, whatever the receiver's input, so
  the TV gets a Wake-on-LAN packet first. It works over Wi-Fi, after a night in standby too, and
  the record keeps playing (the TV's "Power On with Mobile" must stay on).
- `launch_app` alone brings the app forward and clears the screensaver.
- `playing` tells Playing from Paused: never interrupt Playing.
- Connect by address: discovery sometimes misses a sleeping Apple TV.
- The pairing lives in the `now-spinning` user's ~/.pyatv.conf (made in Phase 0).
"""

from __future__ import annotations

import asyncio
import logging
import socket
from typing import Protocol

log = logging.getLogger(__name__)


def magic_packet(mac: str) -> bytes:
    raw = bytes.fromhex(mac.replace(":", "").replace("-", ""))
    if len(raw) != 6:
        raise ValueError(f"not a MAC address: {mac!r}")
    return b"\xff" * 6 + raw * 16


def wake_on_lan(mac: str, broadcast: str = "255.255.255.255", port: int = 9) -> None:
    packet = magic_packet(mac)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(packet, (broadcast, port))


class AppleTv(Protocol):
    async def is_playing(self) -> bool: ...
    async def wake_and_launch(self, bundle_id: str) -> None: ...
    async def reachable(self) -> bool: ...


class PyatvAppleTv:
    """The real Apple TV. Each call opens a connection and closes it again."""

    def __init__(self, identifier: str, host: str) -> None:
        self.identifier, self.host = identifier, host

    async def _connect(self):
        import pyatv
        from pyatv.storage.file_storage import FileStorage

        loop = asyncio.get_running_loop()
        storage = FileStorage.default_storage(loop)
        await storage.load()
        confs = await pyatv.scan(loop, identifier=self.identifier, hosts=[self.host], storage=storage, timeout=5)
        if not confs:
            raise ConnectionError(f"Apple TV {self.identifier} not found at {self.host}")
        return await pyatv.connect(confs[0], loop, storage=storage)

    async def is_playing(self) -> bool:
        from pyatv.const import DeviceState

        atv = await self._connect()
        try:
            playing = await atv.metadata.playing()
            return playing.device_state is DeviceState.Playing
        finally:
            await _close(atv)

    async def wake_and_launch(self, bundle_id: str) -> None:
        from pyatv.const import PowerState

        atv = await self._connect()
        try:
            if atv.power.power_state is not PowerState.On:
                await atv.power.turn_on()
            await atv.apps.launch_app(bundle_id)
        finally:
            await _close(atv)

    async def reachable(self) -> bool:
        try:
            atv = await self._connect()
        except Exception:  # noqa: BLE001 - any failure means not reachable
            return False
        await _close(atv)
        return True


async def _close(atv) -> None:
    await asyncio.gather(*atv.close(), return_exceptions=True)


async def wake_display(apple_tv: AppleTv, tv_mac: str, broadcast: str, bundle_id: str) -> bool:
    """Wake the TV, then the Apple TV, then bring the app forward. Never interrupts something
    playing. Returns whether the Apple TV was reached."""
    try:
        if await apple_tv.is_playing():
            log.info("display: the Apple TV is playing something; leaving it alone")
            return True
    except Exception as e:  # noqa: BLE001
        log.warning("display: Apple TV unreachable (%s)", e)
        wake_on_lan(tv_mac, broadcast)  # the TV can still come on for the record
        return False
    wake_on_lan(tv_mac, broadcast)
    await asyncio.sleep(2)  # let the TV start before the Apple TV's picture arrives
    try:
        await apple_tv.wake_and_launch(bundle_id)
        log.info("display: TV woken, %s in front", bundle_id)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("display: couldn't bring %s forward (%s)", bundle_id, e)
        return False
