import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  adminSecretFor,
  LOCAL_AI_ADMIN_SECRET,
  LOCAL_SUPABASE_URL,
  positionalArgs,
  scriptTarget,
} from "./script-target";

// A fake 20-letter project ref, built at runtime (the repo's no-project-ref
// scan rightly refuses real-looking refs written out).
const REF = "p".repeat(20);

describe("ai:index / ai:eval target: local unless --remote=<ref>", () => {
  it("no flag: local Supabase, whatever .env.local holds", () => {
    expect(scriptTarget(["node", "x"])).toMatchObject({
      ok: true,
      remote: false,
      url: LOCAL_SUPABASE_URL,
    });
    expect(scriptTarget(["node", "x"], { SUPABASE_URL: "http://127.0.0.1:54321" })).toMatchObject({
      ok: true,
      remote: false,
    });
  });

  it("--remote=<ref>: that cloud project", () => {
    expect(scriptTarget(["node", "x", `--remote=${REF}`])).toEqual({
      ok: true,
      remote: true,
      ref: REF,
      url: `https://${REF}.supabase.co`,
      label: `project ${REF} (cloud)`,
    });
  });

  it("refuses a bare --remote, an empty one and a bad ref", () => {
    expect(scriptTarget(["node", "x", "--remote"])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Name the project/),
    });
    expect(scriptTarget(["node", "x", "--remote="])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/empty/),
    });
    for (const bad of ["abc", "P".repeat(20), `${REF}x`, "https://x.supabase.co"]) {
      expect(scriptTarget(["node", "x", `--remote=${bad}`]).ok, bad).toBe(false);
    }
  });

  it("a cloud SUPABASE_URL without --remote is refused, not used", () => {
    const r = scriptTarget(["node", "x"], { SUPABASE_URL: `https://${REF}.supabase.co` });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/--remote=/);
  });

  it("the secret: required for the cloud (never the local placeholder), defaulted locally", () => {
    const cloud = scriptTarget(["node", "x", `--remote=${REF}`]);
    const local = scriptTarget(["node", "x"]);
    if (!cloud.ok || !local.ok) throw new Error("targets");
    expect(adminSecretFor(cloud, undefined).ok).toBe(false);
    expect(adminSecretFor(cloud, LOCAL_AI_ADMIN_SECRET).ok).toBe(false);
    expect(adminSecretFor(cloud, "a-real-secret")).toEqual({ ok: true, secret: "a-real-secret" });
    expect(adminSecretFor(local, undefined)).toEqual({ ok: true, secret: LOCAL_AI_ADMIN_SECRET });
  });

  it("flags aren't suite names", () => {
    expect(positionalArgs(["gift-ideas", `--remote=${REF}`])).toEqual(["gift-ideas"]);
    expect(positionalArgs([`--remote=${REF}`])).toEqual([]);
  });
});

describe("the real scripts refuse before touching the network", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const run = (script: string, args: string[]) => {
    const env = { ...process.env };
    delete env.AI_ADMIN_SECRET;
    delete env.SUPABASE_URL;
    return spawnSync(process.execPath, [`scripts/${script}`, ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
  };

  for (const script of ["ai-index.ts", "ai-eval.ts"]) {
    it(`${script}: bare --remote, empty --remote=, and no secret for the cloud`, () => {
      const bare = run(script, ["--remote"]);
      expect(bare.status).toBe(1);
      expect(bare.stderr).toMatch(/Name the project/);

      const empty = run(script, ["--remote="]);
      expect(empty.status).toBe(1);
      expect(empty.stderr).toMatch(/empty/);

      const noSecret = run(script, [`--remote=${REF}`]);
      expect(noSecret.status).toBe(1);
      expect(noSecret.stderr).toMatch(/Set AI_ADMIN_SECRET/);
    });
  }
});
