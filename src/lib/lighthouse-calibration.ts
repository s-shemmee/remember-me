/**
 * Lighthouse CPU calibration (scripts/lighthouse.ts, CI job `lighthouse`).
 *
 * Lighthouse emulates a phone by slowing the host CPU down by a fixed 4x. On
 * GitHub's runners the host's speed swings (Lighthouse's `benchmarkIndex`
 * went from about 1,200 to 3,300 between runs), so the "phone" did too, and
 * the score with it. Instead we keep the emulated device fixed: before each
 * run we read the host's benchmarkIndex and slow it down to a device of
 * TARGET_BENCHMARK_INDEX, the top of Lighthouse's "Mid-Tier Mobile" class
 * (docs/throttling.md, 125–800), which is what the runs that set the 0.9
 * budget emulated (a 3,200 runner at 4x).
 */
export const TARGET_BENCHMARK_INDEX = 800;
export const MIN_MULTIPLIER = 1;
export const MAX_MULTIPLIER = 10;

/** The cpuSlowdownMultiplier that makes this host behave like the target device. */
export function cpuSlowdownMultiplier(benchmarkIndex: number): number {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) return 4; // Lighthouse's default
  const raw = benchmarkIndex / TARGET_BENCHMARK_INDEX;
  const clamped = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw));
  return Math.round(clamped * 100) / 100;
}
