# Cloudflare Worker: Dynamic Meta Tag Injection

This Cloudflare Worker injects dynamic meta tags for artist and venue pages when accessed by bots (search engines, social media crawlers, AI assistants), while keeping the original SPA fast for human users.

## What It Does

**For Bots (Googlebot, Facebook, Twitter, etc.):**
- Detects bot user agents
- Parses URL parameters (`?scene=artists&artist=depeche-mode`)
- Fetches entity metadata from your JSON files
- Injects dynamic meta tags into HTML `<head>`
- Returns personalized HTML with artist/venue-specific:
  - Title: "Depeche Mode - Morperhaus Concert Archives"
  - Description: "8 concerts from 1988-2024. Explore setlists..."
  - OG image: Artist photo (if available)
  - Schema.org data (future enhancement)

**For Humans:**
- Bypasses worker completely
- No performance impact
- Original fast SPA experience

## Prerequisites

1. **Cloudflare Account** (free tier works)
2. **Wrangler CLI** installed:
   ```bash
   npm install -g wrangler
   ```
3. **Cloudflare Authentication**:
   ```bash
   wrangler login
   ```

## Setup

### Step 1: Install Wrangler (if not installed)

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens your browser to authenticate.

### Step 3: Update Account ID

Get your Account ID from Cloudflare Dashboard:
- Go to: https://dash.cloudflare.com
- Click on your profile (top right) > Account Home
- Copy the **Account ID**

Edit `wrangler.toml` and replace `YOUR_ACCOUNT_ID_HERE`:

```toml
account_id = "abc123def456..."
```

## Local Testing

### Start Local Development Server

```bash
cd workers
wrangler dev
```

This starts the worker on `http://localhost:8787`

### Test with Curl

**Test Bot Detection (should inject meta tags):**
```bash
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1)" \
  "http://localhost:8787/?scene=artists&artist=depeche-mode" | grep "<title>"
```

Expected output: `<title>Depeche Mode - Morperhaus Concert Archives</title>`

**Test Human User (should pass through unchanged):**
```bash
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  "http://localhost:8787/?scene=artists&artist=depeche-mode" | grep "<title>"
```

Expected output: `<title>Morperhaus Concert Archives</title>` (original static title)

### Test Venue Pages

```bash
curl -A "facebookexternalhit/1.1" \
  "http://localhost:8787/?scene=venues&venue=9-30-club" | grep "og:description"
```

Expected: Dynamic description with concert count and featured artists.

## Deployment

### Step 1: Deploy Worker

```bash
cd workers
wrangler deploy
```

This deploys to: `https://concerts-meta-injector.YOUR_SUBDOMAIN.workers.dev`

### Step 2: Configure Route in Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Select your domain: `concerts.morperhaus.org`
3. Navigate to: **Workers & Pages** > **concerts-meta-injector**
4. Click **Settings** > **Triggers** > **Add route**
5. Enter route: `concerts.morperhaus.org/*`
6. Select zone: `concerts.morperhaus.org`
7. Click **Add route**

**Important:** This route intercepts ALL requests to your domain. The worker intelligently passes through human traffic.

### Step 3: Verify Deployment

Test production deployment:

```bash
curl -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" | grep "<title>"
```

Should return dynamic title.

## Monitoring

### View Logs

```bash
wrangler tail
```

Shows real-time requests:
```
[Bot Detected] Googlebot/2.1... | /?scene=artists&artist=depeche-mode
[Artist Meta Injected] Depeche Mode (8 concerts)
```

### Check Worker Metrics

Cloudflare Dashboard > Workers & Pages > concerts-meta-injector > Metrics

- Requests/day
- CPU time
- Errors
- Success rate

## Supported Bots

The worker detects these user agents:

**Search Engines:**
- Googlebot
- Bingbot
- DuckDuckBot
- Baiduspider
- Yandexbot
- Slurp (Yahoo)

**Social Media:**
- facebookexternalhit
- Twitterbot
- LinkedInBot
- WhatsApp
- Telegram
- Slackbot
- Discordbot

**AI Assistants:**
- GPTBot (ChatGPT)
- ClaudeBot
- PerplexityBot
- Google-Extended

## Supported URL Patterns

**Artist Pages:**
```
/?scene=artists&artist={artist-normalized}
```
Example: `/?scene=artists&artist=depeche-mode`

Injects:
- Artist name in title
- Concert count and date range
- Artist photo (if available)

**Venue Pages (Network):**
```
/?scene=venues&venue={venue-normalized}
```
Example: `/?scene=venues&venue=9-30-club`

**Venue Pages (Map):**
```
/?scene=geography&venue={venue-normalized}
```
Example: `/?scene=geography&venue=9-30-club`

Injects:
- Venue name and location
- Concert count
- Featured artists

## Performance

**Bot Requests:**
- Cold start: ~50-100ms (first request after deploy)
- Warm requests: ~10-20ms (cached metadata)
- Total latency: ~30-120ms

**Human Requests:**
- Worker overhead: ~0ms (bypassed immediately)
- No performance impact

## Caching

The worker caches bot responses for 1 hour (`Cache-Control: max-age=3600`).

**Why?**
- Metadata rarely changes
- Reduces worker invocations
- Improves bot response time

**Cache Invalidation:**
- Automatic after 1 hour
- Manual: Wait or purge Cloudflare cache

## Troubleshooting

### Worker Not Detecting Bots

Check user agent in logs:
```bash
wrangler tail
```

Verify user agent is in `BOT_USER_AGENTS` list (line 14-41 in `meta-injector.js`).

### Metadata Not Loading

Check origin fetch in logs. Ensure these URLs are accessible:
- `https://concerts.morperhaus.org/data/artists-metadata.json`
- `https://concerts.morperhaus.org/data/venues-metadata.json`
- `https://concerts.morperhaus.org/data/concerts.json`

### Route Not Working

Verify route configuration:
1. Cloudflare Dashboard > Workers & Pages
2. concerts-meta-injector > Settings > Triggers
3. Ensure route is: `concerts.morperhaus.org/*`

### Testing Social Media Previews

After deployment, test with:

**Facebook:**
https://developers.facebook.com/tools/debug/
Enter: `https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode`

**Twitter:**
https://cards-dev.twitter.com/validator
Enter: `https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode`

**LinkedIn:**
https://www.linkedin.com/post-inspector/
Enter: `https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode`

## Cost

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- Unlimited workers
- Unlimited routes

**Estimated Bot Traffic:**
- ~1,000-5,000 bot requests/day
- Well within free tier limits

## Maintenance

**When to Update:**
- Adding new bot user agents: Edit `BOT_USER_AGENTS` array
- Changing meta tag format: Edit `injectArtistMeta` or `injectVenueMeta`
- After updating data schema: Verify JSON field names

**Redeployment:**
```bash
cd workers
wrangler deploy
```

Changes are live immediately.

## Security

**What the Worker Can Access:**
- Public JSON files (read-only)
- HTML responses from origin (read/modify for bots only)

**What It Cannot Do:**
- Modify responses for human users
- Access private data
- Write to your origin server
- Access cookies or authentication

**Safety:**
- All fetches are to your own origin
- No external API calls
- No user data collected
- Errors fallback to original HTML

## Related Documentation

- **SEO Spec**: `docs/specs/future/global-seo-optimization.md`
- **Build Process**: `docs/BUILD.md`
- **Deep Linking**: `docs/DEEP_LINKING.md`
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/

## Questions?

If you encounter issues:
1. Check `wrangler tail` logs
2. Verify route configuration
3. Test with curl locally first
4. Check Cloudflare Dashboard > Workers & Pages > Metrics
