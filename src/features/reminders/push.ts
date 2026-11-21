/**
 * Push notification wording and payload. Short, because notifications show
 * on lock screens: a name, the day and the countdown. Never an age, a
 * little thing, a wish or anything about reservations. Remembrance days use
 * the gentle wording. Pure and shared with the Edge Function (`.ts` imports).
 */
import { countdownLabel, formatFullDate } from "../../lib/dates.ts";
import { occasionTitle, typeFor } from "../occasions/types.ts";
import { ownDayLine, reminderLine } from "./copy.ts";
import type { DueReminder } from "./due.ts";

export type PushPayload = {
  title: string;
  body: string;
  /** A same-origin path the notification opens. */
  url: string;
  /** The batch id: a retried batch replaces its notification instead of adding one. */
  tag: string;
};

/** "Khalid's birthday is in 7 days 🎂", "It's Khalid's birthday today 🎂" (no age). */
export function pushTitle(r: DueReminder): string {
  if (r.day.isYou) return ownDayLine(r).headline;
  const type = typeFor(r.day.kind, r.day.inMemory);
  if (type.gentle) return reminderLine(r).headline;
  const when = countdownLabel(r.offset);
  const name = r.day.personName;
  if (r.day.kind === "birthday") {
    return r.offset === 0
      ? `It's ${name}'s birthday today ${type.emoji}`
      : `${name}'s birthday is ${when} ${type.emoji}`;
  }
  return `${occasionTitle(name, r.day.kind, r.day.title?.trim() || null)} is ${when} ${type.emoji}`;
}

/** The friend's wishlist when they're connected with free wishes, otherwise the person. */
export function pushUrl(r: DueReminder): string {
  // Your own day: a week before, your wishlist; on the day, Celebrate Me.
  if (r.day.isYou) return r.offset === 0 ? "/celebrate" : "/wishlists?list=birthday";
  if (r.day.wishlistFriendId && !typeFor(r.day.kind, r.day.inMemory).gentle) {
    return `/wishlists?tab=friends&friend=${encodeURIComponent(r.day.wishlistFriendId)}`;
  }
  return `/people?person=${encodeURIComponent(r.day.personId)}`;
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

/** One notification per person per run, like the email. */
export function pushPayload(reminders: DueReminder[], tag: string): PushPayload {
  if (reminders.length === 1) {
    const r = reminders[0]!;
    const body = r.day.isYou ? (ownDayLine(r).detail ?? "") : formatFullDate(r.occursOn);
    return { title: pushTitle(r), body, url: pushUrl(r), tag };
  }
  const names = [...new Set(reminders.map((r) => r.day.personName))];
  return {
    title: `Coming up: ${joinNames(names)}`,
    body: `${reminders.length} days to keep in mind`,
    url: "/home",
    tag,
  };
}

export const TEST_PUSH: Omit<PushPayload, "tag"> = {
  title: "Notifications are on 🕯️",
  body: "This is how your reminders will arrive.",
  url: "/settings/notifications",
};

/**
 * Known push services only: the server POSTs to a subscription's endpoint,
 * so it must never be an arbitrary URL. Same rule as public.is_push_endpoint().
 */
const PUSH_ENDPOINT_RE =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/\S+$/;

export const isPushEndpoint = (endpoint: unknown): endpoint is string =>
  typeof endpoint === "string" && endpoint.length <= 1000 && PUSH_ENDPOINT_RE.test(endpoint);
