import { describe, expect, it } from "vitest";

import { NAME_MAX, RELATION_COLORS, RELATIONS } from "./constants";
import { onboardingError } from "./errors";
import { needsMessage, noorLine, sampleNudge } from "./noor-lines";
import { onboardingRedirect } from "./redirect";
import {
  fieldErrors,
  isLeapYear,
  isRealDayMonth,
  lookSchema,
  onboardingSchema,
  personSchema,
  remindersSchema,
  youSchema,
} from "./schema";

const you = { firstName: "Sara", day: 14, month: 3, year: null };
const look = { kind: "initials" as const, color: "lilac" as const, character: null };
const person = {
  skipped: false as const,
  name: "Khalid",
  relation: "Best friend" as const,
  day: 14,
  month: 3,
  year: null,
  littleThing: "",
};
const reminders = { offsets: [7, 1, 0], email: true, push: false };

const errorsOf = (r: { success: boolean; error?: unknown }) =>
  r.success ? {} : fieldErrors(r.error as Parameters<typeof fieldErrors>[0]);

describe("dates", () => {
  it.each([
    [29, 2, true],
    [30, 2, false],
    [31, 4, false],
    [30, 4, true],
    [31, 12, true],
    [0, 1, false],
    [1, 13, false],
  ])("%i/%i is a real day of the year: %s", (d, m, ok) => expect(isRealDayMonth(d, m)).toBe(ok));

  it.each([
    [2004, true],
    [2000, true],
    [1900, false],
    [2001, false],
  ])("%i is a leap year: %s", (y, ok) => expect(isLeapYear(y)).toBe(ok));
});

describe("step 1 · you", () => {
  it("accepts a name and day + month, year optional", () => {
    expect(youSchema.safeParse(you).success).toBe(true);
    expect(youSchema.safeParse({ ...you, year: 1995 }).success).toBe(true);
  });

  it("explains a missing name and birthday", () => {
    expect(errorsOf(youSchema.safeParse({ ...you, firstName: "  ", day: null }))).toEqual({
      firstName: "What should we call you?",
      day: "Pick your birthday: day and month.",
    });
  });

  it("allows 29 February, refuses 30 February and 29 February in a non-leap year", () => {
    expect(youSchema.safeParse({ ...you, day: 29, month: 2 }).success).toBe(true);
    expect(errorsOf(youSchema.safeParse({ ...you, day: 30, month: 2 })).day).toBe(
      "That day doesn't exist in that month.",
    );
    expect(errorsOf(youSchema.safeParse({ ...you, day: 29, month: 2, year: 2001 })).year).toBe(
      "2001 had no 29 February.",
    );
  });

  it("keeps names to 40 characters", () => {
    expect(NAME_MAX).toBe(40);
    expect(youSchema.safeParse({ ...you, firstName: "a".repeat(40) }).success).toBe(true);
    expect(errorsOf(youSchema.safeParse({ ...you, firstName: "a".repeat(41) })).firstName).toBe(
      "Keep it to 40 characters.",
    );
  });

  it("refuses a year in the future", () => {
    expect(errorsOf(youSchema.safeParse({ ...you, year: new Date().getFullYear() + 1 })).year).toBe(
      "That year hasn't happened yet.",
    );
  });
});

describe("step 2 · look", () => {
  it("needs a character when the character avatar is chosen", () => {
    expect(lookSchema.safeParse({ ...look, kind: "character", character: "fox" }).success).toBe(
      true,
    );
    expect(errorsOf(lookSchema.safeParse({ ...look, kind: "character" })).character).toBe(
      "Pick a character, or choose initials.",
    );
  });

  it("only accepts the six pastels", () => {
    expect(lookSchema.safeParse({ ...look, color: "black" }).success).toBe(false);
  });
});

describe("step 3 · first person", () => {
  it("accepts a skipped person", () => {
    expect(personSchema.safeParse({ skipped: true }).success).toBe(true);
  });

  it("needs a name and a birthday when not skipped", () => {
    expect(
      errorsOf(personSchema.safeParse({ ...person, name: "", day: null, month: null })),
    ).toEqual({
      name: "What's their name?",
      day: "When is their birthday? Day and month.",
    });
  });

  it("keeps their name to 40 characters", () => {
    expect(errorsOf(personSchema.safeParse({ ...person, name: "k".repeat(41) })).name).toBe(
      "Keep it to 40 characters.",
    );
  });

  it("accepts a person born on 29 February", () => {
    expect(personSchema.safeParse({ ...person, day: 29, month: 2, year: 2004 }).success).toBe(true);
  });

  it("only accepts the relation chips", () => {
    expect(personSchema.safeParse({ ...person, relation: "Neighbour" }).success).toBe(false);
  });
});

