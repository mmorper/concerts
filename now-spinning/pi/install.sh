#!/usr/bin/env bash
# Install or update the Now Spinning listener. Run as `pi` from a checkout of this folder:
#   sudo ./install.sh
# Safe to run again: an update re-copies the code and rebuilds the environment from uv.lock.
#
# What it does, and why (spec §Pi listener, "A shared Pi"):
# - code in /opt/now-spinning/app and its environment in /opt/now-spinning/venv, owned by root,
#   so the service can run them but never change them
# - the environment is built from the committed lock file with --frozen --no-build: nothing is
#   compiled and no package code runs as root during the install
# - the interpreter is the system's Python 3.13, which root owns; uv is a pinned, root-owned copy
# - /etc/now-spinning/env is created root-only from env.example, never overwritten
# It does NOT start the service the first time: fill in the token, then `systemctl enable --now`.

set -euo pipefail

UV_VERSION="0.11.32"
# sha256 of uv-aarch64-unknown-linux-gnu.tar.gz for that version, from the release page.
UV_SHA256="4d4fa08d95b06642e5800df6a22bd71455f23f988269e18da2847971d8c0bf31"
SRC="$(cd "$(dirname "$0")" && pwd)"
OPT=/opt/now-spinning
PY=/usr/bin/python3.13

[[ $EUID -eq 0 ]] || { echo "run with sudo"; exit 1; }
[[ -x $PY ]] || { echo "$PY not found"; exit 1; }
id now-spinning >/dev/null 2>&1 || { echo "the now-spinning user doesn't exist (NOW_SPINNING_OPERATIONS.md §3)"; exit 1; }
dpkg -s libportaudio2 >/dev/null 2>&1 || apt-get install -y libportaudio2

# A root-owned uv at a pinned version (spec: never the copy in the service's home).
if ! /usr/local/bin/uv --version 2>/dev/null | grep -q " $UV_VERSION "; then
  tmp=$(mktemp -d)
  curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-aarch64-unknown-linux-gnu.tar.gz" -o "$tmp/uv.tgz"
  echo "$UV_SHA256  $tmp/uv.tgz" | sha256sum -c - || { echo "uv download didn't match its checksum"; exit 1; }
  tar -xzf "$tmp/uv.tgz" -C "$tmp"
  install -o root -g root -m 0755 "$tmp/uv-aarch64-unknown-linux-gnu/uv" /usr/local/bin/uv
  rm -rf "$tmp"
fi

install -d -o root -g root -m 0755 "$OPT" "$OPT/app"
rm -rf "$OPT/app/now_spinning"
cp -r "$SRC/now_spinning" "$SRC/pyproject.toml" "$SRC/uv.lock" "$OPT/app/"
find "$OPT/app" -name __pycache__ -prune -exec rm -rf {} +
chown -R root:root "$OPT/app"
chmod -R u=rwX,go=rX "$OPT/app"

UV_PROJECT_ENVIRONMENT="$OPT/venv" UV_CACHE_DIR="$OPT/cache" UV_PYTHON="$PY" UV_PYTHON_DOWNLOADS=never \
  /usr/local/bin/uv sync --project "$OPT/app" --frozen --no-build --no-dev
chmod -R go-w "$OPT"

install -d -o root -g root -m 0700 /etc/now-spinning
if [[ ! -f /etc/now-spinning/env ]]; then
  install -o root -g root -m 0600 "$SRC/env.example" /etc/now-spinning/env
  echo "created /etc/now-spinning/env: fill in NS_INGEST_TOKEN, NS_APPLE_TV_ID and NS_TV_MAC (sudo nano /etc/now-spinning/env)"
fi

install -o root -g root -m 0644 "$SRC/now-spinning.service" /etc/systemd/system/now-spinning.service
systemctl daemon-reload
if systemctl is-enabled --quiet now-spinning; then
  systemctl restart now-spinning
  echo "updated and restarted"
else
  echo "installed, not started. Next: docs/NOW_SPINNING_OPERATIONS.md §12 steps 3-5 (settings, --check, then enable)"
fi
