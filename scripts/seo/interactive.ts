/**
 * Interactive Mode for SEO Analysis Tool
 *
 * Provides a user-friendly menu system for non-CLI-native users.
 * Wraps the existing analysis functions with guided prompts.
 */

import * as readline from 'readline'
import type {
  CorrelationInsight,
  ActionablePlaybook,
  AnalysisContext,
  SiteStats,
  PageAnalysis,
  GSCData,
  GA4Data,
  BacklinkData,
  SEOAnalysisConfig,
} from './types.js'
import { generatePlaybook } from './insights/playbooks.js'

// ============================================================================
// Readline Utilities
// ============================================================================

let rl: readline.Interface | null = null

function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }
  return rl
}

export function closeReadline(): void {
  if (rl) {
    rl.close()
    rl = null
  }
}

export async function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

export async function promptChoice(question: string, max: number): Promise<number> {
  while (true) {
    const answer = await prompt(question)
    const num = parseInt(answer, 10)
    if (!isNaN(num) && num >= 1 && num <= max) {
      return num
    }
    if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'quit') {
      return -1
    }
    console.log(`  Please enter a number 1-${max}, or 'q' to quit.`)
  }
}

export async function pressEnter(message: string = 'Press Enter to continue...'): Promise<void> {
  await prompt(message)
}

// ============================================================================
// Display Utilities
// ============================================================================

export function clearScreen(): void {
  // Don't clear in non-TTY environments
  if (process.stdout.isTTY) {
    console.clear()
  }
}

export function printHeader(title: string): void {
  const line = '═'.repeat(60)
  console.log(`\n${line}`)
  console.log(`  ${title}`)
  console.log(`${line}\n`)
}

export function printDivider(): void {
  console.log('─'.repeat(60))
}

export function getGrade(score: number): { grade: string; label: string; emoji: string } {
  if (score >= 90) return { grade: 'A', label: 'Excellent', emoji: '🌟' }
  if (score >= 80) return { grade: 'B', label: 'Good', emoji: '✅' }
  if (score >= 70) return { grade: 'C', label: 'Fair', emoji: '⚠️' }
  if (score >= 60) return { grade: 'D', label: 'Poor', emoji: '🔶' }
  return { grade: 'F', label: 'Critical', emoji: '🔴' }
}

export function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴'
    case 'warning':
      return '⚠️'
    case 'opportunity':
      return '💡'
    default:
      return '•'
  }
}

export function getImpactLabel(impact: string): string {
  switch (impact) {
    case 'high':
      return 'High Impact'
    case 'medium':
      return 'Medium Impact'
    case 'low':
      return 'Low Impact'
    default:
      return impact
  }
}

// ============================================================================
// Main Menu
// ============================================================================

export async function showMainMenu(): Promise<'full' | 'quick' | 'compare' | 'export' | 'quit'> {
  printHeader('SEO Analysis Tool')

  console.log('  What would you like to do?\n')
  console.log('  [1] Full analysis          Run complete SEO audit with action items')
  console.log('  [2] Quick score check      Just show the score (fast)')
  console.log('  [3] Compare progress       See what changed since last run')
  console.log('  [4] Export for sharing     Generate HTML or CSV report')
  console.log('  [5] Quit\n')

  const choice = await promptChoice('  Your choice (1-5): ', 5)

  switch (choice) {
    case 1:
      return 'full'
    case 2:
      return 'quick'
    case 3:
      return 'compare'
    case 4:
      return 'export'
    case 5:
    case -1:
    default:
      return 'quit'
  }
}

// ============================================================================
// Post-Analysis Menu
// ============================================================================

export interface AnalysisResult {
  score: number
  insights: CorrelationInsight[]
  context: AnalysisContext
  dateStr: string
}

export async function showPostAnalysisMenu(
  result: AnalysisResult
): Promise<'action-items' | 'fix-issue' | 'save' | 'done'> {
  const { grade, label, emoji } = getGrade(result.score)

  printDivider()
  console.log(`\n${emoji} Analysis complete: ${result.score}/100 (${grade} Grade - ${label})\n`)

  if (result.insights.length > 0) {
    console.log(`  Found ${result.insights.length} issue${result.insights.length > 1 ? 's' : ''} to review:\n`)

    result.insights.slice(0, 5).forEach((insight, i) => {
      const emoji = getSeverityEmoji(insight.severity)
      const impact = getImpactLabel(insight.estimatedImpact)
      console.log(`  #${i + 1} ${emoji}  ${insight.title} (${impact.toLowerCase()})`)
    })

    if (result.insights.length > 5) {
      console.log(`  ... and ${result.insights.length - 5} more`)
    }
    console.log()
  } else {
    console.log('  No issues found! Your site is in great shape.\n')
  }

  console.log('  What next?')
  console.log('  [1] Show action items for all issues')
  console.log('  [2] Get detailed help for a specific issue')
  console.log('  [3] Save report and exit')
  console.log('  [4] Exit without saving\n')

  const choice = await promptChoice('  Your choice (1-4): ', 4)

  switch (choice) {
    case 1:
      return 'action-items'
    case 2:
      return 'fix-issue'
    case 3:
      return 'save'
    case 4:
    case -1:
    default:
      return 'done'
  }
}