describe("step 4 · reminders", () => {
  it("accepts any of 14, 7, 3, 1, 0 days and needs at least one", () => {
    expect(remindersSchema.safeParse({ ...reminders, offsets: [14, 0] }).success).toBe(true);
    expect(errorsOf(remindersSchema.safeParse({ ...reminders, offsets: [] })).offsets).toBe(
      "Pick at least one, so I know when to nudge you.",
    );
    expect(remindersSchema.safeParse({ ...reminders, offsets: [5] }).success).toBe(false);
  });
});

describe("whole onboarding", () => {
  it("accepts a complete draft, with or without the first person", () => {
    const base = { you, look, reminders, timezone: "Africa/Casablanca" };
    expect(onboardingSchema.safeParse({ ...base, person }).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...base, person: { skipped: true } }).success).toBe(true);
  });
});

describe("helpers", () => {
  it("gives each relation its colour, all different", () => {
    expect(RELATION_COLORS).toEqual({
      "Best friend": "rose",
      Family: "sky",
      Partner: "peach",
      Friend: "lilac",
      Colleague: "mint",
    });
    expect(new Set(RELATIONS.map((r) => RELATION_COLORS[r])).size).toBe(RELATIONS.length);
  });

  it("says in the action bar what Continue needs", () => {
    expect(needsMessage(0, { day: "Pick your birthday: day and month." })).toBe(
      "Pick your birthday day and month to continue.",
    );
    expect(needsMessage(0, { day: "That day doesn't exist in that month." })).toBe(
      "That day doesn't exist in that month.",
    );
    expect(needsMessage(2, { name: "What's their name?" })).toBe(
      "Add their name and birthday, or skip for now.",
    );
    expect(needsMessage(2, { year: "2001 had no 29 February." })).toBe("2001 had no 29 February.");
    expect(needsMessage(3, { offsets: "Pick at least one, so I know when to nudge you." })).toBe(
      "Pick at least one, so I know when to nudge you.",
    );
  });

  it("previews a reminder with the first person's name, else a generic one", () => {
    expect(sampleNudge("Sara", [7, 1, 0])).toBe("Sara's birthday is in 7 days");
    expect(sampleNudge(" Sara ", [14, 0])).toBe("Sara's birthday is in 2 weeks");
    expect(sampleNudge("Sara", [1])).toBe("Sara's birthday is tomorrow");
    expect(sampleNudge(null, [0])).toBe("A friend's birthday is today");
    expect(sampleNudge("", [3])).toBe("A friend's birthday is in 3 days");
  });

  it("maps database error codes to a step and friendly copy", () => {
    expect(onboardingError("invalid_person_birthday")).toEqual({
      kind: "step",
      step: 2,
      message: "Their birthday doesn't look right.",
    });
    expect(onboardingError("already_onboarded")).toEqual({ kind: "already_onboarded" });
    expect(onboardingError("something new")).toMatchObject({ kind: "unknown" });
  });

  it("redirects unfinished people to onboarding and finished people away from it", () => {
    expect(onboardingRedirect("/home", false)).toBe("/onboarding");
    expect(onboardingRedirect("/people/khalid", false)).toBe("/onboarding");
    expect(onboardingRedirect("/onboarding", false)).toBeNull();
    expect(onboardingRedirect("/onboarding", true)).toBe("/home");
    expect(onboardingRedirect("/home", true)).toBeNull();
  });

  it("has Noor's line for every step, using names when known", () => {
    const ctx = { firstName: "Sara", birthdayDone: true, personName: "Khalid" };
    expect(noorLine(0, ctx)).toBe(
      "Hi Sara! I'm Noor 🕯️ I'll help you remember the people you love. But first, you.",
    );
    expect(noorLine(2, ctx)).toMatch(/^Ooh, Khalid!/);
    expect(noorLine(2, { ...ctx, personName: "" })).toBe(
      "Now the fun part. Who should never be forgotten? 💌",
    );
    expect(noorLine(4, ctx)).toBe("Done! I'll remind you before Khalid's day. You just show up 🥹");
  });

  it("never uses em dashes or more than one emoji per line", () => {
    const ctx = { firstName: "Sara", birthdayDone: true, personName: "Khalid" };
    for (let step = 0; step <= 4; step++) {
      const line = noorLine(step, ctx);
      expect(line).not.toContain("—");
      expect(line.match(/\p{Extended_Pictographic}/gu)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });
});
