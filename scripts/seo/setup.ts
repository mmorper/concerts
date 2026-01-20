/**
 * Interactive Setup Wizard
 *
 * Guides users through configuring credentials for SEO analysis.
 * Provides a friendly first-run experience for non-technical users.
 */

import readline from 'readline'
import {
  loadCredentials,
  saveCredentialsToFile,
  hasGoogleCredentials,
  hasBacklinkCredentials,
  getConfigFile,
  checkGitSafety,
  savePropertyMapping,
  printCredentialSummary,
} from './credentials.js'
import { runOAuthFlow, getValidAccessToken } from './oauth.js'
import type { CredentialStore } from './types.js'

// ============================================================================
// Readline Interface
// ============================================================================

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

async function promptChoice(rl: readline.Interface, question: string, options: string[]): Promise<number> {
  console.log('\n' + question)
  options.forEach((opt, i) => {
    console.log(`  [${i + 1}] ${opt}`)
  })
  console.log('')

  while (true) {
    const answer = await prompt(rl, 'Enter choice: ')

    if (answer === '?' || answer.toLowerCase() === 'help') {
      console.log('\nType a number (1-' + options.length + ') to select an option.')
      continue
    }

    if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'quit') {
      return -1 // User wants to quit
    }

    const num = parseInt(answer, 10)
    if (num >= 1 && num <= options.length) {
      return num
    }

    console.log(`Please enter a number between 1 and ${options.length}`)
  }
}

