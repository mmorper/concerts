import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // The workers are self-contained projects — own package.json, own tsconfig,
    // own vitest.config.ts — and this config cannot run their tests: it has no
    // plugin for the `.md` imports they use, so collection dies with
    // "Failed to parse source for import analysis" and reports "no tests".
    //
    // Before this exclusion those files showed up as failures in `npm test`,
    // which was worse than useless: 118 worker tests that pass under their own
    // configs looked broken, and the noise buried the three root suites that
    // are genuinely failing. Run them with `npm run test:workers`.
    exclude: [...configDefaults.exclude, 'workers/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.ts',
        'dist/',
        'workers/', // Covered by each worker's own vitest config
        'scripts/generate-version.ts', // Build-time only
        'scripts/generate-og-simple.ts', // Manual tool
        'scripts/preview-og-crops.ts', // Manual tool
        'scripts/review-venue-photos.ts', // Manual tool
        'scripts/test-places-api.ts', // Development utility
        'scripts/test-setlistfm.ts', // Development utility
      ],
      // Core pipeline scripts should have >85% coverage
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 30000, // 30s for API mock tests
    hookTimeout: 30000, // 30s for setup/teardown
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
