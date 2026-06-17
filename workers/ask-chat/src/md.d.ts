// wrangler.toml has a Text rule for **/*.md, so the reused module's prompt import (and any
// here) resolves as a string. Mirrors workers/mcp-server/src/md.d.ts.
declare module "*.md" {
  const content: string;
  export default content;
}
