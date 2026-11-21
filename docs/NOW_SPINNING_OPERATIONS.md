# Now Spinning: Raspberry Pi setup and operations

How to take the Raspberry Pi from a sealed box to a machine that hears the turntable and can
identify songs. Parts 1–10 are everything Phase 0 needs. Part 11 (installing the listener
service) is filled in when Phase 4 builds the listener.

**Spec:** [`specs/future/global-now-spinning/global-now-spinning-spec.md`](specs/future/global-now-spinning/global-now-spinning-spec.md).
Its Phase 0 table numbers the checks; this guide says which step covers which check.

Commands are marked **Mac** (Terminal on your Mac) or **Pi** (after you've logged in to the Pi
over SSH). Anything in `<angle brackets>` is a value you fill in.

---

## What you need

- CanaKit Raspberry Pi 5 kit: the Pi, the 45 W power supply, the 32 GB microSD card and USB card
  reader, the official active cooler, the case
- Mackie Onyx Blackjack, its USB-A → USB-B cable, and the dual RCA → dual 1/4" cable
- An Ethernet cable to the switch in the AV cabinet
- Your Mac, on the same home network

---

## 1. Assemble the Pi

1. **Active cooler.** Peel the backing off its thermal pads. Line its two spring pins up with
   the two holes beside the processor and press until they click. Plug its small 4-pin cable
   into the connector marked **FAN** on the board, between the GPIO header and the USB ports.
   The plug only fits one way; don't force it.
2. **Case.** Seat the Pi in the case's base. **Don't connect the case's own fan.** The active
   cooler is enough for this job and is close to silent; the case fan may run at full speed all
   the time. You can add it later if the temperature check in step 5 says so.
3. Leave the lid off for now, so you can get at the microSD slot.

---

## 2. Put Raspberry Pi OS on the card (Mac)

1. Download **Raspberry Pi Imager** from raspberrypi.com/software and install it.
2. Put the microSD card in the kit's USB reader and plug it into the Mac.
3. In Imager:
   - **Device:** Raspberry Pi 5.
   - **Operating system:** *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**.
     Lite has no desktop. That suits a box in a cabinet that you reach over the network. If you
     later choose to have the Pi drive the TV (display option A in the spec), the desktop gets
     installed then.
   - **Storage:** the microSD card. Double-check it's the card and not another drive.
4. When Imager offers **OS customisation**, choose to edit settings. Menu names move between
   Imager versions, but these are the values to set:

   | Setting | Value |
   |---|---|
   | Hostname | `now-spinning` |
   | Username and password | A username (for example your first name in lowercase) and a strong password. Write the password in your password manager. |
   | Wireless LAN | Leave unset. It's on Ethernet. |
   | Locale | Your time zone, keyboard layout US |
   | SSH | **Enable**, with **public-key authentication only** (see below) |
   | Raspberry Pi Connect | Off |

   **SSH key.** Imager can fill this in from your Mac. If it shows an empty box, you don't have a
   key yet. Make one in Terminal and paste the printed line into Imager:
   ```bash
   # Mac
   ssh-keygen -t ed25519 -C "now-spinning"      # press Enter to accept the defaults
   cat ~/.ssh/id_ed25519.pub
   ```
5. Write the card. Imager verifies it and ejects it when done.

---

## 3. First boot and logging in

1. Put the card in the slot on the underside of the Pi, contacts facing the board. Fit the lid.
2. Connect the Ethernet cable, then the power supply. Nothing else yet.
3. Wait two to three minutes. The first boot resizes the card and reboots once by itself.
4. Log in from the Mac:
   ```bash
   # Mac
   ssh <username>@now-spinning.local
   ```
   Answer `yes` to the fingerprint question the first time. You should land at a prompt like
   `<username>@now-spinning:~ $`.

If `now-spinning.local` isn't found, look in your router's list of connected devices for
`now-spinning` and use its IP address instead (`ssh <username>@192.168.x.y`).

**Give the Pi a fixed address.** In the router, add a DHCP reservation for the Pi so its IP never
changes. The Worker doesn't need it, but you'll SSH in by this address for years.

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

**Temperature.**

```bash
# Pi
vcgencmd measure_temp             # resting in the cabinet: well under 60 °C is fine
```

Check it again after the Pi has been listening for an hour with the cabinet door closed. If it's
above 70 °C, connect the case fan or give the cabinet more air.

**Keep logs in memory.** Cutting power to the cabinet while the Pi is writing can corrupt the
card. Keeping the system log in RAM removes most writes:

```bash
# Pi
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=volatile\nRuntimeMaxUse=32M\n' | sudo tee /etc/systemd/journald.conf.d/now-spinning.conf
sudo systemctl restart systemd-journald
```

Logs then vanish at each reboot. That's the trade, and it's the right one here.

**Plug the Pi into an outlet that stays on,** not a switched strip that cuts with the
receiver. To turn it off on purpose, run `sudo poweroff` and wait for the green light to stop
flashing before pulling the plug.

---

## 6. Connect and set up the Blackjack

