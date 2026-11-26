"""The receiver client, against a fake receiver speaking its telnet protocol over a real socket.

The replies are the ones Phase 0 recorded from the AV7703 (#688), including the unprompted
status lines it streams while the Marantz app is connected.
"""

import asyncio

from now_spinning.receiver import Receiver, parse, split_lines

# What the AV7703 actually sent (check 6b, receiver on, Phono, Zone 2 on at 60).
REAL = b"PWON\rZMON\rSIPHONO\rSVON\rSVMPLAY\rZ2ON\rZ2PHONO\rZ260\rSVON\rSVMPLAY\rZ2SLPOFF\rTFHDCMP\rTPHD01\r"
# The stream another controller causes (check 6), between the answers.
NOISE = b"SSINFSIGRES I --- \rSSAUDSTS 2202222012000000\rOPSTS 0000000000000000000000222220\rMV45\rCVFL 50\r"


def test_parse_the_real_reply():
    st = parse(split_lines(REAL))
    assert st and st.power_on and st.main_on and st.main_on_phono
    assert st.zone2_on and st.zone2_source == "PHONO"


def test_parse_ignores_the_noise_and_zone2_volume_mute_sleep():
    st = parse(split_lines(NOISE + REAL + b"Z2MUOFF\r"))
    assert st and st.zone2_source == "PHONO"


def test_standby_still_reports_phono_but_main_is_off():
    st = parse(split_lines(b"PWSTANDBY\rZMOFF\rSIPHONO\rZ2OFF\rZ2PHONO\r"))
    assert st and st.standby and not st.main_on_phono and st.source == "PHONO"


def test_a_partial_reply_is_none():
    assert parse(split_lines(b"PWON\rSIPHONO\r")) is None


class FakeAV:
    """Answers queries from its state, applies commands, and streams noise like the real one."""

    def __init__(self) -> None:
        self.state = {"PW": "PWSTANDBY", "ZM": "ZMOFF", "SI": "SIPHONO", "Z2": "Z2OFF", "Z2S": "Z2PHONO"}
        self.received: list[str] = []

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        writer.write(NOISE)
        buf = b""
        try:
            while chunk := await reader.read(256):
                buf += chunk
                while b"\r" in buf:
                    line, buf = buf.split(b"\r", 1)
                    cmd = line.decode()
                    self.received.append(cmd)
                    writer.write(self.answer(cmd) + NOISE)
                    await writer.drain()
        finally:
            writer.close()

    def answer(self, cmd: str) -> bytes:
        s = self.state
        if cmd == "PW?":
            return f"{s['PW']}\r".encode()
        if cmd == "ZM?":
            return f"{s['ZM']}\r".encode()
        if cmd == "SI?":
            return f"{s['SI']}\r".encode()
        if cmd == "Z2?":
            return f"{s['Z2']}\r{s['Z2S']}\rZ260\r".encode()
        if cmd == "ZMON":
            s.update(PW="PWON", ZM="ZMON")
        elif cmd == "PWSTANDBY":
            s.update(PW="PWSTANDBY", ZM="ZMOFF", Z2="Z2OFF")
        elif cmd.startswith("SI"):
            if s["PW"] == "PWON":  # in standby the input doesn't change (Phase 0)
                s["SI"] = cmd
        elif cmd == "Z2ON":
            s.update(PW="PWON", Z2="Z2ON")
            return b""  # sometimes no reply at all
        elif cmd == "Z2OFF":
            s["Z2"] = "Z2OFF"
        elif cmd.startswith("Z2"):
            s["Z2S"] = cmd
        return b""


def test_against_the_fake_receiver():
    async def go():
        av = FakeAV()
        server = await asyncio.start_server(av.handle, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        rx = Receiver("127.0.0.1", port, reply_window_s=0.3)
        try:
            st = await rx.status()
            assert st and st.standby and st.source == "PHONO"

            await rx.send("SIMPLAY", gap_s=0)  # ignored in standby
            assert (await rx.status()).source == "PHONO"

            await rx.send("ZMON", "SIMPLAY", "PWSTANDBY", gap_s=0.01)  # the standby return
            st = await rx.status()
            assert st.standby and st.source == "MPLAY"

            await rx.send("ZMON", "SIPHONO", "Z2ON", "Z2PHONO", gap_s=0.01)
            st = await rx.status()
            assert st.main_on_phono and st.zone2_on and st.zone2_source == "PHONO"
        finally:
            server.close()
            await server.wait_closed()

    asyncio.run(go())


def test_an_unreachable_receiver_raises_oserror():
    async def go():
        rx = Receiver("127.0.0.1", 1, reply_window_s=0.1)
        try:
            await rx.status()
        except OSError:
            return True
        return False

    assert asyncio.run(go())
