# Now Spinning: the Pi listener

Runs on the Raspberry Pi as the `now-spinning` systemd service. **Phase 4a** (#696), on the
equipment since 2026-11-27:

- **Zone 2 follows Phono.** When the receiver's main zone is on Phono, Zone 2 goes on, set to
  Phono (it feeds the Blackjack). It is turned back on if its 8-hour Auto Standby switches it off,
  and off again when the main zone leaves Phono.
- **The receiver goes back to the Apple TV input** after records: 15 minutes after the record
  stops with the needle lifted, 60 with the needle left in the run-out, at once if the receiver is
  put in standby on Phono. Music-level sound cancels the timers.
- **The display wakes** when a record starts on Phono, not at the gaps between songs: the TV by
  Wake-on-LAN, then the Apple TV, then the Now Spinning app. Never while the Apple TV is
  playing something.
- **A health check-in** to the Worker every 5 minutes (`recognizer: "off"` until Phase 4b).
- **No reading isn't silence.** If the Blackjack stops delivering audio, nothing is decided
  while it's out, and the return timers start again from zero when it's back, so a playing record
  is never taken for a lifted needle. The stream is restarted every minute; the journal says so.

**Phase 4b** adds song recognition, so the Now Spinning page shows the song:

- **Listens only on Phono** (or on sound alone while the receiver is unreachable). A 12-second clip
  as soon as a record starts, then one every 30 seconds; Shazam gets a fingerprint made on the
  Pi, never audio, and nothing is written to disk.
- **Posts what it hears** to the Worker: the song, `gap` between songs, `unmatched` after three
  misses, `stopped` after 3 minutes of silence, 5 minutes with no match, or the receiver leaving
  Phono, and `alive` every minute while something shows. A new song needs two results that agree.
- **Recognition `ok` / `failing`** in the check-in (three errors in a row, or no audio).
  `NS_RECOGNIZER=off` turns recognition off and leaves the 4a listener.
- The return to the Apple TV input still follows loudness alone, so it works when Shazam doesn't.

The rules and their reasons are in the spec, `docs/specs/implemented/global-now-spinning/global-now-spinning-spec.md`
§Pi listener. Installing, updating and checking it on the Pi: `docs/NOW_SPINNING_OPERATIONS.md` §12.

## Layout

| File | What |
|---|---|
| `now_spinning/controller.py` | The rules: receiver status and loudness in, actions out. No I/O. |
| `now_spinning/loop.py` | The identification loop: loudness and results in, Worker events out. No I/O. |
| `now_spinning/recognition.py` | The `Recognizer` interface, Shazam behind it, Shazam's answer → a `track` event |
| `now_spinning/levels.py` | Loudness bands from Phase 0 check 3: music ≥ −45 dBFS, run-out, lifted < −75 |
| `now_spinning/receiver.py` | The AV7703's telnet control: short connections, replies read to a deadline |
| `now_spinning/display.py` | Wake-on-LAN, and the Apple TV over pyatv |
| `now_spinning/worker.py` | The health check-in |
| `now_spinning/audio.py` | One RMS reading a second from the Blackjack, and the last 12 s in memory for a clip |
| `now_spinning/app.py` | The loop that ties them together |
| `now-spinning.service`, `install.sh`, `env.example` | Installing it on the Pi |

## Develop and test (no hardware needed)

```bash
cd now-spinning/pi
uv sync --python 3.13 --frozen
uv run --frozen python -m pytest -q
```

The tests drive whole evenings through the rules with a fake clock, talk to a fake receiver over a
real socket, and check that every locked package installs on the Pi without building.

On the Pi, `python -m now_spinning --check` reads the receiver, one loudness reading and one clip
through Shazam, and exits; `--dry-run` runs everything but only logs what it would do.
`python -m now_spinning --wav side.wav` runs the identification loop on a recording and prints what
it would post (no settings needed; `NS_RECOGNIZER=off` skips Shazam).
