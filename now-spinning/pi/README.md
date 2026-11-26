# Now Spinning: the Pi listener

Runs on the Raspberry Pi as the `now-spinning` systemd service. **Phase 4a** (#696):

- **Zone 2 follows Phono.** When the receiver's main zone is on Phono, Zone 2 goes on, set to
  Phono (it feeds the Blackjack). It is turned back on if its 8-hour Auto Standby switches it off,
  and off again when the main zone leaves Phono.
- **The receiver goes back to the Apple TV input** after records: 15 minutes after the record
  stops with the needle lifted, 60 with the needle left in the run-out, at once if the receiver is
  put in standby on Phono. Music-level sound cancels the timers.
- **The display wakes** when music starts after silence on Phono: the TV by Wake-on-LAN, then the
  Apple TV, then the app (Music for now). Never while the Apple TV is playing something.
- **A health check-in** to the Worker every 5 minutes (`recognizer: "off"` until Phase 4b).
- **No reading isn't silence.** If the Blackjack stops delivering audio, the timers stand still
  (a playing record is never taken for a lifted needle) and the stream is restarted every minute;
  the journal says so.

Phase 4b adds song recognition (Shazam) and posting what's playing.

The rules and their reasons are in the spec, `docs/specs/future/global-now-spinning/global-now-spinning-spec.md`
§Pi listener. Installing, updating and checking it on the Pi: `docs/NOW_SPINNING_OPERATIONS.md` §12.

## Layout

| File | What |
|---|---|
| `now_spinning/controller.py` | The rules: receiver status and loudness in, actions out. No I/O. |
| `now_spinning/levels.py` | Loudness bands from Phase 0 check 3: music ≥ −45 dBFS, run-out, lifted < −75 |
| `now_spinning/receiver.py` | The AV7703's telnet control: short connections, replies read to a deadline |
| `now_spinning/display.py` | Wake-on-LAN, and the Apple TV over pyatv |
| `now_spinning/worker.py` | The health check-in |
| `now_spinning/audio.py` | One RMS reading a second from the Blackjack; nothing stored |
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

On the Pi, `python -m now_spinning --check` reads the receiver and one loudness reading and exits;
`--dry-run` runs everything but only logs what it would do.
