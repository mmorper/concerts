import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.ts',
        'dist/',
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
