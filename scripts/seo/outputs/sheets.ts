/**
 * Google Sheets Export
 *
 * Creates a Google Sheets compatible export using the Google Sheets API.
 * Requires OAuth with sheets.spreadsheets scope.
 */

import type { SEOReport } from '../types.js'
import { getValidAccessToken, canAuthenticateGoogle } from '../oauth.js'

// ============================================================================
// Types
// ============================================================================

interface SheetData {
  title: string
  headers: string[]
  rows: (string | number)[][]
}

interface CreateSpreadsheetResponse {
  spreadsheetId: string
  spreadsheetUrl: string
}

// ============================================================================
// Sheet Data Generators
// ============================================================================

function generateSummarySheet(report: SEOReport): SheetData {
  return {
    title: 'Summary',
    headers: ['Metric', 'Value'],
    rows: [
      ['Site', report.metadata.url],
      ['Date', report.metadata.date],
      ['Pages Analyzed', report.metadata.pagesAnalyzed],
      ['Confidence', `${report.metadata.confidence}%`],
      ['Date Range', `${report.metadata.dateRange.start} to ${report.metadata.dateRange.end}`],
      ['', ''],
      ['Overall Score', report.scores.overall],
      ['Technical Foundation', `${report.scores.technical}/25`],
      ['Content Quality', `${report.scores.content}/30`],
      ['Semantic Intelligence', `${report.scores.semantic}/20`],
      ['Authority & Trust', `${report.scores.authority}/15`],
      ['User Experience', `${report.scores.ux}/10`],
      ['AI Agent Readiness', `${report.scores.aiReadiness}/10`],
      ['', ''],
      ['Data Sources', ''],
      ['Crawl', report.metadata.dataSources.crawl ? 'Yes' : 'No'],
      ['GSC', report.metadata.dataSources.gsc ? 'Yes' : 'No'],
      ['GA4', report.metadata.dataSources.ga4 ? 'Yes' : 'No'],
      ['Backlinks', report.metadata.dataSources.backlinks],
    ],
  }
}

function generatePagesSheet(report: SEOReport): SheetData {
  return {
    title: 'Pages',
    headers: [
      'URL',
      'Path',
      'Title',
      'Title Length',
      'Description Length',
      'H1 Count',
      'Has Schema',
      'Has OG',
      'Response Time (ms)',
      'Word Count',
      'Internal Links',
      'External Links',
    ],
    rows: report.crawlData.map((page) => [
      page.url,
      page.url.replace(report.metadata.url, '') || '/',
      page.title || '',
      page.titleLength,
      page.descriptionLength,
      page.h1Count,
      page.hasSchema ? 'Yes' : 'No',
      page.hasOG ? 'Yes' : 'No',
      page.responseTime,
      page.wordCount,
      page.internalLinks,
      page.externalLinks,
    ]),
  }
}

function generateInsightsSheet(report: SEOReport): SheetData {
  return {
    title: 'Insights',
    headers: [
      'Severity',
      'Type',
      'Title',
      'Description',
      'Recommendation',
      'Impact',
      'Data Sources',
      'Affected Pages',
    ],
    rows: report.insights.map((insight) => [
      insight.severity,
      insight.type,
      insight.title,
      insight.description,
      insight.recommendation,
      insight.estimatedImpact,
      insight.dataSources.join(', '),
      insight.affectedPages.length,
    ]),
  }
}

function generateRecommendationsSheet(report: SEOReport): SheetData {
  return {
    title: 'Recommendations',
    headers: [
      'Category',
      'Title',
      'Impact',
      'Effort',
      'Points',
      'Description',
      'Affected Pages',
    ],
    rows: report.recommendations.map((rec) => [
      rec.category,
      rec.title,
      rec.impact,
      rec.effort,
      rec.points,
      rec.description,
      rec.affectedPages?.length || 0,
    ]),
  }
}

function generateGSCPagesSheet(report: SEOReport): SheetData | null {
  if (!report.gscData) return null

  return {
    title: 'GSC Pages',
    headers: ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
    rows: report.gscData.pages.map((page) => [
      page.page,
      page.clicks,
      page.impressions,
      `${(page.ctr * 100).toFixed(2)}%`,
      page.position.toFixed(1),
    ]),
  }
}

function generateGSCQueriesSheet(report: SEOReport): SheetData | null {
  if (!report.gscData) return null

  return {
    title: 'GSC Queries',
    headers: ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
    rows: report.gscData.queries.map((query) => [
      query.query,
      query.clicks,
      query.impressions,
      `${(query.ctr * 100).toFixed(2)}%`,
      query.position.toFixed(1),
    ]),
  }
}

