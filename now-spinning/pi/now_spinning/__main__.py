"""python -m now_spinning [--dry-run | --check]

  (no flag)   run the service (systemd starts it this way)
  --dry-run   run, but log every action instead of carrying it out; reads the receiver and audio
  --check     read the receiver's status and one loudness reading, print them, exit
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from . import __version__, config
from .app import Listener
from .audio import LevelStream
from .receiver import Receiver


async def check(cfg: config.Config) -> int:
    st = await Receiver(cfg.receiver_host).status()
    print(f"receiver {cfg.receiver_host}: {st if st else 'no complete reply'}")
    loop = asyncio.get_running_loop()
    stream = LevelStream(cfg.audio_device, loop)
    stream.start()
    try:
        level = await asyncio.wait_for(stream.queue.get(), 5)
        print(f"audio {cfg.audio_device!r}: {level:.1f} dBFS")
    finally:
        stream.stop()
    return 0 if st else 1


async def serve(cfg: config.Config) -> int:
    loop = asyncio.get_running_loop()
    stream = LevelStream(cfg.audio_device, loop)
    stream.start()
    try:
        await Listener(cfg).serve(stream.queue, restart_audio=stream.restart)
    finally:
        stream.stop()
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="now_spinning", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    try:
        cfg = config.load(dry_run=args.dry_run or args.check)
    except config.ConfigError as e:
        print(f"config: {e}", file=sys.stderr)
        return 2
    logging.getLogger("now_spinning").info("now-spinning %s%s", __version__, " (dry run)" if cfg.dry_run else "")
    return asyncio.run(check(cfg) if args.check else serve(cfg))


if __name__ == "__main__":
    sys.exit(main())
