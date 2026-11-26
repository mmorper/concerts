# Now Spinning: Raspberry Pi setup and operations

How to take the Raspberry Pi to a machine that hears the turntable and can identify songs, and to
checking that it can drive the Apple TV. Parts 1–11 are everything Phase 0 needs. Part 12
(installing the listener service) is filled in when Phase 4 builds the listener.

**Spec:** [`specs/future/global-now-spinning/global-now-spinning-spec.md`](specs/future/global-now-spinning/global-now-spinning-spec.md).
Its Phase 0 table numbers the checks; this guide says which step covers which check.
**Checklist to tick off as you go:** issue #688. The whole project is tracked in epic #687.

Commands are marked **Mac** (Terminal on your Mac), **Pi** (logged in to the Pi over SSH as
`pi`) or **Pi (now-spinning)** (in a shell as the `now-spinning` user, which step 3 sets up).
Anything in `<angle brackets>` is a value you fill in.

---

## This Pi is shared

The Pi is `mh-unifi-now-playing`, at `192.168.1.244`, with the admin user `pi`. It also runs the
UniFi MCP servers, which have their own runbook: "UniFi MCP on Raspberry Pi — Setup Guide", in
the Unifi Administration project. That runbook owns the operating system: the card, SSH and the
fixed address.

The UniFi servers keep a console password on this Pi. It is a view-only account, but it can sign
in to the console directly and see the network and the cameras. Three rules follow, and every
step below keeps them:

- **Never reflash the card for Now Spinning.** It would wipe the UniFi servers. If the card
  itself fails, rebuild from the UniFi runbook first, then return to step 3 here.
- **Now Spinning runs as its own user, `now-spinning`.** That user can't log in and has no
  `sudo`, so it can't read the UniFi password. The `unifi-mcp` user can't read Now Spinning's
  token either.
- **This project's third-party code never runs as `pi` or as root.** That means `shazamio`,
  `pyatv` and, later, the listener. `pi` can become root, and root can read everything.

A few steps here do change the system the UniFi runbook owns: the new user in step 3, updates
and firmware in step 4, the log settings and (rarely) `config.txt` in step 5. Each is marked
**Record this in the UniFi runbook**, so that runbook stays the full account of this machine.

---

## What you need

- The Raspberry Pi 5 (8 GB) that already runs the UniFi servers, in its case with the active
  cooler
- Its CanaKit 45 W USB-C power supply. Step 5 checks that the Pi sees it as a 5 A supply: the
  Blackjack draws its power from the Pi.
- Mackie Onyx Blackjack, its USB-A → USB-B cable, and the dual RCA → dual 1/4" cable
- An Ethernet cable to the switch in the AV cabinet
- Your Mac, on the same home network
- The Apple TV and its remote (step 10)

---

## Before the hardware arrives: try Shazam on your phone (check 2a, optional)

The Shazam app uses the same catalogue the Pi will query, so this answers the biggest question
early: does Shazam know your records, and what does it call them?

- Play the ten test records and Shazam a track or two from each.
- Write down exactly what it shows for the artist and the title, including extras like
  "(Remastered 2009)". The app's history keeps them all.
- Press and hold the Shazam button for Auto Shazam and let a whole side play. It logs each song,
  much as the Pi will at track changes.
- Leave the needle in the run-out groove for a minute. It should find nothing.

A match here is a strong sign, because the phone hears the record through speakers and room
noise, which is harder than the Pi's direct line feed. A miss is ambiguous: it may be the room.
Either way, step 8 still has to be done on the Pi.

---

## 1. Assemble the Pi

Skip this step if the Pi is already assembled and running.

1. **Active cooler.** Peel the backing off its thermal pads. Line its two spring pins up with
   the two holes beside the processor and press until they click. Plug its small 4-pin cable
   into the connector marked **FAN** on the board, between the GPIO header and the USB ports.
   The plug only fits one way; don't force it.
2. **Case.** Seat the Pi in the case's base. **Don't connect the case's own fan.** The active
   cooler is enough for this job and is close to silent; the case fan may run at full speed all
   the time. You can add it later if the temperature check in step 5 says so.
3. Fit the lid once the microSD card is in its slot on the underside.

---

## 2. The operating system: already done

The UniFi runbook's Step 2 set the Pi up: Raspberry Pi OS Lite (64-bit), wired Ethernet, SSH with
keys only and password logins off, and a fixed address on the main network. Nothing to do here.

