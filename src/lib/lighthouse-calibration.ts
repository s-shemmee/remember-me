/**
 * Lighthouse CPU calibration (scripts/lighthouse.ts, CI job `lighthouse`).
 *
 * Lighthouse emulates a phone by slowing the host CPU down (4x by default).
 * GitHub's runners vary a lot in speed (Lighthouse's `benchmarkIndex` from
 * about 1,200 to 4,200), so a fixed slowdown makes the "phone", and the
 * score, swing with the runner. Before each run we read the host's
 * benchmarkIndex and pick the slowdown that makes the landing page do the
 * same amount of main-thread work on any runner.
 *
 * The slowdown grows with the square root of benchmarkIndex, not linearly:
 * across 97 CI runs (2026-11-22), the page's real, unthrottled main-thread
 * work shrank roughly as benchmarkIndex^-0.49, so dividing by benchmarkIndex
 * itself (the old rule, index / 800) over-throttled fast runners: at about
 * 4,000 their throttled work came out a third above slower runners' and the
 * same code scored 0.86 instead of 0.93. Anchored at REFERENCE_INDEX, where
 * the old rule set the 0.9 budget (2,200 → 2.75x), so slow and typical
 * runners are throttled as before.
 */
export const REFERENCE_INDEX = 2200;
export const REFERENCE_MULTIPLIER = 2.75;
export const MIN_MULTIPLIER = 1;
export const MAX_MULTIPLIER = 10;

/** The cpuSlowdownMultiplier for this host: the reference, scaled by √(index / reference). */
export function cpuSlowdownMultiplier(benchmarkIndex: number): number {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) return 4; // Lighthouse's default
  const raw = REFERENCE_MULTIPLIER * Math.sqrt(benchmarkIndex / REFERENCE_INDEX);
  const clamped = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw));
  return Math.round(clamped * 100) / 100;
}
