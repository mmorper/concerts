import { defineConfig } from "vitest/config";

// Pure-logic tests run in node. The Durable Object + KV integration tests (cap boundary
// under concurrency, kill-switch modes) need @cloudflare/vitest-pool-workers and land with
// the gate layer (#139 remaining).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
