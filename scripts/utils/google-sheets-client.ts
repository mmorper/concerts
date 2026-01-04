import { google } from 'googleapis'

/**
 * Google Sheets API Client
 * Handles OAuth authentication and data fetching
 */

export interface RawConcertRow {
  date: string
  headliner: string
  genre: string
  opener: string
  venue: string
  cityState: string
  reference?: string
  openers: string[] // Parsed from Opener_ columns
}

export class GoogleSheetsClient {
  private sheets
  private auth

  constructor(config: {
    clientId: string
    clientSecret: string
    redirectUri: string
    refreshToken: string
  }) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )

    this.auth.setCredentials({
      refresh_token: config.refreshToken,
    })

    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  /**
   * Parse header row to create column name → index mapping
   */
  private parseHeaders(headerRow: string[]): Map<string, number> {
    const columnMap = new Map<string, number>()

    headerRow.forEach((header, index) => {
      const normalizedHeader = header.trim().toLowerCase()
      columnMap.set(normalizedHeader, index)
    })

    return columnMap
  }

  /**
   * Get column index by name with fallback
   */
  private getColumnIndex(
    columnMap: Map<string, number>,
    ...possibleNames: string[]
  ): number | undefined {
    for (const name of possibleNames) {
      const index = columnMap.get(name.toLowerCase())
      if (index !== undefined) {
        return index
      }
    }
    return undefined
  }

  /**
   * Fetch concert data from Google Sheet
   */
  async fetchConcerts(spreadsheetId: string, range: string): Promise<RawConcertRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        console.log('No data found in sheet')
        return []
      }

      // First row is headers
      const headerRow = rows[0]
      const columnMap = this.parseHeaders(headerRow)

      // Identify required columns
      const dateCol = this.getColumnIndex(columnMap, 'date')
      const headlinerCol = this.getColumnIndex(columnMap, 'headliner')
      const venueCol = this.getColumnIndex(columnMap, 'venue')

      // City/State can be either a combined column or separate columns
      const cityStateCol = this.getColumnIndex(columnMap, 'city/state', 'citystate')
      const cityCol = this.getColumnIndex(columnMap, 'city')
      const stateCol = this.getColumnIndex(columnMap, 'state')

      // Validate required columns
      const missingColumns: string[] = []
      if (dateCol === undefined) missingColumns.push('Date')
      if (headlinerCol === undefined) missingColumns.push('Headliner')
      if (venueCol === undefined) missingColumns.push('Venue')

      // Either combined City/State OR separate City + State columns are required
      if (cityStateCol === undefined && (cityCol === undefined || stateCol === undefined)) {
        missingColumns.push('City/State (or separate City and State columns)')
      }

      if (missingColumns.length > 0) {
        throw new Error(
          `Missing required columns: ${missingColumns.join(', ')}. ` +
          `Available columns: ${headerRow.join(', ')}`
        )
      }

      // Identify optional columns
      const genreCol = this.getColumnIndex(columnMap, 'genre_headliner', 'genre')
      const openerCol = this.getColumnIndex(columnMap, 'opener')
      const referenceCol = this.getColumnIndex(columnMap, 'reference')

      // Log warnings for missing optional columns
      if (genreCol === undefined) {
        console.warn('⚠️  Genre column not found - genre field will be empty')
      }
      if (openerCol === undefined) {
        console.warn('⚠️  Opener column not found - primary opener field will be empty')
      }

      // Find all Opener_N columns (Opener_1, Opener_2, etc.)
      const openerColumns: number[] = []
      for (let i = 1; i <= 15; i++) {
        const col = this.getColumnIndex(columnMap, `opener_${i}`)
        if (col !== undefined) {
          openerColumns.push(col)
        }
      }

      console.log(`📋 Parsed ${headerRow.length} columns from header row`)
      console.log(`   Required: Date(${dateCol}), Headliner(${headlinerCol}), Venue(${venueCol})`)
      if (cityStateCol !== undefined) {
        console.log(`   Location: City/State(${cityStateCol}) [combined column]`)
      } else {
        console.log(`   Location: City(${cityCol}), State(${stateCol}) [separate columns]`)
      }
      console.log(`   Optional: Genre(${genreCol ?? 'missing'}), Opener(${openerCol ?? 'missing'}), Reference(${referenceCol ?? 'missing'})`)
      console.log(`   Found ${openerColumns.length} Opener_N columns`)

      // Skip header row, parse data rows
      const parsedRows = rows.slice(1).map((row, index) => {
        try {
          const date = (row[dateCol!] || '').trim()
          const headliner = (row[headlinerCol!] || '').trim()
          const genre = genreCol !== undefined ? (row[genreCol] || '').trim() : ''
          const opener = openerCol !== undefined ? (row[openerCol] || '').trim() : ''
          const venue = (row[venueCol!] || '').trim()

          // Get cityState from either combined column or separate City + State columns
          let cityState = ''
          if (cityStateCol !== undefined) {
            cityState = (row[cityStateCol] || '').trim()
          } else if (cityCol !== undefined && stateCol !== undefined) {
            const city = (row[cityCol] || '').trim()
            const state = (row[stateCol] || '').trim()
            cityState = `${city}, ${state}`
          }

          const reference = referenceCol !== undefined ? row[referenceCol] : undefined

          // Parse additional openers from Opener_1 through Opener_N columns
          const openers: string[] = []
          for (const col of openerColumns) {
            if (row[col] && row[col].trim()) {
              openers.push(row[col].trim())
            }
          }

          // Debug: Log Howard Jones concert opener data
          if (headliner.includes('Howard') && date.includes('2024')) {
            console.log(`\n🐛 DEBUG: ${headliner} @ ${date}`)
            console.log(`   Venue: "${venue}"`)
            console.log(`   Opener column value: "${opener}"`)
            console.log(`   Opener_N columns (indices): ${JSON.stringify(openerColumns.slice(0, 5))}`)
            console.log(`   Parsed openers array: ${JSON.stringify(openers)}`)
            console.log(`   Raw row length: ${row.length}`)
            for (let i = 0; i < Math.min(5, openerColumns.length); i++) {
              const colIdx = openerColumns[i]
              const val = row[colIdx]
              console.log(`   Opener_${i+1} (col ${colIdx}): "${val}" [type: ${typeof val}, empty: ${!val}]`)
            }
          }

          return {
            date,
            headliner,
            genre,
            opener,
            venue,
            cityState,
            reference,
            openers,
          } as RawConcertRow
        } catch (error) {
          console.error(`Error parsing row ${index + 2}:`, error) // +2 because we skipped header
          return null
        }
      })

      return parsedRows.filter((row): row is RawConcertRow => row !== null)
    } catch (error) {
      console.error('Failed to fetch data from Google Sheets:', error)
      throw error
    }
  }
}

/**
 * Helper to get OAuth credentials (for initial setup)
 */
export async function getAuthUrl(clientId: string, clientSecret: string, redirectUri: string): Promise<string> {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']

  return auth.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  })
}

/**
 * Helper to exchange auth code for tokens (for initial setup)
 */
export async function getTokensFromCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const { tokens } = await auth.getToken(code)
  return tokens
}
