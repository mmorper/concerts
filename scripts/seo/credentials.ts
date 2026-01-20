/**
 * Credential Management System
 *
 * Handles secure storage and retrieval of API credentials.
 * Checks sources in order: environment variables → config file → OAuth flow
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { CredentialStore, CredentialSource } from './types.js'

// ============================================================================
// Constants
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.seo-analyzer')
const CONFIG_FILE = path.join(CONFIG_DIR, 'credentials.json')
const CURRENT_VERSION = 1

// Environment variable names
const ENV_VARS = {
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  GOOGLE_REFRESH_TOKEN: 'GOOGLE_REFRESH_TOKEN',
  AHREFS_API_KEY: 'AHREFS_API_KEY',
  SEMRUSH_API_KEY: 'SEMRUSH_API_KEY',
}

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Check if Google credentials are available via environment variables
 */
export function hasGoogleEnvCredentials(): boolean {
  return !!(process.env[ENV_VARS.GOOGLE_CLIENT_ID] && process.env[ENV_VARS.GOOGLE_CLIENT_SECRET])
}

/**
 * Check if Ahrefs API key is available via environment variables
 */
export function hasAhrefsEnvCredentials(): boolean {
  return !!process.env[ENV_VARS.AHREFS_API_KEY]
}

/**
 * Check if SEMrush API key is available via environment variables
 */
export function hasSemrushEnvCredentials(): boolean {
  return !!process.env[ENV_VARS.SEMRUSH_API_KEY]
}

/**
 * Load credentials from environment variables
 */
export function loadCredentialsFromEnv(): Partial<CredentialStore> {
  const credentials: Partial<CredentialStore> = {
    version: CURRENT_VERSION,
  }

  if (hasGoogleEnvCredentials()) {
    credentials.google = {
      clientId: process.env[ENV_VARS.GOOGLE_CLIENT_ID]!,
      clientSecret: process.env[ENV_VARS.GOOGLE_CLIENT_SECRET]!,
      refreshToken: process.env[ENV_VARS.GOOGLE_REFRESH_TOKEN],
    }
  }

  if (hasAhrefsEnvCredentials()) {
    credentials.ahrefs = {
      apiKey: process.env[ENV_VARS.AHREFS_API_KEY]!,
    }
  }

  if (hasSemrushEnvCredentials()) {
    credentials.semrush = {
      apiKey: process.env[ENV_VARS.SEMRUSH_API_KEY]!,
    }
  }

  return credentials
}

// ============================================================================
// Config File Helpers
// ============================================================================

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

/**
 * Check if config file exists
 */
export function hasConfigFile(): boolean {
  return fs.existsSync(CONFIG_FILE)
}

/**
 * Load credentials from config file
 */
export function loadCredentialsFromFile(): CredentialStore | null {
  if (!hasConfigFile()) {
    return null
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const credentials = JSON.parse(content) as CredentialStore

    // Validate version
    if (!credentials.version || credentials.version < CURRENT_VERSION) {
      console.warn('⚠️  Credential file needs migration')
      // In future, add migration logic here
    }

    return credentials
  } catch (error) {
    console.error('❌ Failed to load credentials file:', error)
    return null
  }
}

/**
 * Save credentials to config file
 */
export function saveCredentialsToFile(credentials: CredentialStore): void {
  ensureConfigDir()

  // Ensure version is set
  credentials.version = CURRENT_VERSION

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(credentials, null, 2), 'utf-8')
}

/**
 * Check if credentials file might be in a git repository
 */
export function isInGitRepo(filepath: string): boolean {
  let currentDir = path.dirname(filepath)
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return true
    }
    currentDir = path.dirname(currentDir)
  }

  return false
}

/**
 * Warn if credentials might be committed to git
 */
export function checkGitSafety(): void {
  if (isInGitRepo(CONFIG_FILE)) {
    console.warn('\n⚠️  WARNING: Credentials file is in a git repository!')
    console.warn('   This should not happen with the default location (~/.seo-analyzer/)')
    console.warn('   Make sure credentials are not committed to version control.\n')
  }
}

// ============================================================================
// Unified Credential Access
// ============================================================================

/**
 * Get the source of credentials
 */
export function getCredentialSource(): CredentialSource {
  const hasEnvGoogle = hasGoogleEnvCredentials()
  const hasEnvAhrefs = hasAhrefsEnvCredentials()
  const hasEnvSemrush = hasSemrushEnvCredentials()
  const hasFile = hasConfigFile()
  const fileCredentials = hasFile ? loadCredentialsFromFile() : null

  return {
    type: hasEnvGoogle || hasEnvAhrefs || hasEnvSemrush ? 'env' : hasFile ? 'file' : 'oauth',
    google: hasEnvGoogle || !!(fileCredentials?.google?.clientId),
    ahrefs: hasEnvAhrefs || !!fileCredentials?.ahrefs?.apiKey,
    semrush: hasEnvSemrush || !!fileCredentials?.semrush?.apiKey,
  }
}