Don't repeat that setup from this guide, and don't reflash (see
[This Pi is shared](#this-pi-is-shared)).

---

## 3. Log in, check the basics, and create the Now Spinning user

**Log in from the Mac:**

```bash
# Mac
ssh pi@192.168.1.244
```

You should land at the prompt `pi@mh-unifi-now-playing:~ $`.

**Check the basics.** Each line should print what its comment says:

```bash
# Pi
uname -m                                             # aarch64
sudo sshd -T | grep -i '^passwordauthentication'     # passwordauthentication no
sudo stat -c '%A %U %n' /home/*                      # drwx------ for /home/unifi-mcp and /home/pi
sudo -l | grep -o use_pty                            # use_pty
```

- **If a home folder shows anything other than `drwx------`,** other users can reach files
  inside it. Close it with `sudo chmod 700 /home/<name>`.
- **If the last line prints nothing,** add the setting with
  `echo 'Defaults use_pty' | sudo tee /etc/sudoers.d/use-pty`. It stops a program in another
  user's shell from typing into your terminal. Newer versions of `sudo` turn it on without
  listing it, so the line can print nothing when the setting is already on. Adding it again
  does no harm.

**Record this in the UniFi runbook** if you changed either one.

**Create the Now Spinning user.** It has no password and no login shell, and it isn't in the
`sudo` group. The `audio` group lets it hear the Blackjack:

```bash
# Pi
sudo adduser --system --group --home /var/lib/now-spinning now-spinning
sudo usermod -aG audio now-spinning
sudo chmod 700 /var/lib/now-spinning
```

**Record this in the UniFi runbook:** a second service user, `now-spinning`, with no login and
no `sudo`.

**Open a shell as that user.** Steps 8 and 10 run their commands there:

```bash
# Pi
sudo -H -u now-spinning bash
cd                                 # to its home, /var/lib/now-spinning
```

The prompt changes to `now-spinning@mh-unifi-now-playing`. Type `exit` to return to `pi`.
From that shell, check that it really can't reach the UniFi files or use `sudo`:

```bash
# Pi (now-spinning)
find /home/unifi-mcp /home/pi -type f -readable 2>/dev/null | head -5   # prints nothing
ls /home/unifi-mcp                 # Permission denied
sudo -n true                       # "a password is required" or "not in the sudoers file"
exit
```

The first line lists the files this user can read in those two homes, in any folder it can
open, whatever the files are called. A home it can pass through but not open (`drwx--x--x`)
hides its files from this check. That's why the folder check above must show `drwx------`.

If the first line prints a path, or either of the others succeeds, stop and fix that before
running anything else as this user.

---

## 4. Update everything (Pi)

```bash
# Pi
sudo apt update && sudo apt full-upgrade -y
sudo rpi-eeprom-update            # shows whether the board's firmware is current
sudo rpi-eeprom-update -a         # only if the line above says an update is available
sudo reboot
```

Wait a minute and SSH in again. Then check the clock, since recognition and logs rely on it:

```bash
# Pi
timedatectl          # "System clock synchronized: yes" and your time zone
```

Let the Pi install security updates by itself, so it doesn't need regular visits. The UniFi
runbook's rule that nothing updates by itself is about its pinned MCP servers, which these
updates don't touch. A reboot is safe for them too: they only run while a chat is using them.

**Record this in the UniFi runbook:** the date of this upgrade, any firmware update, and that
automatic security updates are now on. Its maintenance table says the OS is upgraded by hand
each month; that still applies to everything that isn't a security patch.

```bash
# Pi
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades     # answer Yes
```

---

## 5. Power, temperature and the card's lifespan (Pi)

**Power (Phase 0 check 1c).** The Blackjack runs on USB power from the Pi. The Pi 5 only allows
its full 1.6 A of USB current when it recognises a 5 A supply.

```bash
# Pi
vcgencmd get_throttled            # 0x0 = no under-voltage or throttling, ever, since boot
od -An -tu4 --endian=big /proc/device-tree/chosen/power/max_current   # 5000 = a 5 A supply
```

If `max_current` isn't 5000, the Pi didn't recognise the supply as 5 A. Check that you're using
the kit's supply, not a phone charger. If you're sure the label says **5 V / 5 A**, you can add
`usb_max_current_enable=1` on its own line at the end of `/boot/firmware/config.txt` and reboot.
Never do that with a weaker supply: the Pi would draw more than the supply can give.
**Record this in the UniFi runbook** if you add that line.

**Temperature.**

```bash
# Pi
vcgencmd measure_temp             # resting in the cabinet: well under 60 °C is fine
```

Check it again after the Pi has been listening for an hour with the cabinet door closed. If it's
above 70 °C, connect the case fan or give the cabinet more air.

**Keep the system log on the card, with a size cap.** This Pi holds credentials, so the record
of who logged in over SSH has to survive a reboot:

```bash
# Pi
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=persistent\nSystemMaxUse=64M\n' | sudo tee /etc/systemd/journald.conf.d/now-spinning.conf
sudo systemctl restart systemd-journald
```

An earlier version of this guide kept logs in memory (`Storage=volatile`), which lost them at
each reboot. If you ran that step, this one replaces it: it writes the same file.

**Record this in the UniFi runbook:** the system log is capped at 64 MB, by
`/etc/systemd/journald.conf.d/now-spinning.conf`.

**Plug the Pi into an outlet that stays on,** not a switched strip that cuts with the
receiver. Cutting power while the Pi is writing can corrupt the card. To turn it off on
purpose, run `sudo poweroff` and wait for the green light to stop flashing before pulling the
plug.

---

## 6. Connect and set up the Blackjack

**On the Blackjack, before you plug anything in** (the spec's settings table):

| Control | Setting |
|---|---|
| Inputs 1 and 2: LINE / HI-Z | **LINE** (button out) |
| Inputs 1 and 2: GAIN | **U** (unity), both the same |
| PHANTOM | **Off** (light off) |
| TO MON, MONITOR, PHONES | Minimum |

**Cables:**
- White RCA → AV7703 **ZONE2 PRE OUT L**; white-banded 1/4" plug → Blackjack **input 1**.
- Red RCA → **ZONE2 PRE OUT R**; red-banded 1/4" plug → **input 2**.
- USB-B → Blackjack; USB-A → one of the Pi's **black** USB 2.0 ports.

The Blackjack's POWER and USB lights should come on.

**Check the Pi sees it (Phase 0 check 1b):**

```bash
# Pi
sudo apt install -y alsa-utils sox netcat-openbsd   # nc is used from step 7
lsusb                              # a line naming Mackie or LOUD
arecord -l                         # "card N: <Name> [...]": note the short name before the bracket
sudo dmesg | grep -iE "over-current|undervolt"    # should print nothing
```

In the commands below, `<card>` is that short name. On this Pi it is `Blackjack`
(`card 2: Blackjack [Onyx Blackjack]`). Using the name rather than the number matters, because
the number can change between boots.

---

## 7. Set the levels (Phase 0 check 1)

**On the AV7703** (once): General → ZONE2 Setup → Volume Level → **60**. Leave Bass, Treble,
Lch and Rch Level at 0 dB, High Pass Filter off and Channel on Stereo. Volume Limit and Power On
Volume turn grey: that is how you can tell the level is fixed. On this receiver, 60 with GAIN at
U put the loudest passage at −13 dBFS (2026-11-25). Each step is 1 dB.

Setting the level doesn't turn the zone on. Turn on Zone 2 with **Phono** as its source, from
the remote's zone button, the Marantz app, or the Pi (the receiver's address is in step 9):

```bash
# Pi
printf 'Z2ON\r'    | nc -w 2 <receiver-ip> 23
printf 'Z2PHONO\r' | nc -w 2 <receiver-ip> 23
```

If these time out, see step 9: the receiver needs Network Control set to Always On, and a
firewall rule if it's on a different network from the Pi. The front panel shows MULTI ZONE, and a second line with Zone 2's name and Phono. Put on the
loudest record you own.

**Watch a live meter on the Pi:**

```bash
# Pi
arecord -D plughw:CARD=<card>,DEV=0 -f cd -V stereo /dev/null      # Ctrl-C to stop
```

The meter is a line of text with a bar and a percentage for each channel. The percentage is the
peak as a share of full scale: 25% is about −12 dBFS, 50% about −6, 100% is clipping. A very
quiet signal still reads `+00%|00%+`: on the bench (2026-11-25), a clip whose loudest moment was
−38 dBFS by `sox` showed `00%` on the meter, which samples moment to moment and can miss a
single click. Step 7's `sox` check below tells the two apart: `-inf` is silence, a
number is a quiet signal.

- **Aim for peaks around −12 dBFS on the loudest passages:** the bars reach roughly a quarter of
  the scale, and never the end. Anywhere from −15 to −10 is fine.
- The Blackjack's **SIG/OL lights must never turn red.** If they do, lower Zone 2's fixed level.
- **Adjust with Zone 2's level only**, leaving GAIN at U. Each step on the receiver is 1 dB, so a
  peak of −18 needs about 6 more.
- **Write down the final Zone 2 level and the GAIN knob positions.** A bumped knob is the most
  likely reason recognition gets worse months from now.

**Record a sample, measure it and listen to it.** Measure on a loud, dense passage: a surface
click can read as the peak of a quiet clip.

```bash
# Pi
arecord -D plughw:CARD=<card>,DEV=0 -f cd -d 15 ~/level-test.wav
sox ~/level-test.wav -n stats 2>&1 | grep -E "Pk lev dB|RMS lev dB"
```

```bash
# Mac: copy it over and play it
scp pi@192.168.1.244:level-test.wav ~/Desktop/
```

`Pk lev dB` is the peak, first for both channels together, then left, then right. The `scp`
runs on the Mac, not the Pi: on the Pi it tries to log in to itself and is refused.

It should sound like the record, with no buzz or hum between tracks. If there's hum, move the
cable away from power cords. If one side is silent, check the L/R cables.

---

## 8. Test Shazam on your records (Phase 0 checks 2, 3 and 8)

`shazamio` is an unofficial client, so everything in this step runs as `now-spinning`, never
as `pi`. Open that user's shell first, **on its own**:

```bash
# Pi
sudo -H -u now-spinning bash
cd
```

Paste nothing else until the prompt reads `now-spinning@mh-unifi-now-playing`. If you paste the
switch and the installs as one block and the switch fails (`sudo: unknown user now-spinning`
means step 3 was skipped), the installs run as `pi`. If that happens, remove what they put in
`pi`'s home, create the user (step 3), and start this step again:

```bash
# Pi (as pi)
rm -rf ~/ns-test ~/.cache/uv ~/.local/share/uv ~/try-shazam.py
rm -f ~/.local/bin/uv ~/.local/bin/uvx ~/.local/bin/env ~/.local/bin/env.fish
sed -i '/\.local\/bin\/env/d' ~/.profile ~/.bashrc     # the lines the uv installer added
```

**Install a test environment.** It uses `uv` and Python 3.13, the same tools as the UniFi
servers. `uv` and its Python install into this user's home only, and they are for these tests
only: step 11 deletes them. The real listener gets a separate copy that root owns, so nothing
this user can change is ever run by root.

```bash
# Pi (now-spinning)
curl -LsSf https://astral.sh/uv/install.sh | sh
~/.local/bin/uv venv --python 3.13 ~/ns-test
~/.local/bin/uv pip install --python ~/ns-test/bin/python shazamio
~/ns-test/bin/python --version    # write this down: Phase 0 check 8
```

**Check 8.** Note the Python version, and whether `uv` downloaded ready-made packages or started
building `shazamio-core` from Rust source. If it built, or failed, that package has no
ready-made build for this Python on the Pi. Phase 4 then pins a Python version that has one, so
record it either way.

**A small test script:**

```bash
# Pi (now-spinning)
cat > ~/try-shazam.py <<'EOF'
import asyncio, sys
from shazamio import Shazam

async def main(path):
    out = await Shazam().recognize(path)
    track = out.get("track")
    if not track:
        print("no match")
        return
    album = next((m["text"] for s in track.get("sections", []) for m in s.get("metadata", [])
                  if m.get("title") == "Album"), "")
    print(f'{track.get("subtitle")} | {track.get("title")} | {album}')
    if len(sys.argv) > 2:                       # optional: save the whole response
        import json
        json.dump(out, open(sys.argv[2], "w"), indent=1)

asyncio.run(main(sys.argv[1]))
EOF
```

**Run it with a record playing.** If it can't open the audio device, the `audio` group hasn't
taken effect in this shell: `exit` and open the shell again.

```bash
# Pi (now-spinning): record 10 seconds, then identify it
arecord -q -D plughw:CARD=<card>,DEV=0 -f cd -d 10 /tmp/clip.wav && ~/ns-test/bin/python ~/try-shazam.py /tmp/clip.wav
```

It prints `artist | title | album`, or `no match`. A few lines about an "Unclosed client
session" follow: `shazamio` leaves its connection open when the script ends. They're harmless
here (Phase 4's listener closes it). Add `2>/dev/null` to hide them, and drop it again if a run
prints nothing at all.

Repeat for **ten records**: an old pressing, a live album, an album with no gaps between tracks,
a 45, and something obscure. For each one, write down:
- whether it matched, and after how many tries
- **exactly** what Shazam called the artist and the title (the spec's lookup rules have to cope
  with these spellings)

| # | Record | Matched? | Shazam's artist | Shazam's title |
|---|---|---|---|---|
| 1 | | | | |

**Save one complete response.** Phase 4 needs to see every field Shazam returns. For one record
that matched, add a file name to the command and copy the file to your Mac:

```bash
# Pi (now-spinning): saved in /tmp, because pi can't read this user's home
~/ns-test/bin/python ~/try-shazam.py /tmp/clip.wav /tmp/shazam-sample.json
```
```bash
# Mac
scp pi@192.168.1.244:/tmp/shazam-sample.json ~/Desktop/
```

Attach it to issue #688. It names the song you were playing and nothing else about you.

**Check 3 (run-out groove).** At the end of a side, leave the needle in the run-out groove for a
minute while the meter from step 7 runs. Note what the meter shows: the clicks may never drop
low enough to count as silence.

**Check 7 (what goes to Shazam)** is answered in Phase 4 from `shazamio`'s source code. Nothing
to do here.

---

## 9. The receiver over the network (Phase 0 checks 6 and 6b)

On the AV7703: Network → Network Control → **Always On**, so the receiver answers while in
standby. Find its IP address in its Network Information menu, or in the router's device list,
and give it a fixed address in UniFi.

**If the receiver is on a different network from the Pi** (the IoT VLAN, say), the commands
below time out until a firewall rule lets `192.168.1.244` reach it. The UniFi MCP can tell you
which network the receiver is on. Note what you find, and any rule you add, on #688.

```bash
# Pi: ask the main zone which input it's on (expect "SIPHONO" while the turntable is selected)
printf 'SI?\r' | nc -w 2 <receiver-ip> 23
```

If that prints nothing while a control app (Home Assistant, the Marantz app) is connected, the
receiver accepts one telnet client at a time. Note it for check 6; the listener will use the
receiver's HTTP control instead.

**Check 6b: can the Pi control Zone 2?** The listener needs all of these. They are the standard
Denon/Marantz control commands; write down each reply, including any that prints nothing.

```bash
# Pi: one at a time, with a record playing on Phono in the main zone
printf 'ZM?\r'     | nc -w 2 <receiver-ip> 23     # main zone power: expect ZMON
printf 'Z2?\r'     | nc -w 2 <receiver-ip> 23     # Zone 2 status: power, source, volume
printf 'Z2ON\r'    | nc -w 2 <receiver-ip> 23     # turn Zone 2 on (the front panel shows it)
printf 'Z2PHONO\r' | nc -w 2 <receiver-ip> 23     # set Zone 2's source to Phono
printf 'Z2?\r'     | nc -w 2 <receiver-ip> 23     # confirm: Z2ON and Z2PHONO
printf 'Z2OFF\r'   | nc -w 2 <receiver-ip> 23     # turn Zone 2 off again
```

While Zone 2 is on Phono, the level meter from step 7 should show the record. The main zone
must keep playing throughout; if any command interrupts it, note which.

---

## 10. The Apple TV (Phase 0 checks 4 and 5)

The picture on the TV will come from a tvOS app on the Apple TV. The app can't put itself on
screen, so the Pi has to wake the Apple TV and bring the app forward for every record. These two
checks find out whether that works. Both are required.

**Check 4: does waking the Apple TV steal the receiver's input?**

1. Put the receiver on Phono with a record playing. Let the Apple TV go to sleep (hold the TV
   button on the remote → Sleep).
2. Wake the Apple TV with its remote.
3. Did the receiver switch away from Phono, so the record stopped?

If it did, HDMI control (CEC) is doing it. Turn it off in one of two places, then repeat the test
and write down which you chose:
- Apple TV: Settings → Remotes and Devices → Control TVs and Receivers → Off. The Apple TV remote
  then no longer turns the TV on or changes the volume.
- Or the AV7703: its HDMI Control setting → Off.

**Check 5: can the Pi put an app on the Apple TV's screen?**

On the Apple TV first: Settings → AirPlay and HomeKit → Allow Access → "Anyone on the Same
Network", so the Pi can pair.

Run these as `now-spinning`. `atvremote` saves the pairing in the home of the user that ran
it, and the listener will run as this user.

```bash
# Pi (now-spinning)
~/.local/bin/uv pip install --python ~/ns-test/bin/python pyatv
~/ns-test/bin/atvremote scan                                   # find the Apple TV; copy its Identifier
~/ns-test/bin/atvremote --id <identifier> --protocol companion pair   # type the PIN the TV shows
~/ns-test/bin/atvremote --id <identifier> --protocol airplay pair     # and again
```

**If `scan` finds nothing,** the Apple TV may be on a different network from the Pi: device
discovery doesn't cross VLANs.
- Give the Apple TV a fixed address in UniFi, then scan that address:
  `~/ns-test/bin/atvremote --scan-hosts <apple-tv-ip> scan`.
- If that finds it, add `--scan-hosts <apple-tv-ip>` to **every** `atvremote` command in this
  step, straight after `atvremote`. Each command looks the Apple TV up again, so `pair` and the
  rest fail without it.
- If that also finds nothing, a firewall rule is blocking `192.168.1.244`.

Note the Apple TV's network, and any rule you add, on #688.

Then try each of these and write down what happened. If a command isn't recognised, run
`~/ns-test/bin/atvremote commands` to see the names your version uses.

```bash
# Pi (now-spinning)
~/ns-test/bin/atvremote --id <identifier> power_state          # on or off?
~/ns-test/bin/atvremote --id <identifier> app_list             # the installed apps and their identifiers
~/ns-test/bin/atvremote --id <identifier> launch_app=com.apple.TVMusic    # does Music open?
~/ns-test/bin/atvremote --id <identifier> playing              # says what is playing, if anything
~/ns-test/bin/atvremote --id <identifier> app                  # which app is in front
```

Three situations matter. Test each with the receiver on Phono:

| Start from | Run | Write down |
|---|---|---|
| Apple TV asleep | `turn_on`, then `launch_app=com.apple.TVMusic` | Did it wake? Did Music open? Did the receiver stay on Phono? |
| Music open, screensaver showing | `launch_app=com.apple.TVMusic` | Did the screensaver go away? If not, try `turn_on`, then `menu`, and note which worked. |
| A film playing | `playing` | Does it report that something is playing? (The listener uses this to know not to interrupt.) |

## 11. Record the results

Add one line per check to the spec's **Revision History**, with the date: the Zone 2 level and
gain positions, the ten-record table, the run-out finding, the Python version, the Apple TV
results from step 10, and the answers to checks 6 and 6b. That's what Phase 4 is designed
against. Tick the same items off on issue #688.

Then delete the test files, including the test copy of `uv` and its Python. Keep only the
Apple TV pairing (`~/.pyatv.conf`), which the listener uses:

```bash
# Pi (now-spinning): full paths, so a slip into pi's shell can't delete pi's own files
cd /var/lib/now-spinning
rm -rf /var/lib/now-spinning/ns-test /var/lib/now-spinning/try-shazam.py
rm -rf /var/lib/now-spinning/.local /var/lib/now-spinning/.cache
rm -f /tmp/clip.wav /tmp/shazam-sample.json
ls -A /var/lib/now-spinning        # .pyatv.conf; a leftover .profile or .config is harmless
```
```bash
# Pi
rm -f ~/level-test.wav
```

---

## 12. Installing the listener (Phase 4)

**Phase 4a** (#696) is what this step installs: Zone 2 follows Phono, the receiver goes back to the
Apple TV input after records, the TV and Apple TV wake when a record starts, and a health check-in
every 5 minutes. Song recognition (Shazam) is Phase 4b; it installs the same way, as an update.
What it does and why: `now-spinning/pi/README.md` and the spec's §Pi listener.

Everything here runs as `pi`. The listener itself runs as `now-spinning`, from code root owns:
- the code in `/opt/now-spinning/app` and its Python environment in `/opt/now-spinning/venv`,
  owned by root, built from the committed lock file by a pinned, root-owned `uv` and the system's
  Python 3.13, with nothing compiled (`--frozen --no-build`). Root never runs anything from
  `/var/lib/now-spinning`.
- its settings in `/etc/now-spinning/env`, readable by root only. systemd reads them before it
  starts the service.
- the Apple TV pairing from step 10, which stays in `/var/lib/now-spinning`.

**1. Get the code.** The repository is public, so no login is needed. This only downloads files;
nothing runs.

```bash
# Pi
sudo apt install -y git                      # if `git` isn't there yet
git clone --depth 1 https://github.com/mmorper/concerts.git ~/concerts
```

**2. Install.** It installs `libportaudio2` if it's missing, puts a pinned `uv` in
`/usr/local/bin` (checked against its published checksum), builds the environment, installs the
service and creates `/etc/now-spinning/env` from the template. It doesn't start anything.

```bash
# Pi
cd ~/concerts/now-spinning/pi && sudo ./install.sh
```

**3. Fill in the settings.** `sudo nano /etc/now-spinning/env`. The addresses are already filled
in. Three values aren't, because the repository is public:
- `NS_INGEST_TOKEN`: from 1Password, "Now Spinning ingest token".
- `NS_APPLE_TV_ID`: the Apple TV's identifier from step 10. To read it again:
  `sudo -u now-spinning -H /opt/now-spinning/venv/bin/atvremote --scan-hosts 192.168.1.111 scan`
  and copy the first identifier under "Family Room".
- `NS_TV_MAC`: the TV's MAC address. With the TV on: `ip neigh show 192.168.1.231`, the value
  after `lladdr`.

**4. Check it before it controls anything.** This reads the receiver once and one second of audio,
prints both and exits, as the `now-spinning` user with the real settings:

```bash
# Pi
sudo systemd-run --pipe --wait --quiet -p User=now-spinning -p SupplementaryGroups=audio \
  -p EnvironmentFile=/etc/now-spinning/env -p WorkingDirectory=/opt/now-spinning/app \
  -p Environment=HOME=/var/lib/now-spinning \
  /opt/now-spinning/venv/bin/python -m now_spinning --check
```

Expect a `ReceiverStatus(...)` line and a dBFS reading. `no complete reply` means the receiver
didn't answer (step 9's notes apply); `no input device` means the Blackjack isn't seen (step 6).

Optional: the same command with `--dry-run` instead of `--check` runs everything but only logs
what it would do. Put a record on and watch; Ctrl-C to stop.

**5. Start it.**

```bash
# Pi
sudo systemctl enable --now now-spinning
journalctl -u now-spinning -f               # its log; Ctrl-C to stop watching
```

Within 5 minutes the page's `#debug` panel shows the listener online, with song recognition
`off`. That's correct for Phase 4a.

**6. Check it on the equipment** (Phase 4a's part of #697). Tick each on #697:
- [ ] Main zone to Phono → Zone 2 turns on within about 5 seconds (MULTI ZONE on the display).
- [ ] Main zone back to the Apple TV → Zone 2 turns off.
- [ ] Record playing, TV off, Apple TV asleep → the TV comes on and Music is in front; the record
  keeps playing.
- [ ] A film playing on the Apple TV, then Phono and a record → the film isn't interrupted.
- [ ] Needle lifted at the end of a side → about 18 minutes later (3 to call it stopped, then 15)
  the receiver goes to standby on the Apple TV input, and the Apple TV remote brings everything up.
- [ ] Needle left in the run-out → nothing at 18 minutes; about 63 minutes later the same return.
- [ ] Receiver turned off with its remote while on Phono → within a few seconds it is set to the
  Apple TV input and stays in standby.
- [ ] A side longer than 15 minutes plays through without anything switching.

**Record this in the UniFi runbook:** the `now-spinning` service, `libportaudio2`,
`/usr/local/bin/uv` (pinned), `/opt/now-spinning` and `/etc/now-spinning`.

**Updating, on purpose.** Pull, re-run the installer, which rebuilds from the lock file and
restarts the service:

```bash
# Pi
cd ~/concerts && git pull && cd now-spinning/pi && sudo ./install.sh
```

**Stopping it.** `sudo systemctl disable --now now-spinning`. Zone 2 then stays as it is; switch
it off from the Marantz app if needed.

**Rotating the ingest token.** Generate a new one (`openssl rand -hex 32`), set it on the Worker
(`npx wrangler secret put NOW_SPINNING_INGEST_TOKEN` in `workers/now-spinning`), put it in
`/etc/now-spinning/env` and 1Password, then `sudo systemctl restart now-spinning`. Until both
match, the check-in fails and the panel shows the listener offline. Also in
[`SECRETS.md`](SECRETS.md).

Building and installing the tvOS app is done on the Mac, not the Pi: see issue #701.

---

## When something isn't right: find where the problem is

The web page and the tvOS app show the same thing from the same source. Open the page on a
laptop or phone and compare it with the TV. That tells you which part to look at.

**Open the page with its diagnostics panel:**

```
https://concerts.morperhaus.org/now-spinning#debug
```

The first time on a device, give it the display token once:
`https://concerts.morperhaus.org/now-spinning#token=<display token>&debug`. The page keeps the
token on that device and takes it out of the address straight away. After that, `#debug` alone
is enough.

The panel shows:
- **Connection:**
  - It shows `live`, `reconnecting`, or `reconnecting · polling every 10 s`.
  - It also shows how long ago the last message and the last heartbeat `pong` arrived.
  - It can also say `token refused`, `no token`, or `Worker not configured (503)`.
  - A `last drop: no heartbeat` line means the network dropped the connection without saying
    so. The page noticed within a minute and reconnected.
- **Listener:** online or last seen, song recognition, receiver, Apple TV, and the listener's
  version.
- **State:** the contract version, what is on screen (with `faded`, `black` or `mirrored`),
  and the raw state exactly as the Worker sent it.

| The web page shows | The TV shows | The problem is in | Look at |
|---|---|---|---|
| The right song | Nothing, or the screensaver | Waking the Apple TV, or the app isn't open | The panel's Apple TV line. Open the app by hand: if it then shows the song, the waking step failed (step 10's commands test it). |
| The right song | The wrong song, or an old one | The tvOS app | Quit and reopen the app. If that fixes it, the app lost its connection and didn't recover; note it on the epic (#687). |
| The right song | The app won't open at all | The app's signing has expired (about a year after it was installed) | Run it from Xcode again to reinstall it (#701). Set the next reminder. |
| The right song | The app, but garbled or cut off | The tvOS app | Compare with the page. The app may be older than a newer screen type; rebuild and reinstall it (#701). |
| Idle while a record plays | Idle | The Pi listener | The panel's listener lines. Offline: is the Pi powered and on the network? Online but not identifying: is Zone 2 on Phono, and does the meter in step 7 move? |
| "Listening…" that never resolves | The same | Song recognition | The panel's recognition line. If it says failing, Shazam is refusing or unreachable. If it says ok, Shazam doesn't know this record. |
| The right song, wrong history | The same | The Worker's lookup, or the archive data | The raw state in the panel. Note the artist and title Shazam sent and open an issue. |
| "The archive isn't answering right now." | The same | The index file | It is rebuilt on every site deploy. Check the latest deploy succeeded. |
| Nothing loads, or the panel says reconnecting | Anything | The Worker, or your network | Other pages on the site. The Cloudflare dashboard for the Worker. |
| The panel says `reconnecting · polling every 10 s`, and songs still change | Anything | The WebSocket only. The Worker itself is answering. | The Cloudflare dashboard for the Worker. Songs still reach the page, up to 10 seconds late. |
| The panel says `token refused` | Anything | The display token on this device is wrong, or it was rotated | Open the page once more with the current token (`#token=…&debug`). The TV needs it too: rebuild the app with the new `Secrets.xcconfig` (#701). |
| The panel says `Worker not configured (503)` | Idle | The Worker has no tokens yet, or one was deleted | Set both (`SECRETS.md`, #693). |

**Send a test song without playing a record.** This posts what the listener would, so it checks
everything from the Worker to the screen. Run it on the Mac and paste the ingest token at the
prompt: `read -s` keeps it off the screen and out of your shell history.

```bash
# Mac
read -rs NS_INGEST
curl -sS -X POST https://concerts.morperhaus.org/api/now-spinning \
  -H "Authorization: Bearer $NS_INGEST" -H 'Content-Type: application/json' \
  -d '{"event":"track","artist":"Depeche Mode","title":"Everything Counts (Remastered 2006)"}'
```

The open page, and the TV if the app is open, should change within a second or two. To clear
it, send `-d '{"event":"stopped"}'` the same way. Left alone, the screen goes idle by itself
after three minutes, because no listener is reporting.

On the Pi, once the listener is installed (step 12), these show what it is doing:

```bash
# Pi
systemctl status now-spinning        # running, or why not
journalctl -u now-spinning -n 50     # its last 50 log lines
```

## Troubleshooting the Pi setup

| Symptom | Likely cause | Fix |
|---|---|---|
| `ssh pi@192.168.1.244` times out | The Pi is off, or its address changed | Check its power and its fixed address in UniFi |
| `Permission denied (publickey)` | The Mac's key isn't the one on the Pi | Plug a keyboard and screen into the Pi and fix `~/.ssh/authorized_keys`. Don't reflash. |
| `atvremote scan` finds nothing | The Apple TV is on another network | Step 10: scan it by address |
| `arecord -l` lists no Blackjack | Cable, or not enough USB power | Try the other black USB port; run step 5's power check |
| Recording is silent | Zone 2 off, or its source isn't Phono | Turn Zone 2 on and select Phono |
| SIG/OL lights red | Too much level | Lower Zone 2's fixed level |
| Hum between tracks | Cable near a power cord | Re-route it; keep it short |
| `get_throttled` isn't `0x0` | Under-voltage at some point | Use the kit's supply; check the cable is seated |
| `nc` prints nothing from the receiver | Network Control is off, or another app holds the connection | Set Network Control to Always On; close other control apps and retry |
| Pi runs hot | Cooler fan not connected | Check the FAN plug; connect the case fan |
