/**
 * Unified Test Runner for Morperhaus Concert Archives
 *
 * Orchestrates the complete test suite:
 * - Data Pipeline Tests (Vitest)
 * - Scene Visual Tests (Puppeteer)
 * - Coverage Reports
 *
 * Usage:
 *   tsx scripts/run-tests.ts [options]
 *
 * Options:
 *   --pipeline     Run only pipeline tests
 *   --scenes       Run only scene tests
 *   --coverage     Run with coverage report
 *   --quick        Run pipeline tests only (no Puppeteer)
 */

import { spawn } from 'child_process'

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

interface TestResult {
  name: string
  passed: number
  failed: number
  duration: number
  exitCode: number
}

const results: TestResult[] = []

/**
 * Print formatted section header
 */
function printHeader(title: string) {
  console.log('\n' + colors.bright + colors.cyan + '━'.repeat(60) + colors.reset)
  console.log(colors.bright + colors.cyan + `  ${title}` + colors.reset)
  console.log(colors.bright + colors.cyan + '━'.repeat(60) + colors.reset + '\n')
}

/**
 * Print formatted message
 */
function printMessage(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const icon = {
    info: colors.blue + 'ℹ' + colors.reset,
    success: colors.green + '✓' + colors.reset,
    error: colors.red + '✗' + colors.reset,
    warning: colors.yellow + '⚠' + colors.reset,
  }[type]

  console.log(`${icon} ${message}`)
}

/**
 * Run a command and capture output
 */
function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; shell?: boolean } = {}
): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      shell: options.shell ?? true,
      stdio: 'inherit', // Show output in real-time
    })

    proc.on('close', (code) => {
      const duration = Date.now() - startTime
      resolve({
        name: `${command} ${args.join(' ')}`,
        passed: code === 0 ? 1 : 0,
        failed: code === 0 ? 0 : 1,
        duration,
        exitCode: code || 0,
      })
    })
  })
}

/**
 * Run pipeline tests (Vitest)
 */
async function runPipelineTests(coverage: boolean = false): Promise<void> {
  printHeader('🧪 Running Pipeline Tests (Vitest)')

  const args = ['run', 'test:pipeline']
  if (coverage) {
    args.push('--', '--coverage')
  }

  const result = await runCommand('npm', args)
  results.push(result)

  if (result.exitCode === 0) {
    printMessage(`Pipeline tests passed in ${(result.duration / 1000).toFixed(1)}s`, 'success')
  } else {
    printMessage('Pipeline tests failed', 'error')
  }
}

/**
 * Run scene tests (Puppeteer)
 */
async function runSceneTests(): Promise<void> {
  printHeader('🎭 Running Scene Tests (Puppeteer)')

  // This used to probe for a dev server on 5173 and, finding none, print a warning
  // and return — leaving the overall run green while testing no scenes at all.
  // Anyone without a dev server already up (which is anyone running `test:all` on
  // its own, and every release) got a pass that meant nothing.
  //
  // Delegate to the same runner CI uses instead. It builds the app, serves the
  // build, runs every scene test including the smoke gate, and tears the server
  // down — so there is no server to forget to start and nothing to skip. Honour
  // TEST_BASE_URL if it is already set: the runner then reuses that server rather
  // than rebuilding, which keeps the fast local loop fast.
  const reusingServer = Boolean(process.env.TEST_BASE_URL)

  printMessage(
    reusingServer
      ? `Using existing server at ${process.env.TEST_BASE_URL}`
      : 'Building the app and serving it for the scene tests…',
    'info'
  )

  const result = await runCommand('npm', ['run', 'test:scenes:puppeteer'])
  results.push(result)

  if (result.exitCode === 0) {
    printMessage(`Scene tests passed in ${(result.duration / 1000).toFixed(1)}s`, 'success')
  } else {
    printMessage('Scene tests failed', 'error')
  }
}

/**
 * Print summary report
 */
function printSummary() {
  printHeader('📊 Test Suite Summary')

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`${colors.bright}Pipeline Tests:${colors.reset}`)
  const pipelineResults = results.filter((r) => r.name.includes('test:pipeline'))
  if (pipelineResults.length > 0) {
    const pipelinePassed = pipelineResults.every((r) => r.exitCode === 0)
    const icon = pipelinePassed ? colors.green + '✅' : colors.red + '❌'
    console.log(`  ${icon} ${pipelinePassed ? 'All passed' : 'Some failed'}${colors.reset}`)
  }

  console.log(`\n${colors.bright}Scene Tests:${colors.reset}`)
  const sceneResults = results.filter((r) => r.name.includes('test:'))
  if (sceneResults.length > 0) {
    sceneResults.forEach((r) => {
      const scene = r.name.match(/test:(\w+)/)?.[1] || 'unknown'
      const icon = r.exitCode === 0 ? colors.green + '✓' : colors.red + '✗'
      console.log(`  ${icon} ${scene.charAt(0).toUpperCase() + scene.slice(1)}${colors.reset}`)
    })
  } else {
    console.log(`  ${colors.dim}(skipped)${colors.reset}`)
  }

  console.log(`\n${colors.bright}Total:${colors.reset}`)
  console.log(`  Tests Run:    ${totalPassed + totalFailed}`)
  console.log(`  Passed:       ${colors.green}${totalPassed}${colors.reset}`)
  if (totalFailed > 0) {
    console.log(`  Failed:       ${colors.red}${totalFailed}${colors.reset}`)
  }
  console.log(`  Duration:     ${(totalDuration / 1000).toFixed(1)}s`)

  console.log('\n' + colors.cyan + '━'.repeat(60) + colors.reset + '\n')

  // Exit with error if any tests failed
  if (totalFailed > 0) {
    process.exit(1)
  }
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2)
  const runPipeline = args.includes('--pipeline') || args.length === 0
  const runScenes = args.includes('--scenes') || args.length === 0
  const coverage = args.includes('--coverage')
  const quick = args.includes('--quick')

  printHeader('🧪 Morperhaus Test Suite')

  try {
    // Run pipeline tests
    if (runPipeline || quick) {
      await runPipelineTests(coverage)
    }

    // Run scene tests (unless --quick flag)
    if (runScenes && !quick) {
      await runSceneTests()
    }

    // Print summary
    printSummary()
  } catch (error) {
    console.error(colors.red + '\n❌ Test runner encountered an error:' + colors.reset)
    console.error(error)
    process.exit(1)
  }
}

// Run the test suite
main()
