# API Setup Guide

This document explains how to configure the various APIs needed for the concert data pipeline.

## Overview

The data pipeline uses two services:
1. **Google Sheets API** - To fetch concert data from your spreadsheet
2. **Google Maps Geocoding API** - To get accurate venue coordinates for the map

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

### 2. Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key immediately
4. Click "Edit API key" to restrict it (recommended):
   - **Select restriction type dropdown**: Choose "API restriction" (not "Websites", "IP addresses", etc.)
   - **Select Maps APIs dropdown**: Click it and check only "Geocoding API"
   - Click "OK" to confirm the API selection
5. Click "Restrict key" button to save restrictions

### 3. Add to .env File

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

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

# Google Maps Geocoding API
GOOGLE_MAPS_API_KEY=your_maps_api_key_here

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
