# Morperhaus Concert Archives - Memory

## Venue Photo Bug (Recurring)

**Symptom:** All venue images disappear from map popups after every data refresh.

**Root cause:** Google Places API v1 photo resource names (`places/{placeId}/photos/{ref}`) are perishable — Google rotates them, and when it does the name and every CDN URL previously minted from it die together. A rotated name returns `400 INVALID_ARGUMENT: The photo resource in the request is invalid`; the orphaned `lh3.googleusercontent.com` URL returns 403.

**Fix applied (2026-03-07):**

- `scripts/utils/google-places-client.ts`: Replaced `getPhotoUrl()` (sync, builds expiring URL) with `fetchPhotoUri()` (async, calls the media endpoint with `skipHttpRedirect=true` to resolve to an `lh3.googleusercontent.com` CDN URL at refresh time).
- `scripts/enrich-venues.ts`: Uses `fetchPhotoUri()` with auto-retry on 400 (force-refreshes place details from the API to get fresh photo names, then resolves again).

**Fix applied (2026-08-22, #315) — the 2026-03-07 fix was not enough.** It resolved names to CDN URLs but left the *names* pinned in a 90-day cache. When Google rotated the `AWCwyd…` generation to `AVoNoX…` around 2026-08-10, 65 of 67 venue photos died and the cache kept serving the dead names until October.

- **Split cache TTL:** identity 90 days (`expiresAt`), photo list 7 days (`photosExpireAt`). A photo-only refresh re-runs Place Details against the cached place ID and skips the Text Search.
- **One photo call per candidate, not three.** The three stored sizes share one base URL; the 800px and 400px variants are derived by rewriting the `-h{px}` suffix. Verified byte-identical to what separate API calls return.
- **Retry with backoff on 429/5xx**, honouring `Retry-After`. A throttled venue keeps its previous photo (re-HEAD-checked first) instead of being downgraded to a placeholder.
- **`build-data.ts` streams subprocess output.** It used `promisify(exec)` and never printed the buffer, so the venue step was silent in CI — the reason this went twelve days unnoticed.

**Key files:**

- `scripts/utils/google-places-client.ts` — `fetchPhotoUri()` function
- `scripts/enrich-venues.ts` — photo URL generation logic
- `public/data/venues-metadata.json` — `photoUrls.thumbnail/medium/large` fields
- `public/data/venue-photos-cache.json` — Places API cache: 90-day identity TTL, 7-day photo TTL (#315)

**To fix manually when broken:** Run `npm run enrich-venues`

---

## iTunes Audio Previews (v4.3.1+)

**Architecture:** iTunes-only. Deezer was dropped because its CDN signed tokens (`hdnea=exp=<unix>`) expire within ~15 minutes — incompatible with a static data pipeline.

**Key files:**
- `scripts/enrich-top-tracks.ts` — enrichment script; 30-day cache TTL; `SEARCH_ALIASES` + `ARTIST_ID_OVERRIDES` for disambiguation
- `scripts/utils/itunes-client.ts` — `getTopTracks()` (search by name) + `getTopTracksByArtistId()` (lookup by ID); 3-retry exponential backoff for 429s
- `scripts/build-data.ts` — Step 5, `--skip-tracks` flag to bypass
- `src/hooks/useArtistTopTracks.ts` — loads `public/data/artists-top-tracks.json`

**iTunes search disambiguation:**

Some concert names don't match Apple Music. Two override mechanisms in `enrich-top-tracks.ts`:

1. `SEARCH_ALIASES` — maps concert name → search term (for name mismatches)
   - `"Brian Setzer \u201968 Comeback Special"` → `"Brian Setzer"` (note: U+2019 curly apostrophe in data)
   - `"Brian Setzer and the Nashvillians"` → `"Brian Setzer"`

2. `ARTIST_ID_OVERRIDES` — maps concert name → iTunes artist ID (for ambiguous searches)
   - `"The Roots"` → `43680` (searches "roots" return unrelated songs; ID lookup is exact)
   - Artist IDs come from `music.apple.com/us/artist/<slug>/<ID>` URLs

**Key rules:**
- iTunes CDN URLs don't expire — 30-day TTL is safe
- When searching returns wrong/unrelated results, use artist ID lookup instead of search aliases
- The apostrophe in artist names from `concerts.json` may be U+2019 (curly), not U+0027 (straight) — check with `python3 -c "print(repr(name))"` before adding alias keys

---

## Safari Audio Playback Bug (Recurring)

**Symptom:** Clicking play on tracks in the gatefold does nothing in Safari. Controls are visible but unresponsive.

**Root cause:** Two compounding issues in [AudioPreviewPlayer.tsx](src/components/scenes/ArtistScene/AudioPreviewPlayer.tsx):

1. `preload="metadata"` causes Safari to pre-fetch, putting the audio element in a state where `play()` gets blocked
2. `audio.load()` after setting `audio.src` is redundant (spec says src change triggers reset automatically) and breaks Safari's user gesture chain — Safari considers the gesture "consumed" before `play()` is reached

**Fix:** In `playTrack()` when loading a new track:

- Do NOT call `audio.load()` — setting `audio.src` is sufficient
- Keep `preload="none"` on the `<audio>` element

**Regression history:**

- `57914b6` — Original: `preload="metadata"` + `audio.load()` — broken in Safari
- `fcae25d` — Changed `preload="none"` — fixed
- `afb95a7` — Incidentally reverted `preload` back to `"metadata"` in a broad polish commit — broken again
- `885cce2`+ — Removed `audio.load()` + restored `preload="none"` — fixed

**Key rule:** Never change `preload` on the `<audio>` element in AudioPreviewPlayer without understanding why it is `"none"`. Never add `audio.load()` before `audio.play()` — it is not needed and breaks Safari.
