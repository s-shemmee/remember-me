import { describe, expect, it } from "vitest";

import { OCCASION_TYPES, occasionTitle, occasionType, OTHER_DAY_KINDS } from "./types";

describe("occasion types", () => {
  it("has the six types with their emojis (🕯️ is Noor's, so never a type)", () => {
    expect(Object.values(OCCASION_TYPES).map((t) => `${t.label} ${t.emoji}`)).toEqual([
      "Birthday 🎂",
      "Anniversary 💞",
      "Graduation 🎓",
      "Work milestone 💼",
      "Remembrance 🕊️",
      "Something else ✨",
    ]);
    expect(Object.values(OCCASION_TYPES).some((t) => t.emoji === "🕯️")).toBe(false);
  });

  it("has no health type: health goes under Something else, in the user's own words", () => {
    expect(OTHER_DAY_KINDS).toEqual([
      "anniversary",
      "graduation",
      "work_milestone",
      "remembrance",
      "other",
    ]);
    expect(Object.keys(OCCASION_TYPES).some((k) => /health|medical/.test(k))).toBe(false);
    expect(occasionType("health")).toBe(OCCASION_TYPES.other);
  });

  it("suggests titles with their repeat", () => {
    const chips = (k: keyof typeof OCCASION_TYPES) =>
      OCCASION_TYPES[k].chips.map((c) => `${c.title}:${c.recurring ? "yearly" : "once"}`);
    expect(chips("anniversary")).toEqual([
      "Wedding:yearly",
      "The day we met:yearly",
      "Friendship anniversary:yearly",
    ]);
    expect(chips("graduation")).toEqual([
      "Bachelor's:once",
      "Master's:once",
      "Finished a course:once",
    ]);
    expect(chips("work_milestone")).toEqual([
      "New job:once",
      "Promotion:once",
      "Work anniversary:yearly",
      "Opened a business:yearly",
    ]);
    expect(chips("remembrance")).toEqual([]);
    expect(OCCASION_TYPES.remembrance.placeholder).toBe("In memory of…");
    expect(chips("other")).toEqual([
      "First marathon:once",
      "Moved to a new city:once",
      "Got their licence:once",
    ]);
    expect(chips("birthday")).toEqual([]);
  });

  it("repeats by default: Graduation and Something else once, the rest every year", () => {
    expect(OTHER_DAY_KINDS.map((k) => `${k}:${OCCASION_TYPES[k].defaultRecurring}`)).toEqual([
      "anniversary:true",
      "graduation:false",
      "work_milestone:true",
      "remembrance:true",
      "other:false",
    ]);
  });

  it("only Something else needs a title; only Remembrance is gentle", () => {
    expect(OTHER_DAY_KINDS.filter((k) => OCCASION_TYPES[k].titleRequired)).toEqual(["other"]);
    expect(
      Object.values(OCCASION_TYPES)
        .filter((t) => t.gentle)
        .map((t) => t.kind),
    ).toEqual(["remembrance"]);
  });

  it("names a day with its title, or the type", () => {
    expect(occasionTitle("Khalid", "anniversary", null)).toBe("Khalid's anniversary");
    expect(occasionTitle("Khalid", "anniversary", "  ")).toBe("Khalid's anniversary");
    expect(occasionTitle("Khalid", "work_milestone", " New job ")).toBe("Khalid · New job");
    expect(occasionTitle("Grandma", "remembrance", null)).toBe("Grandma's day of remembrance");
    expect(occasionTitle("Sara", "remembrance", "In memory of Dad")).toBe(
      "Sara · In memory of Dad",
    );
  });
});
