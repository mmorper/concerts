/**
 * HTML Report Generator
 *
 * Generates a standalone HTML report with embedded CSS and interactive features.
 */

import type { SEOReport, CorrelationInsight, ActionablePlaybook } from '../types.js'

// ============================================================================
// Styles
// ============================================================================

const CSS = `
<style>
  :root {
    --primary: #6366f1;
    --success: #22c55e;
    --warning: #eab308;
    --danger: #ef4444;
    --bg: #f9fafb;
    --card: #ffffff;
    --text: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
  }

  .container { max-width: 1200px; margin: 0 auto; }

  header {
    text-align: center;
    margin-bottom: 3rem;
  }

  header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  header .meta {
    color: var(--muted);
    font-size: 0.875rem;
  }

  .score-hero {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
    margin-bottom: 2rem;
  }

  .score-hero .score {
    font-size: 5rem;
    font-weight: 700;
    line-height: 1;
  }

  .score-hero .label {
    font-size: 1.25rem;
    opacity: 0.9;
  }

  .score-hero .confidence {
    font-size: 0.875rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .card {
    background: var(--card);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .card h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .score-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .score-bar .label {
    flex: 1;
    font-size: 0.875rem;
  }

  .score-bar .value {
    font-weight: 600;
    font-size: 0.875rem;
    min-width: 60px;
    text-align: right;
  }

  .score-bar .bar {
    width: 100px;
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .score-bar .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .score-bar .bar-fill.good { background: var(--success); }
  .score-bar .bar-fill.medium { background: var(--warning); }
  .score-bar .bar-fill.poor { background: var(--danger); }

  .data-sources {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .data-source {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--card);
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .data-source.active { border: 2px solid var(--success); }
  .data-source.inactive { opacity: 0.5; }

  .insights {
    margin-bottom: 2rem;
  }

  .insight {
    background: var(--card);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--border);
  }

  .insight.critical { border-left-color: var(--danger); }
  .insight.warning { border-left-color: var(--warning); }
  .insight.opportunity { border-left-color: var(--success); }

  .insight h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .insight p {
    color: var(--muted);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .insight .recommendation {
    background: var(--bg);
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .insight .meta {
    display: flex;
    gap: 1rem;
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .pages-table {
    width: 100%;
    border-collapse: collapse;
  }

  .pages-table th,
  .pages-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
  }

  .pages-table th {
    background: var(--bg);
    font-weight: 600;
  }

  .pages-table tr:hover td {
    background: var(--bg);
  }

  .check { color: var(--success); }
  .x { color: var(--danger); }
  .warn { color: var(--warning); }

  .playbook {
    background: var(--card);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .playbook h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .playbook-section {
    margin-bottom: 1.5rem;
  }

  .playbook-section h4 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }

  .playbook-steps {
    list-style: decimal;
    margin-left: 1.5rem;
  }

  .playbook-steps li {
    margin-bottom: 0.5rem;
  }

  .code-snippet {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  footer {
    text-align: center;
    color: var(--muted);
    font-size: 0.75rem;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }

  @media print {
    body { padding: 0; }
    .score-hero { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
`

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getScoreClass(score: number, max: number): string {
  const pct = (score / max) * 100
  if (pct >= 70) return 'good'
  if (pct >= 50) return 'medium'
  return 'poor'
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴'
    case 'warning': return '🟡'
    case 'opportunity': return '🟢'
    default: return '⚪'
  }
}

// ============================================================================
// Section Generators
// ============================================================================

function generateScoreHero(report: SEOReport): string {
  return `
    <div class="score-hero">
      <div class="score">${report.scores.overall}</div>
      <div class="label">Overall SEO Score</div>
      <div class="confidence">${report.metadata.confidence}% confidence based on available data sources</div>
    </div>
  `
}

