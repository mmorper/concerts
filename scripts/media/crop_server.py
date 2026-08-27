#!/usr/bin/env python3
"""Serve the crop page and persist each box the moment it is set.

    MEDIA_CROP_DATE=2026-06-04 python3 scripts/media/crop_server.py

WHY THIS IS NOT THE REVIEW PAGE. Re-opening `media:review` to add a crop costs a full
Photos read and a permission prompt per show, surfaces every rejected asset alongside the
kept ones, and — the part that actually matters — crops a Photos PREVIEW rather than the
published JPEG the renderer will crop. Those are different files. A box drawn on one does
not reliably transfer to the other.

So this reads `media-index.json` and serves the committed files from `public/images/shows/`
directly. No library access, no prompt, opens instantly, and the pixels on screen are the
pixels that get cropped.

WRITES TO TWO PLACES, DELIBERATELY. `media-index.json` is what the renderer reads;
`data/media-decisions.json` is what survives a re-derivation. Writing only the index would
mean a rebuild silently loses every crop.
"""
import http.server
import json
import os
import socketserver
import sys
import threading
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "public" / "data" / "media-index.json"
DECISIONS = ROOT / "data" / "media-decisions.json"
SHOWS = ROOT / "public" / "images" / "shows"
PAGE = Path(__file__).resolve().parent / "crop-page.html"
PORT = int(os.environ.get("MEDIA_CROP_PORT", "8788"))
ONLY = os.environ.get("MEDIA_CROP_DATE") or None


def load(p: Path) -> dict:
    return json.loads(p.read_text()) if p.exists() else {}


def stills() -> list[dict]:
    """Published stills, newest show first, in the order they were ingested."""
    idx = load(INDEX)
    out = []
    for a in idx.get("assets", []):
        if a.get("kind") != "image" or not a.get("url"):
            continue
        if ONLY and a.get("date") != ONLY:
            continue
        out.append({
            "url": a["url"], "date": a["date"], "artist": a.get("artist"),
            "subject": a.get("subject"), "hero": bool(a.get("hero")),
            "crop": a.get("crop"), "w": a.get("width"), "h": a.get("height"),
        })
    out.sort(key=lambda x: (x["date"], x["url"]), reverse=True)
    return out


def apply_crop(url: str, crop: dict | None) -> str:
    """Write the box to the index, and to the decision record when one can be identified.

    Returns a short note about where it landed, so the caller can be honest on screen rather
    than implying both files were written.
    """
    idx = load(INDEX)
    target = None
    for a in idx.get("assets", []):
        if a.get("url") == url:
            if crop:
                a["crop"] = crop
            else:
                # Remove the key rather than writing `"crop": null`. A cleared crop is an
                # absent one; recording it as an explicit null leaves a permanent smear of
                # nulls across every asset anyone ever cleared.
                a.pop("crop", None)
            target = a
            break
    if target is None:
        return "unknown url"
    INDEX.write_text(json.dumps(idx, indent=2) + "\n")

    # ── The decision record, ONLY when the asset owns the key ────────────────────────
    #
    # decisions are keyed by Photos UUID. A still exported straight from the library has
    # one. A still CUT FROM A CLIP does not: its `derivedFrom.original` is the CLIP's uuid,
    # and the clip's decision record is the decision to MINE it, not a judgement about this
    # particular frame — whose own record is keyed `frame:<clip>:<n>`.
    #
    # Writing through `derivedFrom.original` was the first attempt and is wrong twice over:
    # it attaches a still's framing to a clip, and when two stills come from ONE clip — as
    # -03 and -04 do from 3D0337AF — the second silently overwrites the first. There is no
    # mapping from `derivedFrom.frame` (a timecode) back to the page ordinal in the key, so
    # the honest move is not to guess.
    #
    # media-index.json is tracked and committed, so a derived still's crop is durable there
    # regardless; what it misses is only the re-derivation path, which for a derived still
    # runs through selects.json anyway.
    uuid = target.get("uuid")
    if not uuid:
        return "index only (derived still — no decision key of its own)"
    dec = load(DECISIONS)
    show = dec.get("shows", {}).get(target["date"])
    if not show or uuid not in show.get("decisions", {}):
        return "index only (no decision record)"
    if crop:
        show["decisions"][uuid]["crop"] = crop
    else:
        show["decisions"][uuid].pop("crop", None)
    DECISIONS.write_text(json.dumps(dec, indent=2) + "\n")
    return "index + decisions"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        # Serve from `public/`, not the repo root: media-index urls are site-relative
        # (`/images/shows/…`) and are what the site itself serves. Rooting anywhere else
        # makes every published file 404 while /assets keeps working, which reads as an
        # empty page rather than a path bug.
        super().__init__(*a, directory=str(ROOT / "public"), **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            body = PAGE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/assets":
            body = json.dumps({"assets": stills(), "date": ONLY}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # Everything else is a real file under the repo root — the published JPEGs.
        return super().do_GET()

    def do_POST(self):
        if self.path != "/crop":
            self.send_response(404)
            self.end_headers()
            return
        n = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(n) or b"{}")
        where = apply_crop(payload.get("url", ""), payload.get("crop"))
        body = json.dumps({"saved": where}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _die_with_parent() -> None:
    """Exit when whoever started us is gone — same rule as review_server.py.

    An orphan holds the port and the next run cannot bind. Signals do not survive the npm
    and tsx wrappers reliably, so this checks from its own side and needs no cooperation.
    """
    original = os.getppid()
    while True:
        time.sleep(1)
        if os.getppid() != original:
            os._exit(0)


if __name__ == "__main__":
    if not INDEX.exists():
        sys.exit(f"No media-index.json at {INDEX}. Ingest a show first.")
    threading.Thread(target=_die_with_parent, daemon=True).start()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as srv:
        print(f"crop → http://127.0.0.1:{PORT}/")
        srv.serve_forever()
