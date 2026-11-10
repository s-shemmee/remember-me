import {
  type CalendarDate,
  countdownLabel,
  daysBetween,
  daysInMonth,
  formatLongDate,
  formatShortDate,
  MONTHS,
  nextOccurrence,
  occurrenceIn,
  weekdayIndex,
  yearsOn,
} from "@/lib/dates";
import type { Pastel } from "@/styles/tokens";

/**
 * Every day worth remembering, from your people and your own birthday, and
 * what Home and Calendar say about them. Pure functions on plain calendar
 * dates ("today" comes from the user's timezone), so they're unit-tested.
 *
 * Birthdays, anniversaries and other days repeat every year (29 February
 * falls on the 28th in non-leap years). A graduation with a year happens
 * once, on that date.
 */

export type DayKind = "birthday" | "anniversary" | "graduation" | "other";

/** One remembered day: an occasion of one of your people, or your own birthday. */
export type DaySource = {
  /** Occasion id, or "you" for your own birthday. */
  id: string;
  /** The person's id; null for your own day. */
  personId: string | null;
  /** The person's name, or your first name. */
  name: string;
  isYou: boolean;
  kind: DayKind;
  title: string | null;
  day: number;
  month: number;
  year: number | null;
  color: Pastel;
  littleThings: string[];
};

/** A remembered day on a given date. */
export type DayEvent = {
  key: string;
  source: DaySource;
  on: CalendarDate;
  daysUntil: number;
  emoji: string;
  /** "Khalid's birthday", "Mom & Dad's anniversary", "Your day". */
  title: string;
  /** For name tags: "Khalid", "You". */
  short: string;
  /** "Turns 30", "32 years", "Graduation"… null when there's nothing to add. */
  detail: string | null;
  /** "today", "tomorrow", "in 12 days". */
  when: string;
  /** "Fri, 6 November". */
  date: string;
  /** "Fri, 6 Nov". */
  shortDate: string;
};

const EMOJI: Record<DayKind, string> = {
  birthday: "🎂",
  anniversary: "💍",
  graduation: "🎓",
  other: "✨",
};

const possessive = (name: string) => `${name}'s`;

const isOneOff = (s: Pick<DaySource, "kind" | "year">) =>
  s.kind === "graduation" && s.year !== null;

/**
 * When this day next happens, on or after `today`. A one-off graduation
 * that has passed returns null.
 */
export function nextDate(s: DaySource, today: CalendarDate): CalendarDate | null {
  if (isOneOff(s)) {
    const on = { year: s.year!, month: s.month, day: s.day };
    return daysBetween(today, on) >= 0 ? on : null;
  }
  return nextOccurrence(s, today);
}

/** Whether (and when) this day falls in a given month. */
export function dateInMonth(s: DaySource, year: number, month: number): CalendarDate | null {
  if (s.month !== month) return null;
  if (isOneOff(s) && s.year !== year) return null;
  return occurrenceIn(s, year);
}

export function eventOn(s: DaySource, on: CalendarDate, today: CalendarDate): DayEvent {
  const years = isOneOff(s) ? null : yearsOn(s.year, on);
  const daysUntil = daysBetween(today, on);
  const label = s.kind === "other" ? s.title?.trim() || "A special day" : null;
  const title = s.isYou
    ? "Your day"
    : s.kind === "birthday"
      ? `${possessive(s.name)} birthday`
      : s.kind === "anniversary"
        ? `${possessive(s.name)} anniversary`
        : s.kind === "graduation"
          ? `${possessive(s.name)} graduation`
          : `${label} (${s.name})`;
  const detail =
    s.kind === "birthday" && years
      ? `Turns ${years}`
      : s.kind === "anniversary" && years
        ? `${years} ${years === 1 ? "year" : "years"}`
        : null;
  return {
    key: `${s.id}:${on.year}`,
    source: s,
    on,
    daysUntil,
    emoji: s.isYou ? "✨" : EMOJI[s.kind],
    title,
    short: s.isYou ? "You" : s.name,
    detail,
    when: countdownLabel(daysUntil),
    date: formatLongDate(on),
    shortDate: formatShortDate(on),
  };
}

const byDate = (a: DayEvent, b: DayEvent) =>
  a.daysUntil - b.daysUntil ||
  // Your own day first, then birthdays, then by name.
  Number(b.source.isYou) - Number(a.source.isYou) ||
  Number(b.source.kind === "birthday") - Number(a.source.kind === "birthday") ||
  a.source.name.localeCompare(b.source.name);

/** Upcoming days from today (inclusive), soonest first, optionally within `days` days. */
export function upcoming(sources: DaySource[], today: CalendarDate, within?: number): DayEvent[] {
  const out: DayEvent[] = [];
  for (const s of sources) {
    const on = nextDate(s, today);
    if (!on) continue;
    const e = eventOn(s, on, today);
    if (within === undefined || e.daysUntil < within) out.push(e);
  }
  return out.sort(byDate);
}