// ============================================================================
// Action Items Display
// ============================================================================

export function displayActionItems(insights: CorrelationInsight[]): void {
  printHeader('ACTION ITEMS (in order of impact)')

  // Sort by severity (critical first) then impact
  const sorted = [...insights].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, opportunity: 2 }
    const impactOrder = { high: 0, medium: 1, low: 2 }

    const sevA = severityOrder[a.severity as keyof typeof severityOrder] ?? 3
    const sevB = severityOrder[b.severity as keyof typeof severityOrder] ?? 3

    if (sevA !== sevB) return sevA - sevB

    const impA = impactOrder[a.estimatedImpact as keyof typeof impactOrder] ?? 3
    const impB = impactOrder[b.estimatedImpact as keyof typeof impactOrder] ?? 3

    return impA - impB
  })

  sorted.forEach((insight, i) => {
    const emoji = getSeverityEmoji(insight.severity)
    const impact = getImpactLabel(insight.estimatedImpact)

    console.log(`\n  ${i + 1}. ${impact.toUpperCase()} - ${insight.title}`)
    console.log(`     ${emoji} ${insight.description}`)
    console.log(`     → ${insight.recommendation}`)
    if (insight.affectedPages.length > 0 && insight.affectedPages.length <= 3) {
      console.log(`     Pages: ${insight.affectedPages.join(', ')}`)
    } else if (insight.affectedPages.length > 3) {
      console.log(`     Pages: ${insight.affectedPages.length} affected`)
    }
  })

  console.log('\n  ────────────────────────────────────────────────────────')
  console.log(`  💡 Tip: Run '/seo' again and select "Get detailed help"`)
  console.log(`     to see step-by-step instructions for any issue.\n`)
}

// ============================================================================
// Issue Selection
// ============================================================================

export async function selectIssue(insights: CorrelationInsight[]): Promise<number> {
  console.log('\n  Which issue would you like help with?\n')

  insights.slice(0, 10).forEach((insight, i) => {
    const emoji = getSeverityEmoji(insight.severity)
    console.log(`  [${i + 1}] ${emoji} ${insight.title}`)
  })

  if (insights.length > 10) {
    console.log(`  ... (${insights.length - 10} more)`)
  }

  console.log()
  const choice = await promptChoice(`  Your choice (1-${Math.min(insights.length, 10)}): `, Math.min(insights.length, 10))

  return choice - 1 // Convert to 0-indexed
}

// ============================================================================
// Playbook Display
// ============================================================================

export function displayPlaybook(playbook: ActionablePlaybook): void {
  const { insight } = playbook

  printHeader(`FIX: ${insight.title}`)

  // Why it matters
  console.log('  WHY IT MATTERS')
  console.log(`  ${insight.description}`)
  console.log()

  // Current state
  console.log('  CURRENT STATE')
  console.log(`  ${playbook.diagnosis.current}`)
  if (playbook.diagnosis.gap) {
    console.log(`  Gap: ${playbook.diagnosis.gap}`)
  }
  console.log()

  // How to fix
  console.log(`  HOW TO FIX (${playbook.fix.steps.length} steps)\n`)
  playbook.fix.steps.forEach((step, i) => {
    console.log(`  Step ${i + 1}: ${step}`)
  })

  // Code snippet
  if (playbook.fix.codeSnippet) {
    console.log('\n  ┌' + '─'.repeat(58))
    playbook.fix.codeSnippet.split('\n').forEach((line) => {
      console.log(`  │ ${line}`)
    })
    console.log('  └' + '─'.repeat(58))
  }

  // Verification
  console.log('\n  HOW TO VERIFY')
  console.log(`  Where: ${playbook.verification.method}`)
  console.log(`  When: Check in ${playbook.verification.checkAfter}`)
  console.log(`  Target: ${playbook.verification.target}`)

  // Impact
  console.log('\n  EXPECTED IMPACT')
  console.log(`  Metric: ${playbook.impact.metric}`)
  console.log(`  Estimate: ${playbook.impact.estimate}`)
  console.log(`  Timeframe: ${playbook.impact.timeframe}`)
  console.log()
}

