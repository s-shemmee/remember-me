import { describe, expect, it } from "vitest";

import { isCacheable, precacheable } from "./cache-rules";
import { notificationFor, parsePush, safePath } from "./push-message";

const ORIGIN = "https://app.example.com";
const check = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  isCacheable({
    url: new URL(path, ORIGIN),
    origin: ORIGIN,
    method: init.method ?? "GET",
    headers: new Headers(init.headers),
  });

describe("what the service worker may cache", () => {
  it("the app shell and static files", () => {
    for (const path of [
      "/_next/static/chunks/main-abc123.js",
      "/_next/static/css/app-abc.css",
      "/_next/static/media/jakarta-latin.woff2",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
      "/offline",
      "/apple-touch-icon.png",
      "/favicon.ico",
      "/icon.svg",
    ]) {
      expect(check(path), path).toBe(true);
    }
  });

  it("never personal data: pages, RSC payloads, API, auth, actions", () => {
    for (const path of [
      "/home",
      "/people",
      "/people?person=1f0e0000-0000-4000-8000-000000000001",
      "/wishlists?tab=friends",
      "/settings",
      "/profile",
      "/invite/abc",
      "/unsubscribe?token=x",
      "/api/health",
      "/auth/confirm",
      "/_next/image?url=x",
      "/serwist/sw.js",
    ]) {
      expect(check(path), path).toBe(false);
    }
    expect(check("/_next/static/chunks/x.js?_rsc=1a2b")).toBe(false);
    expect(check("/home", { headers: { RSC: "1" } })).toBe(false);
    expect(check("/_next/static/x.js", { headers: { "Next-Action": "abc" } })).toBe(false);
  });

  it("never a POST, never another origin (Supabase, signed photo URLs)", () => {
    expect(check("/_next/static/x.js", { method: "POST" })).toBe(false);
    expect(
      isCacheable({
        url: new URL(
          "https://project.supabase.co/storage/v1/object/sign/wish-images/u/a.webp?token=x",
        ),
        origin: ORIGIN,
        method: "GET",
      }),
    ).toBe(false);
    expect(
      isCacheable({
        url: new URL("https://project.supabase.co/rest/v1/people"),
        origin: ORIGIN,
        method: "GET",
      }),
    ).toBe(false);
  });

  it("filters the build's precache list by the same rules", () => {
    expect(precacheable("/_next/static/chunks/a.js", ORIGIN)).toBe(true);
    expect(precacheable({ url: "/offline" }, ORIGIN)).toBe(true);
    expect(precacheable({ url: "/home" }, ORIGIN)).toBe(false);
    expect(precacheable("https://evil.example/a.js", ORIGIN)).toBe(false);
  });
});

describe("push in the service worker", () => {
  it("shows the payload's title and body and keeps its tag", () => {
    expect(
      parsePush(
        JSON.stringify({
          title: "Khalid's birthday is in 7 days 🎂",
          body: "Friday 13 November",
          url: "/people?person=p1",
          tag: "batch-1",
        }),
      ),
    ).toEqual({
      title: "Khalid's birthday is in 7 days 🎂",
      options: {
        body: "Friday 13 November",
        tag: "batch-1",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: "/people?person=p1" },
      },
    });
  });

  it("an odd payload still shows something gentle", () => {
    expect(parsePush("not json").title).toBe("Remember Me");
    expect(parsePush(null).options.data.url).toBe("/home");
    expect(notificationFor({ title: 42 }).title).toBe("Remember Me");
    expect(notificationFor({ title: "x".repeat(500) }).title).toHaveLength(120);
  });

  it("a click opens only same-origin paths", () => {
    expect(safePath("/wishlists?tab=friends&friend=f1")).toBe("/wishlists?tab=friends&friend=f1");
    for (const bad of ["https://evil.example", "//evil.example/x", "/\\evil.example", "home", 42]) {
      expect(safePath(bad), String(bad)).toBe("/home");
    }
  });
});
