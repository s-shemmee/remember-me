import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn(), redirectWithCookies: vi.fn() }));

const { config } = await import("./proxy");

// Next compiles the matcher with path-to-regexp; for this single
// group-style pattern that is equivalent to an anchored RegExp.
const matcher = new RegExp(`^${config.matcher[0]}$`);
const runsOn = (path: string) => matcher.test(path);

describe("proxy matcher", () => {
  it.each(["/", "/home", "/log-in", "/sign-up", "/people/khalid", "/auth/confirm", "/api/other"])(
    "runs on %s",
    (path) => expect(runsOn(path)).toBe(true),
  );

  it.each([
    "/monitoring",
    "/monitoring?o=1&p=2",
    "/api/health",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/noor.svg",
    "/icons/icon-192.png",
    "/fonts/jakarta.woff2",
    "/robots.txt",
    "/sitemap.xml",
  ])("skips %s", (path) => expect(runsOn(path.split("?")[0]!)).toBe(false));
});
