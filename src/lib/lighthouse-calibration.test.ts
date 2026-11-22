import { describe, expect, it } from "vitest";

import {
  cpuSlowdownMultiplier,
  REFERENCE_INDEX,
  REFERENCE_MULTIPLIER,
} from "./lighthouse-calibration";

describe("Lighthouse CPU calibration", () => {
  it("at the reference runner, the slowdown that set the 0.9 budget", () => {
    expect(cpuSlowdownMultiplier(REFERENCE_INDEX)).toBe(REFERENCE_MULTIPLIER);
  });

  it("grows with the square root of the runner's speed, not linearly", () => {
    // A runner twice as fast on the benchmark does about 1/√2 the page work.
    expect(cpuSlowdownMultiplier(4400)).toBe(3.89);
    expect(cpuSlowdownMultiplier(1100)).toBe(1.94);
    // The runners that failed the budget with the linear rule (index / 800 → 4.4x, 5x).
    expect(cpuSlowdownMultiplier(3500)).toBe(3.47);
    expect(cpuSlowdownMultiplier(4000)).toBe(3.71);
  });

  it("the same page work on slow and fast runners (CI data, 2026-11-22)", () => {
    // Medians of unthrottled main-thread ms per benchmarkIndex band (97 runs).
    const measured: [index: number, ms: number][] = [
      [2239, 705],
      [2826, 587],
      [3291, 527],
      [3890, 536],
    ];
    const spread = (slowdown: (index: number) => number) => {
      const throttled = measured.map(([index, ms]) => ms * slowdown(index));
      return Math.max(...throttled) / Math.min(...throttled);
    };
    // Within about 10% of each other; the old linear rule (index / 800) was 30% apart.
    expect(spread(cpuSlowdownMultiplier)).toBeLessThan(1.12);
    expect(spread((index) => index / 800)).toBeGreaterThan(1.25);
  });

  it("never speeds a host up or slows it beyond 10x", () => {
    expect(cpuSlowdownMultiplier(200)).toBe(1);
    expect(cpuSlowdownMultiplier(1_000_000)).toBe(10);
  });

  it("falls back to Lighthouse's default when the benchmark is missing", () => {
    expect(cpuSlowdownMultiplier(Number.NaN)).toBe(4);
    expect(cpuSlowdownMultiplier(0)).toBe(4);
  });
});
