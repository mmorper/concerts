export interface Env {
  DATA_BASE_URL: string;
  MCP_QUERY_USAGE: KVNamespace;
  ANTHROPIC_API_KEY?: string;
}

export interface Narration {
  context?: string;
  closingArc?: string;
}

export interface NarrationRecord {
  narration: Narration;
  inputHash: string;
  generatedAt: string;
  promptVersion: number;
}

export type NarrationKind = "venues" | "artists";

export interface QueryUsageRecord {
  tokens: number;
  calls: number;
}

export const QUERY_DAILY_TOKEN_CAP = 250_000;
export const QUERY_DAILY_CALL_CAP = 8;
