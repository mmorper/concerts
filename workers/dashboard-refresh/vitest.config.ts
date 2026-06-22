import { defineConfig } from "vitest/config";

// Self-contained config so this package's pure-helper tests don't inherit the repo-root vitest
// config (which references a setup file that doesn't exist here). Plain node — the unit tests
// cover normalizeQuery/topTopics/spendWindows/parseCapUsd; the KV/GraphQL/AE I/O isn't unit-tested.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
