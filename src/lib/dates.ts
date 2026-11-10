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

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** The hour (0–23) right now in a timezone. An unknown timezone falls back to Casablanca. */
export function hourIn(timeZone: string | null | undefined, now: Date = new Date()): number {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value;
  let hour: string | undefined;
  try {
    hour = format(timeZone || DEFAULT_TIMEZONE);
  } catch {
    hour = format(DEFAULT_TIMEZONE);
  }
  return Number(hour) % 24;
}

const fromUtc = (ms: number): CalendarDate => {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

/** The date `n` days after (or before, if negative) `d`. */
export function addDays(d: CalendarDate, n: number): CalendarDate {
  return fromUtc(toUtc(d) + n * 86_400_000);
}

/** The month `n` months after `{year, month}`. */
export function addMonths(ym: { year: number; month: number }, n: number) {
  const index = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 0 = Monday … 6 = Sunday (weeks start on Monday, as in the screens). */
export function weekdayIndex(d: CalendarDate): number {
  return (new Date(toUtc(d)).getUTCDay() + 6) % 7;
}

/** "Wednesday". */
export function weekdayName(d: CalendarDate): string {
  return WEEKDAYS_LONG[new Date(toUtc(d)).getUTCDay()]!;
}

/** "Wednesday 4 November". */
export function formatFullDate(d: CalendarDate): string {
  return `${weekdayName(d)} ${d.day} ${MONTHS[d.month - 1]}`;
}

export const sameDate = (a: CalendarDate, b: CalendarDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/** "2026-11-06", for URLs. */
export const toIsoDate = (d: CalendarDate) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/** Parses "2026-11-06"; null if it isn't a real date. */
export function fromIsoDate(value: string | null | undefined): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= daysInMonth(d.month, d.year)
    ? d
    : null;
}
