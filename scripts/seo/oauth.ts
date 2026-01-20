/**
 * Google OAuth Flow Handler
 *
 * Handles OAuth2 authentication for Google Search Console and Analytics APIs.
 */

import http from 'http'
import { URL } from 'url'
import {
  loadCredentials,
  saveCredentialsToFile,
  updateGoogleAccessToken,
  isGoogleTokenExpired,
} from './credentials.js'
import type { CredentialStore } from './types.js'

// ============================================================================
// Constants
// ============================================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REDIRECT_URI = 'http://localhost:3847/callback'
const LOCAL_PORT = 3847

// Required OAuth scopes for GSC and GA4
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly', // Search Console
  'https://www.googleapis.com/auth/analytics.readonly', // Analytics (GA4 Data API)
]

// Optional scope for Google Sheets export
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

// ============================================================================
// OAuth URL Generation
// ============================================================================

/**
 * Generate the Google OAuth authorization URL
 */
export function getAuthUrl(clientId: string, includeSheets: boolean = false): string {
  const scopes = includeSheets ? [...GOOGLE_SCOPES, SHEETS_SCOPE] : GOOGLE_SCOPES

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// ============================================================================
// Token Exchange
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken: string
  expiresIn: number
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

// ============================================================================
// Local OAuth Server
// ============================================================================

/**
 * Start a local server to receive the OAuth callback
 */
export function startOAuthCallbackServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${LOCAL_PORT}`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          server.close()
          reject(new Error(`OAuth error: ${error}`))
          return
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `)
          server.close()
          resolve(code)
        }
      }
    })

    server.on('error', (err) => {
      reject(err)
    })

    server.listen(LOCAL_PORT, () => {
      // Server is ready
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth callback timeout'))
    }, 5 * 60 * 1000)
  })
}

// ============================================================================
// High-Level OAuth Flow
// ============================================================================

/**
 * Run the complete OAuth flow interactively
 * Returns the authorization code from the callback
 */
export async function runOAuthFlow(
  clientId: string,
  clientSecret: string,
  includeSheets: boolean = false
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: number
}> {
  // Generate auth URL
  const authUrl = getAuthUrl(clientId, includeSheets)

  console.log('\n📱 Opening browser for Google authorization...')
  console.log('\nIf browser doesn\'t open, visit this URL manually:')
  console.log(`\n${authUrl}\n`)

  // Open browser
  const open = await import('open')
  await open.default(authUrl)

  // Start callback server and wait for code
  console.log('⏳ Waiting for authorization...')
  const code = await startOAuthCallbackServer()

  // Exchange code for tokens
  console.log('🔄 Exchanging code for tokens...')
  const tokens = await exchangeCodeForTokens(code, clientId, clientSecret)

  const expiresAt = Date.now() + tokens.expiresIn * 1000

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  }
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get a valid access token (refreshing if needed)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const credentials = loadCredentials()

  if (!credentials.google) {
    return null
  }

  const { clientId, clientSecret, refreshToken, accessToken, expiresAt } = credentials.google

  // If we have a valid access token, return it
  if (accessToken && expiresAt && !isGoogleTokenExpired()) {
    return accessToken
  }

  // If we have a refresh token, use it to get a new access token
  if (refreshToken && clientId && clientSecret) {
    try {
      const result = await refreshAccessToken(refreshToken, clientId, clientSecret)
      const newExpiresAt = Date.now() + result.expiresIn * 1000

      updateGoogleAccessToken(result.accessToken, newExpiresAt)

      return result.accessToken
    } catch (error) {
      console.error('❌ Failed to refresh access token:', error)
      return null
    }
  }

  return null
}

/**
 * Check if we can authenticate with Google
 */
export async function canAuthenticateGoogle(): Promise<boolean> {
  const token = await getValidAccessToken()
  return token !== null
}

// ============================================================================
// Save OAuth Result to Credentials
// ============================================================================

/**
 * Save the OAuth result to the credentials file
 */
export function saveOAuthResult(
  clientId: string,
  clientSecret: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): void {
  const credentials = loadCredentials()

  credentials.google = {
    clientId,
    clientSecret,
    refreshToken,
    accessToken,
    expiresAt,
  }

  saveCredentialsToFile(credentials)
}
