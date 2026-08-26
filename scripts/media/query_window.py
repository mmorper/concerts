"""Read one show's window out of the Photos library, and report what it excluded.

Called by `media:prep` as an osxphotos query function:

    bin/osxphotos query --from-date .. --to-date .. \
        --query-function scripts/media/query_window.py::probe --quiet

osxphotos hands over a list of PhotoInfo objects and expects a filtered list back. This
function returns an EMPTY list on purpose — it is a reader, not a filter. Returning
nothing means osxphotos prints nothing and, critically, that no downstream osxphotos
action can ever be handed a photo by this code path.

The whole file is read-only. Nothing here writes to, tags, or reorganises the library.

Parameters arrive as JSON at $MEDIA_PREP_PARAMS; the payload is written to
$MEDIA_PREP_OUT. Environment rather than argv because osxphotos owns the command line.

WHY THE WINDOW IS RE-TESTED HERE
The --from-date/--to-date pair on the command line is a COARSE pre-filter, widened by a
day on each side. The authoritative test is the naive-local comparison below, which is
what every probe in this project has used: Photos stores naive local time, so a Los
Angeles show and a DC show fall in the same local window with no timezone arithmetic.
Trusting the CLI filter instead would make the window silently timezone-dependent.

WHAT THIS DOES NOT DO
It does not decide whether an asset is a concert photograph. The window is a DATE filter,
not a concert filter — 17:00->04:00 catches the whole evening, and of 66 Beck-window
frames on 2018-04-27 none were of the show; they were a wedding. Discrimination happens in
scripts/media/rank.ts, where it can be unit-tested. This file reports facts and counts.
"""
from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, List

from osxphotos import PhotoInfo

# Recorded for every asset. `overall` and `curation` are the only two ever ranked on — the
# rest ride along so the worksheet can show them and so a future probe need not re-query.
# See rank.ts for the measured face bias that rules the others out.
# Where to stage previews, when the caller wants them. `media:prep` does not, and leaves
# this unset — it produces a worksheet that points at Photos, not a page of images.
_img = os.environ.get("MEDIA_REVIEW_IMG_DIR")
IMG_DIR = Path(_img) if _img else None
if IMG_DIR is not None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)

SCORE_FIELDS = [
    "overall",
    "curation",
    "low_light",
    "sharply_focused_subject",
    "well_framed_subject",
    "pleasant_lighting",
    "interesting_subject",
    "pleasant_composition",
]


def _params() -> dict[str, Any]:
    path = os.environ.get("MEDIA_PREP_PARAMS")
    if not path:
        raise SystemExit("MEDIA_PREP_PARAMS is not set — media:prep must provide it.")
    return json.loads(Path(path).read_text())


def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None)


def _record(p: PhotoInfo, local: datetime) -> dict[str, Any]:
    scores = getattr(p, "score", None)
    width, height = int(p.width or 0), int(p.height or 0)

    # Duration lives on exif_info, NOT on PhotoInfo — `p.duration` does not exist, and
    # reading it returns nothing rather than raising. Verified against the library.
    duration = None
    exif = getattr(p, "exif_info", None)
    if exif is not None:
        duration = getattr(exif, "duration", None)

    # Photos' own preview JPEG, copied out of the library HERE rather than by the caller.
    #
    # THE COPY HAS TO HAPPEN IN THIS PROCESS. macOS grants Full Disk Access to the
    # osxphotos binary, not to node — so node reading a path inside the library gets EPERM.
    # That is the whole reason the binary is built locally and TCC-scoped to it.
    #
    # This replaces `osxphotos export --preview`, which has no way to write ONLY the
    # preview: it exports the original alongside it. On one show that was 550MB of
    # unwanted originals against 33MB of previews, and it leaves an export database that
    # makes the next run stop and ask for confirmation.
    #
    # Derivatives are LOCAL even when the original is in iCloud — verified on iCloud-only
    # assets — so nothing downloads. Largest wins: the list holds a full-size preview, a
    # thumbnail, and a master thumbnail.
    #
    # Read-only. Files are copied OUT; nothing in the library is written.
    preview_file = None
    if IMG_DIR is not None:
        try:
            derivatives = [d for d in (getattr(p, "path_derivatives", None) or []) if os.path.exists(d)]
            if derivatives:
                src = max(derivatives, key=os.path.getsize)
                preview_file = f"{p.uuid.upper()}_pv.jpeg"
                shutil.copyfile(src, IMG_DIR / preview_file)
        except Exception:
            preview_file = None

    # A PlaceInfo, not a string. `.name` is the reverse-geocoded description.
    place = getattr(p, "place", None)
    place_name = getattr(place, "name", None) if place is not None else None

    return {
        "uuid": p.uuid,
        "original_filename": p.original_filename or p.filename or "",
        "local_time": local.strftime("%Y-%m-%dT%H:%M:%S"),
        "hour": local.hour,
        "is_movie": bool(p.ismovie),
        "live_photo": bool(getattr(p, "live_photo", False)),
        "duration": round(float(duration), 2) if duration is not None else None,
        "width": width,
        "height": height,
        "keywords": list(p.keywords or []),
        "labels": list(getattr(p, "labels", []) or []),
        "persons": [x for x in (p.persons or []) if x != "_UNKNOWN_"],
        "place": place_name,
        "latitude": p.latitude,
        "longitude": p.longitude,
        # Whose camera. 73% coverage; {Mike Morper: 454, Dori Morper: 116} across the
        # concert windows, and the archive speaks in the first person, so it matters.
        "contributors": list(getattr(p, "share_participants", []) or []),
        "favorite": bool(p.favorite),
        "in_cloud": bool(p.incloud),
        "is_missing": bool(p.ismissing),
        "preview_file": preview_file,
        "scores": {f: getattr(scores, f, None) for f in SCORE_FIELDS} if scores else None,
    }


