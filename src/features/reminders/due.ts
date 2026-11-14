/**
 * Which reminders are due right now (docs/decisions.md, "Email reminders").
 *
 * Pure: no I/O, no clock of its own. Shared by the app (Vitest) and the
 * send-reminders Edge Function (Deno), so imports are relative with `.ts`.
 *
 * A reminder is due once the user's local wall clock reaches their send
 * time (09:00) on the day `offset` days before an occurrence. A run that
 * misses 9:00 still sends later that local day; the next local day it's no
 * longer due (that offset has passed). Keys already logged are skipped.
 */
import {
  addDays,
  type CalendarDate,
  DEFAULT_TIMEZONE,
  minutesIn,
  occurrenceIn,
  sameDate,
  todayIn,
  toIsoDate,
} from "../../lib/dates.ts";

/** Offsets a user can pick: two weeks, a week, three days, the day before, the morning of. */
export const REMINDER_OFFSETS = [14, 7, 3, 1, 0] as const;
export const DEFAULT_SEND_TIME = "09:00";

export type Channel = "email" | "push";

export type ReminderUser = {
  profileId: string;
  email: string;
  firstName: string;
  timezone: string | null;
  offsets: number[];
  /** "HH:MM" (Postgres `time` may add ":SS"). */
  sendTime: string;
  emailOn: boolean;
  /** Push on and at least one device. */
  pushOn: boolean;
};

export type ReminderDay = {
  occasionId: string;
  personId: string;
  personName: string;
  personColor: string;
  kind: string;
  title: string | null;
  day: number;
  month: number;
  year: number | null;
  recurring: boolean;
  littleThing: string | null;
  archived: boolean;
  /** Set when the person is a connected friend with at least one free wish. */
  wishlistFriendId: string | null;
};

export type DueReminder = {
  /** `${occasionId}|${offset}|${occursOn}`: the notification_log key (with user and channel). */
  key: string;
  offset: number;
  occursOn: CalendarDate;
  day: ReminderDay;
};

export const reminderKey = (occasionId: string, offset: number, occursOn: CalendarDate | string) =>
  `${occasionId}|${offset}|${typeof occursOn === "string" ? occursOn : toIsoDate(occursOn)}`;

/** "09:00" or "09:00:00" → 540. Anything unreadable → 09:00. */
export function sendMinutes(sendTime: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(sendTime ?? "");
  if (!m) return 9 * 60;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : 9 * 60;
}

/**
 * Whether a day falls on `date`. Yearly days repeat every year (29 February
 * falls on 28 February in other years); a day that happens once only falls
 * in its own year.
 */
export function occursOn(
  day: Pick<ReminderDay, "day" | "month" | "year" | "recurring">,
  date: CalendarDate,
) {
  if (!day.recurring) {
    return day.year != null && sameDate({ year: day.year, month: day.month, day: day.day }, date);
  }
  return sameDate(occurrenceIn({ day: day.day, month: day.month }, date.year), date);
}

export function dueReminders({
  now,
  user,
  days,
  sent,
  channel = "email",
}: {
  now: Date;
  user: ReminderUser;
  days: ReminderDay[];
  /** Keys already in notification_log for this user and channel (any status). */
  sent: ReadonlySet<string>;
  /** Which channel this is for (default email): off means nothing is due. */
  channel?: Channel;
}): DueReminder[] {
  const on = channel === "push" ? user.pushOn : user.emailOn;
  if (!on || !user.offsets.length) return [];
  const zone = user.timezone || DEFAULT_TIMEZONE;
  if (minutesIn(zone, now) < sendMinutes(user.sendTime)) return [];
  const today = todayIn(zone, now);
  const offsets = [...new Set(user.offsets)]
    .filter((o) => (REMINDER_OFFSETS as readonly number[]).includes(o))
    .sort((a, b) => a - b);

  const due: DueReminder[] = [];
  for (const day of days) {
    if (day.archived) continue;
    for (const offset of offsets) {
      const on = addDays(today, offset);
      if (!occursOn(day, on)) continue;
      const key = reminderKey(day.occasionId, offset, on);
      if (sent.has(key)) continue;
      due.push({ key, offset, occursOn: on, day });
    }
  }
  // Soonest first, then by name.
  return due.sort(
    (a, b) => a.offset - b.offset || a.day.personName.localeCompare(b.day.personName),
  );
}
