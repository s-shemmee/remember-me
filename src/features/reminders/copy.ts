/**
 * Reminder wording, the same as in the app: names, never
 * pronouns; one emoji; Remembrance days are gentle (no "celebrate", no
 * countdown excitement, no gift prompts, no little thing, no wishlist).
 * Pure and shared with the Edge Function, so imports end in `.ts`.
 */
import { countdownLabel, formatFullDate, yearsOn } from "../../lib/dates.ts";
import { occasionTitle, typeFor } from "../occasions/types.ts";
import type { DueReminder } from "./due.ts";

export type ReminderLine = {
  /** "Khalid turns 30 in 7 days 🎂", "Grandma's day of remembrance is in 3 days 🕊️". */
  headline: string;
  /** "Friday 13 November". */
  date: string;
  /** "Little thing: black coffee", or for Remembrance "A kind word can mean a lot." */
  detail: string | null;
  gentle: boolean;
  /** Only for a connected friend with free wishes, never on Remembrance days. */
  wishlistLabel: string | null;
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Your own day ("Remind me about my own day"): a week before, "Your day is
 * in 7 days ✨" with "Time to update your wishlist?"; on the day, "Happy
 * birthday, Maya! 🎉" with "Today is all about you."
 */
export function ownDayLine(r: DueReminder): ReminderLine {
  const name = r.day.personName.trim();
  const date = formatFullDate(r.occursOn);
  if (r.offset === 0) {
    return {
      headline: `Happy birthday${name ? `, ${name}` : ""}! 🎉`,
      date,
      detail: "Today is all about you.",
      gentle: false,
      wishlistLabel: null,
    };
  }
  return {
    headline: `Your day is ${countdownLabel(r.offset)} ✨`,
    date,
    detail: "Time to update your wishlist?",
    gentle: false,
    wishlistLabel: null,
  };
}

export function reminderLine(r: DueReminder): ReminderLine {
  if (r.day.isYou) return ownDayLine(r);
  const { day, offset, occursOn } = r;
  const type = typeFor(day.kind, day.inMemory);
  const when = countdownLabel(offset);
  const name = day.personName;
  const title = day.title?.trim() || null;
  const date = formatFullDate(occursOn);

  if (type.gentle) {
    return {
      headline: title
        ? `${capitalise(when)}: ${name} · ${title} ${type.emoji}`
        : `${name}'s ${type.noun} is ${when} ${type.emoji}`,
      date,
      detail: "A kind word can mean a lot.",
      gentle: true,
      wishlistLabel: null,
    };
  }

  let headline: string;
  if (day.kind === "birthday") {
    const age = yearsOn(day.year, occursOn);
    headline = age
      ? `${name} turns ${age} ${when} ${type.emoji}`
      : offset === 0
        ? `It's ${name}'s birthday today ${type.emoji}`
        : `${name}'s birthday is ${when} ${type.emoji}`;
  } else {
    headline = `${occasionTitle(name, day.kind, title)} is ${when} ${type.emoji}`;
  }
  const thing = day.littleThing?.trim();
  return {
    headline,
    date,
    detail: thing ? `Little thing: ${thing}` : null,
    gentle: false,
    wishlistLabel: day.wishlistFriendId ? `See ${name}'s wishlist` : null,
  };
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

/** One reminder: its headline. Several: "Coming up: Khalid, Sara and 1 more". */
export function reminderSubject(reminders: DueReminder[]): string {
  if (reminders.length === 1) return reminderLine(reminders[0]!).headline;
  const names = [...new Set(reminders.map((r) => r.day.personName))];
  return `Coming up: ${joinNames(names)}`;
}

/** The inbox preview line. */
export function reminderPreview(reminders: DueReminder[]): string {
  if (reminders.length === 1) {
    const line = reminderLine(reminders[0]!);
    if (reminders[0]!.day.isYou) return line.detail ?? line.date;
    return line.gentle ? line.date : `${line.date}. I'll keep reminding you, gently.`;
  }
  return `${reminders.length} days to keep in mind, from Noor at Remember Me.`;
}
