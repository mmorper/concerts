"""python -m now_spinning [--dry-run | --check | --wav FILE]

  (no flag)   run the service (systemd starts it this way)
  --dry-run   run, but log every action instead of carrying it out; reads the receiver and audio
  --check     read the receiver's status, one loudness reading and (recognition on) one 12-second
              clip through the recogniser; print them, exit
  --wav FILE  run the identification loop on a recording, a second at a time, and print what it
              would POST. Needs no receiver, Worker or settings; it calls Shazam unless
              NS_RECOGNIZER=off.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import os
import wave
from collections import deque

import numpy as np

from . import __version__, config
from .app import Listener
from .audio import LevelStream
from .levels import rms_dbfs
from .loop import Failed, Loop, NoMatch
from .receiver import Receiver
from .recognition import CLIP_S, RecognitionError, ShazamRecognizer, wav_bytes


async def check(cfg: config.Config) -> int:
    st = await Receiver(cfg.receiver_host).status()
    print(f"receiver {cfg.receiver_host}: {st if st else 'no complete reply'}")
    loop = asyncio.get_running_loop()
    stream = LevelStream(cfg.audio_device, loop)
    stream.start()
    try:
        level = await asyncio.wait_for(stream.queue.get(), 5)
        print(f"audio {cfg.audio_device!r}: {level:.1f} dBFS")
        if cfg.recognizer != "off":
            print(f"recording {CLIP_S} s for the recogniser…")
            while (wav := stream.clip()) is None:
                await asyncio.sleep(1)
            shazam = ShazamRecognizer()
            try:
                m = await shazam.recognize(wav)
                print(f"shazam: {m.artist} — {m.title}" if m else "shazam: answered, no match (is a record playing?)")
            except RecognitionError as e:
                print(f"shazam: failed ({e})")
            finally:
                await shazam.close()
    finally:
        stream.stop()
    return 0 if st else 1


async def run_wav(path: str) -> int:
    """The loop on a file: one reading a second, a clip when it asks, real recognition."""
    with wave.open(path, "rb") as w:
        rate, channels, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if width != 2:
        print("--wav needs 16-bit PCM", file=sys.stderr)
        return 2
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    mono = samples.reshape(-1, channels).mean(axis=1)
    recognizer = None if os.environ.get("NS_RECOGNIZER", "").strip().lower() == "off" else ShazamRecognizer()
    lp, blocks = Loop(), deque(maxlen=CLIP_S)
    lp.set_gate(0, True)
    for second in range(len(mono) // rate):
        block = mono[second * rate:(second + 1) * rate]
        blocks.append(block)
        events, clip = lp.on_level(second, rms_dbfs(block))
        for e in events:
            print(f"{second:>5}s  would POST {e}")
        if clip is None:
            continue
        if recognizer is None:
            lp.in_flight = False
            continue
        try:
            m = await recognizer.recognize(wav_bytes(np.concatenate(list(blocks)), rate))
            result = m if m is not None else NoMatch()
        except RecognitionError as e:
            print(f"{second:>5}s  recognition failed ({e})")
            result = Failed()
        for e in lp.on_result(second, clip.epoch, result):
            print(f"{second:>5}s  would POST {e}")
    for e in lp.set_gate(len(mono) // rate, False):
        print(f"  end  would POST {e}")
    if recognizer is not None:
        await recognizer.close()
    return 0


async def serve(cfg: config.Config) -> int:
    loop = asyncio.get_running_loop()
    stream = LevelStream(cfg.audio_device, loop)
    stream.start()
    recognizer = ShazamRecognizer() if cfg.recognizer == "shazam" else None
    try:
        await Listener(cfg, recognizer=recognizer, clip=stream.clip).serve(stream.queue, restart_audio=stream.restart)
    finally:
        stream.stop()
        if recognizer is not None:
            await recognizer.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="now_spinning", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--wav", metavar="FILE")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    if args.wav:
        return asyncio.run(run_wav(args.wav))
    try:
        cfg = config.load(dry_run=args.dry_run or args.check)
    except config.ConfigError as e:
        print(f"config: {e}", file=sys.stderr)
        return 2
    logging.getLogger("now_spinning").info("now-spinning %s%s", __version__, " (dry run)" if cfg.dry_run else "")
    return asyncio.run(check(cfg) if args.check else serve(cfg))


if __name__ == "__main__":
    sys.exit(main())
