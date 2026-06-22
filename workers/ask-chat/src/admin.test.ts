import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Env, SpendStatus } from "./types.js";

// The admin routes are the seam between the Access gate and the control state. We test the
// ROUTING + request validation here (status codes, JSON shapes, the PRG/JSON mode-flip fork),
// and mock the three collaborators — Access (auth), cost (DO-backed spend), control (KV-backed
// mode + IP list) — whose own logic is covered by access/cost/control unit tests. control's IP
// store is mocked statefully so add/remove sequencing through the route is genuinely exercised.

const harness = vi.hoisted(() => ({
  accessOk: true,
  email: "owner@example.com" as string | undefined,
  mode: "on" as "on" | "paused" | "deterministic-only",
  ips: [] as string[],
  spend: {
    day: "2026-06-22",
    committedMicroUsd: 600_000,
    reservedMicroUsd: 50_000,
    capMicroUsd: 833_333,
    fraction: 0.72,
  } as SpendStatus,
}));

vi.mock("./access.js", () => ({
  verifyAccess: vi.fn(async () => (harness.accessOk ? { ok: true, email: harness.email } : { ok: false })),
}));

vi.mock("./cost.js", () => ({
  spendStatus: vi.fn(async () => harness.spend),
}));

vi.mock("./control.js", () => ({
  getMode: vi.fn(async () => harness.mode),
  setMode: vi.fn(async (_env: Env, m: "on" | "paused" | "deterministic-only") => {
    harness.mode = m;
  }),
  getAdminIps: vi.fn(async () => [...harness.ips]),
  setAdminIps: vi.fn(async (_env: Env, ips: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ips) {
      const ip = (raw ?? "").trim();
      if (ip && !seen.has(ip)) {
        seen.add(ip);
        out.push(ip);
      }
    }
    harness.ips = out;
    return out;
  }),
}));

import { handleAdmin } from "./admin.js";

const env = {} as Env;

function call(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(`https://concerts.morperhaus.org${path}`);
  return handleAdmin(new Request(url.toString(), init), env, url);
}

beforeEach(() => {
  harness.accessOk = true;
  harness.email = "owner@example.com";
  harness.mode = "on";
  harness.ips = [];
});

describe("handleAdmin — access gate", () => {
  it("denies every route with 403 when Access fails (fail-closed)", async () => {
    harness.accessOk = false;
    const state = await call("/api/ask/admin/state");
    const page = await call("/api/ask/admin");
    expect(state.status).toBe(403);
    expect(page.status).toBe(403);
  });
});

describe("GET /api/ask/admin/state", () => {
  it("returns mode + spend + adminIps as no-store JSON", async () => {
    harness.mode = "deterministic-only";
    harness.ips = ["1.1.1.1"];
    const res = await call("/api/ask/admin/state");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      mode: "deterministic-only",
      spend: harness.spend,
      adminIps: ["1.1.1.1"],
    });
  });
});

describe("POST /api/ask/admin/ips", () => {
  it("adds an IP and returns the updated list", async () => {
    const res = await call("/api/ask/admin/ips", {
      method: "POST",
      body: JSON.stringify({ op: "add", ip: "203.0.113.7" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ adminIps: ["203.0.113.7"] });
  });

  it("removes an IP and returns the remaining list", async () => {
    harness.ips = ["203.0.113.7", "198.51.100.4"];
    const res = await call("/api/ask/admin/ips", {
      method: "POST",
      body: JSON.stringify({ op: "remove", ip: "203.0.113.7" }),
    });
    expect(await res.json()).toEqual({ adminIps: ["198.51.100.4"] });
  });

  it("trims the submitted IP before storing", async () => {
    const res = await call("/api/ask/admin/ips", {
      method: "POST",
      body: JSON.stringify({ op: "add", ip: "  203.0.113.7  " }),
    });
    expect(await res.json()).toEqual({ adminIps: ["203.0.113.7"] });
  });

  it("rejects an unknown op with 400", async () => {
    const res = await call("/api/ask/admin/ips", {
      method: "POST",
      body: JSON.stringify({ op: "nuke", ip: "203.0.113.7" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing/empty IP with 400", async () => {
    const res = await call("/api/ask/admin/ips", {
      method: "POST",
      body: JSON.stringify({ op: "add", ip: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid JSON body with 400", async () => {
    const res = await call("/api/ask/admin/ips", { method: "POST", body: "{not json" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ask/admin/mode", () => {
  it("flips the mode and returns JSON when ?format=json", async () => {
    const res = await call("/api/ask/admin/mode?to=paused&format=json", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, mode: "paused" });
    expect(harness.mode).toBe("paused");
  });

  it("returns JSON when the Accept header asks for it", async () => {
    const res = await call("/api/ask/admin/mode?to=deterministic-only", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: "deterministic-only" });
  });

  it("redirects (303 PRG) back to the page for the HTML form", async () => {
    const res = await call("/api/ask/admin/mode?to=paused", { method: "POST" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/api/ask/admin");
  });

  it("ignores an invalid target mode (no flip) but still responds", async () => {
    const res = await call("/api/ask/admin/mode?to=bogus&format=json", { method: "POST" });
    expect(await res.json()).toEqual({ ok: true, mode: "on" });
    expect(harness.mode).toBe("on");
  });
});

describe("GET /api/ask/admin (HTML page)", () => {
  it("renders the control page", async () => {
    const res = await call("/api/ask/admin");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Ask the Archive");
  });
});

describe("unknown admin route", () => {
  it("returns 404", async () => {
    const res = await call("/api/ask/admin/nonsense");
    expect(res.status).toBe(404);
  });
});
