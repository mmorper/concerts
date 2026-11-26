"""The service: one loop, ticking once a second.

- every second: the newest loudness reading → the controller
- every 5 seconds: the receiver's status → the controller (three failures in a row: unreachable)
- every 5 minutes: the health check-in to the Worker
Actions the controller returns are carried out here. With --dry-run they are logged instead,
and nothing is sent to the receiver, the TV, the Apple TV or the Worker.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time

from . import worker
from .config import Config
from .controller import Action, Controller
from .display import AppleTv, PyatvAppleTv, wake_display
from .levels import LevelTracker
from .receiver import Receiver

log = logging.getLogger("now_spinning")

POLL_EVERY_S = 5
UNREACHABLE_AFTER = 3


class Listener:
    def __init__(self, cfg: Config, receiver: Receiver | None = None, apple_tv: AppleTv | None = None) -> None:
        self.cfg = cfg
        self.receiver = receiver or Receiver(cfg.receiver_host)
        self.apple_tv = apple_tv or PyatvAppleTv(cfg.apple_tv_id, cfg.apple_tv_host)
        self.controller = Controller()
        self.tracker = LevelTracker()
        self.receiver_failures = 0
        self.apple_tv_ok = True
        self._tasks: set[asyncio.Task] = set()
        self._dry_logged: dict[Action, float] = {}

    @property
    def receiver_ok(self) -> bool:
        return self.receiver_failures < UNREACHABLE_AFTER

    async def poll_receiver(self, now: float) -> None:
        try:
            st = await self.receiver.status()
        except (OSError, asyncio.TimeoutError) as e:
            st = None
            log.debug("receiver: %s", e)
        if st is None:
            self.receiver_failures += 1
            if self.receiver_failures == UNREACHABLE_AFTER:
                log.warning("receiver: unreachable after %d polls", UNREACHABLE_AFTER)
            return
        if not self.receiver_ok:
            log.info("receiver: reachable again")
        self.receiver_failures = 0
        await self.run(self.controller.on_status(now, st))

    async def on_reading(self, now: float, dbfs: float) -> None:
        level = self.tracker.add(dbfs)
        await self.run(self.controller.on_level(now, level))

    async def run(self, actions: list[Action]) -> None:
        for a in actions:
            if self.cfg.dry_run:
                # Nothing is carried out, so the same action comes back every poll: log it once a
                # minute at most.
                if time.monotonic() - self._dry_logged.get(a, -math.inf) >= 60:
                    self._dry_logged[a] = time.monotonic()
                    log.info("dry run: would %s", a.value)
                continue
            try:
                if a is Action.ZONE2_ON:
                    await self.receiver.send("Z2ON", "Z2PHONO")
                elif a is Action.ZONE2_OFF:
                    await self.receiver.send("Z2OFF")
                elif a is Action.RETURN_TO_APPLE_TV:
                    log.info("return: the record has stopped; receiver back to the Apple TV input")
                    await self.receiver.send("SIMPLAY", "PWSTANDBY", gap_s=2)
                elif a is Action.RETURN_FROM_STANDBY:
                    log.info("return: receiver in standby on Phono; setting it to the Apple TV input")
                    await self.receiver.send("ZMON", "SIMPLAY", "PWSTANDBY", gap_s=3)
                elif a is Action.WAKE_DISPLAY:
                    self._spawn(self._wake())
            except (OSError, asyncio.TimeoutError) as e:
                log.warning("receiver: %s failed (%s)", a.value, e)

    async def _wake(self) -> None:
        self.apple_tv_ok = await wake_display(self.apple_tv, self.cfg.tv_mac, self.cfg.wol_broadcast, self.cfg.app_bundle_id)

    async def heartbeat(self) -> None:
        if not self.cfg.dry_run:
            self.apple_tv_ok = await self.apple_tv.reachable()
        body = worker.status_body(receiver_ok=self.receiver_ok, apple_tv_ok=self.apple_tv_ok)
        if self.cfg.dry_run:
            log.info("dry run: would POST %s", body)
            return
        await worker.post(f"{self.cfg.worker_url}/api/now-spinning", self.cfg.ingest_token, body)

    def _spawn(self, coro) -> None:
        t = asyncio.create_task(coro)
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)

    async def serve(self, readings: asyncio.Queue[float]) -> None:
        last_poll = last_beat = -math.inf
        while True:
            now = time.monotonic()
            dbfs = -math.inf
            while not readings.empty():
                dbfs = readings.get_nowait()
            await self.on_reading(now, dbfs)
            if now - last_poll >= POLL_EVERY_S:
                last_poll = now
                await self.poll_receiver(now)
            if now - last_beat >= worker.STATUS_EVERY_S:
                last_beat = now
                self._spawn(self.heartbeat())
            await asyncio.sleep(1)
