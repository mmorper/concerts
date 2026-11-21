import { describe, expect, it } from "vitest";
import { sameToken, tokenOf, wantsSubprotocol } from "./auth.js";

const r = (headers: Record<string, string>) => new Request("https://x/", { headers });

describe("sameToken", () => {
  it("matches only the exact token", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abd", "abc")).toBe(false);
    expect(sameToken("ab", "abc")).toBe(false);
    expect(sameToken("abcd", "abc")).toBe(false);
    expect(sameToken(null, "abc")).toBe(false);
  });

  it("never matches an empty secret", () => {
    expect(sameToken("", "")).toBe(false);
  });
});

describe("tokenOf", () => {
  it("reads a Bearer header", () => {
    expect(tokenOf(r({ Authorization: "Bearer 0123abcd" }))).toBe("0123abcd");
  });

  it("reads the second WebSocket subprotocol, only after ours", () => {
    expect(tokenOf(r({ "Sec-WebSocket-Protocol": "now-spinning.v1, 0123abcd" }))).toBe("0123abcd");
    expect(tokenOf(r({ "Sec-WebSocket-Protocol": "other, 0123abcd" }))).toBeNull();
  });

  it("never reads a query string", () => {
    expect(tokenOf(new Request("https://x/?token=0123abcd"))).toBeNull();
  });
});

describe("wantsSubprotocol", () => {
  it("is true when the client offered ours", () => {
    expect(wantsSubprotocol(r({ "Sec-WebSocket-Protocol": "now-spinning.v1, abc" }))).toBe(true);
    expect(wantsSubprotocol(r({}))).toBe(false);
  });
});
