import { describe, expect, it } from "vitest";

import { EXTENSION_URLS, scrubAuthEvent } from "./sentry-filters";

describe("Sentry filters", () => {
  it("auth reports lose request data, cookies, the user and extras", () => {
    const event = scrubAuthEvent({
      tags: { auth_action: "sign_up", supabase_code: "unexpected_failure" },
      request: {
        url: "https://app.example.com/sign-up",
        data: "email=sara%40test.local&password=secret",
        cookies: { a: "b" },
        query_string: "x=1",
        headers: { cookie: "a=b" },
      },
      user: { email: "sara@test.local" },
      extra: { form: "x" },
    });
    expect(event).toEqual({
      tags: { auth_action: "sign_up", supabase_code: "unexpected_failure" },
      request: { url: "https://app.example.com/sign-up" },
    });
  });

  it("leaves other events alone", () => {
    const other = { tags: { route: "/home" }, request: { data: "x" }, user: { id: "1" } };
    expect(scrubAuthEvent(structuredClone(other))).toEqual(other);
  });

  it("ignores errors from browser extensions", () => {
    const denied = (url: string) => EXTENSION_URLS.some((re) => re.test(url));
    expect(denied("chrome-extension://abc/content.js")).toBe(true);
    expect(denied("moz-extension://abc/content.js")).toBe(true);
    expect(denied("safari-web-extension://abc/script.js")).toBe(true);
    expect(denied("https://app.example.com/_next/static/chunk.js")).toBe(false);
  });
});
