import { describe, it, expect } from "vitest";
import { usageMicroUsd, dailyCapMicroUsd, ipDailyCapMicroUsd, RESERVE_EST_MICRO_USD } from "./cost.js";
import type { Env } from "./types.js";

// $1/MTok input == 1 microUSD/token, so the per-class rates are exact and easy to assert.
describe("usageMicroUsd", () => {
  it("prices fresh input at 1 and output at 5 microUSD/token", () => {
    expect(usageMicroUsd({ input_tokens: 1000, output_tokens: 100 })).toBe(1000 + 500);
  });

  it("prices cache writes at 1.25× and cache reads at 0.1× input", () => {
    // 1000 cache-write (1250) + 2000 cache-read (200) + 0 fresh + 0 output
    expect(usageMicroUsd({ cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000 })).toBe(
      1250 + 200,
    );
  });

  it("rounds up sub-microUSD fractions (cache read)", () => {
    // 1 cache-read token = 0.1 microUSD → ceils to 1
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
