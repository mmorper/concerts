# Testing Guide

## Overview

This project uses Puppeteer for visual testing. Currently, only a basic sanity check is implemented. Comprehensive scene-by-scene visual testing is planned for v1.1+.

## Current Test Coverage

| Test          | Purpose                   | Status          |
|---------------|---------------------------|-----------------|
| `test:sanity` | Page load verification    | ✅ Active       |
| Scene-specific tests | Visual regression per scene | 📋 Planned (v1.1) |

## Running Tests

```bash
# Start dev server first (in separate terminal)
npm run dev

# Run sanity check
npm run test:sanity
```

## When to Use Visual Tests

✅ **Good use cases:**

- Verifying page renders without errors after major changes
- Animation and transition validation
- Viewport-dependent behavior
- Multi-step user interactions

❌ **Not appropriate for:**

- Data transformation logic (use unit tests)
- Pure function testing (use unit tests)
- API response handling (use integration tests)

## Port Assumption

Tests assume the dev server runs on `http://localhost:5179`. If Vite assigns a different port, either:

1. Update the test files, or
2. Configure Vite to use a fixed port in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5179,
    strictPort: true
  }
})
```

## Screenshot Location

All screenshots save to `/tmp/` which:

- Avoids committing test artifacts to git
- Works on macOS and Linux
- Clears on system restart

## Future Work

See [docs/specs/future/visual-testing-suite.md](docs/specs/future/visual-testing-suite.md) for the comprehensive testing roadmap covering all 5 scenes.

### Recommended Tools for v1.1+

- **Vitest** for unit testing data utilities and hooks
- **Playwright** as a Puppeteer alternative (better cross-browser support)
- **Percy or Chromatic** for automated visual regression CI
