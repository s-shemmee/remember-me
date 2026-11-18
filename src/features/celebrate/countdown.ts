/**
 * Celebrate Me (AppCelebrate): the countdown to your own birthday and what
 * Noor says at each stage. Pure, so it's unit-tested. "Today" is in your
 * timezone; 29 February falls on the 28th in other years.
 */
import {
  type CalendarDate,
  daysBetween,
  type DayMonth,
  MONTHS,
  nextOccurrence,
  toIsoDate,
  yearsOn,
} from "@/lib/dates";

export type Stage = "months" | "weeks" | "week" | "tomorrow" | "today";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Countdown = {
  daysUntil: number;
  on: CalendarDate;
  /** "2026-11-22": the occurrence your own plan belongs to. */
  occursOn: string;
  stage: Stage;
  /** "Sunday 22 November". */
  dateLabel: string;
  /** How old you turn, when your birth year is set (it stays private). */
  turning: number | null;
};

export function stageFor(daysUntil: number): Stage {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil <= 7) return "week";
  if (daysUntil < 60) return "weeks";
  return "months";
}

export function countdown(
  birthday: DayMonth,
  today: CalendarDate,
  birthYear: number | null = null,
): Countdown {
  const on = nextOccurrence(birthday, today);
  const daysUntil = daysBetween(today, on);
  const weekday = WEEKDAYS[new Date(Date.UTC(on.year, on.month - 1, on.day)).getUTCDay()];
  return {
    daysUntil,
    on,
    occursOn: toIsoDate(on),
    stage: stageFor(daysUntil),
    dateLabel: `${weekday} ${on.day} ${MONTHS[on.month - 1]}`,
    turning: yearsOn(birthYear, on),
  };
}

/** Noor's line for the stage (first person, one emoji, no em dashes). */
export function noorCountdownLine(c: Pick<Countdown, "daysUntil" | "stage">, firstName: string) {
  switch (c.stage) {
    case "today":
      return `Happy birthday${firstName ? `, ${firstName}` : ""}! Today is all about you 🎉`;
    case "tomorrow":
      return "Tomorrow is your day. Rest well tonight 🌙";
    case "week":
      return "Your day is this week. Is your wishlist up to date? 🎁";
    case "weeks": {
      const weeks = Math.round(c.daysUntil / 7);
      return `Your day is ${weeks <= 1 ? "about a week" : `${weeks} weeks`} away. Plenty of time to plan something lovely ✨`;
    }
    case "months":
      return `Your day is ${Math.round(c.daysUntil / 30.44)} months away. No rush, I'll keep it in mind ✨`;
  }
}

/** Noor's second line: how your own plan is going. */
export function noorPlanLine(done: number, total: number): string {
  if (total > 0 && done >= total) return "Everything is ready. Now just enjoy it 🥹";
  if (done === 0) return "Let's plan something lovely. Start with one thing 💌";
  return `${done} of ${total} done. Treat yourself the way you treat them 🤍`;
}

/** On the day, when a sealed note opens. */
export const NOTE_OPENS_LINE = "You left yourself a note 💌";

/** The big number's words: "days to go", "day to go". */
export const daysToGoLabel = (days: number) => (days === 1 ? "day to go" : "days to go");

/** The handwritten line under the countdown. */
export function turningLine(turning: number | null, stage: Stage): string {
  if (stage === "today") {
    return turning
      ? `${turning} today, and it's a good one ✨`
      : "and it's going to be a good one ✨";
  }
  return turning
    ? `turning ${turning}, and it's going to be a good one ✨`
    : "and it's going to be a good one ✨";
}

/** "Share with my people": each tap makes a fresh invite (it works once, for 7 days). */
export const SHARE_TEXT =
  "Here’s my birthday wishlist on Remember Me 🎁. This link works for one person, for 7 days.";

/** "A note to future me": up to 2,000 characters (the database checks too). */
export const MAX_FUTURE_NOTE = 2000;
