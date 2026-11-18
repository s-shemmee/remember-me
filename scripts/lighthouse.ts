/**
 * `pnpm lighthouse` (and the CI job `lighthouse`): Lighthouse CI on the
 * landing page with the CPU slowdown calibrated to the machine, so every run
 * emulates the same phone (src/lib/lighthouse-calibration.ts).
 *
 * 1. Starts `pnpm start` (unless something already answers on the URL).
 * 2. Three times: a quick calibration run reads this machine's
 *    benchmarkIndex right now (it's thrown away), then the measured run uses
 *    the multiplier for it.
 * 3. `lhci assert` checks the budgets in lighthouserc.json on the median of
 *    the three measured runs; `lhci upload` writes the reports to
 *    .lighthouseci.
 *
 * Needs `pnpm build` first. Run with Node 24 (TypeScript is stripped natively).
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { cpuSlowdownMultiplier } from "../src/lib/lighthouse-calibration.ts";

const URL = process.env.LHCI_URL ?? "http://localhost:3000/";
const RUNS = 3;
const DIR = ".lighthouseci";
const WIN = process.platform === "win32";

function lhci(args: string[]): number {
  const result = spawnSync("pnpm", ["exec", "lhci", ...args], { stdio: "inherit", shell: WIN });
  return result.status ?? 1;
}

const reports = () =>
  (existsSync(DIR) ? readdirSync(DIR, { withFileTypes: true }) : [])
    .filter((f) => f.isFile() && /^lhr-.*\.json$/.test(f.name))
    .map((f) => path.join(DIR, f.name));

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(URL, { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    return false;
  }
}

async function startServer(): Promise<ChildProcess | null> {
  if (await isUp()) {
    console.log(`Using the server already on ${URL}`);
    return null;
  }
  const port = new globalThis.URL(URL).port || "3000";
  const server = spawn("pnpm", ["start", "-p", port], { stdio: "ignore", shell: WIN });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return server;
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopServer(server);
  throw new Error(`The app didn't start on ${URL}`);
}

function stopServer(server: ChildProcess | null) {
  if (!server?.pid) return;
  if (WIN) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

async function main(): Promise<number> {
  rmSync(DIR, { recursive: true, force: true });
  const server = await startServer();
  try {
    for (let run = 1; run <= RUNS; run++) {
      // Calibration: one cheap audit, just to read the machine's speed now.
      const before = new Set(reports());
      if (
        lhci([
          "collect",
          `--url=${URL}`,
          "--numberOfRuns=1",
          "--additive",
          "--settings.onlyAudits=viewport",
        ]) !== 0
      ) {
        return 1;
      }
      const calibration = reports().filter((f) => !before.has(f));
      const index = calibration
        .map(
          (f) =>
            (JSON.parse(readFileSync(f, "utf8")) as { environment?: { benchmarkIndex?: number } })
              .environment?.benchmarkIndex,
        )
        .find((v): v is number => typeof v === "number");
      for (const f of calibration) rmSync(f);
      const multiplier = cpuSlowdownMultiplier(index ?? Number.NaN);
      console.log(
        `Run ${run}/${RUNS}: benchmarkIndex ${index ?? "unknown"} → cpuSlowdownMultiplier ${multiplier}`,
      );

      if (
        lhci([
          "collect",
          `--url=${URL}`,
          "--numberOfRuns=1",
          "--additive",
          `--settings.throttling.cpuSlowdownMultiplier=${multiplier}`,
        ]) !== 0
      ) {
        return 1;
      }
    }
  } finally {
    stopServer(server);
  }
  const asserted = lhci(["assert"]);
  lhci(["upload"]);
  return asserted;
}

process.exit(await main());