function generateDataSources(report: SEOReport): string {
  const { dataSources } = report.metadata
  return `
    <div class="data-sources">
      <div class="data-source ${dataSources.crawl ? 'active' : 'inactive'}">
        ${dataSources.crawl ? '✅' : '⬜'} Crawl
      </div>
      <div class="data-source ${dataSources.gsc ? 'active' : 'inactive'}">
        ${dataSources.gsc ? '✅' : '⬜'} Google Search Console
      </div>
      <div class="data-source ${dataSources.ga4 ? 'active' : 'inactive'}">
        ${dataSources.ga4 ? '✅' : '⬜'} Google Analytics 4
      </div>
      <div class="data-source ${dataSources.backlinks !== 'none' ? 'active' : 'inactive'}">
        ${dataSources.backlinks !== 'none' ? '✅' : '⬜'} Backlinks (${dataSources.backlinks})
      </div>
    </div>
  `
}

function generateScoreCards(report: SEOReport): string {
  const { scores } = report
  const categories = [
    { name: 'Technical Foundation', icon: '🔧', score: scores.technical, max: 25 },
    { name: 'Content Quality', icon: '📝', score: scores.content, max: 30 },
    { name: 'Semantic Intelligence', icon: '🧠', score: scores.semantic, max: 20 },
    { name: 'Authority & Trust', icon: '⭐', score: scores.authority, max: 15 },
    { name: 'User Experience', icon: '👤', score: scores.ux, max: 10 },
    { name: 'AI Agent Readiness', icon: '🤖', score: scores.aiReadiness, max: 10 },
  ]

  return `
    <div class="card">
      <h2>📊 Score Breakdown</h2>
      ${categories.map(cat => `
        <div class="score-bar">
          <span class="label">${cat.icon} ${cat.name}</span>
          <span class="value">${cat.score}/${cat.max}</span>
          <div class="bar">
            <div class="bar-fill ${getScoreClass(cat.score, cat.max)}"
                 style="width: ${(cat.score / cat.max) * 100}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function generateInsightsSection(insights: CorrelationInsight[]): string {
  if (insights.length === 0) {
    return '<div class="card"><h2>🔍 Insights</h2><p>No insights detected.</p></div>'
  }

  const grouped = {
    critical: insights.filter(i => i.severity === 'critical'),
    warning: insights.filter(i => i.severity === 'warning'),
    opportunity: insights.filter(i => i.severity === 'opportunity'),
  }

  return `
    <div class="insights">
      <h2 style="margin-bottom: 1rem;">🔍 Correlation Insights</h2>

      ${grouped.critical.length > 0 ? `
        <h3 style="color: var(--danger); margin-bottom: 0.5rem;">🔴 Critical (${grouped.critical.length})</h3>
        ${grouped.critical.map(i => generateInsightCard(i)).join('')}
      ` : ''}

      ${grouped.warning.length > 0 ? `
        <h3 style="color: var(--warning); margin: 1rem 0 0.5rem;">🟡 Warnings (${grouped.warning.length})</h3>
        ${grouped.warning.map(i => generateInsightCard(i)).join('')}
      ` : ''}

      ${grouped.opportunity.length > 0 ? `
        <h3 style="color: var(--success); margin: 1rem 0 0.5rem;">🟢 Opportunities (${grouped.opportunity.length})</h3>
        ${grouped.opportunity.map(i => generateInsightCard(i)).join('')}
      ` : ''}
    </div>
  `
}

function generateInsightCard(insight: CorrelationInsight): string {
  return `
    <div class="insight ${insight.severity}">
      <h3>${getSeverityIcon(insight.severity)} ${escapeHtml(insight.title)}</h3>
      <p>${escapeHtml(insight.description)}</p>
      <div class="recommendation">
        <strong>Recommendation:</strong> ${escapeHtml(insight.recommendation)}
      </div>
      <div class="meta">
        <span>Sources: ${insight.dataSources.join(' + ')}</span>
        <span>Impact: ${insight.estimatedImpact}</span>
        <span>Pages: ${insight.affectedPages.length}</span>
      </div>
    </div>
  `
}

function generatePlaybooksSection(playbooks: ActionablePlaybook[]): string {
  if (playbooks.length === 0) {
    return ''
  }

  return `
    <div class="playbooks">
      <h2 style="margin-bottom: 1rem;">📋 Action Playbooks</h2>
      ${playbooks.slice(0, 5).map(p => generatePlaybookCard(p)).join('')}
    </div>
  `
}

