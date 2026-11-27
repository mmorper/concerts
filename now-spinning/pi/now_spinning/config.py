"""Settings, read from the environment.

On the Pi, systemd loads them from /etc/now-spinning/env (root-only) before it starts the service
as the `now-spinning` user. See now-spinning/pi/env.example and NOW_SPINNING_OPERATIONS.md §12.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Config:
    worker_url: str
    ingest_token: str
    receiver_host: str
    apple_tv_id: str
    apple_tv_host: str
    tv_mac: str
    wol_broadcast: str = "255.255.255.255"
    audio_device: str = "Blackjack"
    app_bundle_id: str = "com.apple.TVMusic"
    recognizer: str = "shazam"  # or "off": no recognition, the 4a behaviour (Phase 4b)
    dry_run: bool = False


def _need(env: dict[str, str], key: str) -> str:
    value = env.get(key, "").strip()
    if not value:
        raise ConfigError(f"{key} is not set")
    return value


def load(env: dict[str, str] | None = None, *, dry_run: bool = False) -> Config:
    env = dict(os.environ) if env is None else env
    return Config(
        worker_url=_need(env, "NS_WORKER_URL").rstrip("/"),
        ingest_token=_need(env, "NS_INGEST_TOKEN"),
        receiver_host=_need(env, "NS_RECEIVER_HOST"),
        apple_tv_id=_need(env, "NS_APPLE_TV_ID"),
        apple_tv_host=_need(env, "NS_APPLE_TV_HOST"),
        tv_mac=_need(env, "NS_TV_MAC"),
        wol_broadcast=env.get("NS_WOL_BROADCAST", "").strip() or "255.255.255.255",
        audio_device=env.get("NS_AUDIO_DEVICE", "").strip() or "Blackjack",
        app_bundle_id=env.get("NS_APP_BUNDLE_ID", "").strip() or "com.apple.TVMusic",
        recognizer=_recognizer(env),
        dry_run=dry_run,
    )


RECOGNIZERS = ("shazam", "off")


def _recognizer(env: dict[str, str]) -> str:
    value = env.get("NS_RECOGNIZER", "").strip().lower() or "shazam"
    if value not in RECOGNIZERS:
        raise ConfigError(f"NS_RECOGNIZER is {value!r}; use one of {', '.join(RECOGNIZERS)}")
    return value
