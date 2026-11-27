"""The health check-in to the Worker: POST {event: "status"} every 5 minutes, playing or not.

`recognizer` is "ok", "failing" (three recognition errors in a row, or no audio), or "off" when
recognition is turned off (NS_RECOGNIZER=off): honest, and the Worker shows no "isn't working"
notice for "off". The token is sent as a Bearer header and never logged.
"""

from __future__ import annotations

import json
import logging

import aiohttp

from . import __version__

log = logging.getLogger(__name__)

STATUS_EVERY_S = 300


def status_body(*, receiver_ok: bool, apple_tv_ok: bool, recognizer: str = "off") -> dict:
    return {
        "event": "status",
        "recognizer": recognizer,
        "receiver": "ok" if receiver_ok else "unreachable",
        "appleTv": "ok" if apple_tv_ok else "unreachable",
        "version": f"pi-{__version__}",
    }


async def post(url: str, token: str, body: dict) -> bool:
    """POST to the Worker. Never raises: the listener keeps running when the Worker is down."""
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as s:
            # UTF-8, not aiohttp's ASCII escapes, which take 6 bytes a character (the 2 KB limit).
            data = json.dumps(body, ensure_ascii=False).encode()
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            async with s.post(url, data=data, headers=headers) as r:
                if r.status != 200:
                    log.warning("worker: %s answered %s", body.get("event"), r.status)
                    return False
                return True
    except Exception as e:  # noqa: BLE001
        log.warning("worker: %s not sent (%s)", body.get("event"), type(e).__name__)
        return False