async function promptYesNo(rl: readline.Interface, question: string): Promise<boolean> {
  const answer = await prompt(rl, `${question} (y/n): `)
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ============================================================================
// Setup Flow Components
// ============================================================================

/**
 * Welcome screen
 */
function showWelcome(): void {
  console.log('')
  console.log('🔍 SEO ANALYZER — Setup')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Welcome! This wizard will help you configure your data sources.')
  console.log('')
  console.log('The more data sources you connect, the better insights you\'ll get:')
  console.log('')
  console.log('  📊 Google Search Console — See how your pages rank in Google')
  console.log('  📈 Google Analytics 4    — See how visitors use your site')
  console.log('  🔗 Backlink APIs         — See who links to you (optional)')
  console.log('')
  console.log('Your credentials are stored locally and never uploaded.')
  console.log('')
  console.log('Press Ctrl+C at any time to cancel.')
  console.log('')
}

/**
 * Google OAuth setup
 */
async function setupGoogleOAuth(rl: readline.Interface): Promise<boolean> {
  console.log('')
  console.log('📊 GOOGLE SEARCH CONSOLE & ANALYTICS')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log('')
  console.log('To connect Google APIs, you need OAuth credentials.')
  console.log('')
  console.log('Option 1: Create your own (recommended for personal use)')
  console.log('  1. Go to https://console.cloud.google.com/')
  console.log('  2. Create a project and enable Search Console & Analytics APIs')
  console.log('  3. Create OAuth credentials (Desktop app type)')
  console.log('')
  console.log('Option 2: Use existing credentials')
  console.log('  If you already have OAuth client ID and secret, enter them below.')
  console.log('')

  const choice = await promptChoice(rl, 'How would you like to authenticate?', [
    '🌐 I\'ll create/use OAuth credentials (opens browser)',
    '📝 I have credentials to enter manually',
    '⏭️  Skip for now (use crawl-only mode)',
  ])

  if (choice === -1 || choice === 3) {
    console.log('\n⏭️  Skipping Google setup. You can run /seo --setup later.')
    return false
  }

  if (choice === 1) {
    // OAuth flow
    console.log('')
    console.log('First, I need your OAuth client credentials.')
    console.log('')

    const clientId = await prompt(rl, 'Client ID: ')
    if (!clientId) {
      console.log('❌ Client ID is required')
      return false
    }

    const clientSecret = await prompt(rl, 'Client Secret: ')
    if (!clientSecret) {
      console.log('❌ Client Secret is required')
      return false
    }

    const includeSheets = await promptYesNo(
      rl,
      'Include Google Sheets export capability?'
    )

    try {
      const { accessToken, refreshToken, expiresAt } = await runOAuthFlow(
        clientId,
        clientSecret,
        includeSheets
      )

      // Save credentials
      const credentials = loadCredentials()
      credentials.google = {
        clientId,
        clientSecret,
        refreshToken,
        accessToken,
        expiresAt,
      }
      saveCredentialsToFile(credentials)

      console.log('\n✅ Google authorization successful!')
      return true
    } catch (error) {
      console.error('\n❌ OAuth flow failed:', error)
      return false
    }
  }

  if (choice === 2) {
    // Manual credentials entry
    console.log('')
    console.log('Enter your OAuth credentials:')
    console.log('')

    const clientId = await prompt(rl, 'Client ID: ')
    const clientSecret = await prompt(rl, 'Client Secret: ')
    const refreshToken = await prompt(rl, 'Refresh Token (optional, press Enter to skip): ')

    if (!clientId || !clientSecret) {
      console.log('❌ Client ID and Secret are required')
      return false
    }

    const credentials = loadCredentials()
    credentials.google = {
      clientId,
      clientSecret,
      refreshToken: refreshToken || undefined,
    }
    saveCredentialsToFile(credentials)

    if (!refreshToken) {
      console.log('')
      console.log('⚠️  No refresh token provided.')
      console.log('   You\'ll be prompted to authenticate when running /seo')
    }

    console.log('\n✅ Google credentials saved!')
    return true
  }

  return false
}

/**
 * Backlink API setup
 */
async function setupBacklinkAPI(rl: readline.Interface): Promise<void> {
  console.log('')
  console.log('🔗 BACKLINK APIS (Optional)')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log('')
  console.log('Backlink data requires a paid subscription to Ahrefs or SEMrush.')
  console.log('This is optional — the tool works great without it.')
  console.log('')

  const choice = await promptChoice(rl, 'Do you have a backlink API key?', [
    'Yes, I have an Ahrefs API key',
    'Yes, I have a SEMrush API key',
    'No, skip backlinks (recommended for most users)',
  ])

  if (choice === -1 || choice === 3) {
    console.log('\n⏭️  Skipping backlink setup.')
    return
  }

  const credentials = loadCredentials()

  if (choice === 1) {
    const apiKey = await prompt(rl, 'Ahrefs API Key: ')
    if (apiKey) {
      credentials.ahrefs = { apiKey }
      saveCredentialsToFile(credentials)
      console.log('\n✅ Ahrefs API key saved!')
    }
  }

  if (choice === 2) {
    const apiKey = await prompt(rl, 'SEMrush API Key: ')
    if (apiKey) {
      credentials.semrush = { apiKey }
      saveCredentialsToFile(credentials)
      console.log('\n✅ SEMrush API key saved!')
    }
  }
}

/**
 * Property selection for a site
 */
async function setupPropertyMapping(
  rl: readline.Interface,
  siteUrl: string
): Promise<void> {
  console.log('')
  console.log('🔗 PROPERTY MAPPING')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log('')
  console.log(`Configuring properties for: ${siteUrl}`)
  console.log('')

  // This would typically list available properties from Google APIs
  // For now, prompt for manual entry
  const gscProperty = await prompt(
    rl,
    'Search Console property (e.g., sc-domain:example.com): '
  )
  const ga4PropertyId = await prompt(
    rl,
    'GA4 Property ID (e.g., 123456789): '
  )

  if (gscProperty || ga4PropertyId) {
    savePropertyMapping(siteUrl, {
      gscProperty: gscProperty || undefined,
      ga4PropertyId: ga4PropertyId || undefined,
    })
    console.log('\n✅ Property mapping saved!')
  }
}

// ============================================================================
// Main Setup Flow
// ============================================================================

/**
 * Run the complete setup wizard
 */
export async function runSetupWizard(siteUrl?: string): Promise<void> {
  const rl = createReadlineInterface()

  try {
    showWelcome()

    // Check existing credentials
    if (hasGoogleCredentials()) {
      console.log('ℹ️  Google credentials already configured.')
      const reconfigure = await promptYesNo(rl, 'Would you like to reconfigure?')
      if (!reconfigure) {
        console.log('⏭️  Keeping existing Google configuration.')
      } else {
        await setupGoogleOAuth(rl)
      }
    } else {
      await setupGoogleOAuth(rl)
    }

    // Backlink setup
    if (hasBacklinkCredentials()) {
      console.log(`\nℹ️  Backlink API already configured (${hasBacklinkCredentials()}).`)
      const reconfigure = await promptYesNo(rl, 'Would you like to reconfigure?')
      if (reconfigure) {
        await setupBacklinkAPI(rl)
      }
    } else {
      await setupBacklinkAPI(rl)
    }

    // Property mapping if site URL provided
    if (siteUrl) {
      await setupPropertyMapping(rl, siteUrl)
    }

    // Final summary
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('                    SETUP COMPLETE')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')

    printCredentialSummary()

    // Security reminder
    console.log('💾 Configuration saved to:')
    console.log(`   ${getConfigFile()}`)
    console.log('')
    console.log('⚠️  Security Notes:')
    console.log('   • This file contains sensitive credentials')
    console.log('   • It is stored in your home directory, NOT your project')
    console.log('   • Never commit this file to version control')
    console.log('')
    console.log('🚀 Ready to analyze! Run: /seo')
    console.log('')

    checkGitSafety()
  } finally {
    rl.close()
  }
}

/**
 * Quick setup check - returns true if ready, false if setup needed
 */
export function checkSetupStatus(): {
  ready: boolean
  hasGoogle: boolean
  hasBacklinks: boolean
  message: string
} {
  const hasGoogle = hasGoogleCredentials()
  const backlinks = hasBacklinkCredentials()

  if (!hasGoogle && !backlinks) {
    return {
      ready: false,
      hasGoogle: false,
      hasBacklinks: false,
      message: 'No credentials configured. Run /seo --setup to get started.',
    }
  }

  if (!hasGoogle) {
    return {
      ready: true, // Can still run crawl-only
      hasGoogle: false,
      hasBacklinks: !!backlinks,
      message: 'Running in crawl-only mode. Run /seo --setup to add Google APIs for better insights.',
    }
  }

  return {
    ready: true,
    hasGoogle: true,
    hasBacklinks: !!backlinks,
    message: backlinks
      ? 'All data sources configured!'
      : 'Google APIs configured. Backlink API optional.',
  }
}

/**
 * Prompt user to setup if no credentials found
 */
export async function promptSetupIfNeeded(): Promise<boolean> {
  const status = checkSetupStatus()

  if (status.ready && status.hasGoogle) {
    return true // Ready to proceed
  }

  if (!status.hasGoogle) {
    console.log('')
    console.log('🔧 SETUP NEEDED')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('I couldn\'t find your configuration file. This is normal for')
    console.log('first-time users!')
    console.log('')
    console.log('To get the most out of this tool, you\'ll need to connect your')
    console.log('Google Search Console and Analytics accounts.')
    console.log('')

    const rl = createReadlineInterface()

    try {
      const choice = await promptChoice(rl, 'Would you like to set that up now?', [
        'Yes, let\'s configure (opens browser for Google sign-in)',
        'Skip for now (run with limited features)',
        'I have credentials to enter manually',
      ])

      if (choice === 1) {
        await runSetupWizard()
        return true
      }

      if (choice === 2) {
        console.log('')
        console.log('⏭️  Running in crawl-only mode.')
        console.log('   Some features will be unavailable without Google API access.')
        console.log('   Run /seo --setup later to configure.')
        console.log('')
        return true
      }

      if (choice === 3) {
        await setupGoogleOAuth(rl)
        return hasGoogleCredentials()
      }

      return false
    } finally {
      rl.close()
    }
  }

  return status.ready
}
