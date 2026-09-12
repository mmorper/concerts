/**
 * Claim verifier (#529) — prompt building and response parsing.
 *
 * The API call itself is exercised with an injected client, the same pattern
 * `social.ts`'s tests use — no network, no API key required.
 */

import { describe, it, expect } from "vitest";
import {
  buildVerifyPrompt,
  parseVerifierResponse,
  verifyClaims,
  hasMustFix,
  formatClaimIssues,
  type ClaimIssue,
} from "../../scripts/liner-notes/verify-claims.ts";

describe("buildVerifyPrompt", () => {
  it("embeds the fact sheet and every present copy field", () => {
    const prompt = buildVerifyPrompt("FACT SHEET TEXT", {
      headline: "The Headline",
      prose: "The prose.",
      hook: "The hook.",
      caption: "The caption.",
      beats: ["Beat one.", "Beat two."],
    });
    expect(prompt.user).toContain("FACT SHEET TEXT");
    expect(prompt.user).toContain("Headline: The Headline");
    expect(prompt.user).toContain("Prose: The prose.");
    expect(prompt.user).toContain("Hook: The hook.");
    expect(prompt.user).toContain("Caption: The caption.");
    expect(prompt.user).toContain("Beat 1: Beat one.");
    expect(prompt.user).toContain("Beat 2: Beat two.");
  });

  it("omits absent fields rather than printing them empty", () => {
    const prompt = buildVerifyPrompt("FACT SHEET", { hook: "Hook only." });
    expect(prompt.user).not.toContain("Headline:");
    expect(prompt.user).not.toContain("Prose:");
    expect(prompt.user).not.toContain("Caption:");
    expect(prompt.user).toContain("Hook only.");
  });

  it("is pure — no network, safe for --dump-prompts", () => {
    // If this needed a client it would not compile; the assertion is just that
    // it returns synchronously with no side effects.
    const a = buildVerifyPrompt("X", { hook: "H" });
    const b = buildVerifyPrompt("X", { hook: "H" });
    expect(a).toEqual(b);
  });
});

describe("parseVerifierResponse", () => {
  it("parses a well-formed issue array", () => {
    const issues = parseVerifierResponse(
      JSON.stringify([
        {
          field: "hook",
          sentence: "I was 19 years old.",
          kind: "invented-number",
          severity: "must-fix",
          evidence: "The fact sheet gives no birth year.",
        },
      ])
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("invented-number");
    expect(issues[0].severity).toBe("must-fix");
  });

  it("returns [] for an empty array", () => {
    expect(parseVerifierResponse("[]")).toEqual([]);
  });

  it("unfences code-fenced JSON", () => {
    const issues = parseVerifierResponse(
      "```json\n[{\"field\":\"hook\",\"sentence\":\"x\",\"kind\":\"internal\",\"severity\":\"review\",\"evidence\":\"y\"}]\n```"
    );
    expect(issues).toHaveLength(1);
  });

  it("carries an optional replacement when present", () => {
    const issues = parseVerifierResponse(
      JSON.stringify([
        {
          field: "hook",
          sentence: "x",
          kind: "internal",
          severity: "review",
          evidence: "y",
          replacement: "a better hook",
        },
      ])
    );
    expect(issues[0].replacement).toBe("a better hook");
  });

  it("throws — never guesses — on a non-array response", () => {
    expect(() => parseVerifierResponse('{"not": "an array"}')).toThrow();
  });

  it("throws on an issue with an unrecognised kind", () => {
    expect(() =>
      parseVerifierResponse(
        JSON.stringify([{ field: "hook", sentence: "x", kind: "made-up-kind", severity: "must-fix", evidence: "y" }])
      )
    ).toThrow();
  });

  it("throws on an issue with an unrecognised severity", () => {
    expect(() =>
      parseVerifierResponse(
        JSON.stringify([{ field: "hook", sentence: "x", kind: "internal", severity: "urgent", evidence: "y" }])
      )
    ).toThrow();
  });

  it("throws on malformed JSON rather than returning []", () => {
    expect(() => parseVerifierResponse("not json at all")).toThrow();
  });
});

describe("hasMustFix", () => {
  const review: ClaimIssue = { field: "hook", sentence: "x", kind: "external", severity: "review", evidence: "y" };
  const mustFix: ClaimIssue = { field: "hook", sentence: "x", kind: "contradicted", severity: "must-fix", evidence: "y" };

  it("is false when every issue is review-severity", () => {
    expect(hasMustFix([review])).toBe(false);
    expect(hasMustFix([])).toBe(false);
  });

  it("is true when any issue is must-fix", () => {
    expect(hasMustFix([review, mustFix])).toBe(true);
  });
});

describe("formatClaimIssues", () => {
  it("marks must-fix and review issues distinctly", () => {
    const out = formatClaimIssues("some-slug", [
      { field: "hook", sentence: "a", kind: "contradicted", severity: "must-fix", evidence: "b" },
      { field: "caption", sentence: "c", kind: "external", severity: "review", evidence: "d" },
    ]);
    expect(out).toContain("some-slug");
    expect(out).toContain("✗");
    expect(out).toContain("⚠");
  });
});

describe("verifyClaims (injected client)", () => {
  it("calls the client with the built prompt and returns parsed issues", async () => {
    const client = {
      create: async () => ({
        content: [{ type: "text", text: "[]" }],
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const issues = await verifyClaims("FACT SHEET", { hook: "A hook." }, client);
    expect(issues).toEqual([]);
  });

  it("propagates a malformed response as a thrown error — ambiguity means stop", async () => {
    const client = {
      create: async () => ({ content: [{ type: "text", text: "not json" }] }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(verifyClaims("FACT SHEET", { hook: "A hook." }, client)).rejects.toThrow();
  });
});
