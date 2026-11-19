import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACCOUNTS, COLORS, demoPeople, PLANS, RELATIONS, WISHES } from "../../scripts/demo/data";
import { addDays, daysBetween, nextOccurrence } from "./dates";
import { checkSeedTarget } from "./seed-guard";

// Fake 20-letter project refs, built at runtime (the no-project-ref scan
// rightly refuses real-looking refs written out in the repo).
const PROJECT = "p".repeat(20);
const OTHER = "o".repeat(20);
const cloud = (ref: string) => `https://${ref}.supabase.co`;

describe("seed:demo guard: local Supabase only", () => {
  it("runs against local Supabase", () => {
    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:54321/",
      "https://localhost:54321",
    ]) {
      expect(checkSeedTarget(url), url).toMatchObject({ ok: true });
    }
    expect(checkSeedTarget("http://127.0.0.1:54321/rest/v1")).toEqual({
      ok: true,
      url: "http://127.0.0.1:54321",
    });
  });

  it("refuses production, and every other cloud project too (an unknown ref)", () => {
    for (const url of [cloud(PROJECT), cloud(OTHER), `${cloud(PROJECT)}/rest/v1`]) {
      const res = checkSeedTarget(url);
      expect(res.ok, url).toBe(false);
      expect(!res.ok && res.reason).toMatch(/only runs against local Supabase/);
    }
  });

  it("refuses a missing or invalid URL", () => {
    for (const url of [undefined, "", "   "]) {
      const res = checkSeedTarget(url);
      expect(!res.ok && res.reason).toMatch(/No Supabase URL/);
    }
    expect(checkSeedTarget("not a url").ok).toBe(false);
  });

  it("refuses any other host or scheme, including look-alikes", () => {
    for (const url of [
      "https://rememberme.shemme.codes",
      "https://supabase.example.com",
      `http://${PROJECT}.supabase.co`,
      "http://127.0.0.1.evil.example",
      "http://localhost.evil.example:54321",
      "ftp://127.0.0.1",
      "http://10.0.0.5:54321",
    ]) {
      expect(checkSeedTarget(url).ok, url).toBe(false);
    }
  });

  it("the real script refuses the cloud project, or no URL, before connecting to anything", () => {
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
    const production = run({ SUPABASE_URL: cloud(PROJECT) });
    expect(production.status).toBe(1);
    expect(production.stderr).toMatch(/seed:demo refused: .*only runs against local Supabase/);
    // The old staging switch does nothing any more.
    const withRef = run({ SUPABASE_URL: cloud(PROJECT), SUPABASE_STAGING_REF: PROJECT });
    expect(withRef.status).toBe(1);

    const missing = run({});
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/seed:demo refused: No Supabase URL/);
  }, 60_000);
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
