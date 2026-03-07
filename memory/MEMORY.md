# Morperhaus Concert Archives - Memory

## Venue Photo Bug (Recurring)

**Symptom:** All venue images disappear from map popups after every data refresh.

**Root cause:** Google Places API v1 photo resource names (`places/{placeId}/photos/{ref}`) expire within days of being fetched. The old pipeline stored these as direct image URLs (`places.googleapis.com/v1/.../media?key=...`), which became invalid returning `400 INVALID_ARGUMENT: The photo resource in the request is invalid`.

**Fix applied (2026-03-07):**

- `scripts/utils/google-places-client.ts`: Replaced `getPhotoUrl()` (sync, builds expiring URL) with `fetchPhotoUri()` (async, calls the media endpoint with `skipHttpRedirect=true` to resolve to a stable `lh3.googleusercontent.com` CDN URL at refresh time).
- `scripts/enrich-venues.ts`: Uses `fetchPhotoUri()` with auto-retry on 400 (force-refreshes place details from the API to get fresh photo names, then resolves again).

**Key files:**

- `scripts/utils/google-places-client.ts` — `fetchPhotoUri()` function
- `scripts/enrich-venues.ts` — photo URL generation logic
- `public/data/venues-metadata.json` — `photoUrls.thumbnail/medium/large` fields
- `public/data/venue-photos-cache.json` — 90-day Places API cache (photo names inside expire faster)

**To fix manually when broken:** Run `npm run enrich-venues`

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
