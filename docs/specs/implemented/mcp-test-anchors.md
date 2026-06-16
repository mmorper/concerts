# MCP Test Anchors

Recorded by W1 ([#104](https://github.com/mmorper/concerts/issues/104)) for use by W3 ([#106](https://github.com/mmorper/concerts/issues/106)) tool tests. Re-derive from `public/data/*.json` if the data shifts substantially.

**Snapshot:** 2026-05-17 (data computedAt 2026-05-12)

## Fact-table anchors (from `facts.json`)

| Anchor | Value | Source fact `id` |
|---|---|---|
| Most-seen artist | **Social Distortion** (8 concerts, 1990–2024) | `top-artist` |
| Most-visited venue | **Pacific Amphitheatre** (17 shows, 1985–2026) | `top-venue` |
| Total concerts | 182 | `total-concerts` |

## `surprise_me` setlist anchor (from `setlists-cache.json`)

- **`concertId`: `concert-1`** — Adam Ant @ Irvine Meadows, 1984-04-27
- Cache entry shape: `{ concertId, artistName, date, venue, city, setlist: {...}, fetchedAt }`
- Cache wrapper: `{ version: "1.0.0", generatedAt, entries: { [concertId]: {...} } }` — 368 cached concerts

Any `concertId` from `concert-1`…`concert-N` that appears in `entries` works. Prefer `concert-1` since the artist (Adam Ant) is unambiguous and the venue (Irvine Meadows, demolished 2016) makes for a good demo of cross-referencing closed venues.

## `on_this_day` anchors (from `concerts.json` date frequency)

| Anchor | `MM-DD` | Concert count |
|---|---|---|
| Hit (multi-show) | **`06-04`** | 4 concerts |
| Hit (multi-show, runner-up) | `11-16` | 4 concerts |
| Zero-result | **`01-02`** | 0 concerts |

`01-02` is a verified empty slot in the archive; safe to lock in for the zero-result test until the data refreshes (any new Jan-2 show would land here and break the assertion).

## Ambiguous artist partial-match (for fuzzy/disambiguation tests)

| Query | Matches |
|---|---|
| `Peter` | `Peter Gabriel`, `Peter Hook and the Light` |
| `Peter Hook` | `Peter Hook and the Light` (unique → narrow match) |

The `Peter` query is the disambiguation case (multiple matches). `Peter Hook` exercises the "user typed the artist's name but the headliner is the full project name" pattern flagged in the spec.

Single-match (no ambiguity) sanity anchors: `John` → `Elton John`; `David` → `David Byrne`.

---

## `venues-metadata.json` field inventory (W1 §6 deliverable for `get_venue_history`)

Inventory across all 78 venues; populated counts are out of 78 unless noted.

### Narration-useful, always populated

| Field | Population | Notes |
|---|---|---|
| `name` | 78/78 | Display name |
| `city`, `state`, `cityState` | 78/78 | All three present; `cityState` is precomposed |
| `location.lat`/`lng` | 78/78 | Suitable for map narration ("X miles from Y") if W3 wants it |
| `status` | 78/78 | Enum: `active`, `closed`, `demolished`, `renamed` |
| `stats.totalConcerts`, `firstEvent`, `lastEvent`, `uniqueArtists` | 78/78 | Per-venue rollups; ready for narration |
| `concerts[]` | 78/78 | Per-venue list of `{id, date, headliner}`, sorted chronologically |

### Narration-useful, sometimes populated

| Field | Population | Notes |
|---|---|---|
| `notes` | 12/78 | Free-text closure context; goldmine when present (e.g., `"Demolished for SoFi Stadium development"`). Empty/null for active venues, common for closed/demolished ones. |
| `closedDate` | 10/78 | ISO date; pairs with `status: closed/demolished/renamed` |
| `photoUrls.{thumbnail,medium,large}` | 66/78 real | Remaining 12 are `/images/venues/fallback.jpg` |

### **Not present in the schema** (W3 narration must not assume these)

- `capacity` — **not modeled**. If narration needs venue size, MCP would have to derive it elsewhere or omit it.
- `neighborhood` — **not modeled**. Only city-granularity location.
- `description` — **not modeled**. The closest field is `notes`, which only exists for ~15% of venues.

### Recommended narration template for `get_venue_history`

Compose from: `name` + `cityState` + `stats.totalConcerts` + `stats.firstEvent`–`stats.lastEvent` + (if `status !== 'active'`) `status` + (if `closedDate`) `closedDate` + (if `notes`) `notes` + a sampled-3 from `concerts[]` by headliner.

Example assembled prose for `irvine-meadows`:

> Irvine Meadows in Irvine, California hosted 16 shows between 1984 and 2003 — including Adam Ant, Depeche Mode, and Peter Gabriel. The venue was demolished on 2016-10-30 for residential development.
