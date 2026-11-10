/**
 * Dates for occasions (docs/data-model.md, "Dates"). Occasions are stored as
 * day + month (+ an optional year). Everything here works on plain calendar
 * dates (no times), so daylight saving and the server's own timezone never
 * shift a day. "Today" comes from the user's timezone with `todayIn`.
 *
 * 29 February falls on 28 February in years that aren't leap years.
 */

export type DayMonth = { day: number; month: number };
export type CalendarDate = { year: number; month: number; day: number };

export const DEFAULT_TIMEZONE = "Africa/Casablanca";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(month: number, year: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** A real day of the year; 29 February is allowed (it falls on the 28th otherwise). */
export function isRealDayMonth(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= (month === 2 ? 29 : daysInMonth(month, 2001));
}

/** Today's date in a timezone. An unknown timezone falls back to Casablanca. */
export function todayIn(timeZone: string | null | undefined, now: Date = new Date()): CalendarDate {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone || DEFAULT_TIMEZONE);
  } catch {
    parts = format(DEFAULT_TIMEZONE);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** The date a day + month falls on in a given year (29 Feb → 28 Feb when needed). */
export function occurrenceIn(dm: DayMonth, year: number): CalendarDate {
  return { year, month: dm.month, day: Math.min(dm.day, daysInMonth(dm.month, year)) };
}

const toUtc = (d: CalendarDate) => Date.UTC(d.year, d.month - 1, d.day);

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** The next time a day + month comes round: today if it's today. */
export function nextOccurrence(dm: DayMonth, today: CalendarDate): CalendarDate {
  const thisYear = occurrenceIn(dm, today.year);
  return daysBetween(today, thisYear) >= 0 ? thisYear : occurrenceIn(dm, today.year + 1);
}

/** Days until the next occurrence: 0 means today. */
export function daysUntil(dm: DayMonth, today: CalendarDate): number {
  return daysBetween(today, nextOccurrence(dm, today));
}

/**
 * How old someone turns (or how many years an anniversary marks) on a date,
 * from an optional starting year. Null without a year or when it isn't
 * positive (a graduation still to come, say).
 */
export function yearsOn(startYear: number | null | undefined, on: CalendarDate): number | null {
  if (startYear == null) return null;
  const years = on.year - startYear;
  return years > 0 ? years : null;
}

/**
 * "today", "tomorrow", "in 12 days" up to 45 days, then "in 2 months"
 * (as in the approved screens: "in 40 days", "in 2 months", "in 4 months").
 */
export function countdownLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 45) return `in ${days} days`;
  const months = Math.max(2, Math.round(days / 30.44));
  return `in ${months} months`;
}

/** "Fri, 6 November". */
export function formatLongDate(d: CalendarDate): string {
  const weekday = WEEKDAYS[new Date(toUtc(d)).getUTCDay()];
  return `${weekday}, ${d.day} ${MONTHS[d.month - 1]}`;
}

/** "Sun, 22 Nov". */
export function formatShortDate(d: CalendarDate): string {
  const weekday = WEEKDAYS[new Date(toUtc(d)).getUTCDay()];
  return `${weekday}, ${d.day} ${MONTHS[d.month - 1]!.slice(0, 3)}`;
}

/** "14 March" (no weekday: the same every year). */
export function formatDayMonth(dm: DayMonth): string {
  return `${dm.day} ${MONTHS[dm.month - 1]}`;
}
