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
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, List

from osxphotos import PhotoInfo

# Recorded for every asset. `overall` and `curation` are the only two ever ranked on — the
# rest ride along so the worksheet can show them and so a future probe need not re-query.
# See rank.ts for the measured face bias that rules the others out.
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
        "scores": {f: getattr(scores, f, None) for f in SCORE_FIELDS} if scores else None,
    }


def probe(photos: List[PhotoInfo]) -> List[PhotoInfo]:
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

    payload = {
        "window_from": params["window_from"],
        "window_to": params["window_to"],
        "coarse_scanned": len(photos),
        "excluded": excluded,
        "candidates": records,
    }

    out = os.environ.get("MEDIA_PREP_OUT")
    if not out:
        raise SystemExit("MEDIA_PREP_OUT is not set — media:prep must provide it.")
    Path(out).write_text(json.dumps(payload, indent=2))

    # Return nothing. This is a reader; osxphotos must not act on these photos.
    return []
