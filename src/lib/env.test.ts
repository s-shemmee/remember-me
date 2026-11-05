import { describe, expect, it } from "vitest";

import { EnvError, parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
};

describe("parseEnv", () => {
  it("accepts a valid env", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("names every missing variable", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL: missing/);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: missing/);
  });

  it("rejects a URL that isn't one", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "abcdefgh.supabase" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL: must be an http\(s\) URL/,
    );
  });

  it("rejects old anon keys and secret keys in the publishable slot", () => {
    for (const key of ["eyJhbGciOiJIUzI1NiJ9.legacy-anon", "sb_secret_do-not-ship"]) {
      expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })).toThrow(
        /must be a publishable key/,
      );
    }
  });

  it("never puts a value in the error message", () => {
    const secretish = "sb_secret_do-not-print-me";
    try {
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "nope",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretish,
      });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secretish);
      expect(message).not.toContain("nope");
    }
  });
});
