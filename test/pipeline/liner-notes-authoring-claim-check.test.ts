/**
 * The claim check wired into authoring (#529) — inside the retry loop of
 * `social.ts`'s `authorOne` and `generate.ts`'s `generateProse`, the same way
 * `unsourcedYears` works. Absent a fact sheet and a verifier, both behave
 * exactly as before — every existing caller keeps its current behaviour.
 */

import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { generateSocial, type SocialContext, type SocialSubject } from "../../scripts/liner-notes/social.ts";
import { generate } from "../../scripts/liner-notes/generate.ts";
import type { ClaimIssue } from "../../scripts/liner-notes/verify-claims.ts";
import type { ScoredFinding } from "../../scripts/liner-notes/types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textMessage(text: string): any {
  return { content: [{ type: "text", text }] };
}

type FakeMessagesClient = Pick<Anthropic["messages"], "create">;
type FakeAnthropicClient = Pick<Anthropic, "messages">;

describe("generateSocial — claim check in the retry loop", () => {
  const post: SocialSubject = { slug: "test-post", headline: "A Headline", category: "personal", prose: "Some prose." };
  const context: SocialContext = {
    artists: ["Test Band"],
    venue: "The Venue",
    city: "Los Angeles",
    date: "1990-06-01",
    factSheet: "FACT SHEET TEXT",
  };

  it("skips the claim check entirely when no verifier is supplied", async () => {
    const client: FakeMessagesClient = {
      create: async () =>
        textMessage(JSON.stringify({ hook: "A hook that goes on.", caption: "A caption that goes on." })),
    } as unknown as FakeMessagesClient;
    const out = await generateSocial([{ post, context: { ...context, factSheet: undefined } }], { client });
    expect(out.get("test-post")).toBeDefined();
  });

  it("retries with feedback naming the sentence and evidence when the verifier finds a must-fix issue", async () => {
    let attempt = 0;
    const client: FakeMessagesClient = {
      create: (async (params: { messages: Array<{ content: string }> }) => {
        attempt++;
        if (attempt === 1) {
          // The prompt on the retry must carry the fact-checker's feedback.
          return textMessage(JSON.stringify({ hook: "I was 19 years old that night.", caption: "A true caption here." }));
        }
        expect(params.messages[0].content).toContain("fact-checker found");
        expect(params.messages[0].content).toContain("invented-number");
        return textMessage(JSON.stringify({ hook: "A corrected hook here.", caption: "A true caption here." }));
      }) as unknown as FakeMessagesClient["create"],
    };
    const verifyClaims = async (_factSheet: string, copy: { hook?: string }): Promise<ClaimIssue[]> => {
      if (copy.hook?.includes("19 years old")) {
        return [
          {
            field: "hook",
            sentence: "I was 19 years old that night.",
            kind: "invented-number",
            severity: "must-fix",
            evidence: "The fact sheet gives no birth year.",
          },
        ];
      }
      return [];
    };

    const out = await generateSocial([{ post, context }], { client, verifyClaims });
    expect(attempt).toBe(2);
    expect(out.get("test-post")?.hook).toBe("A corrected hook here.");
  });

  it("does not retry over a review-severity issue", async () => {
    let attempt = 0;
    const client: FakeMessagesClient = {
      create: (async () => {
        attempt++;
        return textMessage(JSON.stringify({ hook: "A perfectly fine hook.", caption: "A perfectly fine caption." }));
      }) as unknown as FakeMessagesClient["create"],
    };
    const verifyClaims = async (): Promise<ClaimIssue[]> => [
      { field: "hook", sentence: "x", kind: "external", severity: "review", evidence: "unconfirmable" },
    ];
    const out = await generateSocial([{ post, context }], { client, verifyClaims });
    expect(attempt).toBe(1);
    expect(out.get("test-post")).toBeDefined();
  });
});

describe("generate — claim check in the prose retry", () => {
  function finding(over: Partial<ScoredFinding> = {}): ScoredFinding {
    return {
      id: "test-finding",
      detector: "artist-longevity",
      category: "personal",
      temporality: "evergreen",
      headline: "Test Band: A Headline",
      dataPoints: {},
      artists: ["test-band"],
      venues: [],
      years: [1990],
      tags: [],
      deepLinks: [],
      score: 40,
      scoreBreakdown: {} as ScoredFinding["scoreBreakdown"],
      ...over,
    } as ScoredFinding;
  }

  const validProse =
    "I saw Test Band in 1990 and it changed everything about how I heard live music from that night forward. " +
    "The room was loud and close, and I remember standing near the back trying to take in every single detail " +
    "of a night I would end up thinking about for years afterward, long after the house lights came back up.";

  it("skips the claim check when no fact sheet/verifier is supplied — unchanged behaviour", async () => {
    const client = {
      messages: { create: (async () => textMessage(validProse)) as unknown as FakeMessagesClient["create"] },
    } as FakeAnthropicClient;
    const [result] = await generate([finding()], { artistsMetadata: {}, artistsTopTracks: {}, client });
    expect(result.prose).toBe(validProse);
  });

  it("retries once with feedback when the verifier finds a must-fix issue, then gives up", async () => {
    let attempt = 0;
    const client = {
      messages: {
        create: (async (params: { messages: Array<{ content: string }> }) => {
          attempt++;
          if (attempt === 2) {
            expect(params.messages[0].content).toContain("fact-checker");
          }
          return textMessage(validProse);
        }) as unknown as FakeMessagesClient["create"],
      },
    } as FakeAnthropicClient;
    const [result] = await generate([finding()], {
      artistsMetadata: {},
      artistsTopTracks: {},
      client,
      getFactSheet: () => "FACT SHEET",
      verifyClaims: async () => [
        { field: "prose", sentence: "x", kind: "contradicted", severity: "must-fix", evidence: "y" },
      ],
    });
    // Both attempts exhausted, still failing — dropped without prose (never thrown out of `generate`).
    expect(attempt).toBe(2);
    expect(result.prose).toBeUndefined();
  });

  it("returns prose once the verifier stops finding a must-fix issue", async () => {
    let attempt = 0;
    const client = {
      messages: {
        create: (async () => {
          attempt++;
          return textMessage(validProse);
        }) as unknown as FakeMessagesClient["create"],
      },
    } as FakeAnthropicClient;
    const [result] = await generate([finding()], {
      artistsMetadata: {},
      artistsTopTracks: {},
      client,
      getFactSheet: () => "FACT SHEET",
      verifyClaims: async () =>
        attempt === 1 ? [{ field: "prose", sentence: "x", kind: "contradicted", severity: "must-fix", evidence: "y" }] : [],
    });
    expect(attempt).toBe(2);
    expect(result.prose).toBe(validProse);
  });
});
