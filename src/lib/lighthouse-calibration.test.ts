import { describe, expect, it } from "vitest";

import { cpuSlowdownMultiplier, TARGET_BENCHMARK_INDEX } from "./lighthouse-calibration";

describe("Lighthouse CPU calibration", () => {
  it("slows every host down to the same device (benchmarkIndex 800)", () => {
    // The runs that set the 0.9 budget: a fast runner at Lighthouse's default 4x.
    expect(cpuSlowdownMultiplier(3200)).toBe(4);
    // A slow runner gets less slowdown, so it emulates the same phone.
    expect(cpuSlowdownMultiplier(1178)).toBe(1.47);
    expect(cpuSlowdownMultiplier(2266)).toBe(2.83);
    for (const index of [1178, 2164, 2266, 3256]) {
      const emulated = index / cpuSlowdownMultiplier(index);
      expect(Math.abs(emulated - TARGET_BENCHMARK_INDEX)).toBeLessThan(5);
    }
  });

  it("never speeds a host up or slows it beyond 10x", () => {
    expect(cpuSlowdownMultiplier(500)).toBe(1);
    expect(cpuSlowdownMultiplier(20_000)).toBe(10);
  });

  it("falls back to Lighthouse's default when the benchmark is missing", () => {
    expect(cpuSlowdownMultiplier(Number.NaN)).toBe(4);
    expect(cpuSlowdownMultiplier(0)).toBe(4);
  });
});
