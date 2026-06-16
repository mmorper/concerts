// No-op alias for the `ai` (Vercel AI SDK) peer dependency of `agents`.
//
// `agents` lazily `await import("ai")` from its MCP *client* transport to convert tool
// schemas — a path this MCP *server* never executes. Bundling the full `ai` SDK into the
// Worker just to satisfy that dead import is wasteful, so wrangler.toml aliases "ai" here.
// `jsonSchema` is the only export the client path destructures; this passthrough keeps it
// benign if it were ever reached. See wrangler.toml [alias].

export function jsonSchema(schema: unknown): { jsonSchema: unknown } {
  return { jsonSchema: schema };
}
