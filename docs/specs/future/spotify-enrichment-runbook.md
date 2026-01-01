# Spotify Data Enrichment Runbook

> **Role**: Technical instructions for running the Spotify enrichment script
> **Feature Spec**: See [spotify-artist-integration.md](./spotify-artist-integration.md) for full feature requirements
> **Status**: Ready to use once Spotify API credentials are configured

---

## Overview

This document covers the *how* of Spotify data enrichment—getting API credentials, running the script, handling mismatches. For the *what* (feature requirements, UI specs, implementation checklist), see the [Spotify Artist Integration Spec](./spotify-artist-integration.md).

---

## Quick Start (When API Access Available)

### 1. Create Spotify Developer App

1. Go to https://developer.spotify.com/dashboard
2. Click "Create app"
3. Fill in details:
   - **App name:** Morperhaus Concerts
   - **App description:** Personal concert history tracker with album art integration
   - **Redirect URI:** `http://localhost:5173` (or your app URL)
   - **Which API/SDKs are you planning to use?** Web API
4. Click "Save"
5. Go to "Settings" and copy your **Client ID** and **Client Secret**

### 2. Add Credentials to `.env`

Create or update `/Users/mmorper/projects/concerts/.env`:

```bash
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Existing environment variables
# (keep any existing variables from your .env file)
```

### 3. Run Enrichment

```bash
npm run enrich-spotify
```

**What this does:**
- Authenticates with Spotify using Client Credentials flow
- Searches for all 240 artists in your concert history
- Fetches the most popular album for each artist
- Downloads album cover URLs (small/medium/large resolutions)
- Fetches top 3 tracks with 30-second preview URLs
- Updates `public/data/artists-metadata.json` with real data

**Expected output:**
```
🎵 Enriching artist metadata with Spotify data...

🔑 Authenticating with Spotify...
✅ Authenticated

Processing 240 artists...

Fetching: Social Distortion
  ✅ Enriched (album: Social Distortion)

Fetching: The Specials
  ✅ Enriched (album: The Specials)

Fetching: Boston
  ⚠️  Review match: "Boston" → "Boston Playlist" (popularity: 15)
  ✅ Enriched (album: Boston)

...

📊 Enrichment Summary:
   ✅ Enriched: 215
   ⏭️  Skipped (cached): 0
   ❌ Failed: 25

💾 Saved to: /Users/mmorper/projects/concerts/public/data/artists-metadata.json

🎉 Done!
```

### 4. Review Warnings

The script will log warnings for low-confidence matches. Look for lines like:

```
⚠️  Review match: "Boston" → "Boston Playlist" (popularity: 15)
⚠️  Review match: "Heart" → "Heart Rate Playlist" (popularity: 8)
```

These are cases where:
- The name match is fuzzy (not exact)
- The Spotify result has low popularity (<30)

### 5. Fix Mismatches

For each warning, manually find the correct artist on Spotify:

1. Search for the artist on https://open.spotify.com
2. Click on the artist profile
3. Copy the Spotify ID from the URL:
   ```
   https://open.spotify.com/artist/29kkCKKGXheHuoO829FxWK
                                   ^^^^^^^^^^^^^^^^^^^^^^
                                   This is the Spotify ID
   ```

4. Add to `scripts/spotify-overrides.json`:

```json
{
  "boston": {
    "spotifyArtistId": "29kkCKKGXheHuoO829FxWK",
    "note": "The classic rock band, not the city playlist"
  },
  "heart": {
    "spotifyArtistId": "34jw2BbxjoYalTp8cJFCPv",
    "note": "Ann & Nancy Wilson rock band"
  }
}
```

**Note:** Use the normalized name (lowercase, no punctuation) as the key.

### 6. Re-run Enrichment

```bash
npm run enrich-spotify
```

The script will now use your manual overrides and fetch the correct artists.

### 7. Verify Results

Check the updated `public/data/artists-metadata.json`:

```json
{
  "metadata": {
    "lastUpdated": "2025-12-29T...",
    "totalArtists": 240,
    "dataSource": "spotify"
  },
  "artists": {
    "socialdistortion": {
      "name": "Social Distortion",
      "spotifyArtistId": "...",
      "spotifyArtistUrl": "https://open.spotify.com/artist/...",
      "mostPopularAlbum": {
        "name": "Social Distortion",
        "coverArt": {
          "small": "https://i.scdn.co/image/...",
          "medium": "https://i.scdn.co/image/...",
          "large": "https://i.scdn.co/image/..."
        }
      },
      "topTracks": [
        {
          "name": "Ball and Chain",
          "previewUrl": "https://p.scdn.co/mp3-preview/...",
          "spotifyUrl": "https://open.spotify.com/track/..."
        }
      ]
    }
  }
}
```

### 8. Test the App

```bash
npm run dev
```

Navigate to the Artist Scene (Scene 5) and verify:
- ✅ Album covers are displaying instead of placeholders
- ✅ Clicking cards reveals concert history
- ✅ "Open in Spotify" links work
- ✅ Spotify attribution appears in footer

### 9. Commit Changes

```bash
git add public/data/artists-metadata.json
git add scripts/spotify-overrides.json
git commit -m "feat: Add Spotify album art and track data for Artist Scene"
```

---

## Common Issues

### Issue: "Missing Spotify credentials"

**Error:**
```
❌ Missing Spotify credentials in .env file
   Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
```

**Solution:** Make sure your `.env` file exists and has both credentials:

