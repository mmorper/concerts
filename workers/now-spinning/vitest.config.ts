import { defineConfig } from "vitest/config";

// Isolated from the repo-root Vite config (the React app). The lookup is pure functions over
// small JSON files, so a plain Node environment is all the tests need.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: __dirname,
  },
});
