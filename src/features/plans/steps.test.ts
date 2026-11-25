import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type DaySource, upcoming } from "@/features/days/days";

import {
  byKey,
  pastPlans,
  planDots,
  planKey,
  planLabel,
  type PlanStep,
  type PlanView,
  previewSteps,
  styleFor,
  SUGGESTIONS,
  targetFor,
} from "./steps";

const source = (extra: Partial<DaySource> = {}): DaySource => ({
  id: "o1",
  personId: "p1",
  name: "Khalid",
  isYou: false,
  kind: "birthday",
  title: null,
  day: 6,
  month: 11,
  year: 1996,
  recurring: true,
  color: "butter",
  littleThings: [],
  ...extra,
});
const today = { year: 2026, month: 11, day: 4 };
const eventOf = (s: DaySource, on = today) => upcoming([s], on)[0]!;

const step = (done: boolean, i = 0): PlanStep => ({
  id: `s${i}`,
  kind: "other",
  label: `Step ${i}`,
  position: i,
  done,
  byReservation: false,
});
const plan = (extra: Partial<PlanView> = {}): PlanView => ({
  id: "plan1",
  occasionId: "o1",
  occursOn: "2026-11-06",
  note: "",
  steps: [step(true, 0), step(false, 1), step(false, 2), step(false, 3)],
  ...extra,
});

describe("suggested steps", () => {
  it("celebrating: Gift, Message, Call, Cake, Something else", () => {
    expect(SUGGESTIONS.celebrate.map((s) => s.label)).toEqual([
      "Gift",
      "Message",
      "Call",
      "Cake",
      "Something else",
    ]);
  });

  it("Remembrance and 'In memory': gentle steps only, nothing celebratory", () => {
    const labels = SUGGESTIONS.gentle.map((s) => s.label);
    expect(labels).toEqual(["Send a kind word", "Call them", "Visit"]);
    expect(SUGGESTIONS.gentle.map((s) => s.kind)).not.toContain("gift");
    expect(SUGGESTIONS.gentle.map((s) => s.kind)).not.toContain("cake");
  });

  it("your own day", () => {
    expect(SUGGESTIONS.own.map((s) => s.label)).toEqual([
      "Plan something with friends",
      "Cake",
      "Treat yourself",
      "Something just for me",
    ]);
  });

  it("match the database's public.plan_suggestions()", () => {
    const sql = readFileSync("supabase/migrations/20261117224615_celebrate_and_plans.sql", "utf8");
    for (const [style, list] of Object.entries(SUGGESTIONS)) {
      list.forEach((s, i) => {
        expect(sql).toContain(`('${style}', '${s.kind}', '${s.label}', ${i})`);
      });
    }
  });

  it("previews show before a plan exists, nothing done", () => {
    expect(previewSteps("gentle").every((s) => !s.done)).toBe(true);
    expect(previewSteps("own")).toHaveLength(4);
  });
});

describe("which plan a day opens", () => {
  it("a birthday: 'Khalid's birthday plan', celebrating", () => {
    const t = targetFor(eventOf(source()));
    expect(t).toMatchObject({
      key: "o1|2026-11-06",
      occasionId: "o1",
      occursOn: "2026-11-06",
      heading: "Khalid's birthday plan",
      style: "celebrate",
    });
  });

  it("someone 'In memory' and a day of remembrance: gentle", () => {
    expect(targetFor(eventOf(source({ inMemory: true, name: "Grandma" })))).toMatchObject({
      heading: "Plan for Grandma's birthday",
      style: "gentle",
    });
    expect(targetFor(eventOf(source({ kind: "remembrance", name: "Dad" }))).style).toBe("gentle");
  });

  it("your own day: 'My plan'", () => {
    const t = targetFor(eventOf(source({ id: "you", personId: null, isYou: true })));
    expect(t).toMatchObject({ key: "you|2026-11-06", occasionId: null, heading: "My plan" });
    expect(styleFor({ isYou: true, gentle: false })).toBe("own");
  });
});

describe("one plan per year", () => {
  it("next year starts fresh: last year's plan isn't this year's", () => {
    const plans = byKey([plan({ occursOn: "2025-11-06" })]);
    const thisYear = targetFor(eventOf(source()));
    expect(plans.get(thisYear.key)).toBeUndefined();
    // The day after this year's birthday, the target moves to next year.
    expect(targetFor(eventOf(source(), { year: 2026, month: 11, day: 7 })).key).toBe(
      "o1|2027-11-06",
    );
  });

  it("past plans stay, newest first, only for that person's days", () => {
    const plans = [
      plan({ id: "a", occursOn: "2024-11-06" }),
      plan({ id: "b", occursOn: "2025-11-06" }),
      plan({ id: "c", occursOn: "2026-11-06" }),
      plan({ id: "d", occasionId: "other", occursOn: "2025-01-01" }),
      plan({ id: "e", occasionId: null, occursOn: "2025-03-14" }),
    ];
    expect(pastPlans(plans, ["o1"], today).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("keys: occasion (or 'you') and date", () => {
    expect(planKey(null, { year: 2026, month: 11, day: 22 })).toBe("you|2026-11-22");
  });
});

describe("plan dots", () => {
  it("one per step, filled when done, with a label", () => {
    expect(planDots(plan()).dots).toEqual([true, false, false, false]);
    expect(planLabel(plan())).toBe("Plan 1 of 4 done");
  });

  it("at most five dots, never scaled: the rest is '+N'", () => {
    const long = plan({ steps: Array.from({ length: 10 }, (_, i) => step(i < 5, i)) });
    expect(planDots(long)).toEqual({ dots: [true, true, true, true, true], more: 5 });
  });

  it("the dots are the plan card's steps, in its order: 4 ticked pills are 4 filled dots", () => {
    // Gift, Message, Call, Cake ticked; Something else and another gift step not.
    const kinds = ["gift", "message", "call", "cake", "other", "gift"] as const;
    const steps = kinds.map((kind, i) => ({ ...step(i < 4, i), kind }));
    // Stored out of order: both read them by position.
    const { dots, more } = planDots(plan({ steps: [...steps].reverse() }));
    expect(dots).toEqual([true, true, true, true, false]);
    expect(more).toBe(1);
    expect(dots.filter(Boolean)).toHaveLength(4);
  });

  it("an empty plan has no dots", () => {
    expect(planDots(plan({ steps: [] }))).toEqual({ dots: [], more: 0 });
  });
});