function generateGA4PagesSheet(report: SEOReport): SheetData | null {
  if (!report.ga4Data) return null

  return {
    title: 'GA4 Pages',
    headers: [
      'Page Path',
      'Page Views',
      'Unique Page Views',
      'Avg Time on Page',
      'Bounce Rate',
      'Exit Rate',
    ],
    rows: report.ga4Data.pageMetrics.map((page) => [
      page.pagePath,
      page.pageViews,
      page.uniquePageViews,
      `${page.avgTimeOnPage.toFixed(1)}s`,
      `${(page.bounceRate * 100).toFixed(1)}%`,
      `${(page.exitRate * 100).toFixed(1)}%`,
    ]),
  }
}

function generateBacklinksSheet(report: SEOReport): SheetData | null {
  if (!report.backlinkData) return null

  const metrics = report.backlinkData.metrics

  return {
    title: 'Backlinks',
    headers: ['Metric', 'Value'],
    rows: [
      ['Provider', report.backlinkData.provider],
      ['Domain', report.backlinkData.domain],
      ['Domain Rating/Authority Score', metrics.domainRating || metrics.authorityScore || 0],
      ['Total Backlinks', metrics.totalBacklinks],
      ['Referring Domains', metrics.referringDomains],
      ['Follow Links', metrics.followLinks],
      ['Nofollow Links', metrics.nofollowLinks],
      ['', ''],
      ['Top Referrers', ''],
      ...report.backlinkData.topReferrers.map((ref) => [
        ref.domain,
        `${ref.backlinks} links (DR: ${ref.domainRating || 'N/A'})`,
      ]),
    ],
  }
}

// ============================================================================
// Google Sheets API Integration
// ============================================================================

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function createSpreadsheet(
  accessToken: string,
  title: string,
  sheets: SheetData[]
): Promise<CreateSpreadsheetResponse> {
  // Create the spreadsheet structure
  const spreadsheetBody = {
    properties: {
      title,
    },
    sheets: sheets.map((sheet, index) => ({
      properties: {
        sheetId: index,
        title: sheet.title,
        gridProperties: {
          rowCount: sheet.rows.length + 1,
          columnCount: sheet.headers.length,
        },
      },
    })),
  }

  // Create the spreadsheet
  const createResponse = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(spreadsheetBody),
  })

  if (!createResponse.ok) {
    const error = await createResponse.text()
    throw new Error(`Failed to create spreadsheet: ${error}`)
  }

  const spreadsheet = await createResponse.json()
  const spreadsheetId = spreadsheet.spreadsheetId

  // Populate each sheet with data
  const batchUpdateData = sheets.flatMap((sheet) => {
    const allRows = [sheet.headers, ...sheet.rows]
    return {
      range: `'${sheet.title}'!A1`,
      values: allRows,
    }
  })

  const batchResponse = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchUpdateData,
      }),
    }
  )

  if (!batchResponse.ok) {
    const error = await batchResponse.text()
    throw new Error(`Failed to populate spreadsheet: ${error}`)
  }

  // Apply formatting (bold headers, auto-resize)
  const formatRequests = sheets.map((_, index) => ({
    repeatCell: {
      range: {
        sheetId: index,
        startRowIndex: 0,
        endRowIndex: 1,
      },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true },
          backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
        },
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor)',
    },
  }))

  // Add auto-resize requests
  const resizeRequests = sheets.map((_, index) => ({
    autoResizeDimensions: {
      dimensions: {
        sheetId: index,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: 20, // First 20 columns
      },
    },
  }))

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [...formatRequests, ...resizeRequests],
    }),
  })

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

export async function exportToGoogleSheets(
  report: SEOReport
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Check if Google auth is available
  if (!(await canAuthenticateGoogle())) {
    return {
      success: false,
      error: 'Google OAuth not configured. Run with --setup to configure.',
    }
  }

  // Get access token
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return {
      success: false,
      error: 'Failed to get Google access token. Run with --setup to re-authenticate.',
    }
  }

  // Generate sheet data
  const sheets: SheetData[] = [
    generateSummarySheet(report),
    generatePagesSheet(report),
    generateInsightsSheet(report),
    generateRecommendationsSheet(report),
  ]

  // Add optional sheets based on available data
  const gscPages = generateGSCPagesSheet(report)
  if (gscPages) sheets.push(gscPages)

  const gscQueries = generateGSCQueriesSheet(report)
  if (gscQueries) sheets.push(gscQueries)

  const ga4Pages = generateGA4PagesSheet(report)
  if (ga4Pages) sheets.push(ga4Pages)

  const backlinks = generateBacklinksSheet(report)
  if (backlinks) sheets.push(backlinks)

  // Create the spreadsheet
  const title = `SEO Report - ${new URL(report.metadata.url).hostname} - ${report.metadata.date}`

  try {
    console.log('  📊 Creating Google Sheets spreadsheet...')
    const result = await createSpreadsheet(accessToken, title, sheets)
    console.log(`  ✅ Spreadsheet created: ${result.spreadsheetUrl}`)
    return {
      success: true,
      url: result.spreadsheetUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// Check if Sheets Export is Available
// ============================================================================

export async function canExportToSheets(): Promise<boolean> {
  return canAuthenticateGoogle()
}
