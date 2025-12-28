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

      // Expected columns based on your sheet structure:
      // Date, Headliner, Genre_Headliner, Opener, Venue, City/State, Who, Reference, ...
      // Then parsed columns and Opener_1 through Opener_15

      return rows.map((row, index) => {
        try {
          // Adjust indices based on your actual column order
          const date = row[0] || ''
          const headliner = row[1] || ''
          const genre = row[2] || ''
          const opener = row[3] || '' // Primary opener field
          const venue = row[4] || ''
          const cityState = row[5] || ''
          const reference = row[8] || undefined // Reference column

          // Parse additional openers from Opener_1 through Opener_15 columns
          // Assuming they start at column 18 (adjust based on your sheet)
          const openers: string[] = []
          for (let i = 18; i <= 33; i++) {
            if (row[i] && row[i].trim()) {
              openers.push(row[i].trim())
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
          }
        } catch (error) {
          console.error(`Error parsing row ${index + 1}:`, error)
          return null
        }
      }).filter((row): row is RawConcertRow => row !== null)
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