def _write(payload: dict[str, Any]) -> List[PhotoInfo]:
    out = os.environ.get("MEDIA_PREP_OUT")
    if not out:
        raise SystemExit("MEDIA_PREP_OUT is not set — the caller must provide it.")
    Path(out).write_text(json.dumps(payload, indent=2))
    # Return nothing. This is a reader; osxphotos must not act on these photos.
    return []


def probe(photos: List[PhotoInfo]) -> List[PhotoInfo]:
    """One show. Called by `media:prep` and `media:review` with a single window."""
    params = _params()
    start = datetime.strptime(params["window_from"], "%Y-%m-%dT%H:%M:%S")
    end = datetime.strptime(params["window_to"], "%Y-%m-%dT%H:%M:%S")

    records: list[dict[str, Any]] = []
    excluded = {"no_date": 0, "outside_window": 0}

    for p in photos:
        if not p.date:
            excluded["no_date"] += 1
            continue
        local = _naive(p.date)
        if not (start <= local <= end):
            excluded["outside_window"] += 1
            continue
        records.append(_record(p, local))

    records.sort(key=lambda r: r["local_time"])

    return _write({
        "window_from": params["window_from"],
        "window_to": params["window_to"],
        "coarse_scanned": len(photos),
        "excluded": excluded,
        "candidates": records,
    })


def corpus(photos: List[PhotoInfo]) -> List[PhotoInfo]:
    """Every show, in ONE library pass. Called by `media:audit` (#381).

    WHY NOT JUST LOOP `probe` 184 TIMES. osxphotos reads and materialises the library on
    every invocation regardless of --from-date, so the coarse range narrows the RESULT, not
    the work. Paying that 184 times is the difference between one slow command and an
    afternoon. This walks the library once and buckets each asset into whichever show
    window contains it.

    NO PREVIEWS HERE. `_record` copies a preview only when MEDIA_REVIEW_IMG_DIR is set, and
    the audit deliberately leaves it unset: this is a census, and staging thousands of
    JPEGs to count them would be the expensive half of a step whose whole purpose is to say
    where to look next. Previews are the review page's job, one show at a time.

    Windows cannot overlap — they are 17:00->04:00 on distinct dates — but two shows on
    consecutive nights share a boundary hour. First match wins and the count of any second
    match is reported rather than silently dropped, because a silent drop here is exactly
    the class of bug that made the date window look like a concert filter for a session.
    """
    params = _params()
    windows = [
        (
            w["date"],
            datetime.strptime(w["from"], "%Y-%m-%dT%H:%M:%S"),
            datetime.strptime(w["to"], "%Y-%m-%dT%H:%M:%S"),
        )
        for w in params["windows"]
    ]
    # Sorted so the bucket search can stop early on a long library.
    windows.sort(key=lambda w: w[1])

    shows: dict[str, list[dict[str, Any]]] = {d: [] for d, _, _ in windows}
    excluded = {"no_date": 0, "outside_all_windows": 0}
    ambiguous = 0

    for p in photos:
        if not p.date:
            excluded["no_date"] += 1
            continue
        local = _naive(p.date)
        hits = [d for d, start, end in windows if start <= local <= end]
        if not hits:
            excluded["outside_all_windows"] += 1
            continue
        if len(hits) > 1:
            ambiguous += 1
        shows[hits[0]].append(_record(p, local))

    for records in shows.values():
        records.sort(key=lambda r: r["local_time"])

    return _write({
        "windows": len(windows),
        "scanned": len(photos),
        "excluded": excluded,
        "ambiguous": ambiguous,
        "shows": shows,
    })
