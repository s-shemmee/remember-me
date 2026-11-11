import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (e2e/). They need local Supabase running (`pnpm db:start`)
 * and read emails from its Mailpit. Locally they reuse your dev server and
 * your installed Edge; in CI they build, start the app and use Chromium.
 * In CI they run inside mcr.microsoft.com/playwright:v<version>-noble, which
 * has no pnpm: the server starts with next's own binary.
 */
const CI = Boolean(process.env.CI);
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(CI ? {} : { channel: "msedge" }) },
    },
  ],
  webServer: {
    command: CI ? "node_modules/.bin/next start" : "pnpm dev",
    url: `${BASE_URL}/log-in`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