// ============================================================================
// Progress Comparison Display
// ============================================================================

export interface ComparisonData {
  current: { score: number; date: string; insights: CorrelationInsight[] }
  baseline: { score: number; date: string; insights: CorrelationInsight[] }
}

export function displayComparison(comparison: ComparisonData): void {
  printHeader('PROGRESS SINCE LAST ANALYSIS')

  const scoreDiff = comparison.current.score - comparison.baseline.score
  const emoji = scoreDiff > 0 ? '🎉' : scoreDiff < 0 ? '📉' : '➡️'
  const diffStr = scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`

  console.log(`  Last run: ${comparison.baseline.date}`)
  console.log(`  Today: ${comparison.current.date}`)
  console.log()
  console.log(`  Score: ${comparison.baseline.score} → ${comparison.current.score}  (${diffStr} points) ${emoji}`)
  console.log()

  // Find fixed issues (in baseline but not current)
  const baselineTitles = new Set(comparison.baseline.insights.map((i) => i.title))
  const currentTitles = new Set(comparison.current.insights.map((i) => i.title))

  const fixed = comparison.baseline.insights.filter((i) => !currentTitles.has(i.title))
  const stillOpen = comparison.current.insights.filter((i) => baselineTitles.has(i.title))
  const newIssues = comparison.current.insights.filter((i) => !baselineTitles.has(i.title))

  if (fixed.length > 0) {
    console.log('  ✅ FIXED')
    fixed.forEach((i) => console.log(`     • ${i.title}`))
    console.log()
  }

  if (stillOpen.length > 0) {
    console.log('  ⚠️  STILL OPEN')
    stillOpen.forEach((i) => console.log(`     • ${i.title}`))
    console.log()
  }

  if (newIssues.length > 0) {
    console.log('  🆕 NEW ISSUES')
    newIssues.forEach((i) => console.log(`     • ${i.title}`))
    console.log()
  }

  // Next milestone
  if (comparison.current.score < 95) {
    const pointsNeeded = 95 - comparison.current.score
    console.log(`  📊 NEXT MILESTONE`)
    console.log(`     Score 95 requires: +${pointsNeeded} points`)
    if (comparison.current.insights.length > 0) {
      console.log(`     Suggested focus: ${comparison.current.insights[0].title}`)
    }
    console.log()
  }
}

// ============================================================================
// Export Menu
// ============================================================================

export async function showExportMenu(): Promise<'html' | 'csv' | 'md' | 'back'> {
  printHeader('EXPORT OPTIONS')

  console.log('  [1] HTML report    Shareable webpage with embedded styles')
  console.log('  [2] CSV export     Spreadsheet with all data (multiple files)')
  console.log('  [3] Markdown       Text report for documentation')
  console.log('  [4] Back to main menu\n')

  const choice = await promptChoice('  Your choice (1-4): ', 4)

  switch (choice) {
    case 1:
      return 'html'
    case 2:
      return 'csv'
    case 3:
      return 'md'
    case 4:
    case -1:
    default:
      return 'back'
  }
}

// ============================================================================
// Quick Score Display
// ============================================================================

export function displayQuickScore(score: number, url: string): void {
  const { grade, label, emoji } = getGrade(score)

  console.log(`\n  ${emoji} ${url}`)
  console.log(`  SEO Score: ${score}/100 (${grade} - ${label})\n`)
}

// ============================================================================
// Context Builder Helper
// ============================================================================

export function buildAnalysisContext(
  crawlData: PageAnalysis[],
  gscData: GSCData | null | undefined,
  ga4Data: GA4Data | null | undefined,
  backlinkData: BacklinkData | null | undefined,
  siteStats: SiteStats
): AnalysisContext {
  // Calculate average CTR from GSC data
  const avgCTR =
    gscData && gscData.pages.length > 0
      ? gscData.pages.reduce((sum, p) => sum + p.ctr, 0) / gscData.pages.length
      : 0.03 // Default 3%

  // Calculate average bounce rate from GA4 data
  const avgBounceRate =
    ga4Data && ga4Data.pageMetrics.length > 0
      ? ga4Data.pageMetrics.reduce((sum, p) => sum + p.bounceRate, 0) / ga4Data.pageMetrics.length
      : 0.5 // Default 50%

  return {
    config: {} as SEOAnalysisConfig,
    crawlData,
    gscData: gscData || undefined,
    ga4Data: ga4Data || undefined,
    backlinkData: backlinkData || undefined,
    siteStats,
    avgCTR,
    avgBounceRate,
  }
}
