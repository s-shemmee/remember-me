import { describe, expect, it } from "vitest";

import { personError } from "./errors";
import { type PersonFormValues, personFieldErrors, personFormSchema } from "./schema";

const valid: PersonFormValues = {
  id: null,
  name: " Khalid ",
  relationKind: "Best friend",
  description: " Brother from uni ",
  color: "rose",
  day: 6,
  month: 11,
  year: 1996,
  littleThings: ["black coffee"],
  days: [{ id: null, kind: "anniversary", title: "", day: 16, month: 11, year: 1993 }],
};

const errorsOf = (input: unknown) => {
  const r = personFormSchema.safeParse(input);
  return r.success ? {} : personFieldErrors(r.error);
};

describe("personFormSchema", () => {
  it("accepts a full person and trims text", () => {
    const r = personFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ name: "Khalid", description: "Brother from uni" });
  });

  it("needs a name and a birthday", () => {
    expect(errorsOf({ ...valid, name: "  ", day: null })).toEqual({
      name: "What's their name?",
      day: "When is their birthday? Day and month.",
    });
  });

  it("keeps the name to 40 and the description to 30 characters", () => {
    expect(errorsOf({ ...valid, name: "k".repeat(41) }).name).toBe("Keep it to 40 characters.");
    expect(errorsOf({ ...valid, name: "k".repeat(40) })).toEqual({});
    expect(errorsOf({ ...valid, description: "d".repeat(31) }).description).toBe(
      "Keep it to 30 characters.",
    );
  });

  it("only takes the five relations and our six pastels", () => {
    expect(errorsOf({ ...valid, relationKind: "Cousin" }).relationKind).toBeDefined();
    expect(errorsOf({ ...valid, color: "black" }).color).toBeDefined();
  });

  it("handles 29 February and future birth years", () => {
    expect(errorsOf({ ...valid, day: 29, month: 2, year: 2004 })).toEqual({});
    expect(errorsOf({ ...valid, day: 29, month: 2, year: 2023 }).year).toBe(
      "2023 had no 29 February.",
    );
    expect(errorsOf({ ...valid, year: new Date().getFullYear() + 1 }).year).toBe(
      "That year hasn't happened yet.",
    );
  });

  it("limits little things to 20, each up to 60 characters", () => {
    expect(
      errorsOf({ ...valid, littleThings: Array.from({ length: 21 }, (_, i) => `t${i}`) })
        .littleThings,
    ).toBe("Up to 20 little things.");
    expect(errorsOf({ ...valid, littleThings: ["x".repeat(61)] })["littleThings.0"]).toBe(
      "Keep each one to 60 characters.",
    );
  });

  it("checks other days, keyed by their row", () => {
    const other = { id: null, kind: "other", title: " ", day: 1, month: 5, year: null };
    expect(errorsOf({ ...valid, days: [valid.days[0], other] })).toEqual({
      "days.1.title": "What's the day called?",
    });
    expect(
      errorsOf({ ...valid, days: [{ ...other, title: "Name day", day: 31, month: 4 }] }),
    ).toEqual({
      "days.0.day": "That day doesn't exist in that month.",
    });
    expect(errorsOf({ ...valid, days: [{ ...other, title: "Name day", day: null }] })).toEqual({
      "days.0.day": "Pick a day and month.",
    });
    // A graduation can be in the future.
    expect(errorsOf({ ...valid, days: [{ ...other, kind: "graduation", year: 2027 }] })).toEqual(
      {},
    );
    expect(errorsOf({ ...valid, days: Array.from({ length: 11 }, () => valid.days[0]) }).days).toBe(
      "Up to 10 other days.",
    );
  });
});

describe("personError", () => {
  it("maps database codes to friendly copy and a field", () => {
    expect(personError("invalid_name")).toEqual({
      kind: "known",
      message: "Their name needs a quick look.",
      field: "name",
    });
    expect(personError("not_found")).toEqual({
      kind: "known",
      message: "I couldn't find them. They may have been removed.",
    });
    expect(personError("not_authenticated")).toEqual({ kind: "signed_out" });
    expect(personError("boom").kind).toBe("unknown");
  });
});
