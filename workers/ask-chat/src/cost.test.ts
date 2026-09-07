import { describe, it, expect } from "vitest";
import { usageMicroUsd, dailyCapMicroUsd, ipDailyCapMicroUsd, RESERVE_EST_MICRO_USD } from "./cost.js";
import type { Env } from "./types.js";

// $1/MTok == 1 microUSD/token, so the per-class rates are exact and easy to assert.
// These MUST track ANTHROPIC_MODEL in agent-loop.ts: the $25/month cap is enforced
// against RATE, so a model change that leaves RATE behind lets the counter under-report
// and the cap allow more spend than it names. Sonnet 5 is $2/$10 per MTok.
describe("usageMicroUsd", () => {
  it("prices fresh input at 2 and output at 10 microUSD/token (Sonnet 5)", () => {
    expect(usageMicroUsd({ input_tokens: 1000, output_tokens: 100 })).toBe(2000 + 1000);
  });

  it("prices cache writes at 1.25× and cache reads at 0.1× input", () => {
    // 1000 cache-write (2 × 1.25 = 2500) + 2000 cache-read (2 × 0.1 = 400)
    expect(usageMicroUsd({ cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000 })).toBe(
      2500 + 400,
    );
  });

  it("rounds up sub-microUSD fractions (cache read)", () => {
    // 1 cache-read token = 2 × 0.1 = 0.2 microUSD → ceils to 1
    expect(usageMicroUsd({ cache_read_input_tokens: 1 })).toBe(1);
  });

  it("treats missing usage fields as zero", () => {
    expect(usageMicroUsd({})).toBe(0);
  });
});

describe("dailyCapMicroUsd", () => {
  it("derives a daily ceiling from the monthly knob ($25/mo → ~$0.833/day)", () => {
    const env = { ASK_MONTHLY_USD: "25" } as Env;
    expect(dailyCapMicroUsd(env)).toBe(Math.round((25 / 30) * 1_000_000)); // 833_333
  });

  it("defaults to $25/mo when the var is empty", () => {
    const env = { ASK_MONTHLY_USD: "" } as Env;
    expect(dailyCapMicroUsd(env)).toBe(833_333);
  });

  it("scales with the knob", () => {
    const env = { ASK_MONTHLY_USD: "60" } as Env;
    expect(dailyCapMicroUsd(env)).toBe(2_000_000); // $2/day
  });
});

describe("ipDailyCapMicroUsd", () => {
  it("defaults to ~$0.15/day when the var is unset", () => {
    expect(ipDailyCapMicroUsd({} as Env)).toBe(150_000);
  });

  it("honours the knob", () => {
    expect(ipDailyCapMicroUsd({ ASK_IP_DAILY_USD: "0.30" } as Env)).toBe(300_000);
  });

  it("is a fraction of the global day cap so one IP can't drain it", () => {
    const env = { ASK_MONTHLY_USD: "25", ASK_IP_DAILY_USD: "0.15" } as Env;
    const ipShare = ipDailyCapMicroUsd(env) / dailyCapMicroUsd(env);
    expect(ipShare).toBeGreaterThan(0); // a real slice
    expect(ipShare).toBeLessThan(0.5); // but well short of the whole budget
  });
});

describe("reservation sizing", () => {
  it("allows several concurrent turns under a $25/mo daily cap but bounds the burst", () => {
    const cap = dailyCapMicroUsd({ ASK_MONTHLY_USD: "25" } as Env);
    const concurrent = Math.floor(cap / RESERVE_EST_MICRO_USD);
    expect(concurrent).toBeGreaterThanOrEqual(5); // not so tight it blocks normal use
    expect(concurrent).toBeLessThan(20); // not so loose a burst can blow the cap
  });
});