```bash
SPOTIFY_CLIENT_ID=abc123...
SPOTIFY_CLIENT_SECRET=xyz789...
```

### Issue: "Spotify auth failed: 401"

**Error:**
```
Spotify auth failed: 401 Unauthorized
```

**Solution:** Your Client ID or Client Secret is incorrect. Double-check the values in your Spotify Developer Dashboard.

### Issue: Too many failed matches

**Error:**
```
📊 Enrichment Summary:
   ✅ Enriched: 120
   ❌ Failed: 120
```

**Solution:** This is normal for obscure artists or bands with common names. Add manual overrides for important artists. Less popular bands might not be on Spotify at all (especially local openers from the 1980s).

### Issue: Rate limiting

**Error:**
```
❌ Error: 429 Too Many Requests
```

**Solution:** The script has built-in rate limiting (350ms between requests). If you still hit rate limits, the script will need to be rerun. Spotify allows ~3 requests/second for Client Credentials flow.

### Issue: Album covers not showing

**Symptoms:** Cards still show genre-colored placeholders

**Debugging:**
1. Check browser console for image load errors
2. Verify `coverArt` URLs exist in `artists-metadata.json`
3. Check if Spotify CDN URLs are accessible (try opening one in browser)
4. Clear browser cache and hard refresh (Cmd+Shift+R)

**Solution:** Spotify CDN URLs are usually reliable. If images aren't loading, the URLs might have expired. Re-run enrichment to get fresh URLs.

---

## Advanced: Manual Overrides

### When to Use Overrides

Use manual overrides for:
1. **Common names** - "Boston", "Heart", "America", "The Cars"
2. **Ambiguous matches** - Multiple artists with same/similar names
3. **Typos in concert data** - If artist name is misspelled in `concerts.json`
4. **Local/obscure artists** - Bands not on Spotify or with very low popularity

### Override File Structure

`scripts/spotify-overrides.json`:

```json
{
  "_comment": "Manual Spotify artist ID overrides",

  "artistnormalizedname": {
    "spotifyArtistId": "ABC123XYZ",
    "note": "Why this override is needed"
  }
}
```

### Finding Spotify Artist IDs

**Method 1: Spotify Web Player**
1. Go to https://open.spotify.com
2. Search for artist
3. Click artist profile
4. Copy ID from URL: `https://open.spotify.com/artist/{ID}`

**Method 2: Spotify API Playground**
1. Go to https://developer.spotify.com/console/get-search-item/
2. Search for artist
3. Copy `id` from results

**Method 3: Check API Response**

The enrichment script logs API results. Look for the artist name in console output and note the suggested ID before adding override.

---

## Spotify API Limits

### Client Credentials Flow

- **Rate limit:** ~3 requests/second
- **Token expiration:** 1 hour (script handles refresh automatically)
- **API calls per enrichment run:** ~240 artists × 3 requests = 720 requests
- **Estimated time:** ~4-5 minutes for full enrichment

### Data Freshness

The script caches enriched data for 90 days. To force re-enrichment:

```bash
# Delete metadata file and regenerate mock data
rm public/data/artists-metadata.json
npm run generate-mock-spotify

# Then run enrichment again
npm run enrich-spotify
```

---

## Testing Enrichment on Subset

To test on just a few artists before running full enrichment, temporarily modify the script:

```typescript
// In scripts/enrich-spotify-metadata.ts, line ~130

// Test on first 10 artists only
const artistNames = Object.keys(artists).slice(0, 10)
```

Then run:

```bash
npm run enrich-spotify
```

Once verified, remove the `.slice(0, 10)` and run the full enrichment.

---

## Spotify TOS Compliance

The current implementation follows Spotify's Design Guidelines:

✅ **Album art unmodified** - Displayed full-bleed, no overlays
✅ **Attribution present** - Spotify logo in scene footer
✅ **Links to Spotify** - "Open in Spotify" on every card back
✅ **Preview clips only** - 30-second previews (when mini-player implemented)

**Important:** Do NOT:
- Crop or modify album art
- Remove Spotify attribution
- Download or cache audio files
- Use preview URLs in other applications

---

## Next Steps After Enrichment

Once enrichment is complete and `artists-metadata.json` is populated:

1. **Implement mini-player**: See [spotify-artist-integration.md](./spotify-artist-integration.md#gatefold-right-panel-spotify-mini-player) for full component spec
2. **Update card fronts**: See [spotify-artist-integration.md](./spotify-artist-integration.md#card-front-album-art-display) for album art implementation
3. **Test playback**: Verify 30-second previews work across browsers

---

## Troubleshooting Checklist

- [ ] `.env` file exists with valid credentials
- [ ] Spotify Developer app is active (not deleted)
- [ ] Redirect URI matches your dev server URL
- [ ] `public/data/artists-metadata.json` exists
- [ ] Browser console shows no CORS errors
- [ ] Album art URLs are accessible (test in browser)
- [ ] Date format in concert history is valid ISO 8601
- [ ] Artist names in `concerts.json` are not misspelled

---

## Support

If you encounter issues:

1. Check Spotify API Status: https://developer.spotify.com/status
2. Review Spotify Web API Docs: https://developer.spotify.com/documentation/web-api
3. Check enrichment script logs for specific error messages
4. Verify API credentials in Spotify Developer Dashboard

---

**Happy Enriching! 🎵**

The Artist Scene will look incredible once album covers are loaded. The genre-colored placeholders are already beautiful, but real album art will take it to the next level.