/** The days in a month, keyed by day of the month. */
export function monthEvents(
  sources: DaySource[],
  year: number,
  month: number,
  today: CalendarDate,
): Map<number, DayEvent[]> {
  const out = new Map<number, DayEvent[]>();
  for (const s of sources) {
    const on = dateInMonth(s, year, month);
    if (!on) continue;
    const list = out.get(on.day) ?? [];
    list.push(eventOn(s, on, today));
    out.set(on.day, list);
  }
  for (const list of out.values()) list.sort(byDate);
  return out;
}

/** Weeks of a month, Monday first; null pads the first and last weeks. */
export function monthGrid(year: number, month: number): (CalendarDate | null)[][] {
  const first = { year, month, day: 1 };
  const cells: (CalendarDate | null)[] = Array.from({ length: weekdayIndex(first) }, () => null);
  for (let day = 1; day <= daysInMonth(month, year); day++) cells.push({ year, month, day });
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Home --------------------------------------------------------------------------------

export function greeting(hour: number): { text: string; emoji: string } {
  if (hour >= 5 && hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour >= 12 && hour < 18) return { text: "Good afternoon", emoji: "🌤️" };
  return { text: "Good evening", emoji: "🌙" };
}

/**
 * Noor's nudge about the next day in the coming 30 (template text, no AI).
 * No pronouns: there's no gender field, so Noor uses the name.
 */
export function noorNudge(
  events: DayEvent[],
  hasPeople: boolean,
  firstName: string,
): { text: string; personId: string | null; name: string | null; isYou: boolean } {
  if (!hasPeople) {
    return {
      text: "Add the first person you'd hate to forget, and I'll remind you before their day 💛",
      personId: null,
      name: null,
      isYou: false,
    };
  }
  const next = events.find((e) => e.daysUntil < 30);
  if (!next) {
    return {
      text: "Nothing in the next 30 days. A calm stretch ☁️",
      personId: null,
      name: null,
      isYou: false,
    };
  }
  const s = next.source;
  if (s.isYou) {
    return {
      text:
        next.daysUntil === 0
          ? `Happy birthday${firstName ? `, ${firstName}` : ""} 🎂 Today is all about you.`
          : `Your day is ${next.when} ✨ You deserve a lovely one.`,
      personId: null,
      name: null,
      isYou: true,
    };
  }
  const when = next.when;
  const years = next.detail?.startsWith("Turns ") ? next.detail.slice(6) : null;
  let text: string;
  if (s.kind === "birthday") {
    text = years
      ? `${s.name} turns ${years} ${when} 🎂`
      : `It's ${possessive(s.name)} birthday ${when} 🎂`;
  } else if (s.kind === "anniversary") {
    text = next.detail
      ? `${s.name} celebrate ${next.detail} ${when} 💍`
      : `${possessive(s.name)} anniversary is ${when} 💍`;
  } else if (s.kind === "graduation") {
    text = `${possessive(s.name)} graduation is ${when} 🎓`;
  } else {
    text = `${s.title?.trim() || "A special day"} for ${s.name} is ${when} ✨`;
  }
  const thing = s.littleThings[0]?.trim();
  if (thing) text += ` Little thing: ${thing}`;
  return { text, personId: s.personId, name: s.name, isYou: false };
}

/** "turns 30 in 2 days", "birthday in 2 days", "anniversary today"… for the Next up card. */
export function nextUpLine(e: DayEvent): string {
  const s = e.source;
  const what =
    s.kind === "birthday"
      ? e.detail
        ? `turns ${e.detail.slice(6)}`
        : "birthday"
      : s.kind === "anniversary"
        ? "anniversary"
        : s.kind === "graduation"
          ? "graduation"
          : s.title?.trim() || "a special day";
  return `${what} ${e.when}`;
}

/** Days still to come this month (today included), your own day too. */
export function moreThisMonth(sources: DaySource[], today: CalendarDate): number {
  let n = 0;
  for (const list of monthEvents(sources, today.year, today.month, today).values()) {
    for (const e of list) if (e.daysUntil >= 0) n++;
  }
  return n;
}

/** "one birthday this week", "2 days to remember this week", "a quiet week ahead". */
export function weekSummary(events: DayEvent[]): string {
  const week = events.filter((e) => e.daysUntil < 7 && !e.source.isYou);
  if (!week.length) return "a quiet week ahead";
  const birthdays = week.filter((e) => e.source.kind === "birthday").length;
  const count = (n: number) => (n === 1 ? "one" : String(n));
  if (birthdays === week.length) {
    return `${count(birthdays)} ${birthdays === 1 ? "birthday" : "birthdays"} this week`;
  }
  return `${count(week.length)} ${week.length === 1 ? "day" : "days"} to remember this week`;
}

export const monthName = (month: number) => MONTHS[month - 1]!;

/** "Noor reminds you 7 days, 1 day and the morning of." */
export function remindersLine(offsets: number[]): string {
  const words: Record<number, string> = {
    14: "2 weeks",
    7: "7 days",
    3: "3 days",
    1: "1 day",
    0: "the morning of",
  };
  const parts = [...offsets].sort((a, b) => b - a).map((o) => words[o] ?? `${o} days`);
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
  return `Noor reminds you ${list}.`;
}
