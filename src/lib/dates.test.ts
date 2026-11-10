import { describe, expect, it } from "vitest";

import {
  countdownLabel,
  daysBetween,
  daysInMonth,
  daysUntil,
  formatDayMonth,
  formatLongDate,
  formatShortDate,
  isLeapYear,
  isRealDayMonth,
  nextOccurrence,
  occurrenceIn,
  todayIn,
  yearsOn,
} from "./dates";

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("leap years and real days", () => {
  it.each([
    [2024, true],
    [2023, false],
    [2000, true],
    [1900, false],
    [2100, false],
    [2400, true],
  ])("%i is a leap year: %s", (y, ok) => expect(isLeapYear(y)).toBe(ok));

  it("knows how long each month is", () => {
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2025)).toBe(28);
    expect(daysInMonth(4, 2025)).toBe(30);
    expect(daysInMonth(12, 2025)).toBe(31);
  });

  it("accepts 29 February and refuses days that never exist", () => {
    expect(isRealDayMonth(29, 2)).toBe(true);
    expect(isRealDayMonth(30, 2)).toBe(false);
    expect(isRealDayMonth(31, 4)).toBe(false);
    expect(isRealDayMonth(31, 12)).toBe(true);
    expect(isRealDayMonth(0, 1)).toBe(false);
    expect(isRealDayMonth(1, 13)).toBe(false);
    expect(isRealDayMonth(1.5, 1)).toBe(false);
  });
});

describe("todayIn", () => {
  // 23:30 UTC on 31 December 2025 is already 1 January in Casablanca (UTC+1)
  // and still 31 December in New York.
  const lateNight = new Date("2025-12-31T23:30:00Z");

  it("uses the user's timezone, not the server's", () => {
    expect(todayIn("Africa/Casablanca", lateNight)).toEqual(d(2026, 1, 1));
    expect(todayIn("America/New_York", lateNight)).toEqual(d(2025, 12, 31));
    expect(todayIn("UTC", lateNight)).toEqual(d(2025, 12, 31));
  });

  it("falls back to Casablanca for a missing or unknown timezone", () => {
    expect(todayIn(null, lateNight)).toEqual(d(2026, 1, 1));
    expect(todayIn("Mars/Olympus", lateNight)).toEqual(d(2026, 1, 1));
  });
});

describe("next occurrence and days until", () => {
  it("is today when the day is today", () => {
    expect(nextOccurrence({ day: 4, month: 11 }, d(2026, 11, 4))).toEqual(d(2026, 11, 4));
    expect(daysUntil({ day: 4, month: 11 }, d(2026, 11, 4))).toBe(0);
  });

  it("counts forward within the year and rolls over to next year", () => {
    expect(daysUntil({ day: 6, month: 11 }, d(2026, 11, 4))).toBe(2);
    expect(daysUntil({ day: 3, month: 11 }, d(2026, 11, 4))).toBe(364);
    expect(nextOccurrence({ day: 1, month: 1 }, d(2025, 12, 31))).toEqual(d(2026, 1, 1));
    expect(daysUntil({ day: 1, month: 1 }, d(2025, 12, 31))).toBe(1);
    expect(daysUntil({ day: 31, month: 12 }, d(2026, 1, 1))).toBe(364);
  });

  describe("29 February", () => {
    const leapDay = { day: 29, month: 2 };

    it("falls on 28 February in a non-leap year", () => {
      expect(occurrenceIn(leapDay, 2026)).toEqual(d(2026, 2, 28));
      expect(nextOccurrence(leapDay, d(2026, 2, 1))).toEqual(d(2026, 2, 28));
      expect(daysUntil(leapDay, d(2026, 2, 28))).toBe(0);
    });

    it("falls on 29 February in a leap year", () => {
      expect(nextOccurrence(leapDay, d(2028, 2, 28))).toEqual(d(2028, 2, 29));
      expect(daysUntil(leapDay, d(2028, 2, 28))).toBe(1);
    });

    it("after the 28th in a non-leap year, waits for next year", () => {
      expect(nextOccurrence(leapDay, d(2026, 3, 1))).toEqual(d(2027, 2, 28));
      expect(nextOccurrence(leapDay, d(2027, 3, 1))).toEqual(d(2028, 2, 29));
    });
  });

  it("counts days across a leap year", () => {
    expect(daysBetween(d(2024, 2, 28), d(2024, 3, 1))).toBe(2);
    expect(daysBetween(d(2025, 2, 28), d(2025, 3, 1))).toBe(1);
    expect(daysBetween(d(2024, 1, 1), d(2025, 1, 1))).toBe(366);
  });
});

describe("yearsOn", () => {
  it("gives the age turned on the next occurrence", () => {
    expect(yearsOn(1996, nextOccurrence({ day: 6, month: 11 }, d(2026, 11, 4)))).toBe(30);
    // Birthday already passed this year: they turn 31 next year.
    expect(yearsOn(1996, nextOccurrence({ day: 1, month: 1 }, d(2026, 11, 4)))).toBe(31);
  });

  it("is null without a year, or for a day still to come for the first time", () => {
    expect(yearsOn(null, d(2026, 1, 1))).toBeNull();
    expect(yearsOn(undefined, d(2026, 1, 1))).toBeNull();
    expect(yearsOn(2027, d(2026, 11, 24))).toBeNull();
    expect(yearsOn(2026, d(2026, 11, 24))).toBeNull();
  });

  it("works for someone born on 29 February", () => {
    expect(yearsOn(2004, nextOccurrence({ day: 29, month: 2 }, d(2026, 1, 1)))).toBe(22);
  });
});

describe("countdownLabel", () => {
  it.each([
    [0, "today"],
    [1, "tomorrow"],
    [2, "in 2 days"],
    [40, "in 40 days"],
    [45, "in 45 days"],
    [46, "in 2 months"],
    [66, "in 2 months"],
    [119, "in 4 months"],
    [161, "in 5 months"],
    [364, "in 12 months"],
  ])("%i days → %s", (days, label) => expect(countdownLabel(days)).toBe(label));
});

describe("formatting", () => {
  it("writes dates as in the screens", () => {
    expect(formatLongDate(d(2026, 11, 6))).toBe("Fri, 6 November");
    expect(formatShortDate(d(2026, 11, 22))).toBe("Sun, 22 Nov");
    expect(formatDayMonth({ day: 14, month: 3 })).toBe("14 March");
  });
});
