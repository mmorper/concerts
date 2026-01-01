import fs from 'fs'
import { execSync } from 'child_process'

// Detect CI environment (Cloudflare Pages, GitHub Actions, etc.)
const isCloudflarePages = process.env.CF_PAGES === '1'
const isCIEnvironment = process.env.CI === 'true' || isCloudflarePages

// Get version string
let gitTag = ''
if (isCloudflarePages && process.env.CF_PAGES_COMMIT_SHA) {
  // Cloudflare Pages: use branch name + short commit
  const cfBranch = process.env.CF_PAGES_BRANCH || 'unknown'
  const shortCommit = process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  gitTag = `${cfBranch}-${shortCommit}`
} else if (isCIEnvironment) {
  // Other CI: fallback to commit hash
  try {
    gitTag = execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim()
  } catch {
    gitTag = 'ci-build'
  }
} else {
  // Local development: try to get git tags
  try {
    gitTag = execSync('git describe --tags --exact-match 2>/dev/null').toString().trim()
  } catch {
    // No exact tag, try with commit count
    try {
      gitTag = execSync('git describe --tags 2>/dev/null').toString().trim()
    } catch {
      gitTag = 'development'
    }
  }
}

// Get commit hash
let commit = 'unknown'
try {
  commit = execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim()
} catch {
  if (isCloudflarePages && process.env.CF_PAGES_COMMIT_SHA) {
    commit = process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  }
}

// Get branch name
let branch = 'unknown'
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null').toString().trim()
} catch {
  if (isCloudflarePages && process.env.CF_PAGES_BRANCH) {
    branch = process.env.CF_PAGES_BRANCH
  }
}

const version = {
  version: gitTag,
  buildTime: new Date().toISOString(),
  commit,
  branch,
}

fs.writeFileSync(
  'public/version.json',
  JSON.stringify(version, null, 2)
)

console.log('✓ Version file generated:', version)
