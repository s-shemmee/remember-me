import { describe, expect, it } from "vitest";

import { decideRoute, HOME_PATH, safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it.each([
    ["/home", "/home"],
    ["/people/khalid?tab=wishlist#top", "/people/khalid?tab=wishlist#top"],
    ["/reset-password", "/reset-password"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["home"],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["\\/evil.example"],
    ["/\t/evil.example"],
    ["javascript:alert(1)"],
  ])("falls back to home for %j", (input) => {
    expect(safeNextPath(input)).toBe(HOME_PATH);
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("https://evil.example", "/reset-password")).toBe("/reset-password");
  });
});

describe("decideRoute", () => {
  it("sends signed-out people from a protected page to log in, remembering where they were", () => {
    expect(decideRoute("/people/khalid", "?tab=1", false)).toEqual({
      action: "redirect",
      to: "/log-in?next=%2Fpeople%2Fkhalid%3Ftab%3D1",
    });
    expect(decideRoute("/home", "", false)).toEqual({
      action: "redirect",
      to: "/log-in?next=%2Fhome",
    });
  });

  it("lets signed-out people see public pages", () => {
    for (const path of ["/", "/log-in", "/sign-up", "/forgot-password", "/terms", "/homepage"]) {
      expect(decideRoute(path, "", false)).toEqual({ action: "continue" });
    }
  });

  it("sends signed-in people away from log in and sign up", () => {
    expect(decideRoute("/log-in", "", true)).toEqual({ action: "redirect", to: HOME_PATH });
    expect(decideRoute("/sign-up", "", true)).toEqual({ action: "redirect", to: HOME_PATH });
  });

  it("lets signed-in people through to the app and to reset their password", () => {
    for (const path of ["/home", "/settings", "/reset-password", "/forgot-password"]) {
      expect(decideRoute(path, "", true)).toEqual({ action: "continue" });
    }
  });

  it("sends an email link that fell back to the site root on to /auth/confirm", () => {
    const search = "?token_hash=abc&type=email&next=/home";
    for (const signedIn of [false, true]) {
      expect(decideRoute("/", search, signedIn)).toEqual({
        action: "redirect",
        to: "/auth/confirm?token_hash=abc&type=email&next=/home",
      });
    }
    expect(decideRoute("/", "", false)).toEqual({ action: "continue" });
  });

  it("sends signed-in visitors from the landing page straight home", () => {
    expect(decideRoute("/", "", true)).toEqual({ action: "redirect", to: HOME_PATH });
    expect(decideRoute("/privacy", "", true)).toEqual({ action: "continue" });
    expect(decideRoute("/terms", "", true)).toEqual({ action: "continue" });
  });
});
