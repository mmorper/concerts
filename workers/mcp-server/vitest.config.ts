import { defineConfig } from "vitest/config";

// Isolated from the repo-root Vite config (the React app). The tool tests are pure
// narration functions, so a plain Node environment is all they need.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: __dirname,
  },
});
