import { describe, expect, it } from "vitest";

import {
  countdown,
  daysToGoLabel,
  NOTE_OPENS_LINE,
  noorCountdownLine,
  noorPlanLine,
  SHARE_TEXT,
  stageFor,
  turningLine,
} from "./countdown";

const today = { year: 2026, month: 11, day: 4 };

describe("the countdown to your day", () => {
  it("counts to the next birthday, in your calendar", () => {
    expect(countdown({ day: 22, month: 11 }, today)).toMatchObject({
      daysUntil: 18,
      occursOn: "2026-11-22",
      stage: "weeks",
      dateLabel: "Sunday 22 November",
    });
    // Already passed this year: next year.
    expect(countdown({ day: 1, month: 11 }, today).occursOn).toBe("2027-11-01");
    expect(countdown({ day: 4, month: 11 }, today)).toMatchObject({ daysUntil: 0, stage: "today" });
  });

  it("29 February falls on the 28th in other years", () => {
    expect(countdown({ day: 29, month: 2 }, today).occursOn).toBe("2027-02-28");
    expect(countdown({ day: 29, month: 2 }, { year: 2027, month: 3, day: 1 }).occursOn).toBe(
      "2028-02-29",
    );
  });

  it("turning N only with a birth year", () => {
    expect(countdown({ day: 22, month: 11 }, today, 2000).turning).toBe(26);
    expect(countdown({ day: 22, month: 11 }, today).turning).toBeNull();
    expect(turningLine(26, "weeks")).toBe("turning 26, and it's going to be a good one ✨");
    expect(turningLine(null, "weeks")).toBe("and it's going to be a good one ✨");
  });

  it("days to go", () => {
    expect(daysToGoLabel(18)).toBe("days to go");
    expect(daysToGoLabel(1)).toBe("day to go");
  });
});

describe("Noor's line for each stage", () => {
  const line = (days: number, name = "Maya") =>
    noorCountdownLine({ daysUntil: days, stage: stageFor(days) }, name);

  it("weeks away, this week, tomorrow, today", () => {
    expect(line(30)).toBe("Your day is 4 weeks away. Plenty of time to plan something lovely ✨");
    expect(line(9)).toBe(
      "Your day is about a week away. Plenty of time to plan something lovely ✨",
    );
    expect(line(7)).toBe("Your day is this week. Is your wishlist up to date? 🎁");
    expect(line(2)).toBe("Your day is this week. Is your wishlist up to date? 🎁");
    expect(line(1)).toBe("Tomorrow is your day. Rest well tonight 🌙");
    expect(line(0)).toBe("Happy birthday, Maya! Today is all about you 🎉");
    expect(line(0, "")).toBe("Happy birthday! Today is all about you 🎉");
  });

  it("months away", () => {
    expect(line(120)).toBe("Your day is 4 months away. No rush, I'll keep it in mind ✨");
  });

  it("keeps Noor's voice: one emoji, no em dashes", () => {
    const emoji = /\p{Extended_Pictographic}/gu;
    for (const days of [0, 1, 2, 7, 9, 30, 120]) {
      expect(line(days).match(emoji)).toHaveLength(1);
      expect(line(days)).not.toContain("—");
    }
  });

  it("how my plan is going, and the note on the day", () => {
    expect(noorPlanLine(0, 4)).toBe("Let's plan something lovely. Start with one thing 💌");
    expect(noorPlanLine(1, 4)).toBe("1 of 4 done. Treat yourself the way you treat them 🤍");
    expect(noorPlanLine(4, 4)).toBe("Everything is ready. Now just enjoy it 🥹");
    expect(NOTE_OPENS_LINE).toBe("You left yourself a note 💌");
  });
});

describe("sharing", () => {
  it("says the link works once, for 7 days", () => {
    expect(SHARE_TEXT).toBe(
      "Here’s my birthday wishlist on Remember Me 🎁. This link works for one person, for 7 days.",
    );
  });
});
