import { defineConfig } from 'vitest/config'

// Isolated from the repo-root config, which excludes workers/** and targets the
// React app. worker.js is plain ESM with no imports, so a Node environment plus
// stubs for the Workers globals (fetch, caches, ctx.waitUntil) is all it needs —
// no miniflare, no wrangler in the test path.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js'],
  },
})
