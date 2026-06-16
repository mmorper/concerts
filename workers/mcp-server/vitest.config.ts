import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Isolated from the repo-root Vite config (the React app). The tool tests are pure
// narration functions, so a plain Node environment is all they need.
//
// The inline plugin mirrors wrangler.toml's `[[rules]] type = "Text"` for **/*.md, so
// `import QUERY_PROMPT from "../prompts/query.md"` resolves to the file's text in tests
// the same way it does in the Worker bundle.
export default defineConfig({
  plugins: [
    {
      name: "md-as-text",
      transform(_code, id) {
        if (!id.endsWith(".md")) return null;
        const text = readFileSync(id, "utf8");
        return { code: `export default ${JSON.stringify(text)};`, map: null };
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: __dirname,
  },
});
