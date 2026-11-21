import { describe, expect, it } from "vitest";

import { indexSite, isLocalUrl, LOCAL_SITE, PRODUCTION_SITE, siteFlag } from "./index-site";

const CLOUD = "https://abcdefghijklmnop.supabase.co";
const LOCAL = "http://127.0.0.1:54321";

describe("ai:index reads from the site that matches the target", () => {
  it("the cloud project: the production site by default", () => {
    expect(indexSite({ supabaseUrl: CLOUD })).toEqual({ ok: true, site: PRODUCTION_SITE });
  });

  it("local Supabase: localhost by default", () => {
    expect(indexSite({ supabaseUrl: LOCAL })).toEqual({ ok: true, site: LOCAL_SITE });
  });

  it("a dry run with no target: the production site", () => {
    expect(indexSite({})).toEqual({ ok: true, site: PRODUCTION_SITE });
  });

  it("--site wins over SITE_URL, which wins over the default", () => {
    expect(
      indexSite({ supabaseUrl: CLOUD, flag: "https://preview.example/", siteUrl: PRODUCTION_SITE }),
    ).toEqual({ ok: true, site: "https://preview.example" });
    expect(indexSite({ supabaseUrl: LOCAL, siteUrl: "http://localhost:3001" })).toEqual({
      ok: true,
      site: "http://localhost:3001",
    });
  });

  it("refuses localhost for the cloud project, from the flag or SITE_URL", () => {
    for (const site of [{ flag: LOCAL_SITE }, { siteUrl: "http://127.0.0.1:3000" }]) {
      const r = indexSite({ supabaseUrl: CLOUD, ...site });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain(`--site=${PRODUCTION_SITE}`);
    }
  });

  it("refuses a site that isn't a full URL", () => {
    for (const flag of ["", "rememberme.shemme.codes", "/privacy"]) {
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
    expect(isLocalUrl(PRODUCTION_SITE)).toBe(false);
    expect(isLocalUrl("nope")).toBe(false);
  });
});
