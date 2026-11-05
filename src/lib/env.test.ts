import { describe, expect, it } from "vitest";

import { FAKE_LEGACY_JWT, FAKE_SECRET_KEY, fakeEnv } from "@/test/fake-values";

import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a valid env", () => {
    expect(parseEnv(fakeEnv)).toEqual(fakeEnv);
  });

  it("names every missing variable", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL: missing/);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: missing/);
  });

  it("rejects a URL that isn't one", () => {
    expect(() => parseEnv({ ...fakeEnv, NEXT_PUBLIC_SUPABASE_URL: "test.supabase" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL: must be an http\(s\) URL/,
    );
  });

  it("rejects old anon keys and secret keys in the publishable slot", () => {
    for (const wrongKey of [FAKE_LEGACY_JWT, FAKE_SECRET_KEY]) {
      expect(() =>
        parseEnv({ ...fakeEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: wrongKey }),
      ).toThrow(/must be a publishable key/);
    }
  });

  it("never puts a value in the error message", () => {
    try {
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "nope",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_SECRET_KEY,
      });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(FAKE_SECRET_KEY);
      expect(message).not.toContain("nope");
    }
  });
});