function generatePlaybookCard(playbook: ActionablePlaybook): string {
  return `
    <div class="playbook">
      <h3>${getSeverityIcon(playbook.insight.severity)} ${escapeHtml(playbook.insight.title)}</h3>

      <div class="playbook-section">
        <h4>Diagnosis</h4>
        <p><strong>Current:</strong> ${escapeHtml(playbook.diagnosis.current)}</p>
        <p><strong>Expected:</strong> ${escapeHtml(playbook.diagnosis.expected)}</p>
        <p><strong>Gap:</strong> ${escapeHtml(playbook.diagnosis.gap)}</p>
      </div>

      <div class="playbook-section">
        <h4>Fix</h4>
        <p><strong>${escapeHtml(playbook.fix.summary)}</strong></p>
        <ol class="playbook-steps">
          ${playbook.fix.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
        ${playbook.fix.codeSnippet ? `
          <div class="code-snippet">${escapeHtml(playbook.fix.codeSnippet)}</div>
        ` : ''}
      </div>

      <div class="playbook-section">
        <h4>Expected Impact</h4>
        <p><strong>${escapeHtml(playbook.impact.metric)}:</strong> ${escapeHtml(playbook.impact.estimate)}</p>
        <p><strong>Timeframe:</strong> ${escapeHtml(playbook.impact.timeframe)}</p>
      </div>

      <div class="playbook-section">
        <h4>Verification</h4>
        <p>${escapeHtml(playbook.verification.method)}</p>
        <p><strong>Target:</strong> ${escapeHtml(playbook.verification.target)}</p>
        <p><strong>Re-check:</strong> ${escapeHtml(playbook.verification.checkAfter)}</p>
      </div>
    </div>
  `
}

function generatePagesTable(report: SEOReport): string {
  return `
    <div class="card" style="overflow-x: auto;">
      <h2>📄 Page Analysis</h2>
      <table class="pages-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Title</th>
            <th>Description</th>
            <th>H1</th>
            <th>Schema</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          ${report.crawlData.map(page => {
            const path = page.url.replace(report.metadata.url, '') || '/'
            return `
              <tr>
                <td>${escapeHtml(path)}</td>
                <td class="${page.title ? 'check' : 'x'}">${page.titleLength} chars</td>
                <td class="${page.description ? 'check' : 'x'}">${page.descriptionLength} chars</td>
                <td class="${page.h1Count === 1 ? 'check' : page.h1Count === 0 ? 'x' : 'warn'}">${page.h1Count}</td>
                <td class="${page.hasSchema ? 'check' : 'x'}">${page.hasSchema ? '✓' : '✗'}</td>
                <td>${page.responseTime}ms</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ============================================================================
// Main Export
// ============================================================================

export function generateHtmlReport(report: SEOReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Report - ${escapeHtml(report.metadata.url)} - ${report.metadata.date}</title>
  ${CSS}
</head>
<body>
  <div class="container">
    <header>
      <h1>SEO Analysis Report</h1>
      <div class="meta">
        ${escapeHtml(report.metadata.url)} • ${report.metadata.date} •
        ${report.metadata.pagesAnalyzed} pages analyzed
      </div>
    </header>

    ${generateScoreHero(report)}
    ${generateDataSources(report)}

    <div class="grid">
      ${generateScoreCards(report)}

      <div class="card">
        <h2>📅 Analysis Period</h2>
        <p><strong>From:</strong> ${report.metadata.dateRange.start}</p>
        <p><strong>To:</strong> ${report.metadata.dateRange.end}</p>
        <p style="margin-top: 1rem;"><strong>Version:</strong> ${report.metadata.version}</p>
      </div>
    </div>

    ${generateInsightsSection(report.insights)}
    ${generatePlaybooksSection(report.playbooks)}
    ${generatePagesTable(report)}

    <footer>
      Generated by SEO Tool v${report.metadata.version} •
      ${new Date().toISOString()}
    </footer>
  </div>
</body>
</html>`
}
