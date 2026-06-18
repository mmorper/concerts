import { defineConfig } from "vitest/config";

// Pure-logic tests run in node. The Durable Object + KV integration tests (cap boundary
// under concurrency, kill-switch modes) need @cloudflare/vitest-pool-workers and land with
// the gate layer (#139 remaining).
export default defineConfig({
  plugins: [
    // The reused MCP module imports its system prompt as text (`import X from
    // "../prompts/query.md"`), which wrangler resolves via its Text rule at build time. Mirror
    // that here so any test that transitively pulls in the shared tool fns (e.g. tools-bridge)
    // loads the .md as a string instead of failing import analysis.
    {
      name: "md-as-string",
      enforce: "pre",
      transform(code: string, id: string) {
        if (id.endsWith(".md")) {
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
