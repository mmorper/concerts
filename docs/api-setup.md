# API Setup Guide

This document explains how to configure the various APIs needed for the concert data pipeline.

## Overview

The data pipeline uses three Google Cloud services and two music metadata services:
1. **Google Sheets API** - To fetch concert data from your spreadsheet
2. **Google Maps Geocoding API** - To get accurate venue coordinates for the map
3. **Google Places API (New)** - To fetch venue photos and metadata (v1.3.2+)
4. **setlist.fm API** - To fetch concert setlists for Artist Scene liner notes (v1.5.0+)
5. **Ticketmaster Discovery API** - To fetch upcoming tour dates for artists (v2.0.0+)

## Google Sheets API Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "Concert Archives"

### 2. Enable the Google Sheets API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: "Concert Archives Data Sync"
   - Add your email as developer
   - Scopes: None needed (we'll request at runtime)
4. Application type: "Web application"
5. Name: "Concert Data Import"
6. Authorized redirect URIs: `http://localhost:5173`
7. Click "Create"
8. Save the **Client ID** and **Client Secret**

### 4. Get Refresh Token

Run this one-time setup script:

```bash
# Create a temporary script to get your refresh token
node -e "
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:5173'
);

const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    console.log('Your refresh token:', token.refresh_token);
  });
});
"
```

Steps:
1. Replace `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with your actual values
2. Run the script
3. Open the URL it prints in your browser
4. Authorize the app with your Google account
5. Copy the code from the redirect URL (after `?code=`)
6. Paste it into the terminal
7. Save the **Refresh Token** it prints

### 5. Get Your Sheet ID

From your Google Sheets URL:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
```

Copy the `SHEET_ID_HERE` part.

### 6. Update .env File

```bash
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

## Google Maps Geocoding API Setup

The Google Maps Geocoding API is used to get accurate venue-specific coordinates for displaying concerts on the map.

### 1. Enable the API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Use the same project you created for Google Sheets (or create a new one)
3. Go to "APIs & Services" → "Library"
4. Search for "Geocoding API"
5. Click "Enable"

### 2. Create API Key for Geocoding

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Name it "Geocoding API Key (Server-side)"
4. Copy the API key immediately
5. Click "Edit API key" to restrict it:
   - **Application restrictions**: None (this key is only used server-side during builds)
   - **API restrictions**: Click "Restrict key"
   - **Select APIs dropdown**: Check only "Geocoding API"
   - Click "Save"

### 3. Add to .env File

```bash
GOOGLE_MAPS_API_KEY=your_geocoding_api_key_here
```

**Security Note**: This key is only used in server-side build scripts (`scripts/geocode-venues.ts`). It is never exposed to browsers or committed to the repository.

### 4. Enable Billing (Required)

**Important**: Google requires a payment method on file, but you won't be charged for typical usage (see [DATA_PIPELINE.md](DATA_PIPELINE.md#geocoding-strategy) for cost details).

1. Go to "Billing" in Google Cloud Console
2. Link a payment method (credit card)
3. You're automatically enrolled in the free tier ($200/month credit)


## Complete .env File

Once you have all API credentials, your `.env` file should look like:

```bash
# Google Sheets API
GOOGLE_SHEET_ID=1abc123...xyz
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Maps APIs (Separate Keys for Security)
GOOGLE_MAPS_API_KEY=AIzaSyA...    # Geocoding (server-side, API restrictions only)
GOOGLE_PLACES_API_KEY=AIzaSyB...  # Places Photos (client-side, HTTP referrer restrictions)

# Sheet Configuration
SHEET_RANGE=Sheet1!A2:Z1000
```

## Testing Your Setup

Run the data pipeline:

```bash
# Fetch from Google Sheets and process data
npm run build-data
```

## Troubleshooting

### Google Sheets Errors

**"Invalid Credentials"**
- Make sure OAuth 2.0 is configured correctly
- Verify refresh token hasn't expired
- Try regenerating the refresh token

**"Insufficient Permission"**
- Ensure the Google Sheets API is enabled in your project
- Check that the OAuth scopes include spreadsheets.readonly

**"Sheet Not Found"**
- Verify the GOOGLE_SHEET_ID is correct
- Make sure your Google account has access to the sheet


## Rate Limits

- **Google Sheets API**: 100 requests/100 seconds per user (plenty for our use)
- **Google Maps Geocoding API**: 50 requests/second (enforced by rate limiter with 20ms delays)

For implementation details on how caching minimizes API calls, see [DATA_PIPELINE.md - Geocoding Strategy](DATA_PIPELINE.md#geocoding-strategy).

## Google Places API Setup (v1.3.2+)

The Google Places API (New) is used to fetch venue photos, ratings, and metadata for displaying in the Geography Scene map popups and venue detail modals.

### 1. Enable the API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Use the same project you created for Google Sheets/Geocoding
3. Go to "APIs & Services" → "Library"
4. Search for "Places API (New)"
5. Click "Enable"

**Note**: Make sure you enable **"Places API (New)"**, not the legacy "Places API".

### 2. Create Separate API Key for Places API

⚠️ **IMPORTANT**: Places API requires a **separate API key** from Geocoding because:

- Places photo URLs are embedded in `venues-metadata.json` and served to browsers (client-side)
- Geocoding runs only server-side during builds (never exposed to browsers)
- **You cannot use the same key for both** - they require different security restrictions

**Create the Places API Key:**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Name it "Places API Key (Client-side)"
4. Copy the API key immediately
5. Click "Edit API key" to restrict it:

   **Application restrictions** (REQUIRED for security):

   - Select "HTTP referrers (web sites)"
   - Click "Add an item" and enter your production domain:

     ```text
     https://concerts.morperhaus.org/*
     ```

   - Click "Add an item" again for localhost development:

     ```text
     http://localhost:*
     ```

   - Click "Done"

   **API restrictions**:

   - Select "Restrict key"
   - Check "Places API (New)" only
   - Click "Save"

6. Click "Save" to apply all restrictions

**Why HTTP referrer restrictions matter:**

- Places photo URLs contain the API key as a query parameter (`?key=...`)
- These URLs are visible in `venues-metadata.json` on GitHub and in browser DevTools
- HTTP referrer restrictions prevent unauthorized domains from using your key
- Even if someone copies your key, they can only use it on your authorized domains

### 3. Configure Environment Variables

```bash
GOOGLE_PLACES_API_KEY=your_places_api_key_here
```

Your complete `.env` should now have separate keys:

```bash
# Geocoding (server-side only, API restrictions)
GOOGLE_MAPS_API_KEY=AIzaSyA...

# Places API (client-side, HTTP referrer restrictions)
GOOGLE_PLACES_API_KEY=AIzaSyB...
```

### 3. Verify Billing is Enabled

Places API requires billing to be enabled (same billing account as Geocoding API).

1. Go to "Billing" in Google Cloud Console
2. Verify billing is linked to your project
3. You're automatically enrolled in the free tier ($200/month credit)

### 4. Run Venue Enrichment

Once the API is enabled, you can enrich your venues with photos:

```bash
# Export venues for classification (one-time setup)
npm run export-venues

# Copy the example file and classify your venues
# cp data/example-venue-status.csv data/venue-status.csv
# Edit data/venue-status.csv with your venue classifications
# (active/closed/demolished/renamed)
# See data/README.md for column specifications

# Run enrichment to fetch photos from Places API
npm run enrich-venues
```

### 5. Cost Estimate

Pricing:

- **Text Search**: $32.00 per 1,000 requests
- **Place Details**: $17.00 per 1,000 requests
- **Place Photos**: $7.00 per 1,000 requests

Your Usage:

- Initial run: ~50 active venues = **$2.80**
- Photo refresh (90-day cache): 4×/year = **$11.20/year**
- New venues: ~5/year = **$0.20/year**

**Annual estimate: ~$15/year** (well within $200/month free tier)

### 6. Photo Attribution and Terms

When using photos from Google Places API, you must comply with Google's terms:

- **Attribution is automatic** - Photos include `authorAttributions` metadata with photographer name/profile
- **Display attribution in UI** - When showing venue photos, display the photographer's name
- **Use within Google's ToS** - Photos are licensed for use via Google Maps Platform
- **No downloads/storage** - Photos are served via CDN URLs (not stored locally)
- **Flag inappropriate content** - Each photo includes a `flagContentUri` for reporting issues

For venues with sensitive copyright concerns or low-quality photos, use manual photo curation instead.

For detailed implementation and caching strategy, see [DATA_PIPELINE.md - Venue Enrichment](DATA_PIPELINE.md#5-venue-enrichment-export-venuests-enrich-venuests).

## setlist.fm API Setup (v1.5.0+)

The setlist.fm API is used to fetch concert setlists for the Artist Scene liner notes feature. This allows users to view the actual songs performed at concerts in their collection.

### 1. Create setlist.fm Account

1. Go to [setlist.fm](https://www.setlist.fm/)
2. Click "Sign Up" in the top-right corner
3. Create a free account with your email
4. Verify your email address

### 2. Request API Key

1. Once logged in, go to [API Settings](https://www.setlist.fm/settings/api)
2. Click "Apply for an API key"
3. Fill out the application form:
   - **Application name:** "Morperhaus Concert Archives" (or your project name)
   - **Application URL:** https://concerts.morperhaus.org (your production URL)
   - **Description:** "Personal concert archive visualization project. Fetching setlists for concerts I've attended to display in an interactive artist detail view."
   - **API version:** 1.0
   - **Expected API calls:** "Low volume - personal project with <100 unique concerts. Estimated 10-50 API calls per day."
4. Submit the application
5. Wait for approval (typically 1-3 business days)
6. Once approved, your API key will appear in the API Settings page

### 3. Configure Environment Variable

Once you receive your API key, add it to your `.env` file:

```bash
# setlist.fm API (client-side, rate-limited by key)
VITE_SETLISTFM_API_KEY=your_setlistfm_api_key_here
```

**Important Notes:**

- The API key is prefixed with `VITE_` because it's used client-side (browser)
- setlist.fm API keys are **safe to expose in client-side code** (common practice)
- The key is rate-limited per key (not per domain)
- There is no domain restriction - the key works from any origin
- Monitor your usage at [setlist.fm/settings/api](https://www.setlist.fm/settings/api)

### 4. Verify Setup

Test your API key with a simple request:

```bash
curl -X GET "https://api.setlist.fm/rest/1.0/search/setlists?artistName=The+National&cityName=Brooklyn" \
  -H "Accept: application/json" \
  -H "x-api-key: your_api_key_here"
```

You should receive a JSON response with setlist data. If you get a 401 error, your API key is invalid.

### 5. API Usage & Rate Limits

**Rate Limits:**
- No explicit rate limit documented in the API docs
- Fair use policy applies - be respectful
- Recommended self-imposed limit: 5 requests/second max
- The app implements 24-hour client-side caching to minimize requests

**Expected Usage:**
- Initial development/testing: ~50-100 requests
- Typical user session: 3-5 setlist fetches
- Daily usage (10 users): ~30-50 requests
- Monthly usage: ~900-1,500 requests
- **Cost: $0** (completely free API)

**Data Availability:**
- setlist.fm is community-contributed
- Not all concerts will have setlists (expected hit rate: 40-60%)
- Older shows (pre-2000) less likely to have data
- Popular artists more likely to be documented
- Users can contribute missing setlists to the community

### 6. Attribution Requirements

When displaying setlists, you must:

- ✅ Include "via setlist.fm" attribution text (implemented in LinerNotesPanel)
- ✅ Link to setlist.fm when possible
- ✅ Respect the community-contributed nature of the data
- ✅ Encourage users to contribute missing setlists

The liner notes panel includes proper attribution at the bottom of each setlist display.

### 7. Troubleshooting

**"401 Unauthorized" Error:**
- Verify your API key is correct in `.env`
- Ensure you're including the `x-api-key` header
- Check that your API key application was approved

**"No setlists found" (empty results):**
- Normal - not all concerts have setlists on setlist.fm
- Try searching manually at [setlist.fm](https://www.setlist.fm/) to verify
- Encourage users to contribute missing setlists

**"Rate limit exceeded" (429 error):**
- Reduce request frequency
- Check for infinite loops or redundant calls
- Verify caching is working correctly

**Incorrect setlist returned:**
- Fuzzy matching may return close but not exact matches
- Check artist name, date, and venue name spelling
- Report matching issues for future tuning

### 8. Development vs Production

**Development:**
- Use the same API key for development and production
- Test with known concerts that have setlists (e.g., popular artists)
- Monitor console for API errors

**Production:**
- Same API key works in production (no domain restrictions)
- Monitor API usage in setlist.fm dashboard
- Set up error tracking to catch failed requests

### Complete .env File

Your `.env` should now include:

```bash
# Google Sheets API
GOOGLE_SHEET_ID=1abc123...xyz
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Maps APIs (Separate Keys for Security)
GOOGLE_MAPS_API_KEY=AIzaSyA...    # Geocoding (server-side, API restrictions only)
GOOGLE_PLACES_API_KEY=AIzaSyB...  # Places Photos (client-side, HTTP referrer restrictions)

# setlist.fm API (v1.5.0+)
VITE_SETLISTFM_API_KEY=your_setlistfm_api_key_here

# Sheet Configuration
SHEET_RANGE=Sheet1!A2:Z1000
```

For implementation details and design specifications, see [docs/specs/future/setlist-liner-notes.md](specs/future/setlist-liner-notes.md).

## Ticketmaster Discovery API Setup (v2.0.0+)

The Ticketmaster Discovery API is used to fetch upcoming tour dates for artists in the Artist Scene. This allows users to discover when their favorite artists are touring and get direct ticket purchase links.

### 1. Create Ticketmaster Developer Account

1. Go to [Ticketmaster Developer Portal](https://developer.ticketmaster.com/)
2. Click "Get Your API Key" or "Sign Up"
3. Create a free account with your email
4. Verify your email address

### 2. Get API Key

1. Log in to [Ticketmaster Developer Portal](https://developer.ticketmaster.com/)
2. Go to "My Apps" or click "Get Your API Key"
3. Click "Create New App"
4. Fill out the form:
   - **App Name:** "Morperhaus Concert Archives" (or your project name)
   - **Description:** "Personal concert archive visualization project with upcoming tour dates feature"
5. Submit and your API key will be generated immediately
6. Copy the **Consumer Key** (this is your API key)

### 2. Configure Environment Variable

Add your API key to your `.env` file:

```bash
# Ticketmaster Discovery API (v2.0.0+)
VITE_TICKETMASTER_API_KEY=your_ticketmaster_api_key_here
```

**Important Notes:**

- The API key is prefixed with `VITE_` because it's used client-side (browser)
- Ticketmaster API keys are designed for client-side use
- The key is rate-limited per key (5,000 API calls/day, 5 requests/second)
- Monitor your usage in the [Ticketmaster Developer Dashboard](https://developer-acct.ticketmaster.com/user/login)

### 3. Verify Setup

Test your API key with a simple request:

```bash
curl -X GET "https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=Pearl+Jam&apikey=your_api_key_here"
```

You should receive a JSON response with artist/attraction data. If you get a 401 error, your API key is invalid.

### 4. API Usage & Rate Limits

**Rate Limits (Free Tier):**

- 5,000 API calls per day
- 5 requests per second
- Automatically enforced by Ticketmaster
- Exceeded limits return 429 "Too Many Requests" error

**Expected Usage:**

- Initial development/testing: ~50-100 requests
- Typical user session: 4-6 tour date fetches (2 API calls per artist: search + events)
- Daily usage (10 users): ~40-60 requests
- Monthly usage: ~1,200-1,800 requests
- **Well within free tier limits**
- **Cost: $0** (completely free)

**Caching Strategy:**

- 24-hour client-side caching to minimize API calls
- Artist name normalization fallback (try exact match, then remove "The")
- Empty results cached to prevent repeated failed lookups

**Data Availability:**

- Excellent coverage for actively touring artists
- Comprehensive event data with ticket links
- Not all artists will have upcoming events (normal condition)
- Best coverage for major touring acts and large venues

### 5. API Endpoints Used

The tour dates feature uses two Discovery API endpoints:

**1. Attractions Search (find artist ID):**

```
GET https://app.ticketmaster.com/discovery/v2/attractions.json?keyword={artist_name}&apikey={api_key}
```

**2. Events Search (fetch tour dates):**

```
GET https://app.ticketmaster.com/discovery/v2/events.json?attractionId={attraction_id}&sort=date,asc&apikey={api_key}
```

**Response:**

- Sorted list of upcoming events (empty if none)
- Each event includes: date/time, venue, city, state, country, ticket offers with URLs
- Direct links to Ticketmaster ticket purchase pages

### 6. Development vs Production

**Development:**

- Use the same API key for development and production
- No domain restrictions or CORS configuration needed
- Test with known touring artists (e.g., Pearl Jam, The National, Foo Fighters)
- Monitor console for API errors and rate limit warnings

**Production:**

- Same API key works in production
- No additional configuration needed
- Monitor usage in Ticketmaster Developer Dashboard
- Set up error tracking to catch failed requests

### 7. Troubleshooting

**"401 Unauthorized" Error:**

- Verify your API key is correct in `.env`
- Ensure you're using the Consumer Key (not Consumer Secret)
- Check that your Ticketmaster developer account is active

**Empty Results (no events):**

- Normal - artist has no upcoming tour dates
- Or artist not found in Ticketmaster database
- Show "No upcoming shows" message gracefully
- Consider manual fallback for artist name variations

**"429 Too Many Requests" Error:**

- You've exceeded the rate limit (5 req/sec or 5,000/day)
- Verify caching is working correctly
- Check for infinite loops or redundant API calls
- Wait and retry with exponential backoff

**"Attraction not found" (search returns empty):**

- Artist name too generic or misspelled
- Try normalized version (remove "The ", trim whitespace)
- Some historical/inactive bands may not be in Ticketmaster's database
- Show "No upcoming shows" gracefully

### Complete .env File

Your `.env` should now include:

```bash
# Google Sheets API
GOOGLE_SHEET_ID=1abc123...xyz
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Maps APIs (Separate Keys for Security)
GOOGLE_MAPS_API_KEY=AIzaSyA...    # Geocoding (server-side, API restrictions only)
GOOGLE_PLACES_API_KEY=AIzaSyB...  # Places Photos (client-side, HTTP referrer restrictions)

# setlist.fm API (v1.5.0+)
VITE_SETLISTFM_API_KEY=your_setlistfm_api_key_here

# Ticketmaster Discovery API (v2.0.0+)
VITE_TICKETMASTER_API_KEY=your_ticketmaster_api_key_here

# Sheet Configuration
SHEET_RANGE=Sheet1!A2:Z1000
```

For implementation details and design specifications, see [docs/specs/implemented/upcoming-tour-dates.md](specs/implemented/upcoming-tour-dates.md).

## Best Practices

1. **Run the pipeline when you've added new concerts** to your Google Sheet
2. **Don't commit your .env file** - it contains secrets
3. **Commit the generated JSON files** - they're the source of truth for the app
4. **Keep API keys secure** - treat them like passwords

## Expected Cost

Both APIs stay within free tiers for typical usage:

- **Google Sheets API**: Free tier (60 reads/minute per user)
- **Google Maps Geocoding API**: $200/month free tier

**Total monthly cost: $0**

For detailed cost analysis and caching strategy, see [DATA_PIPELINE.md - Geocoding Strategy](DATA_PIPELINE.md#geocoding-strategy).
