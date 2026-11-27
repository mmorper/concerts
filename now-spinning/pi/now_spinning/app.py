"""The service: one loop, ticking once a second.

- every second: the newest loudness reading → the controller. No new reading means "unknown", not
  silence: the controller isn't called during an outage, and when readings come back its return
  timers start again from zero, so a record that is playing is never taken for a lifted needle.
  After AUDIO_STALL_S without a reading the stream is logged as stalled and restarted, every
  AUDIO_RETRY_S until readings come back.
  The same reading goes to the identification loop (loop.py), which asks for a recognition clip
  and says what to post to the Worker. It runs only while the gate is open: the main zone on
  Phono, or the receiver unreachable (then it listens on sound alone).
- every 5 seconds: the receiver's status → the controller (three failures in a row: unreachable)
- every 5 minutes: the health check-in to the Worker
Actions the controller returns are carried out here. With --dry-run they are logged instead,
and nothing is sent to the receiver, the TV, the Apple TV or the Worker. Events go to the Worker
in order, one at a time, retried a few times. The journal names event kinds, never songs: the
spec keeps no play history.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from collections.abc import Callable

from . import worker
from .config import Config
from .controller import Action, Controller
from .display import AppleTv, PyatvAppleTv, wake_display
from .levels import LevelTracker
from .loop import Failed, Loop, NoMatch
from .receiver import Receiver
from .recognition import RecognitionError, Recognizer

log = logging.getLogger("now_spinning")

POLL_EVERY_S = 5
UNREACHABLE_AFTER = 3
AUDIO_STALL_S = 30
AUDIO_RETRY_S = 60
POST_RETRIES_S = (2, 5, 15)  # waits between attempts at one event; then it is dropped


class Listener:
    def __init__(
        self,
        cfg: Config,
        receiver: Receiver | None = None,
        apple_tv: AppleTv | None = None,
        recognizer: Recognizer | None = None,
        clip: Callable[[], bytes | None] | None = None,
    ) -> None:
        self.cfg = cfg
        self.recognizer = recognizer  # None: recognition off (NS_RECOGNIZER=off, or Phase 4a)
        self.clip = clip
        self.loop = Loop()
        self.events: asyncio.Queue[dict] = asyncio.Queue()
        self.receiver = receiver or Receiver(cfg.receiver_host)
        self.apple_tv = apple_tv or PyatvAppleTv(cfg.apple_tv_id, cfg.apple_tv_host)
        self.controller = Controller()
        self.tracker = LevelTracker()
        self.receiver_failures = 0
        self.apple_tv_ok = True
        self._tasks: set[asyncio.Task] = set()
        self._dry_logged: dict[Action, float] = {}
        self.audio_ok = True
        self.now = 0.0
        self._last_reading_at = 0.0
        self._restart_failures = 0

    @property
    def receiver_ok(self) -> bool:
        return self.receiver_failures < UNREACHABLE_AFTER

    @property
    def recognizer_status(self) -> str:
        if self.recognizer is None:
            return "off"
        # No audio is recognition not working too: say so, so the idle screen can.
        return "failing" if self.loop.failing or not self.audio_ok else "ok"

    def update_gate(self, now: float) -> None:
        """Listen while the main zone is on Phono; on sound alone while the receiver is unreachable."""
        open_ = self.recognizer is not None and (self.controller.on_phono or not self.receiver_ok)
        if open_ != self.loop.open:
            log.info("recognition: %s", "listening" if open_ else "stopped listening")
        self.post_all(self.loop.set_gate(now, open_))

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
        self.update_gate(now)
        events, clip = self.loop.on_level(now, dbfs)
        self.post_all(events)
        if clip is not None:
            self._spawn(self._recognize(clip.epoch))

    async def _recognize(self, epoch: int) -> None:
        wav = self.clip() if self.clip else None
        if wav is None or self.recognizer is None:
            self.loop.in_flight = False
            return
        was_failing = self.loop.failing
        try:
            match = await self.recognizer.recognize(wav)
            result = match if match is not None else NoMatch()
        except RecognitionError as e:
            log.debug("recognition: %s", e)
            result = Failed()
        except Exception as e:  # noqa: BLE001 - a background task: never lose it silently
            log.warning("recognition: unexpected %s", type(e).__name__)
            result = Failed()
        self.post_all(self.loop.on_result(self.now, epoch, result))
        if self.loop.failing and not was_failing:
            log.warning("recognition: failing (the last %d calls raised errors)", self.loop.errors)
        elif was_failing and not self.loop.failing:
            log.info("recognition: working again")

    def post_all(self, events: list[dict]) -> None:
        for e in events:
            log.info("event: %s", e["event"])  # the kind only: no song names in the journal
            self.events.put_nowait(e)

    async def poster(self) -> None:
        """Send events to the Worker in order. Never raises; a Worker outage only delays them."""
        url = f"{self.cfg.worker_url}/api/now-spinning"
        while True:
            body = await self.events.get()
            if self.cfg.dry_run:
                log.info("dry run: would POST %s", body)
                continue
            for wait in (*POST_RETRIES_S, None):
                if await worker.post(url, self.cfg.ingest_token, body):
                    break
                if wait is None:
                    log.warning("worker: %s dropped after %d attempts", body["event"], len(POST_RETRIES_S) + 1)
                else:
                    await asyncio.sleep(wait)

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
        try:
            self.apple_tv_ok = await wake_display(self.apple_tv, self.cfg.tv_mac, self.cfg.wol_broadcast, self.cfg.app_bundle_id)
        except Exception as e:  # noqa: BLE001 - a background task: log, never lose it silently
            log.warning("display: wake failed (%s)", e)
            self.apple_tv_ok = False

    async def heartbeat(self) -> None:
        if not self.cfg.dry_run:
            self.apple_tv_ok = await self.apple_tv.reachable()
        body = worker.status_body(receiver_ok=self.receiver_ok, apple_tv_ok=self.apple_tv_ok, recognizer=self.recognizer_status)
        if self.cfg.dry_run:
            log.info("dry run: would POST %s", body)
            return
        await worker.post(f"{self.cfg.worker_url}/api/now-spinning", self.cfg.ingest_token, body)

    def _spawn(self, coro) -> None:
        t = asyncio.create_task(coro)
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)

    def check_audio(self, now: float, got_reading: bool, restart_audio: Callable[[], None] | None) -> None:
        """Track the audio stream: stalled after AUDIO_STALL_S without a reading, then restarted
        every AUDIO_RETRY_S. Each restart gets a fresh AUDIO_STALL_S to deliver a reading."""
        if got_reading:
            if not self.audio_ok:
                log.info("audio: readings are back; return timers start again from now")
                self.controller.audio_resumed(now)
                self.loop.audio_resumed()
                self.tracker = LevelTracker()
            self.audio_ok = True
            self._restart_failures = 0
            self._last_reading_at = now
            return
        if now - self._last_reading_at < (AUDIO_STALL_S if self.audio_ok else AUDIO_RETRY_S):
            return
        if self.audio_ok:
            log.warning("audio: no reading for %ds; nothing is decided on sound until it's back", AUDIO_STALL_S)
            self.audio_ok = False
        self._last_reading_at = now  # wait a full interval before the next attempt
        if restart_audio is not None:
            try:
                restart_audio()
                log.info("audio: stream restarted")
                self._restart_failures = 0
            except Exception as e:  # noqa: BLE001 - e.g. the Blackjack unplugged; try again later
                self._restart_failures += 1
                # Once, then hourly: an unplugged Blackjack shouldn't fill the journal.
                level = logging.WARNING if self._restart_failures % 60 == 1 else logging.DEBUG
                log.log(level, "audio: restart failed (%s); retrying every %ds", e, AUDIO_RETRY_S)

    async def tick(self, now: float, readings: asyncio.Queue[float], restart_audio: Callable[[], None] | None = None) -> None:
        self.now = now  # the listener's clock, for results that come back between ticks
        dbfs = None
        while not readings.empty():
            dbfs = readings.get_nowait()
        self.check_audio(now, dbfs is not None, restart_audio)
        if dbfs is not None:
            await self.on_reading(now, dbfs)

    async def serve(self, readings: asyncio.Queue[float], restart_audio: Callable[[], None] | None = None) -> None:
        last_poll = last_beat = -math.inf
        self._last_reading_at = time.monotonic()
        self._spawn(self.poster())
        while True:
            now = time.monotonic()
            await self.tick(now, readings, restart_audio)
            if now - last_poll >= POLL_EVERY_S:
                last_poll = now
                await self.poll_receiver(now)
                self.update_gate(now)
            if now - last_beat >= worker.STATUS_EVERY_S:
                last_beat = now
                self._spawn(self.heartbeat())
            await asyncio.sleep(1)
