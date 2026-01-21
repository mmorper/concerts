#!/usr/bin/env npx tsx
/**
 * Re-authorize Google OAuth with expanded scopes for SEO tool
 *
 * This script generates a new refresh token that includes:
 * - spreadsheets.readonly (existing)
 * - webmasters.readonly (Google Search Console)
 * - analytics.readonly (Google Analytics 4)
 *
 * Usage: npx tsx scripts/seo/reauthorize.ts
 */

import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'
import open from 'open'
import * as dotenv from 'dotenv'

dotenv.config()

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
]

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env')
    process.exit(1)
  }

  // Use localhost with a dynamic port for the callback
  const redirectUri = 'http://localhost:3333/oauth2callback'

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get new refresh token
  })

  console.log('\n🔐 SEO TOOL OAUTH RE-AUTHORIZATION')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log('This will request access to:')
  console.log('  • Google Sheets (read-only) — existing')
  console.log('  • Google Search Console (read-only) — NEW')
  console.log('  • Google Analytics (read-only) — NEW\n')
  console.log('Opening browser for authorization...\n')

  // Start local server to receive the callback
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/oauth2callback')) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const queryParams = new url.URL(req.url, `http://localhost:3333`).searchParams
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
      console.log('⚠️  IMPORTANT: Update your .env file with the new refresh token.')
      console.log('   The old token will continue to work for Sheets only.\n')

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

  server.listen(3333, () => {
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