**On the Blackjack, before you plug anything in** (the spec's settings table):

| Control | Setting |
|---|---|
| Inputs 1 and 2: LINE / HI-Z | **LINE** (button out) |
| Inputs 1 and 2: GAIN | Fully anticlockwise (−15 dB), both the same |
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
sudo apt install -y alsa-utils sox
lsusb                              # a line naming Mackie or LOUD
arecord -l                         # "card N: <Name> [...]": note the short name before the bracket
sudo dmesg | grep -iE "over-current|undervolt"    # should print nothing
```

In the commands below, `<card>` is that short name, for example `Blackjack`. Using the name
rather than the number matters, because the number can change between boots.

---

## 7. Set the levels (Phase 0 check 1)

**On the AV7703** (once): Zone 2 Setup → Volume Level → **fixed**, at a middle value to start.
Then turn on Zone 2 with **Phono** as its source, from the front panel or the remote's zone
button. Put on the loudest record you own.

**Watch a live meter on the Pi:**

```bash
# Pi
arecord -D plughw:CARD=<card>,DEV=0 -f cd -V stereo /dev/null      # Ctrl-C to stop
```

- **Aim for peaks around −12 dBFS on the loudest passages:** the bars reach roughly a quarter of
  the scale, and never the end.
- The Blackjack's **SIG/OL lights must never turn red.** If they do, lower Zone 2's fixed level.
- **Too quiet?** Raise Zone 2's fixed level first. Turn the two GAIN knobs only if that isn't
  enough, and always by the same amount.
- **Write down the final Zone 2 level and the GAIN knob positions.** A bumped knob is the most
  likely reason recognition gets worse months from now.

**Record a sample and listen to it:**

```bash
# Pi
arecord -D plughw:CARD=<card>,DEV=0 -f cd -d 15 ~/level-test.wav
sox ~/level-test.wav -n stats 2>&1 | grep -E "Pk lev dB|RMS lev dB"
```

```bash
# Mac: copy it over and play it
scp <username>@now-spinning.local:level-test.wav ~/Desktop/
```

It should sound like the record, with no buzz or hum between tracks. If there's hum, move the
cable away from power cords. If one side is silent, check the L/R cables.

---

## 8. Test Shazam on your records (Phase 0 checks 2, 3 and 7)

**Install a test environment** (it is thrown away once the real listener exists):

```bash
# Pi
sudo apt install -y python3-venv
python3 -m venv ~/ns-test
~/ns-test/bin/pip install --upgrade pip shazamio
```

If `pip` starts compiling Rust code and fails, the `shazamio-core` package has no ready-made
build for the Pi's Python. Note it in the spec's revision history; it changes how Phase 4
installs things.

**A small test script:**

```bash
# Pi
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

asyncio.run(main(sys.argv[1]))
EOF
```

**Run it with a record playing:**

```bash
# Pi: record 10 seconds, then identify it
arecord -q -D plughw:CARD=<card>,DEV=0 -f cd -d 10 /tmp/clip.wav && ~/ns-test/bin/python ~/try-shazam.py /tmp/clip.wav
```

Repeat for **ten records**: an old pressing, a live album, an album with no gaps between tracks,
a 45, and something obscure. For each one, write down:
- whether it matched, and after how many tries
- **exactly** what Shazam called the artist and the title (the spec's lookup rules have to cope
  with these spellings)

| # | Record | Matched? | Shazam's artist | Shazam's title |
|---|---|---|---|---|
| 1 | | | | |

**Check 3 (run-out groove).** At the end of a side, leave the needle in the run-out groove for a
minute while the meter from step 7 runs. Note what the meter shows: the clicks may never drop
low enough to count as silence.

**Check 7 (what goes to Shazam).** Phase 4 confirms this from `shazamio`'s source code. Nothing
to do here.

---

## 9. The receiver over the network (Phase 0 check 6)

On the AV7703: Network → Network Control → **Always On**, so the receiver answers while in
standby. Find its IP address in its Network Information menu, or in the router's device list,
and give it a DHCP reservation too.

```bash
# Pi: ask the main zone which input it's on (expect "SIPHONO" while the turntable is selected)
printf 'SI?\r' | nc -w 2 <receiver-ip> 23
```

If that prints nothing while a control app (Home Assistant, the Marantz app) is connected, the
receiver accepts one telnet client at a time. Note it for check 6; the listener will use the
receiver's HTTP control instead.

---

## 10. Record the results

Add one line per check to the spec's **Revision History**, with the date: the Zone 2 level and
gain positions, the ten-record table, the run-out finding, and the answers to checks 4–6. That's
what Phase 4 is designed against.

Then delete the test files:

```bash
# Pi
rm -rf ~/ns-test ~/try-shazam.py ~/level-test.wav /tmp/clip.wav
```

---

## 11. Installing the listener (Phase 4)

*To be written when Phase 4 builds the listener.* It will cover cloning the repo, the
listener's Python environment, `/etc/now-spinning/env` (the Worker URL and the ingest token,
readable by root only), the `now-spinning` systemd service, updating with `git pull` and a
restart, and rotating the ingest token (also listed in [`SECRETS.md`](SECRETS.md)).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `now-spinning.local` not found | Name lookup on the network | Use the IP from the router |
| `Permission denied (publickey)` | The key on the card isn't the Mac's key | Reflash with the right public key, or plug a keyboard and screen into the Pi |
| `arecord -l` lists no Blackjack | Cable, or not enough USB power | Try the other black USB port; run step 5's power check |
| Recording is silent | Zone 2 off, or its source isn't Phono | Turn Zone 2 on and select Phono |
| SIG/OL lights red | Too much level | Lower Zone 2's fixed level |
| Hum between tracks | Cable near a power cord | Re-route it; keep it short |
| `get_throttled` isn't `0x0` | Under-voltage at some point | Use the kit's supply; check the cable is seated |
| Pi runs hot | Cooler fan not connected | Check the FAN plug; connect the case fan |
