"""The Pi installs with --no-build, so every locked package needs a ready-made wheel for it:
Linux on 64-bit ARM (aarch64), CPython 3.13, or a pure-Python wheel. CI runs on x86 and can't
notice a package that only builds from source on ARM; this does, before it reaches the Pi."""

import tomllib
from pathlib import Path

LOCK = Path(__file__).resolve().parent.parent / "uv.lock"


def fits_the_pi(wheel: str) -> bool:
    if wheel.endswith("-none-any.whl"):
        return True
    if "musllinux" in wheel or "aarch64" not in wheel:
        return False
    return "-cp313-" in wheel or "-abi3-" in wheel


def test_every_locked_package_has_a_wheel_for_the_pi():
    lock = tomllib.loads(LOCK.read_text())
    missing = []
    for pkg in lock["package"]:
        src = pkg.get("source", {})
        if "virtual" in src or "editable" in src:
            continue  # the project itself
        wheels = [w["url"].rsplit("/", 1)[1] for w in pkg.get("wheels", [])]
        if not any(fits_the_pi(w) for w in wheels):
            missing.append(f"{pkg['name']} {pkg['version']}")
    assert not missing, f"no aarch64/cp313 wheel: {missing}"


def test_srptools_stays_below_2():
    lock = tomllib.loads(LOCK.read_text())
    (srp,) = [p for p in lock["package"] if p["name"] == "srptools"]
    assert int(srp["version"].split(".")[0]) < 2
