import { OCCASION_TYPES, type OccasionKind } from "@/features/occasions/types";
import {
  type CalendarDate,
  countdownLabel,
  daysBetween,
  formatShortDate,
  fromIsoDate,
} from "@/lib/dates";

/**
 * The inbox rows as my_inbox() returns them, and their words. Pure (no
 * emoji: it's app UI; no pronouns: there's no gender field). Never anything
 * about reservations: there is no such kind.
 */
export type InboxRow = {
  id: string;
  kind: "reminder" | "invite_accepted" | "wishlist_update";
  read: boolean;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  person_id: string | null;
  person_name: string | null;
  occasion_kind: string | null;
  birth_year: number | null;
  occurs_on: string | null;
  wish_count: number | null;
  plan_done: number | null;
  plan_total: number | null;
};

export type InboxItem = { id: string; read: boolean; at: string; text: string; href: string };

const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

function reminderText(r: InboxRow, today: CalendarDate): string | null {
  const on = fromIsoDate(r.occurs_on);
  const name = r.person_name;
  if (!on || !name) return null;
  const days = daysBetween(today, on);
  const when = days < 0 ? `was on ${formatShortDate(on)}` : countdownLabel(days);
  const kind = (r.occasion_kind ?? "other") as OccasionKind;
  const type = OCCASION_TYPES[kind] ?? OCCASION_TYPES.other;
  let line: string;
  if (kind === "birthday" && r.birth_year && days >= 0) {
    line = `${name} turns ${on.year - r.birth_year} ${when}.`;
  } else {
    line = `${possessive(name)} ${type.noun} ${days < 0 ? when : `is ${when}`}.`;
  }
  if (r.plan_total && r.plan_total > 0 && days >= 0) {
    line += ` Your plan is ${r.plan_done ?? 0} of ${r.plan_total} done.`;
  }
  return line;
}

/**
 * One row's text and link, or null when there's nothing to show (e.g. a
 * removed person). `linked`: the accounts already linked to one of your
 * people; someone who joined and isn't one of them yet gets the question
 * that leads to People's "Is this someone you already added?".
 */
export function inboxItem(
  r: InboxRow,
  today: CalendarDate,
  linked?: ReadonlySet<string>,
): InboxItem | null {
  const who = r.actor_name ?? "Someone";
  const friendList = r.actor_id ? `/wishlists?tab=friends&friend=${r.actor_id}` : "/wishlists";
  let text: string | null;
  let href: string;
  if (r.kind === "reminder") {
    text = reminderText(r, today);
    href = r.person_id ? `/people?person=${r.person_id}` : "/people";
  } else if (r.kind === "invite_accepted") {
    if (linked && r.actor_id && !linked.has(r.actor_id)) {
      text = `${who} joined through your link. Is this someone you already added?`;
      href = `/people?link=${r.actor_id}`;
    } else {
      text = `${who} accepted your invite. You can now see each other's wishlists.`;
      href = friendList;
    }
  } else {
    const n = r.wish_count ?? 1;
    text = `${who} added ${n} ${n === 1 ? "wish" : "wishes"} to their birthday list.`;
    href = friendList;
  }
  return text ? { id: r.id, read: r.read, at: r.at, text, href } : null;
}

/** "Today", "Yesterday", or "Sat, 21 Nov", in the viewer's time zone. */
export function whenLabel(iso: string, today: CalendarDate, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const day = fromIsoDate(parts);
  if (!day) return "";
  const diff = daysBetween(day, today);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatShortDate(day);
}
