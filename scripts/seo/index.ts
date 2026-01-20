/**
 * SEO Tool v2 Module Exports
 *
 * Central exports for the SEO analysis platform.
 */

// Types
export * from './types.js'

// Credentials
export {
  loadCredentials,
  saveCredentialsToFile,
  hasAnyCredentials,
  hasGoogleCredentials,
  hasBacklinkCredentials,
  getCredentialSummary,
  printCredentialSummary,
  getConfigFile,
  getConfigDir,
} from './credentials.js'

// OAuth
export {
  runOAuthFlow,
  getValidAccessToken,
  canAuthenticateGoogle,
} from './oauth.js'

// Setup
export {
  runSetupWizard,
  checkSetupStatus,
  promptSetupIfNeeded,
} from './setup.js'

// Cache
export {
  readCache,
  writeCache,
  hasValidCache,
  clearDomainCache,
  clearTypeCache,
  clearAllCache,
  getCacheStats,
  printCacheSummary,
  cleanupExpiredCache,
} from './cache.js'

// Google Search Console
export {
  isGSCConfigured,
  fetchGSCData,
  listGSCProperties,
  calculateAverageCTR,
  calculateAveragePosition,
  getTopPagesByClicks,
  getTopQueriesByImpressions,
  findCTROpportunities,
} from './clients/gsc.js'

// Google Analytics 4
export {
  isGA4Configured,
  fetchGA4Data,
  calculateOrganicTrafficPercent,
  findHighBouncePages,
  getTopEngagedPages,
  formatCoreWebVitals,
} from './clients/ga4.js'

// Backlinks
export {
  isBacklinkConfigured,
  getBacklinkProvider,
  getConfiguredProviderName,
  fetchBacklinkData,
} from './clients/backlinks.js'

// Insights
export {
  detectInsights,
  calculateConfidence,
  countInsightsBySeverity,
  urlMatch,
  findCrawlPage,
} from './insights/engine.js'

// Playbooks
export { generatePlaybook, generatePlaybooks } from './insights/playbooks.js'

// Output Formats
export {
  generateHtmlReport,
  generatePagesCSV,
  generateInsightsCSV,
  generateRecommendationsCSV,
  generateScoresCSV,
  generateSummaryCSV,
  generateAllCSV,
  exportToGoogleSheets,
  canExportToSheets,
  type CSVExport,
} from './outputs/index.js'
