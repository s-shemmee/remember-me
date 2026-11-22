import { countdownLabel, type CalendarDate, daysUntil, type DayMonth } from "@/lib/dates";
import type { Pastel } from "@/styles/tokens";

import { formatPrice } from "@/features/wishes/schema";

/** What a friend sees of a wish: free, reserved by you, or taken (never by whom). */
export type WishStatus = "free" | "mine" | "taken";

export type FriendWish = {
  id: string;
  title: string;
  url: string | null;
  price: number | null;
  currency: string;
  note: string | null;
  priority: "love" | "like" | "nice";
  imageUrl: string | null;
  status: WishStatus;
};

export type Friend = {
  profileId: string;
  /** Your name for them (from People when linked), else their first name. */
  name: string;
  /** Their own first name, from their account. */
  firstName?: string;
  pastel: Pastel;
  character: string | null;
  birthday: DayMonth | null;
  /** Days to their next birthday in your timezone; null when unknown. */
  daysUntil: number | null;
  linkedPersonId: string | null;
  /** The linked person in your People is "In memory": no gift counting. */
  inMemory?: boolean;
  /** A signed URL for their photo, when they have one. */
  photoUrl?: string | null;
  wishes: FriendWish[];
};

export type Notice = { id: string; text: string };

/** Friends with the soonest birthday first; unknown birthdays last, then by name. */
export function sortFriends<T extends Pick<Friend, "daysUntil" | "name">>(friends: T[]): T[] {
  return [...friends].sort(
    (a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity) || a.name.localeCompare(b.name),
  );
}

export function friendDaysUntil(birthday: DayMonth | null, today: CalendarDate): number | null {
  return birthday ? daysUntil(birthday, today) : null;
}

/** "Birthday in 2 days", "Birthday today", "Birthday in 4 months". */
export function birthdayLine(days: number | null): string {
  if (days === null) return "No birthday shared";
  return `Birthday ${countdownLabel(days)}`;
}

/** Noor's line above a friend's wishes (AppWishlists). */
export function friendSays(friend: Pick<Friend, "name" | "wishes">): string {
  if (!friend.wishes.length) {
    return `${friend.name} hasn't added any wishes yet. I'll show them here when they do 💛`;
  }
  const mine = friend.wishes.filter((w) => w.status === "mine").length;
  return mine
    ? `Nice, you have ${mine} ${mine === 1 ? "gift" : "gifts"} reserved for ${friend.name}. ${friend.name} will never know it was you 🤫`
    : `Nothing reserved for ${friend.name} yet. Pick something and I'll keep it secret 🤫`;
}

const PRIORITY_RANK = { love: 0, like: 1, nice: 2 } as const;

/** The wish Noor offers on Home: the first free "Love it", else the first free one. */
export function pickNudgeWish(wishes: FriendWish[]): FriendWish | null {
  const free = wishes.filter((w) => w.status === "free");
  if (!free.length) return null;
  return free.reduce((best, w) =>
    PRIORITY_RANK[w.priority] < PRIORITY_RANK[best.priority] ? w : best,
  );
}

/** "The match ball (350 MAD) on Khalid's wishlist is still free. Want me to reserve it for you?" */
export function nudgeWishLine(
  wish: Pick<FriendWish, "title" | "price" | "currency">,
  name: string,
) {
  const price = formatPrice(wish.price, wish.currency);
  return `The ${wish.title}${price ? ` (${price})` : ""} on ${name}'s wishlist is still free. Want me to reserve it for you?`;
}

/** "Khalid", "Khalid & Yasmine", "Khalid, Sara & Yasmine", "Khalid, Sara & 2 more". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
  return `${names.slice(0, 2).join(", ")} & ${names.length - 2} more`;
}

/** Home's "Gifts sorted": friends with a birthday in the next 30 days and wishes. */
export const GIFTS_WINDOW_DAYS = 30;

export function giftsSorted(friends: Friend[]): { value: string; line: string } {
  const soon = sortFriends(
    friends.filter(
      (f) =>
        f.daysUntil !== null &&
        f.daysUntil <= GIFTS_WINDOW_DAYS &&
        f.wishes.length > 0 &&
        !f.inMemory,
    ),
  );
  if (!friends.length) return { value: "None yet", line: "connect with your people" };
  if (!soon.length) return { value: "All calm", line: "no wishlist birthdays in 30 days" };
  const sorted = soon.filter((f) => f.wishes.some((w) => w.status === "mine"));
  if (!sorted.length) {
    return {
      value: `0 of ${soon.length}`,
      line: `${soon.length === 1 ? "birthday" : "birthdays"} soon with a wishlist`,
    };
  }
  return {
    value: `${sorted.length} of ${soon.length}`,
    line: `reserved, for ${joinNames(sorted.map((f) => f.name))}`,
  };
}

/** Server error codes from reserve_wish(), as words. */
export function reserveErrorMessage(code: "taken" | "not_found" | "oops"): string {
  switch (code) {
    case "taken":
      return "Just taken by someone else";
    case "not_found":
      return "That wish isn't there any more.";
    default:
      return "Something went wrong on our side. Please try again.";
  }
}

export const noticeText = (actorName: string) => `${actorName} removed a wish you'd reserved`;
