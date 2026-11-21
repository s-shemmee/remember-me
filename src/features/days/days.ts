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

import { type OccasionKind, occasionTitle, occasionType, typeFor } from "../occasions/types";

/**
 * Every day worth remembering, from your people and your own birthday, and
 * what Home and Calendar say about them. Pure functions on plain calendar
 * dates ("today" comes from the user's timezone), so they're unit-tested.
 *
 * A day repeats every year (29 February falls on the 28th in non-leap
 * years) or happens once, on its date and year (`recurring`). Types, emojis
 * and the gentle Remembrance wording come from features/occasions/types.
 */

export type DayKind = OccasionKind;

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
  /** Every year, or once on day/month/year. */
  recurring: boolean;
  color: Pastel;
  littleThings: string[];
  /** The person has passed: every day of theirs is gentle (people.in_memory). */
  inMemory?: boolean;
};

/** A remembered day on a given date. */
export type DayEvent = {
  key: string;
  source: DaySource;
  on: CalendarDate;
  daysUntil: number;
  emoji: string;
  /** "Khalid's birthday", "Khalid · New job", "Grandma's day of remembrance", "Your day". */
  title: string;
  /** For name tags: "Khalid", "You". */
  short: string;
  /** "Turns 30", "32 years"… null when there's nothing to add. */
  detail: string | null;
  /** Remembrance: no confetti, "celebrate", excitement or gift actions. */
  gentle: boolean;
  /** "today", "tomorrow", "in 12 days". */
  when: string;
  /** "Fri, 6 November". */
  date: string;
  /** "Fri, 6 Nov". */
  shortDate: string;
};

const possessive = (name: string) => `${name}'s`;

const isOneOff = (s: Pick<DaySource, "recurring" | "year">) => !s.recurring && s.year !== null;

/**
 * When this day next happens, on or after `today`. A one-off day that has
 * passed returns null.
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
  const type = typeFor(s.kind, s.inMemory);
  const years = isOneOff(s) ? null : yearsOn(s.year, on);
  const daysUntil = daysBetween(today, on);
  const detail =
    s.kind === "birthday" && years && !s.inMemory
      ? `Turns ${years}`
      : type.countsYears && years
        ? `${years} ${years === 1 ? "year" : "years"}`
        : null;
  return {
    key: `${s.id}:${on.year}`,
    source: s,
    on,
    daysUntil,
    emoji: s.isYou ? "✨" : type.emoji,
    title: s.isYou ? "Your day" : occasionTitle(s.name, s.kind, s.title),
    short: s.isYou ? "You" : s.name,
    detail,
    gentle: type.gentle,
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

/** Home's greeting (no emoji: it's a heading). */
export function greeting(hour: number): { text: string } {
  if (hour >= 5 && hour < 12) return { text: "Good morning" };
  if (hour >= 12 && hour < 18) return { text: "Good afternoon" };
  return { text: "Good evening" };
}

/**
 * Noor's nudge about the next day in the coming 30 (template text, no AI).
 * No pronouns: there's no gender field, so Noor uses the name.
 */
export function noorNudge(
  events: DayEvent[],
  hasPeople: boolean,
  firstName: string,
): {
  text: string;
  personId: string | null;
  name: string | null;
  isYou: boolean;
  /** The day's type (null without one), so Home offers "Reserve it" on birthdays only. */
  kind: DayKind | null;
  /** The text without the little thing, for when Noor offers a wish instead. */
  base: string;
  /** Remembrance or "In memory": never a gift offer. */
  gentle: boolean;
} {
  if (!hasPeople) {
    return {
      text: "Add the first person you'd hate to forget, and I'll remind you before their day 💛",
      personId: null,
      name: null,
      isYou: false,
      kind: null,
      base: "",
      gentle: false,
    };
  }
  const next = events.find((e) => e.daysUntil < 30);
  if (!next) {
    return {
      text: "Nothing in the next 30 days. A calm stretch ☁️",
      personId: null,
      name: null,
      isYou: false,
      kind: null,
      base: "",
      gentle: false,
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
      kind: null,
      base: "",
      gentle: false,
    };
  }
  const when = next.when;
  const type = typeFor(s.kind, s.inMemory);
  const title = s.title?.trim();

  // Remembrance: quiet, no little thing (it reads like a gift idea).
  if (type.gentle) {
    const text = title
      ? `${when.charAt(0).toUpperCase()}${when.slice(1)}: ${s.name} · ${title} ${type.emoji} A kind word can mean a lot.`
      : `${possessive(s.name)} ${type.noun} is ${when} ${type.emoji}`;
    return {
      text,
      personId: s.personId,
      name: s.name,
      isYou: false,
      kind: s.kind,
      base: text,
      gentle: true,
    };
  }

  let text: string;
  if (s.kind === "birthday") {
    // "turns N" only when the birth year is known.
    text = next.detail
      ? `${s.name} ${next.detail.toLowerCase()} ${when} ${type.emoji}`
      : `It's ${possessive(s.name)} birthday ${when} ${type.emoji}`;
  } else if (s.kind === "anniversary" && next.detail) {
    text = `${s.name} celebrate ${next.detail} ${when} ${type.emoji}`;
  } else {
    text = `${occasionTitle(s.name, s.kind, title)} is ${when} ${type.emoji}`;
  }
  const base = text;
  const thing = s.littleThings[0]?.trim();
  if (thing) text += ` Little thing: ${thing}`;
  return {
    text,
    personId: s.personId,
    name: s.name,
    isYou: false,
    kind: s.kind,
    base,
    gentle: false,
  };
}

/** "turns 30 in 2 days", "birthday in 2 days", "new job today"… for the Next up card. */
export function nextUpLine(e: DayEvent): string {
  const s = e.source;
  const what =
    s.kind === "birthday" && e.detail
      ? e.detail.toLowerCase()
      : s.title?.trim().toLowerCase() || occasionType(s.kind).noun;
  return `${what} ${e.when}`;
}

/** The Next up card: the first day that isn't yours or a day of remembrance. */
export const nextUp = (events: DayEvent[]) =>
  events.find((e) => !e.source.isYou && !e.gentle) ?? null;

/**
 * Days still to celebrate this month (today included), your own day too.
 * Days of remembrance aren't counted: they're not for celebrating.
 */
export function moreThisMonth(sources: DaySource[], today: CalendarDate): number {
  let n = 0;
  for (const list of monthEvents(sources, today.year, today.month, today).values()) {
    for (const e of list) if (e.daysUntil >= 0 && !e.gentle) n++;
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
