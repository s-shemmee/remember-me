import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { NO_INDEX, PRIVATE_PATHS, robotsFor, sitemapFor } from "./seo";

vi.mock("server-only", () => ({}));

describe("robots.txt and sitemap.xml", () => {
  it("allows the landing page, disallows the private app, and points to the sitemap", () => {
    const robots = robotsFor("https://rememberme.shemme.codes");
    expect(robots.sitemap).toBe("https://rememberme.shemme.codes/sitemap.xml");
    const [rule] = [robots.rules].flat();
    expect(rule).toMatchObject({ userAgent: "*", allow: "/" });
    for (const p of ["/home", "/people", "/settings", "/onboarding", "/invite/", "/api/"]) {
      expect(rule?.disallow).toContain(p);
    }
    // Public pages stay crawlable (auth pages rely on noindex instead).
    expect(PRIVATE_PATHS).not.toContain("/");
    expect(PRIVATE_PATHS).not.toContain("/sign-up");
  });

  it("lists only public pages, with absolute URLs", () => {
    expect(sitemapFor("https://rememberme.shemme.codes").map((e) => e.url)).toEqual([
      "https://rememberme.shemme.codes/",
    ]);
  });
});

/**
 * Every private route is noindex: the app and auth groups through their
 * layouts, the other private routes on their own pages. A new route under
 * (app) or (auth) inherits it; a new top-level private route must be listed.
 */
describe("noindex on private routes", () => {
  const app = path.join(process.cwd(), "src/app");
  const routes = {
    "(app) layout": () => import("@/app/(app)/layout"),
    "(auth) layout": () => import("@/app/(auth)/layout"),
    invite: () => import("@/app/invite/[token]/page"),
    unsubscribe: () => import("@/app/unsubscribe/page"),
    offline: () => import("@/app/offline/page"),
  };

  // Importing the real route modules (and everything they import) is slow.
  it.each(Object.entries(routes))(
    "%s",
    async (_name, load) => {
      const { metadata } = (await load()) as { metadata?: { robots?: unknown } };
      expect(metadata?.robots).toEqual(NO_INDEX);
    },
    60_000,
  );

  it("onboarding, log in and sign up sit under the noindex (auth) layout", () => {
    const auth = readdirSync(path.join(app, "(auth)"));
    for (const page of [
      "onboarding",
      "log-in",
      "sign-up",
      "check-email",
      "forgot-password",
      "reset-password",
    ]) {
      expect(auth).toContain(page);
    }
  });

  it("every app page sits under the noindex (app) layout", () => {
    const appPages = readdirSync(path.join(app, "(app)")).filter((f) => !f.includes("."));
    expect(appPages).toEqual(
      expect.arrayContaining(["home", "people", "calendar", "wishlists", "celebrate", "settings"]),
    );
  });
});
