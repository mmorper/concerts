/**
 * Scene test runner.
 *
 * Serves the app, runs every Puppeteer scene test against it, tears the server
 * down, and exits non-zero if any test failed.
 *
 * The point of putting this in one script rather than a pile of CI shell steps
 * is that `npm run test:scenes:puppeteer` then does exactly the same thing on a
 * laptop as it does on a runner — no "works locally, fails in CI" gap caused by
 * a step existing in only one of the two places.
 *
 * Server strategy:
 *   - By default, build the app and serve it with `vite preview`. That is what
 *     actually ships, so it catches build-only breakage a dev server would hide.
 *   - If TEST_BASE_URL is set, skip both and test whatever is already running.
 *     This is the fast local loop against `npm run dev`, and it is also how you
 *     point the suite at a second worktree's server when 5173 is taken.
 */

import { spawn } from 'node:child_process'
import process from 'node:process'

// Smoke first: it is the fastest and the most likely to fail, and when the app
// is broken its output says so far more clearly than a scene test timing out on
// a selector. Everything after it assumes the page renders at all.
const TESTS = [
  'test/scenes/test-smoke.mjs',
  'test/scenes/test-timeline.mjs',
  'test/scenes/test-venues.mjs',
  'test/scenes/test-map.mjs',
  'test/scenes/test-genres.mjs',
  'test/scenes/test-artists.mjs'
]

const PORT = process.env.SCENE_TEST_PORT || '4178'
const externalBaseUrl = process.env.TEST_BASE_URL
const baseUrl = externalBaseUrl || `http://localhost:${PORT}`

/** Run a command to completion, inheriting stdio. Resolves with the exit code. */
function run(command, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options })
    child.on('close', code => resolve(code ?? 1))
  })
}

/** Poll until the server answers, or give up. Vite preview needs a moment to bind. */
async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return true
    } catch {
      // Not up yet.
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

async function main() {
  let server = null

  try {
    if (externalBaseUrl) {
      console.log(`▶ Using existing server at ${baseUrl}\n`)
      if (!(await waitForServer(baseUrl, 5000))) {
        console.error(`✗ Nothing is answering at ${baseUrl}`)
        return 1
      }
    } else {
      console.log('▶ Building the app…\n')
      const buildCode = await run('npm', ['run', 'build'])
      if (buildCode !== 0) {
        console.error('\n✗ Build failed — not running scene tests')
        return buildCode
      }

      console.log(`\n▶ Starting preview server on ${PORT}…`)
      server = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], {
        stdio: 'ignore',
        shell: false
      })

      if (!(await waitForServer(baseUrl))) {
        console.error(`✗ Preview server never came up on ${baseUrl}`)
        return 1
      }
      console.log(`✓ Serving at ${baseUrl}\n`)
    }

    const failed = []
    for (const test of TESTS) {
      console.log(`\n${'─'.repeat(60)}\n▶ ${test}\n${'─'.repeat(60)}`)
      const code = await run('node', [test], {
        env: { ...process.env, TEST_BASE_URL: baseUrl }
      })
      if (code !== 0) failed.push(test)
    }

    console.log(`\n${'═'.repeat(60)}`)
    if (failed.length > 0) {
      console.error(`❌ ${failed.length} of ${TESTS.length} scene test(s) failed:`)
      for (const test of failed) console.error(`   • ${test}`)
      return 1
    }
    console.log(`✅ All ${TESTS.length} scene tests passed`)
    return 0
  } finally {
    // Leave nothing listening behind, whatever happened above.
    if (server) server.kill('SIGTERM')
  }
}

main().then(code => process.exit(code))
