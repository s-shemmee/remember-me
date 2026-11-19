import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACCOUNTS, COLORS, demoPeople, PLANS, RELATIONS, WISHES } from "../../scripts/demo/data";
import { addDays, daysBetween, nextOccurrence } from "./dates";
import { checkSeedTarget, demoEmail } from "./seed-guard";

// Fake 20-letter project refs, built at runtime (the no-project-ref scan
// rightly refuses real-looking refs written out in the repo).
const STAGING = "s".repeat(20);
const PRODUCTION = "p".repeat(20);
const cloud = (ref: string) => `https://${ref}.supabase.co`;
const PASSWORD = "a-long-staging-password";

describe("seed:demo guard", () => {
  it("runs against local Supabase", () => {
    for (const url of ["http://127.0.0.1:54321", "http://localhost:54321/"]) {
      expect(checkSeedTarget({ url, stagingRef: undefined })).toMatchObject({
        ok: true,
        kind: "local",
      });
    }
  });

  it("runs against the staging project named in SUPABASE_STAGING_REF, with a demo password", () => {
    expect(
      checkSeedTarget({ url: cloud(STAGING), stagingRef: STAGING, password: PASSWORD }),
    ).toEqual({
      ok: true,
      kind: "staging",
      url: cloud(STAGING),
      ref: STAGING,
    });
  });

  it("refuses production (any project that isn't the staging ref)", () => {
    const res = checkSeedTarget({
      url: cloud(PRODUCTION),
      stagingRef: STAGING,
      password: PASSWORD,
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toMatch(/isn't the staging project/);
  });

  it("refuses an unknown ref: a cloud project with no SUPABASE_STAGING_REF, or a malformed one", () => {
    for (const stagingRef of [undefined, "", "not-a-ref"]) {
      const res = checkSeedTarget({ url: cloud(STAGING), stagingRef, password: PASSWORD });
      expect(res.ok).toBe(false);
      expect(!res.ok && res.reason).toMatch(/SUPABASE_STAGING_REF isn't set/);
    }
  });

  it("refuses a missing or invalid URL", () => {
    for (const url of [undefined, "", "   "]) {
      const res = checkSeedTarget({ url, stagingRef: STAGING });
      expect(!res.ok && res.reason).toMatch(/No Supabase URL/);
    }
    expect(checkSeedTarget({ url: "not a url", stagingRef: STAGING }).ok).toBe(false);
  });

  it("refuses any other host, plain http to the cloud, and staging without its own password", () => {
    for (const url of [
      "https://rememberme.shemme.codes",
      "https://supabase.example.com",
      `http://${STAGING}.supabase.co`,
      `https://${STAGING}.supabase.co.evil.example`,
    ]) {
      expect(checkSeedTarget({ url, stagingRef: STAGING, password: PASSWORD }).ok, url).toBe(false);
    }
    expect(checkSeedTarget({ url: cloud(STAGING), stagingRef: STAGING }).ok).toBe(false);
    expect(
      checkSeedTarget({ url: cloud(STAGING), stagingRef: STAGING, password: "short" }).ok,
    ).toBe(false);
  });

  it("the real script refuses production before connecting to anything", () => {
    const root = path.resolve(__dirname, "../..");
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["scripts/seed-demo.ts"], {
        cwd: root,
        encoding: "utf8",
        env: {
          NODE_ENV: "test",
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "",
          ...env,
        },
        timeout: 30_000,
      });
    const production = run({
      SUPABASE_URL: cloud(PRODUCTION),
      SUPABASE_STAGING_REF: STAGING,
      SEED_DEMO_PASSWORD: PASSWORD,
    });
    expect(production.status).toBe(1);
    expect(production.stderr).toMatch(/seed:demo refused: .*isn't the staging project/);

    const missing = run({});
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/seed:demo refused: No Supabase URL/);
  }, 60_000);

  it("demo emails come from a pattern with {name}", () => {
    expect(demoEmail("demo.{name}@remember-me.test", "Maya")).toBe(
      "demo.maya@remember-me.test",
    );
    expect(demoEmail("me+{name}@gmail.com", "Badr")).toBe("me+badr@gmail.com");
    expect(() => demoEmail("demo@remember-me.test", "Badr")).toThrow(/\{name\}/);
  });
});

describe("demo data", () => {
  const today = { year: 2026, month: 11, day: 19 };
  const people = demoPeople(today);
  const inDays = (dm: { day: number; month: number }) =>
    daysBetween(today, nextOccurrence(dm, today));

  it("about 25 people, every relation and colour, one In memory", () => {
    expect(people.length).toBeGreaterThanOrEqual(25);
    expect(new Set(people.map((p) => p.relationKind))).toEqual(new Set(RELATIONS));
    expect(new Set(people.map((p) => p.color))).toEqual(new Set(COLORS));
    expect(people.filter((p) => p.inMemory)).toHaveLength(1);
    expect(new Set(people.map((p) => p.name)).size).toBe(people.length);
  });

  it("every occasion type, birthdays with and without a year", () => {
    const kinds = new Set(people.flatMap((p) => p.days.map((d) => d.kind)));
    expect(kinds).toEqual(
      new Set(["anniversary", "graduation", "work_milestone", "remembrance", "other"]),
    );
    expect(people.some((p) => p.birthday.year)).toBe(true);
    expect(people.some((p) => !p.birthday.year)).toBe(true);
    expect(people.find((p) => p.inMemory)!.days.map((d) => d.kind)).toContain("remembrance");
  });

  it("every day within the next 60 days, some today, tomorrow and this week", () => {
    const all = people.flatMap((p) => [p.birthday, ...p.days]).map(inDays);
    expect(Math.max(...all)).toBeLessThanOrEqual(60);
    expect(all).toContain(0);
    expect(all).toContain(1);
    expect(all.filter((n) => n <= 7).length).toBeGreaterThanOrEqual(5);
  });

  it("stays valid on any day of the year (29 February included)", () => {
    for (let n = 0; n < 366 * 4; n += 7) {
      const day = addDays({ year: 2026, month: 1, day: 1 }, n);
      for (const p of demoPeople(day)) {
        const { day: d, month: m, year: y } = p.birthday;
        if (d === 29 && m === 2 && y !== undefined) expect(y % 4).toBe(0);
        for (const o of p.days) if (!o.recurring) expect(o.year).toBeDefined();
      }
    }
  });

  it("each friend account is a person, wishes are reserved by connected accounts, plans exist", () => {
    for (const a of ACCOUNTS.filter((x) => x.key !== "main")) {
      expect(people.find((p) => p.account === a.key)?.name).toBe(a.firstName);
    }
    for (const [owner, wishes] of Object.entries(WISHES)) {
      for (const w of wishes) {
        if (w.reservedBy) {
          expect(w.list, w.title).toBe("birthday");
          expect(w.reservedBy).not.toBe(owner);
        }
      }
    }
    expect(WISHES.main.some((w) => w.list === "treat")).toBe(true);
    expect(PLANS.some((p) => p.ticked.length > 0)).toBe(true);
  });
});
