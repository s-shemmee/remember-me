import { describe, expect, it } from "vitest";

import { indexSite, isLocalUrl, LOCAL_SITE, siteFlag } from "./index-site";

const CLOUD = "https://abcdefghijklmnop.supabase.co";
const LOCAL = "http://127.0.0.1:54321";

describe("ai:index reads from the site that matches the target", () => {
  it("requires a site for a non-local Supabase target", () => {
    expect(indexSite({ supabaseUrl: CLOUD })).toEqual({
      ok: false,
      error: "Set SITE_URL or pass --site=<url> for the site being indexed.",
    });
  });

  it("local Supabase: localhost by default", () => {
    expect(indexSite({ supabaseUrl: LOCAL })).toEqual({ ok: true, site: LOCAL_SITE });
  });

  it("a dry run with no target uses localhost", () => {
    expect(indexSite({})).toEqual({ ok: true, site: LOCAL_SITE });
  });

  it("--site wins over SITE_URL, which wins over the default", () => {
    expect(
      indexSite({
        supabaseUrl: CLOUD,
        flag: "https://index.example.com/",
        siteUrl: "https://app.example.com",
      }),
    ).toEqual({ ok: true, site: "https://index.example.com" });
    expect(indexSite({ supabaseUrl: CLOUD, siteUrl: "https://app.example.com" })).toEqual({
      ok: true,
      site: "https://app.example.com",
    });
    expect(indexSite({ supabaseUrl: LOCAL, siteUrl: "http://localhost:3001" })).toEqual({
      ok: true,
      site: "http://localhost:3001",
    });
  });

  it("refuses localhost for the cloud project, from the flag or SITE_URL", () => {
    for (const site of [{ flag: LOCAL_SITE }, { siteUrl: "http://127.0.0.1:3000" }]) {
      const r = indexSite({ supabaseUrl: CLOUD, ...site });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain("Set SITE_URL or pass --site=<public URL>");
    }
  });

  it("refuses a site that isn't a full URL", () => {
    for (const flag of ["", "app.example.com", "/privacy"]) {
      expect(indexSite({ supabaseUrl: CLOUD, flag }).ok, flag).toBe(false);
    }
  });

  it("reads --site in both spellings", () => {
    expect(siteFlag(["--dry-run", "--site=https://a.example"])).toBe("https://a.example");
    expect(siteFlag(["--site", "https://b.example"])).toBe("https://b.example");
    expect(siteFlag(["--site"])).toBe("");
    expect(siteFlag(["--dry-run"])).toBeUndefined();
  });

  it("knows local hosts", () => {
    expect(isLocalUrl("http://localhost:3000")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalUrl("http://app.localhost")).toBe(true);
    expect(isLocalUrl("https://app.example.com")).toBe(false);
    expect(isLocalUrl("nope")).toBe(false);
  });
});
