import { describe, expect, it } from "vitest";

import { resolveAppUrl } from "../../supabase/functions/_shared/site-url";

describe("resolveAppUrl", () => {
  it("uses the configured site and removes trailing slashes", () => {
    expect(resolveAppUrl("https://app.example.com///", false)).toBe("https://app.example.com");
  });

  it("uses localhost only for local Supabase", () => {
    expect(resolveAppUrl(undefined, true)).toBe("http://localhost:3000");
  });

  it("requires a configured site for non-local Supabase", () => {
    expect(() => resolveAppUrl(undefined, false)).toThrow(
      "SITE_URL is required when using a non-local Supabase instance.",
    );
  });
});
