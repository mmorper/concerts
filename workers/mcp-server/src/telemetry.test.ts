import { describe, it, expect, vi } from "vitest";
import { recordMcpQuery } from "./telemetry.js";
import type { Env } from "./types.js";

// A minimal AnalyticsEngineDataset stub that captures the written data point.
function mockEnv(): { env: Env; writes: Array<Record<string, unknown>> } {
  const writes: Array<Record<string, unknown>> = [];
  const env = {
    MCP_ANALYTICS: {
      writeDataPoint: (p: Record<string, unknown>) => writes.push(p),
    },
  } as unknown as Env;
  return { env, writes };
}

describe("recordMcpQuery", () => {
  it("no-ops when the binding is absent (dev/test, or an undeployed dataset)", () => {
    // Must not throw — telemetry is optional and never breaks a tool call.
    expect(() => recordMcpQuery({} as Env, "search_concerts", "ok")).not.toThrow();
  });

  it("writes [day, tool, source, outcome] with the tool as the index", () => {
    const { env, writes } = mockEnv();
    recordMcpQuery(env, "search_concerts", "ok");
    expect(writes).toHaveLength(1);
    const p = writes[0] as { indexes: string[]; blobs: string[]; doubles: number[] };
    expect(p.indexes).toEqual(["search_concerts"]);
    // blob1 is today's UTC day; blob2..4 are tool / source / outcome.
    expect(p.blobs[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.blobs.slice(1)).toEqual(["search_concerts", "external", "ok"]);
    expect(p.doubles).toEqual([1]);
  });

  it("records the error outcome for a failed tool result", () => {
    const { env, writes } = mockEnv();
    recordMcpQuery(env, "query", "error");
    expect((writes[0] as { blobs: string[] }).blobs[3]).toBe("error");
  });

  it("swallows a throwing binding rather than breaking the tool path", () => {
    const env = {
      MCP_ANALYTICS: {
        writeDataPoint: () => {
          throw new Error("AE down");
        },
      },
    } as unknown as Env;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => recordMcpQuery(env, "surprise_me", "ok")).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
