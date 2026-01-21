#!/usr/bin/env npx tsx
/**
 * Test GSC API access
 */
import { google } from 'googleapis'
import * as dotenv from 'dotenv'
dotenv.config()

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN_SEO })

const searchconsole = google.searchconsole({ version: 'v1', auth })

async function test() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 28)

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  const result = await searchconsole.searchanalytics.query({
    siteUrl: 'sc-domain:concerts.morperhaus.org',
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page'],
      rowLimit: 10,
    },
  })

  console.log(`\n📊 GSC DATA (${formatDate(startDate)} to ${formatDate(endDate)})`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  let totalClicks = 0
  let totalImpressions = 0

  result.data.rows?.forEach((row) => {
    const page = row.keys?.[0]?.replace('https://concerts.morperhaus.org', '') || '/'
    const clicks = row.clicks || 0
    const impressions = row.impressions || 0
    const ctr = ((row.ctr || 0) * 100).toFixed(1)
    const position = row.position?.toFixed(1) || '0'

    console.log(
      `  ${page.padEnd(40)} ${clicks.toString().padStart(4)} clicks  ${impressions.toString().padStart(6)} imp  ${ctr}% CTR  #${position}`
    )
    totalClicks += clicks
    totalImpressions += impressions
  })

  console.log(
    `\n  TOTALS:${' '.repeat(32)} ${totalClicks.toString().padStart(4)} clicks  ${totalImpressions.toString().padStart(6)} imp`
  )
}

test().catch((e) => console.error('❌ Error:', e.message))
