# API Setup Guide

This document explains how to configure the various APIs needed for the concert data pipeline.

## Overview

The data pipeline uses three services:
1. **Google Sheets API** - To fetch concert data from your spreadsheet
2. **TheAudioDB** - To fetch artist images and metadata (primary source)
3. **Last.fm API** - To fetch artist data when TheAudioDB doesn't have it (fallback)

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

## TheAudioDB API Setup

TheAudioDB provides a free test API key.

### Option 1: Use Test Key (Easiest)

```bash
THEAUDIODB_API_KEY=2
```

The test key "2" works for basic searches with 2 calls/second rate limit.

### Option 2: Get Your Own Key

1. Go to [TheAudioDB.com](https://www.theaudiodb.com/)
2. Support on Patreon for $2/month: https://www.patreon.com/thedatadb
3. Get your API key from your Patreon rewards
4. Add to `.env`:

```bash
THEAUDIODB_API_KEY=your_api_key
```

## Last.fm API Setup

Last.fm provides a free API for non-commercial use.

### 1. Create an API Account

1. Go to [Last.fm API](https://www.last.fm/api/account/create)
2. Fill out the form:
   - **Application name**: "Concert Archives"
   - **Application description**: "Personal concert history visualization"
   - **Callback URL**: Leave empty or use http://localhost:5173
3. Agree to terms and submit
4. You'll receive an **API Key** immediately

### 2. Add to .env

```bash
LASTFM_API_KEY=your_api_key_here
```

## Complete .env File

Once you have all API credentials, your `.env` file should look like:

```bash
# Google Sheets API
GOOGLE_SHEET_ID=1abc123...xyz
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=1//abc123...

# Music APIs
THEAUDIODB_API_KEY=2
LASTFM_API_KEY=abc123def456...

# Sheet Configuration
SHEET_RANGE=Sheet1!A2:Z1000
```

## Testing Your Setup

Run the data pipeline:

```bash
# Fetch from Google Sheets
npm run fetch-sheet

# Enrich with artist metadata
npm run enrich

# Or run both in sequence
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

### TheAudioDB Errors

**"Rate Limit Exceeded"**
- The rate limiter enforces 2 calls/second
- Consider adding delays between requests
- The script already handles this automatically

**"Artist Not Found"**
- Not all artists are in TheAudioDB
- The script falls back to Last.fm automatically
- Some artists may not have data in either service

### Last.fm Errors

**"Invalid API Key"**
- Verify the key is correct (check for extra spaces)
- Make sure you're using the API Key, not the Shared Secret

**"Artist Not Found"**
- Try the exact artist name as it appears on Last.fm
- Some artists may use different spellings

## Rate Limits

- **Google Sheets API**: 100 requests/100 seconds per user (plenty for our use)
- **TheAudioDB**: 2 requests/second (enforced by rate limiter)
- **Last.fm**: 5 requests/second (enforced by rate limiter)

## Best Practices

1. **Run the pipeline during "vibe code" sessions** when you've added new concerts
2. **Don't commit your .env file** - it contains secrets
3. **Artist metadata is cached** - re-enrichment only updates stale records (>30 days old)
4. **Commit the generated JSON files** - they're the source of truth for the app
5. **Keep API keys secure** - treat them like passwords

## Cost

All APIs used are **completely free** for our use case:
- Google Sheets API: Free tier (60 reads/minute per user)
- TheAudioDB: Free test key or $2/month for enhanced features
- Last.fm: Free for non-commercial use

**Total monthly cost: $0-2**
