#!/usr/bin/env python3
"""Serve the media review page from localhost and persist every verdict as it is made.

    REVIEW_DIR=concert-photos-audit/review/2026-06-04 python3 scripts/media/review_server.py

Localhost rather than `file://` because a file:// page cannot write anywhere — which is
what left the original mock's export modal promising a file write that no button
performed. Every keystroke lands on disk immediately, so an interrupted review resumes
exactly where it stopped.

Read-only with respect to the Photos library: it serves previews that `media:review`
already exported and writes only `verdicts.json` inside the run directory.
"""
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import urllib.parse
from pathlib import Path

RUN = Path(os.environ.get("REVIEW_DIR", "")).resolve()
VERDICTS = RUN / "verdicts.json"
PORT = int(os.environ.get("REVIEW_PORT", "8787"))


def load() -> dict:
    return json.loads(VERDICTS.read_text()) if VERDICTS.exists() else {}


def save(d: dict) -> None:
    VERDICTS.write_text(json.dumps(d, indent=2, sort_keys=True) + "\n")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(RUN), **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/open"):
            # Deep-link into Photos.app for the asset under review.
            #
            # There is NO public URL for an iCloud asset — iCloud.com needs a session and
            # hands out short-lived signed URLs, nothing bookmarkable. But macOS has a
            # local scheme, `photos://asset/<UUID>`, which opens Photos on that exact item.
            # For video that is worth more than a public link would be: full playback and
            # scrubbing in the app that does it best, one click from the review page, with
            # no download and no hunting for a filename.
            #
            # Opened server-side rather than as an <a href> so the browser never has to be
            # asked whether it may hand a custom scheme to the OS.
            q = urllib.parse.urlparse(self.path).query
            uuid = urllib.parse.parse_qs(q).get("uuid", [""])[0]
            # Strict: this string reaches `open`, so it must be a UUID and nothing else.
            ok = bool(re.fullmatch(r"[0-9A-Fa-f-]{36}", uuid))
            if ok:
                subprocess.run(["open", f"photos://asset/{uuid}"], check=False)
            self.send_response(204 if ok else 400)
            self.end_headers()
            return
        if self.path.startswith("/verdicts"):
            body = json.dumps(load()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(n) or b"{}")
        d = load()
        if self.path.startswith("/verdict"):
            uuid = payload.get("uuid")
            if uuid:
                record = {k: v for k, v in payload.items() if k != "uuid" and v is not None}
                if record:
                    # REPLACE, never merge. The page always posts its full current state,
                    # and merging meant a cleared field never cleared: flip a keeper to
                    # reject and the client drops `subject`, but an .update() left the old
                    # value behind — a rejected frame keeping an attribution it no longer
                    # has. Replacing makes deletion work.
                    d[uuid] = record
                else:
                    d.pop(uuid, None)
                save(d)
        elif self.path.startswith("/calibration"):
            d["__calibration__"] = payload
            save(d)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    if not RUN.is_dir():
        sys.exit(f"REVIEW_DIR is not a directory: {RUN}\nRun `npm run media:review <date>` first.")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as srv:
        print(f"review → http://127.0.0.1:{PORT}/index.html")
        print(f"verdicts → {VERDICTS}")
        srv.serve_forever()