/**
 * Load credentials from all available sources (env takes precedence)
 */
export function loadCredentials(): CredentialStore {
  // Start with file credentials as base
  const fileCredentials = loadCredentialsFromFile() || { version: CURRENT_VERSION }

  // Overlay environment variables (they take precedence)
  const envCredentials = loadCredentialsFromEnv()

  // Merge: env vars override file values
  const merged: CredentialStore = {
    version: CURRENT_VERSION,
    google: envCredentials.google || fileCredentials.google,
    ahrefs: envCredentials.ahrefs || fileCredentials.ahrefs,
    semrush: envCredentials.semrush || fileCredentials.semrush,
    properties: fileCredentials.properties,
  }

  return merged
}

/**
 * Check if any credentials are configured
 */
export function hasAnyCredentials(): boolean {
  const source = getCredentialSource()
  return source.google || source.ahrefs || source.semrush
}

/**
 * Check if Google credentials are configured (for GSC/GA4)
 */
export function hasGoogleCredentials(): boolean {
  return getCredentialSource().google
}

/**
 * Check if backlink API is configured
 */
export function hasBacklinkCredentials(): 'ahrefs' | 'semrush' | null {
  const source = getCredentialSource()
  if (source.ahrefs) return 'ahrefs'
  if (source.semrush) return 'semrush'
  return null
}

// ============================================================================
// Property Mapping
// ============================================================================

/**
 * Get GSC property URL for a site
 */
export function getGSCProperty(siteUrl: string): string | undefined {
  const credentials = loadCredentials()
  return credentials.properties?.[siteUrl]?.gscProperty
}

/**
 * Get GA4 property ID for a site
 */
export function getGA4PropertyId(siteUrl: string): string | undefined {
  const credentials = loadCredentials()
  return credentials.properties?.[siteUrl]?.ga4PropertyId
}

/**
 * Save property mapping for a site
 */
export function savePropertyMapping(
  siteUrl: string,
  mapping: { gscProperty?: string; ga4PropertyId?: string }
): void {
  const credentials = loadCredentials()

  if (!credentials.properties) {
    credentials.properties = {}
  }

  credentials.properties[siteUrl] = {
    ...credentials.properties[siteUrl],
    ...mapping,
  }

  saveCredentialsToFile(credentials)
}

// ============================================================================
// Credential Display (for CLI)
// ============================================================================

/**
 * Get a summary of configured credentials for display
 */
export function getCredentialSummary(): string[] {
  const source = getCredentialSource()
  const lines: string[] = []

  lines.push(`Credential Source: ${source.type === 'env' ? 'Environment Variables' : source.type === 'file' ? 'Config File' : 'Not Configured'}`)
  lines.push('')
  lines.push('Data Sources:')
  lines.push(`  Google (GSC/GA4): ${source.google ? '✅ Configured' : '⬚ Not configured'}`)
  lines.push(`  Ahrefs:           ${source.ahrefs ? '✅ Configured' : '⬚ Not configured'}`)
  lines.push(`  SEMrush:          ${source.semrush ? '✅ Configured' : '⬚ Not configured'}`)

  return lines
}

/**
 * Print credential summary to console
 */
export function printCredentialSummary(): void {
  console.log('')
  console.log('📋 CREDENTIAL STATUS')
  console.log('═══════════════════════════════════════════════════════════════')
  getCredentialSummary().forEach(line => console.log(line))
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
}

// ============================================================================
// Token Refresh
// ============================================================================

/**
 * Update Google access token in credentials
 */
export function updateGoogleAccessToken(accessToken: string, expiresAt: number): void {
  const credentials = loadCredentials()

  if (credentials.google) {
    credentials.google.accessToken = accessToken
    credentials.google.expiresAt = expiresAt
    saveCredentialsToFile(credentials)
  }
}

/**
 * Check if Google access token is expired
 */
export function isGoogleTokenExpired(): boolean {
  const credentials = loadCredentials()

  if (!credentials.google?.expiresAt) {
    return true // No expiry info, assume expired
  }

  // Add 5 minute buffer
  return Date.now() > credentials.google.expiresAt - 5 * 60 * 1000
}

// ============================================================================
// Config File Path (for setup)
// ============================================================================

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function getConfigFile(): string {
  return CONFIG_FILE
}
