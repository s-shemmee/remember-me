import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * No Session Replay (docs/decisions.md): Sentry in the browser is configured
 * without any Replay integration, eager or lazy-loaded from Sentry's CDN,
 * and without replay sample rates.
 */
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  lazyLoadIntegration: vi.fn(() => Promise.resolve(() => ({ name: "Replay" }))),
  addIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sentry);

afterEach(() => {
  vi.useRealTimers();
});

describe("Sentry in the browser", () => {
  it("has no Replay integration and no replay sample rates", async () => {
    vi.useFakeTimers();
    await import("./instrumentation-client");

    expect(sentry.init).toHaveBeenCalledOnce();
    const options = sentry.init.mock.calls[0]![0] as Record<string, unknown>;
    const names = ((options.integrations as { name?: string }[] | undefined) ?? []).map((i) => i.name);
    expect(names).not.toContain("Replay");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
    // No personal data (the Privacy Policy says so).
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });

    // Nothing is fetched later either: not on interaction, not after a wait.
    for (const type of ["pointerdown", "keydown", "scroll"]) window.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(60_000);
    expect(sentry.lazyLoadIntegration).not.toHaveBeenCalled();
    expect(sentry.addIntegration).not.toHaveBeenCalled();
    expect(sentry.replayIntegration).not.toHaveBeenCalled();
  });

  it("every Sentry config sends no personal data", () => {
    const root = path.resolve(__dirname, "..");
    for (const file of ["src/instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toMatch(/dataCollection: SENTRY_DATA_COLLECTION/);
    }
  });

  it("no Sentry config anywhere mentions a Replay API", () => {
    const root = path.resolve(__dirname, "..");
    for (const file of [
      "src/instrumentation-client.ts",
      "src/instrumentation.ts",
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
      "next.config.ts",
    ]) {
      const code = readFileSync(path.join(root, file), "utf8");
      expect(code, file).not.toMatch(/replayIntegration|lazyLoadIntegration|replaysSessionSampleRate|replaysOnErrorSampleRate/);
    }
  });
});
