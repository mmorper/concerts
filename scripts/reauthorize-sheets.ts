#!/usr/bin/env npx tsx
/**
 * Re-authorize Google OAuth for Google Sheets Data Pipeline
 *
 * This script generates a new refresh token specifically for:
 * - spreadsheets.readonly (Google Sheets access)
 *
 * This is separate from the SEO tool OAuth which uses GSC + GA4 scopes.
 *
 * Usage: npx tsx scripts/reauthorize-sheets.ts
 */

import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'
import open from 'open'
import * as dotenv from 'dotenv'

dotenv.config()

// Only request Sheets scope for data pipeline
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173'

  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env')
    process.exit(1)
  }

  console.log(`\n📍 Using redirect URI: ${redirectUri}`)
  console.log('   Make sure this matches what\'s registered in Google Cloud Console!\n')

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get new refresh token
  })

  console.log('\n🔐 GOOGLE SHEETS DATA PIPELINE RE-AUTHORIZATION')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log('This will request access to:')
  console.log('  • Google Sheets (read-only) — for concert data pipeline\n')
  console.log('📋 This token will be separate from your SEO tool token.')
  console.log('   Your SEO token (GOOGLE_REFRESH_TOKEN_SEO) will remain unchanged.\n')
  console.log('Opening browser for authorization...\n')

  // Parse port from redirect URI
  const redirectUrl = new url.URL(redirectUri)
  const port = parseInt(redirectUrl.port || '5173', 10)
  const callbackPath = redirectUrl.pathname || '/'

  // Start local server to receive the callback
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith(callbackPath)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const queryParams = new url.URL(req.url, redirectUri).searchParams
    const code = queryParams.get('code')

    if (!code) {
      res.writeHead(400)
      res.end('No authorization code received')
      server.close()
      return
    }

    try {
      const { tokens } = await oauth2Client.getToken(code)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `)

      console.log('✅ Authorization successful!\n')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('NEW REFRESH TOKEN (add to .env):')
      console.log('═══════════════════════════════════════════════════════════════\n')
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
      console.log('═══════════════════════════════════════════════════════════════\n')
      console.log('📝 Next steps:')
      console.log('   1. Copy the token above')
      console.log('   2. Update GOOGLE_REFRESH_TOKEN in your .env file')
      console.log('   3. Keep your GOOGLE_REFRESH_TOKEN_SEO unchanged (for SEO tool)')
      console.log('   4. Test with: npm run build-data\n')

      server.close()
      process.exit(0)
    } catch (error) {
      res.writeHead(500)
      res.end('Failed to exchange code for tokens')
      console.error('❌ Failed to get tokens:', error)
      server.close()
      process.exit(1)
    }
  })

  server.listen(port, () => {
    console.log(`🌐 Local server listening on port ${port}...`)
    // Open browser after server is ready
    open(authUrl)
  })

  // Timeout after 2 minutes
  setTimeout(() => {
    console.error('\n❌ Authorization timed out. Please try again.')
    server.close()
    process.exit(1)
  }, 120000)
}

main().catch(console.error)
